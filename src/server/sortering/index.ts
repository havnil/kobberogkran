// Sortering og varsel til Eirik. Kalles fra API-et i `ctx.waitUntil` (oppgave 7) og kaster aldri.
//
// Statusflyt: ny → sortert (AI og regler er kjørt) → varslet (e-post sendt).
// - Hvert kall tar først en atomisk lås (`laasForVarsel`, lån på 2 min). Samtidige kall som ikke
//   får låsen, gjør ingenting, så to parallelle kall gir nøyaktig én sending. Låsen frigis til slutt
//   med eierskapssjekk (token); krasjer kjøringen, utløper lånet, og et senere kall kan fortsette.
// - Feiler AI-en (eller mangler ANTHROPIC_API_KEY), sendes varselet likevel med bare regler og rådata.
// - Feiler varselet, blir status stående på 'sortert' og hendelsen 'varsel_feil' logges.
//   Et nytt kall sender da på nytt, uten å kalle AI-en igjen (forrige sortering gjenbrukes).
// - En forespørsel som allerede er 'varslet' eller 'lukket', varsles aldri igjen.
import type { D1Database } from '@cloudflare/workers-types';
import {
  frigiVarselLaas,
  hentForesporsel,
  hentSamtykker,
  laasForVarsel,
  loggHendelse,
  settStatus,
  sisteHendelseRad,
  type Foresporsel,
  type Samtykker,
  type SvarJson,
} from '../db';
import type { Env } from '../env';
import { signerBildeLenke } from '../bildelenke';
import { nettstedUrl } from '../../lib/nettsted';
import { EpostVarsler, type Varsler } from '../varsling';
import { formatKr } from '../../lib/priser';
import { ClaudeSorterer, sorteringSchema, type Sortering, type Sorterer } from './ai';
import { kjoretidMin, regelsjekk, type Regelsjekk } from './regler';

export interface SorterOgVarsleDeps {
  sorterer?: Sorterer;
  varsler?: Varsler;
  naa?: () => Date;
  /**
   * Kvitteringen til kunden (fra API-et), som går samtidig med AI-en. Varselet venter på den før
   * sending, så hendelsene for en kvittering som ikke kom fram, er logget og kan vises for Eirik.
   */
  kvittering?: Promise<unknown>;
}

export const BILDELENKE_GYLDIG_SEK = 14 * 24 * 60 * 60;
const EMNE_STED_MAKS = 60;
export const UTKAST_MERKE = 'Utkast – sendes ikke automatisk';

const feiltekst = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 500);

async function forrigeSortering(db: D1Database, id: string): Promise<Sortering | null> {
  const rad = await db
    .prepare(
      `SELECT type, data_json FROM hendelser
        WHERE foresporsel_id = ? AND type IN ('sortering_ok', 'sortering_feil')
        ORDER BY opprettet DESC, rowid DESC LIMIT 1`,
    )
    .bind(id)
    .first<{ type: string; data_json: string | null }>();
  if (rad?.type !== 'sortering_ok' || !rad.data_json) return null;
  try {
    const tolket = sorteringSchema.safeParse(JSON.parse(rad.data_json));
    return tolket.success ? tolket.data : null;
  } catch {
    return null;
  }
}

