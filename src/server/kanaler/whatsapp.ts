// Webhook for inngående WhatsApp (WhatsApp Business Platform / Cloud API, standard Meta-format).
//
// - GET: Metas verifisering. `hub.mode=subscribe` og `hub.verify_token` lik WHATSAPP_VERIFY_TOKEN gir
//   `hub.challenge` tilbake; alt annet gir 403.
// - POST: `X-Hub-Signature-256: sha256=<hex>` er HMAC-SHA256 av den rå kroppen med WHATSAPP_APP_SECRET.
//   Feil eller manglende signatur gir 401. Uten hemmelighet avvises alt med 503 (fail closed).
// - Inngående meldinger varsles til Eirik og besvares ALDRI automatisk: modulen bruker ingen `Kanal`.
//   Eirik svarer selv i WhatsApp Business-appen (coexistence). Statusoppdateringer, reaksjoner og
//   systemmeldinger ignoreres. Kroppen er begrenset til 64 KB (413).
// - Svaret til Meta kommer straks; varselet sendes i `waitUntil`.
//
// Utgående WhatsApp (godkjente maler) kommer som en `Kanal` når leverandøroppsettet er avgjort (oppgave 10).
import type { Env, Kontekst } from '../env';
import { verifiserHmacHex } from '../hmac';
import { forStor, lesBegrensetKropp } from '../kropp';
import { varsleEirik, type Varsler } from '../varsling';

export interface WhatsappDeps {
  varsler?: Varsler;
}

export interface InngaaendeMelding {
  /** Avsenderen i E.164 (+47...). */
  fra: string;
  navn?: string;
  type: string;
  tekst?: string;
}

const MAKS_TEKST = 2000;
/** Reaksjoner (emoji på en melding) og systemmeldinger (f.eks. nummerbytte) gir ikke varsel. */
const IGNORERTE_TYPER = new Set(['reaction', 'system']);

const koder = new TextEncoder();

/** Sammenligner i konstant tid: begge hashes med SHA-256, så lengden lekker heller ikke. */
async function likeKonstantTid(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([a, b].map((t) => crypto.subtle.digest('SHA-256', koder.encode(t))));
  const ux = new Uint8Array(x);
  const uy = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < ux.length; i++) diff |= ux[i] ^ uy[i];
  return diff === 0;
}

export async function haandterWhatsappGet(url: URL, env: Pick<Env, 'WHATSAPP_VERIFY_TOKEN'>): Promise<Response> {
  const p = url.searchParams;
  const forventet = env.WHATSAPP_VERIFY_TOKEN;
  const mottatt = p.get('hub.verify_token');
  if (forventet && mottatt !== null && p.get('hub.mode') === 'subscribe' && (await likeKonstantTid(mottatt, forventet))) {
    return new Response(p.get('hub.challenge') ?? '', { status: 200, headers: { 'content-type': 'text/plain' } });
  }
  return new Response('Forbidden', { status: 403 });
}

/** Sjekker `X-Hub-Signature-256` (`sha256=<hex>`) mot de rå bytene. Kaster aldri. */
export async function verifiserMetaSignatur(raw: ArrayBuffer, header: string | null, hemmelighet: string): Promise<boolean> {
  if (!header?.startsWith('sha256=')) return false;
  return verifiserHmacHex(raw, header.slice('sha256='.length), hemmelighet);
}

const erObjekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const liste = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const tekstEllerUndefined = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

/** Henter inngående meldinger fra en Meta-webhook. Ukjente eller ufullstendige deler hoppes over. */
export function tolkInngaaende(kropp: unknown): InngaaendeMelding[] {
  const ut: InngaaendeMelding[] = [];
  if (!erObjekt(kropp)) return ut;
  for (const entry of liste(kropp.entry)) {
    if (!erObjekt(entry)) continue;
    for (const change of liste(entry.changes)) {
      if (!erObjekt(change) || (change.field !== undefined && change.field !== 'messages')) continue;
      const value = change.value;
      if (!erObjekt(value)) continue;
      const navn = new Map<string, string>();
      for (const c of liste(value.contacts)) {
        if (erObjekt(c) && typeof c.wa_id === 'string' && erObjekt(c.profile) && typeof c.profile.name === 'string') {
          navn.set(c.wa_id, c.profile.name);
        }
      }
      for (const m of liste(value.messages)) {
        if (!erObjekt(m) || typeof m.from !== 'string' || !/^\d{6,15}$/.test(m.from)) continue;
        const type = typeof m.type === 'string' ? m.type : 'ukjent';
        if (IGNORERTE_TYPER.has(type)) continue;
        const innhold = erObjekt(m[type]) ? (m[type] as Record<string, unknown>) : {};
        const tekst = tekstEllerUndefined(innhold.body) ?? tekstEllerUndefined(innhold.text) ?? tekstEllerUndefined(innhold.caption);
        ut.push({ fra: `+${m.from}`, navn: navn.get(m.from), type, tekst: tekst?.slice(0, MAKS_TEKST) });
      }
    }
  }
  return ut;
}

function varselFor(m: InngaaendeMelding): { emne: string; tekst: string } {
  const hvem = m.navn ? `${m.navn} (${m.fra})` : m.fra;
  return {
    emne: `WhatsApp fra ${m.fra}`,
    tekst: [
      `Ny WhatsApp-melding fra ${hvem}.`,
      `Type: ${m.type}`,
      m.tekst ? `\n${m.tekst}\n` : '(Ingen tekst. Se meldingen i WhatsApp Business-appen.)',
      'Systemet svarer ikke automatisk. Svar i WhatsApp Business-appen.',
    ].join('\n'),
  };
}

export async function haandterWhatsappPost(
  request: Request,
  env: Pick<Env, 'WHATSAPP_APP_SECRET' | 'EPOST' | 'VARSEL_TIL' | 'VARSEL_FRA'>,
  ctx: Kontekst,
  deps: WhatsappDeps = {},
): Promise<Response> {
  const hemmelighet = env.WHATSAPP_APP_SECRET;
  if (!hemmelighet) {
    console.error(JSON.stringify({ hendelse: 'whatsapp_webhook_ikke_konfigurert' }));
    return new Response('Not configured', { status: 503 });
  }
  // Kroppen leses én gang (maks 64 KB); signaturen gjelder de nøyaktige bytene.
  const raw = await lesBegrensetKropp(request);
  if (!raw) return forStor();
  if (!(await verifiserMetaSignatur(raw, request.headers.get('x-hub-signature-256'), hemmelighet))) {
    return new Response('Unauthorized', { status: 401 });
  }
  let kropp: unknown;
  try {
    kropp = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return new Response('Bad Request', { status: 400 });
  }
  for (const m of tolkInngaaende(kropp)) {
    const { emne, tekst } = varselFor(m);
    ctx.waitUntil(varsleEirik(env, deps.varsler, emne, tekst, 'whatsapp_inn'));
  }
  return new Response('ok', { status: 200 });
}
