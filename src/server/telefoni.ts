// Ubesvarte anrop (spesifikasjonen, «Tapte anrop»). Telefonitjenesten kaller
// POST /api/telefoni/ubesvart når et anrop til bedriftsnummeret ikke blir besvart.
//
// Flyt:
// 1. Kroppen leses én gang som bytes og verifiseres (`TelefoniVerifiserer`). Standard er
//    HMAC-SHA256 av kroppen med TELEFONI_WEBHOOK_SECRET, hex i `X-Signatur`. Feil gir 401;
//    uten hemmelighet avvises alt med 503.
// 2. `TelefoniAdapter` tolker kroppen. Standard er `{ fra: E.164, tidspunkt? }`. Leverandørspesifikke
//    adaptere kommer når leverandøren er valgt (oppgave 10).
// 3. Skjult eller ugyldig nummer: ingen melding, bare varsel til Eirik.
// 4. Ellers: én atomisk, betinget INSERT i `anrop` sørger for at samme nummer bare får én melding
//    per 30 minutter, også når to webhooker kommer samtidig. Bare den som fikk satt inn raden, sender
//    den faste malen `tapt_anrop` (WhatsApp → RCS → SMS) med lenke til skjemaet og til WhatsApp.
// 5. Eirik varsles om hvert tapte anrop, også de som ikke utløser ny melding.
// Svaret til leverandøren kommer straks; sending og varsel skjer i `waitUntil`. Ingen AI er involvert.
import firmaJson from '../content/firma/firma.json';
import nbJson from '../content/tekster/nb.json';
import { firmaSchema } from '../lib/firma';
import { tekstSchema } from '../lib/innhold';
import { fyllHilsen, waLenke } from '../lib/whatsapp';
import type { Env, Kontekst } from './env';
import { verifiserHmacHex } from './hmac';
import { lagKanaler, sendMedReserve, type Kanal, type SendResultat } from './kanaler/index';
import { varsleEirik, type Varsler } from './varsling';

export const DEDUPE_MS = 30 * 60 * 1000;
export const KILDE = 'tapt-anrop';
const STANDARD_NETTSTED = 'https://kobberogkran.no';

export interface TelefoniVerifiserer {
  verifiser(headers: Headers, raw: ArrayBuffer): Promise<boolean>;
}

/** Standard: HMAC-SHA256 av kroppen, hex i en header (standard `X-Signatur`), konstant tid. */
export class HmacTelefoniVerifiserer implements TelefoniVerifiserer {
  constructor(
    private readonly hemmelighet: string,
    private readonly header = 'x-signatur',
  ) {}

  async verifiser(headers: Headers, raw: ArrayBuffer): Promise<boolean> {
    const sig = headers.get(this.header);
    return !!sig && verifiserHmacHex(raw, sig, this.hemmelighet);
  }
}

export interface UbesvartAnrop {
  /** E.164, eller null når nummeret er skjult eller ugyldig. */
  fra: string | null;
  /** Leverandørens tidspunkt, bare til informasjon i varselet. */
  tidspunkt?: string;
}

export interface TelefoniAdapter {
  /** null når kroppen ikke har riktig form (gir 400). */
  tolk(json: unknown): UbesvartAnrop | null;
}

const E164 = /^\+[1-9]\d{6,14}$/;

/** Standardformatet `{ fra: string (E.164), tidspunkt?: string }`. */
export class StandardTelefoniAdapter implements TelefoniAdapter {
  tolk(json: unknown): UbesvartAnrop | null {
    if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
    const { fra, tidspunkt } = json as Record<string, unknown>;
    const renset = typeof fra === 'string' ? fra.replace(/[\s\-()]/g, '') : '';
    const ut: UbesvartAnrop = { fra: E164.test(renset) ? renset : null };
    if (typeof tidspunkt === 'string' && tidspunkt) ut.tidspunkt = tidspunkt.slice(0, 64);
    return ut;
  }
}

export interface TelefoniDeps {
  kanaler?: Kanal[];
  varsler?: Varsler;
  verifiserer?: TelefoniVerifiserer;
  adapter?: TelefoniAdapter;
  naa?: () => Date;
}

/** Lenkene i malen `tapt_anrop`: skjemaet med `?kilde=tapt-anrop`, og wa.me med ferdig hilsen. */
export function taptAnropVariabler(nettstedUrl: string | undefined): Record<string, string> {
  const base = (nettstedUrl || STANDARD_NETTSTED).replace(/\/+$/, '');
  const firma = firmaSchema.parse(firmaJson.firma);
  const hilsen = fyllHilsen(tekstSchema.parse(nbJson).whatsappHilsen, { kilde: KILDE });
  return {
    skjemaLenke: `${base}/?kilde=${KILDE}#skjema`,
    whatsappLenke: waLenke(firma.whatsapp.verdi, hilsen),
  };
}