export async function sorterOgVarsle(env: Env, id: string, deps: SorterOgVarsleDeps = {}): Promise<void> {
  const naa = deps.naa ?? (() => new Date());
  let laas: string | null = null;
  try {
    laas = await laasForVarsel(env.DB, id, naa());
    if (!laas) return; // varslet, lukket, ukjent id, eller en annen kjøring holder låsen
    // Alt som er logget før lesingen, er med i varselet. Tillegg (bilder og steg 2) som logges
    // etterpå, sendes som eget tillegg (se ../tillegg.ts). Leses før forespørselen, så et tillegg
    // heller kommer med to ganger enn ingen.
    const dekket = await sisteHendelseRad(env.DB);
    // Les etter at låsen er tatt, så status er den gjeldende.
    const f = await hentForesporsel(env.DB, id);
    if (!f || f.status === 'varslet' || f.status === 'lukket') return;

    const regler = regelsjekk(f);

    let ai: Sortering | null;
    if (f.status === 'sortert') {
      ai = await forrigeSortering(env.DB, id);
    } else {
      const sorterer = deps.sorterer ?? new ClaudeSorterer(env.ANTHROPIC_API_KEY);
      try {
        ai = await sorterer.sorter(f, regler);
      } catch (e) {
        ai = null;
        await loggTrygt(env.DB, id, 'sortering_feil', { feil: feiltekst(e) });
      }
      // Feiler loggingen, brukes AI-svaret likevel i varselet.
      if (ai) await loggTrygt(env.DB, id, 'sortering_ok', ai);
      await settStatus(env.DB, id, 'sortert');
    }

    // Samtykker leses rett før sendingen (etter AI-en): WhatsApp-samtykket som nettleseren sender
    // rett etter steg 1, kommer da med her i stedet for som eget tillegg. `samtykkeDekket` markerer
    // hvilke samtykke-tillegg varselet har tatt med (se ../tillegg.ts).
    let samtykkeDekket = dekket;
    let samtykker: Samtykker = {};
    let kvittering: KvitteringStatus = null;
    if (deps.kvittering) await deps.kvittering.catch(() => {});
    try {
      samtykkeDekket = await sisteHendelseRad(env.DB);
      samtykker = await hentSamtykker(env.DB, id);
      kvittering = await kvitteringStatus(env.DB, id);
    } catch (e) {
      samtykkeDekket = dekket;
      console.error('hentSamtykker feilet', id, feiltekst(e));
    }

    try {
      const til = env.VARSEL_TIL;
      const varsler = deps.varsler ?? (env.VARSEL_FRA ? new EpostVarsler(env.EPOST, env.VARSEL_FRA) : null);
      if (!til || !varsler) throw new Error('VARSEL_TIL eller VARSEL_FRA er ikke satt');
      const lenker = await bildelenker(env, f, naa());
      await varsler.send(til, lagEmne(f, ai), lagVarselTekst(f, regler, ai, lenker, samtykker, kvittering));
    } catch (e) {
      await loggTrygt(env.DB, id, 'varsel_feil', { kanal: 'epost', feil: feiltekst(e) });
      return;
    }
    // Sendt: sett status først, så en feil i loggingen ikke fører til ny sending.
    await settStatus(env.DB, id, 'varslet');
    await loggTrygt(env.DB, id, 'varsel_ok', { kanal: 'epost', dekket, samtykkeDekket });
  } catch (e) {
    // Aldri kast ut av waitUntil. Forespørselen er lagret; status 'ny'/'sortert' viser at varselet mangler.
    console.error('sorterOgVarsle feilet', id, feiltekst(e));
  } finally {
    if (laas) await frigiVarselLaas(env.DB, id, laas).catch((e) => console.error('frigiVarselLaas feilet', id, feiltekst(e)));
  }
}

/** Hvorfor kunden ikke fikk kvitteringen, eller null når ingen feil er logget. */
export type KvitteringStatus = 'ingen_kanal' | 'feilet' | null;

async function kvitteringStatus(db: D1Database, id: string): Promise<KvitteringStatus> {
  const rad = await db
    .prepare(
      `SELECT type FROM hendelser
        WHERE foresporsel_id = ? AND type IN ('melding_ingen_kanal', 'melding_feilet')
          AND json_extract(data_json, '$.mal') = 'kvittering'
        ORDER BY rowid DESC LIMIT 1`,
    )
    .bind(id)
    .first<{ type: string }>();
  if (!rad) return null;
  return rad.type === 'melding_ingen_kanal' ? 'ingen_kanal' : 'feilet';
}

/** Logger en hendelse uten å kaste; en feil i loggingen skal ikke stoppe varselet. */
export async function loggTrygt(db: D1Database, id: string, type: string, data: unknown): Promise<void> {
  try {
    await loggHendelse(db, id, type, data);
  } catch (e) {
    console.error('loggHendelse feilet', id, type, feiltekst(e));
  }
}

