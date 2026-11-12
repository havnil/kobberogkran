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
import { frigiVarselLaas, hentForesporsel, laasForVarsel, loggHendelse, settStatus, sisteHendelseRad, type Foresporsel } from '../db';
import type { Env } from '../env';
import { signerBildeLenke } from '../bildelenke';
import { EpostVarsler, type Varsler } from '../varsling';
import { formatKr } from '../../lib/priser';
import { ClaudeSorterer, sorteringSchema, type Sortering, type Sorterer } from './ai';
import { kjoretidMin, regelsjekk, type Regelsjekk } from './regler';

export interface SorterOgVarsleDeps {
  sorterer?: Sorterer;
  varsler?: Varsler;
  naa?: () => Date;
}

const STANDARD_NETTSTED = 'https://kobberogkran.no';
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

    try {
      const til = env.VARSEL_TIL;
      const varsler = deps.varsler ?? (env.VARSEL_FRA ? new EpostVarsler(env.EPOST, env.VARSEL_FRA) : null);
      if (!til || !varsler) throw new Error('VARSEL_TIL eller VARSEL_FRA er ikke satt');
      const lenker = await bildelenker(env, f, naa());
      await varsler.send(til, lagEmne(f, ai), lagVarselTekst(f, regler, ai, lenker));
    } catch (e) {
      await loggTrygt(env.DB, id, 'varsel_feil', { kanal: 'epost', feil: feiltekst(e) });
      return;
    }
    // Sendt: sett status først, så en feil i loggingen ikke fører til ny sending.
    await settStatus(env.DB, id, 'varslet');
    await loggTrygt(env.DB, id, 'varsel_ok', { kanal: 'epost', dekket });
  } catch (e) {
    // Aldri kast ut av waitUntil. Forespørselen er lagret; status 'ny'/'sortert' viser at varselet mangler.
    console.error('sorterOgVarsle feilet', id, feiltekst(e));
  } finally {
    if (laas) await frigiVarselLaas(env.DB, id, laas).catch((e) => console.error('frigiVarselLaas feilet', id, feiltekst(e)));
  }
}

/** Logger en hendelse uten å kaste; en feil i loggingen skal ikke stoppe varselet. */
async function loggTrygt(db: D1Database, id: string, type: string, data: unknown): Promise<void> {
  try {
    await loggHendelse(db, id, type, data);
  } catch (e) {
    console.error('loggHendelse feilet', id, type, feiltekst(e));
  }
}

async function bildelenker(env: Env, f: Foresporsel, naa: Date): Promise<string[]> {
  if (!env.SKJEMA_HMAC || f.bilder.length === 0) return [];
  const base = (env.NETTSTED_URL ?? STANDARD_NETTSTED).replace(/\/+$/, '');
  const utloper = Math.floor(naa.getTime() / 1000) + BILDELENKE_GYLDIG_SEK;
  return Promise.all(f.bilder.map(async (b) => base + (await signerBildeLenke(b.id, env.SKJEMA_HMAC!, utloper))));
}

function hastFor(f: Foresporsel, ai: Sortering | null): string | null {
  return ai?.hast ?? f.hast;
}

export function lagEmne(f: Foresporsel, ai: Sortering | null): string {
  const hast = hastFor(f, ai);
  const helt = f.stedTekst?.replace(/\s+/g, ' ').trim() || 'ukjent sted';
  const sted = [...helt].length > EMNE_STED_MAKS ? `${[...helt].slice(0, EMNE_STED_MAKS - 1).join('')}…` : helt;
  return `${hast === 'akutt' ? 'AKUTT – ' : ''}Ny forespørsel: ${f.tjeneste} – ${sted}`;
}

const liste = (xs: string[], tom: string) => (xs.length ? xs.join(', ') : tom);

/** Fast mal for varselet til Eirik. Bare for Eiriks øyne; sendes aldri til kunden. */
export function lagVarselTekst(f: Foresporsel, regler: Regelsjekk, ai: Sortering | null, lenker: string[]): string {
  const kjoretid = f.kjoretidMin ?? kjoretidMin(f.lat, f.lon);
  const utenfor = regler.utenforOmrade == null ? 'ukjent' : regler.utenforOmrade ? 'JA' : 'nei';
  const pris = regler.prisanslag
    ? `${formatKr(regler.prisanslag.fra, 'nb')}–${formatKr(regler.prisanslag.til, 'nb')} inkl. mva, pluss deler`
    : 'ingen (ikke i prislisten)';

  const l: string[] = [];
  l.push('NY FORESPØRSEL – bare for Eirik, sendes ikke til kunden', '');
  l.push('KUNDE');
  l.push(`Navn: ${f.kunde.navn ?? '(ikke oppgitt)'}`);
  l.push(`Telefon: ${f.kunde.telefon}`);
  l.push(`E-post: ${f.kunde.epost ?? '(ikke oppgitt)'}`, '');

  l.push('JOBBEN');
  l.push(`Tjeneste: ${f.tjeneste}`);
  l.push(`Kundens hast: ${f.hast ?? '(ikke oppgitt)'}`);
  l.push(`Sted: ${f.stedTekst?.trim() || '(ikke oppgitt)'}`);
  if (f.lat != null && f.lon != null) l.push(`Koordinater: ${f.lat}, ${f.lon}`);
  l.push(`Kjøretid fra Hemnes: ${kjoretid == null ? 'ukjent' : `ca. ${kjoretid} min`}`);
  l.push(`Utenfor området: ${utenfor}`);
  l.push(`Kilde: ${f.kilde ?? '(ingen)'}`);
  l.push(`Mottatt: ${f.opprettet}`, '');

  l.push('REGELSJEKK');
  l.push(`Røde flagg: ${liste(regler.rodeFlagg, 'ingen')}`);
  l.push(`Jobber vi ikke tar: ${liste(regler.ikkeVaarJobb, 'ingen')}`);
  l.push(`Mangler: ${liste(regler.mangler, 'ingenting')}`);
  l.push(`Prisanslag fra prislisten: ${pris}`, '');

  if (ai) {
    l.push('AI-SAMMENDRAG');
    l.push(`Hast (AI): ${ai.hast}`);
    l.push(ai.sammendrag, '');
    l.push(`SVARUTKAST (${UTKAST_MERKE})`);
    l.push(ai.svarutkast, '');
  } else {
    l.push('AI-sortering feilet eller er ikke satt opp. Varselet har bare reglene og rådata.', '');
  }

  l.push('BESKRIVELSE FRA KUNDEN');
  l.push(f.beskrivelse?.trim() || '(ingen)', '');
  l.push('SVAR FRA SKJEMAET');
  l.push(f.svar ? JSON.stringify(f.svar, null, 2) : '(steg 2 ikke fylt ut)', '');

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