/**
 * Setter inn en rad for nummeret hvis det ikke finnes en innen de siste 30 minuttene. Én SQL-setning,
 * så D1 utfører sjekk og innsetting atomisk: av to samtidige kall får bare ett satt inn raden.
 * Returnerer radens id når denne kjøringen skal sende, ellers null.
 */
async function reserverMelding(db: Env['DB'], fra: string, naa: Date): Promise<string | null> {
  const id = crypto.randomUUID();
  const grense = new Date(naa.getTime() - DEDUPE_MS).toISOString();
  const r = await db
    .prepare(
      `INSERT INTO anrop (id, fra, opprettet, melding_kanal)
       SELECT ?, ?, ?, NULL
        WHERE NOT EXISTS (SELECT 1 FROM anrop WHERE fra = ? AND opprettet > ?)`,
    )
    .bind(id, fra, naa.toISOString(), fra, grense)
    .run();
  return r.meta.changes === 1 ? id : null;
}

function beskrivSending(r: SendResultat | null): string {
  if (!r) return 'Ingen ny melding: nummeret fikk melding for under 30 minutter siden.';
  if (r.kanal) return `Fast melding sendt på ${r.kanal}.`;
  if (r.forsok.length === 0) return 'Melding ikke sendt: ingen meldingskanal er satt opp ennå.';
  return `Melding ikke sendt: alle kanalene feilet (${r.forsok.map((f) => `${f.kanal}: ${f.feil ?? 'feil'}`).join('; ')}).`;
}

export async function haandterUbesvartAnrop(
  request: Request,
  env: Env,
  ctx: Kontekst,
  deps: TelefoniDeps = {},
): Promise<Response> {
  const hemmelighet = env.TELEFONI_WEBHOOK_SECRET;
  const verifiserer = deps.verifiserer ?? (hemmelighet ? new HmacTelefoniVerifiserer(hemmelighet) : null);
  if (!verifiserer) {
    console.error(JSON.stringify({ hendelse: 'telefoni_webhook_ikke_konfigurert' }));
    return new Response('Not configured', { status: 503 });
  }
  // Kroppen leses én gang; signaturen gjelder de nøyaktige bytene.
  const raw = await request.arrayBuffer();
  if (!(await verifiserer.verifiser(request.headers, raw))) return new Response('Unauthorized', { status: 401 });

  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return new Response('Bad Request', { status: 400 });
  }
  const anrop = (deps.adapter ?? new StandardTelefoniAdapter()).tolk(json);
  if (!anrop) return new Response('Bad Request', { status: 400 });

  const naa = (deps.naa ?? (() => new Date()))();
  const tid = anrop.tidspunkt ?? naa.toISOString();

  if (!anrop.fra) {
    ctx.waitUntil(
      varsleEirik(
        env,
        deps.varsler,
        'Tapt anrop fra skjult nummer',
        `Tapt anrop fra skjult eller ukjent nummer (${tid}).\nIngen melding er sendt, fordi nummeret ikke er kjent.`,
        'tapt_anrop',
      ),
    );
    return new Response('ok', { status: 200 });
  }

  const fra = anrop.fra;
  const radId = await reserverMelding(env.DB, fra, naa);
  ctx.waitUntil(
    (async () => {
      // Eirik skal varsles uansett hva som skjer med meldingen til innringeren.
      let resultat: SendResultat | null = null;
      if (radId) {
        try {
          resultat = await sendMedReserve(deps.kanaler ?? lagKanaler(env), fra, {
            id: 'tapt_anrop',
            variabler: taptAnropVariabler(env.NETTSTED_URL),
          });
          if (resultat.kanal) {
            await env.DB.prepare('UPDATE anrop SET melding_kanal = ? WHERE id = ?').bind(resultat.kanal, radId).run();
          }
        } catch (e) {
          console.error(JSON.stringify({ hendelse: 'tapt_anrop_feilet', feil: String(e).slice(0, 300) }));
          resultat ??= { kanal: null, forsok: [] };
        }
      }
      await varsleEirik(
        env,
        deps.varsler,
        `Tapt anrop fra ${fra}`,
        `Tapt anrop fra ${fra} (${tid}).\n${beskrivSending(resultat)}`,
        'tapt_anrop',
      );
    })(),
  );
  return new Response('ok', { status: 200 });
}