async function bildelenker(env: Env, f: Foresporsel, naa: Date): Promise<string[]> {
  if (!env.SKJEMA_HMAC || f.bilder.length === 0) return [];
  const base = nettstedUrl(env);
  const utloper = Math.floor(naa.getTime() / 1000) + BILDELENKE_GYLDIG_SEK;
  return Promise.all(f.bilder.map(async (b) => base + (await signerBildeLenke(b.id, env.SKJEMA_HMAC!, utloper))));
}

/**
 * AKUTT når kunden har valgt «Det lekker nå» (`lekker-naa`) eller AI-en mener det er akutt.
 * AI-en kan bare oppgradere; den kan aldri nedgradere kundens eget valg, og uten AI gjelder kundens.
 */
export function erAkutt(f: Pick<Foresporsel, 'hast'>, ai: Sortering | null): boolean {
  return f.hast === 'lekker-naa' || ai?.hast === 'akutt';
}

export function lagEmne(f: Foresporsel, ai: Sortering | null): string {
  const helt = f.stedTekst?.replace(/\s+/g, ' ').trim() || 'ukjent sted';
  const sted = [...helt].length > EMNE_STED_MAKS ? `${[...helt].slice(0, EMNE_STED_MAKS - 1).join('')}…` : helt;
  return `${erAkutt(f, ai) ? 'AKUTT – ' : ''}Ny forespørsel: ${f.tjeneste} – ${sted}`;
}

const liste = (xs: string[], tom: string) => (xs.length ? xs.join(', ') : tom);

/** «Mottatt»-tidspunktet i norsk tid (Europe/Oslo), f.eks. «12.11.2026 kl. 11:00». */
export function formatMottatt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const deler = Object.fromEntries(
    new Intl.DateTimeFormat('nb-NO', {
      timeZone: 'Europe/Oslo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return `${deler.day}.${deler.month}.${deler.year} kl. ${deler.hour}:${deler.minute}`;
}

/** Seksjonen REGELSJEKK (brukes i varselet og i tillegg). */
export function regelLinjer(regler: Regelsjekk): string[] {
  const pris = regler.prisanslag
    ? `${formatKr(regler.prisanslag.fra, 'nb')}–${formatKr(regler.prisanslag.til, 'nb')} inkl. mva, pluss deler`
    : 'ingen (ikke i prislisten)';
  return [
    'REGELSJEKK',
    `Røde flagg: ${liste(regler.rodeFlagg, 'ingen')}`,
    `Jobber vi ikke tar: ${liste(regler.ikkeVaarJobb, 'ingen')}`,
    `Mangler: ${liste(regler.mangler, 'ingenting')}`,
    `Prisanslag fra prislisten: ${pris}`,
    '',
  ];
}

/** AI-sammendrag og svarutkast, eller en linje om at AI-en ikke ga noe. */
export function aiLinjer(ai: Sortering | null): string[] {
  if (!ai) return ['AI-sortering feilet eller er ikke satt opp. Varselet har bare reglene og rådata.', ''];
  return ['AI-SAMMENDRAG', `Hast (AI): ${ai.hast}`, ai.sammendrag, '', `SVARUTKAST (${UTKAST_MERKE})`, ai.svarutkast, ''];
}

const SVARNAVN: Record<string, string> = {
  felles: 'Felles',
  tjenesteSvar: 'Om tjenesten',
  hvorHorte: 'Hvor de hørte om oss',
  bildeMerker: 'Bildene viser',
};

const verdi = (v: unknown): string =>
  Array.isArray(v) ? v.map(verdi).join(', ') : v && typeof v === 'object' ? JSON.stringify(v) : String(v);

/** Svarene fra steg 2 som lesbare linjer (ikke rå JSON). */
export function svarLinjer(svar: SvarJson | null): string[] {
  const l: string[] = [];
  for (const [k, v] of Object.entries(svar ?? {})) {
    const navn = SVARNAVN[k] ?? k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const par = Object.entries(v as Record<string, unknown>);
      if (!par.length) continue;
      l.push(`${navn}:`);
      for (const [nk, nv] of par) l.push(`  ${nk}: ${verdi(nv)}`);
    } else if (v !== undefined && v !== null && v !== '') {
      l.push(`${navn}: ${verdi(v)}`);
    }
  }
  return l.length ? l : ['(steg 2 ikke fylt ut)'];
}

/** Samtykkene kunden har gitt (siste valg per type). */
export function samtykkeLinjer(s: Samtykker): string[] {
  const typer = Object.keys(s) as (keyof Samtykker)[];
  if (!typer.length) return ['SAMTYKKER', '(ingen)', ''];
  return ['SAMTYKKER', ...typer.map((t) => `${t}: ${s[t] ? 'ja' : 'nei'}`), ''];
}

/** Fast mal for varselet til Eirik. Bare for Eiriks øyne; sendes aldri til kunden. */
export function lagVarselTekst(
  f: Foresporsel,
  regler: Regelsjekk,
  ai: Sortering | null,
  lenker: string[],
  samtykker: Samtykker = {},
  kvittering: KvitteringStatus = null,
): string {
  const kjoretid = f.kjoretidMin ?? kjoretidMin(f.lat, f.lon);
  const utenfor = regler.utenforOmrade == null ? 'ukjent' : regler.utenforOmrade ? 'JA' : 'nei';

  const l: string[] = [];
  l.push('NY FORESPØRSEL – bare for Eirik, sendes ikke til kunden', '');
  l.push('KUNDE');
  l.push(`Navn: ${f.kunde.navn ?? '(ikke oppgitt)'}`);
  l.push(`Telefon: ${f.kunde.telefon}`);
  l.push(`E-post: ${f.kunde.epost ?? '(ikke oppgitt)'}`);
  if (kvittering === 'ingen_kanal') l.push('Kunden fikk IKKE kvittering (ingen kanal satt opp)');
  if (kvittering === 'feilet') l.push('Kunden fikk IKKE kvittering (alle kanalene feilet)');
  if (f.kundetype === 'bedrift') {
    l.push(`Bedrift: ${f.firmanavn ?? '(ikke oppgitt)'}, org.nr. ${f.orgnr ?? '(ikke oppgitt)'}`);
  } else {
    l.push('Kundetype: privat');
  }
  l.push('');

  l.push('JOBBEN');
  l.push(`Tjeneste: ${f.tjeneste}`);
  l.push(`Kundens hast: ${f.hast ?? '(ikke oppgitt)'}`);
  l.push(`Sted: ${f.stedTekst?.trim() || '(ikke oppgitt)'}`);
  if (f.lat != null && f.lon != null) l.push(`Koordinater: ${f.lat}, ${f.lon}`);
  l.push(`Kjøretid fra Hemnes: ${kjoretid == null ? 'ukjent' : `ca. ${kjoretid} min`}`);
  l.push(`Utenfor området: ${utenfor}`);
  l.push(`Kilde: ${f.kilde ?? '(ingen)'}`);
  l.push(`Mottatt: ${formatMottatt(f.opprettet)}`, '');

  l.push(...regelLinjer(regler));
  l.push(...aiLinjer(ai));

  l.push('BESKRIVELSE FRA KUNDEN');
  l.push(f.beskrivelse?.trim() || '(ingen)', '');
  l.push('SVAR FRA SKJEMAET');
  l.push(...svarLinjer(f.svar), '');
  l.push(...samtykkeLinjer(samtykker));

  l.push('BILDER');
  if (f.bilder.length === 0) l.push('(ingen)');
  else if (lenker.length === 0) l.push(`${f.bilder.length} bilde(r) lagret. Lenker krever SKJEMA_HMAC.`);
  else {
    l.push('Lenkene virker i 14 dager.');
    for (const lenke of lenker) l.push(lenke);
  }
  l.push('', `Forespørsel-id: ${f.id}`);
  return l.join('\n');
}
