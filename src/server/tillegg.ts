// Tillegg til Eirik: når kunden sender bilder eller steg 2 etter at varselet har gått, får Eirik en
// kort e-post med det som er nytt (signerte bildelenker, beskrivelse og svar).
//
// Regelsjekken kjøres på nytt for hvert tillegg, på den nå komplette forespørselen (røde flagg og
// manglende bilder står oftest i steg 2). Er steg 2 fylt ut eller endret, kjøres også én AI-sortering
// (samme ClaudeSorterer og samme personvernregler som hovedvarselet), og sammendraget og
// svarutkastet (merket «Utkast – sendes ikke automatisk») står i tillegget. Bare bilder: ingen AI.
//
// Slik henger det sammen:
// - Hvert tillegg logges straks som hendelsen 'tillegg' (i request-et, før svaret). Ingenting går tapt.
// - Varselet til Eirik (sorterOgVarsle) lagrer `dekket` = høyeste hendelse-rowid før det leste
//   forespørselen. Et tillegg-varsel lagrer også `dekket` når det er sendt. Det som ikke er dekket,
//   er «nytt».
// - Etter et tillegg (`samle: true`) tar én kjøring en reservasjon (hendelsen 'tillegg_varsel'),
//   venter TILLEGG_SAMLE_MS og sender alt nytt i én e-post. Reservasjonen er én betinget INSERT, så av
//   flere samtidige opplastinger får bare én den; de andre kommer med i samme e-post. En støt med 8
//   bilder gir derfor én e-post. Vinduet er kort fordi `waitUntil` bare lever ca. 30 s etter svaret:
//   et lengre vindu ville latt tillegg som kommer etter innsamlingen, bli liggende uten varsel.
// - Etter hovedvarselet (`samle: false`) sendes det som kom inn mens AI-en sorterte, med en gang.
// - Mens status er 'ny' eller 'sortert', sendes ikke tillegg (hovedvarselet tar det med; et tillegg
//   i den statusen starter i stedet et nytt forsøk på hovedvarselet, se skjema.ts). Etter 'lukket'
//   sendes ingenting.
// - Samtykker som hovedvarselet allerede viste (`samtykkeDekket` i 'varsel_ok'), sendes ikke på nytt.
// - Feiler e-posten, flyttes ikke `dekket`, og neste tillegg tar med det som mangler.
import type { D1Database } from '@cloudflare/workers-types';
import { hentForesporsel, loggHendelse, type Foresporsel } from './db';
import type { Env } from './env';
import { signerBildeLenke } from './bildelenke';
import { varsleEirik, type Varsler } from './varsling';
import { nettstedUrl } from '../lib/nettsted';
import { aiLinjer, BILDELENKE_GYLDIG_SEK, erAkutt, loggTrygt, regelLinjer, svarLinjer } from './sortering/index';
import { ClaudeSorterer, type Sortering, type Sorterer } from './sortering/ai';
import { regelsjekk, type Regelsjekk } from './sortering/regler';

export const TILLEGG_SAMLE_MS = 20_000;
/**
 * Tidsavbrudd for AI-kallet i et tillegg. `waitUntil` lever ca. 30 s etter svaret, og samlevinduet
 * bruker 20 av dem, så AI-en får kortere tid enn i hovedvarselet. Svarer den ikke i tide, sendes
 * tillegget med bare reglene.
 */
export const TILLEGG_AI_MS = 8_000;

export type Tillegg =
  | { hva: 'bilde'; bildeId: string; merke?: string }
  | { hva: 'steg2' }
  | { hva: 'samtykke'; type: string; gitt: boolean };

export interface TilleggDeps {
  varsler?: Varsler;
  sorterer?: Sorterer;
  naa?: () => Date;
  vent?: (ms: number) => Promise<void>;
}

const standardVent = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Logger et tillegg. Kalles i request-et etter at selve endringen er lagret. */
export function loggTillegg(db: D1Database, id: string, tillegg: Tillegg): Promise<void> {
  return loggHendelse(db, id, 'tillegg', tillegg);
}

async function dekketTil(db: D1Database, id: string): Promise<{ fra: number; samtykker: number }> {
  const r = await db
    .prepare(
      `SELECT MAX(CAST(json_extract(data_json, '$.dekket') AS INTEGER)) AS m,
              MAX(CAST(json_extract(data_json, '$.samtykkeDekket') AS INTEGER)) AS s FROM hendelser
        WHERE foresporsel_id = ? AND type IN ('varsel_ok', 'tillegg_varsel', 'tillegg_varsel_direkte')
          AND json_extract(data_json, '$.dekket') IS NOT NULL`,
    )
    .bind(id)
    .first<{ m: number | null; s: number | null }>();
  return { fra: r?.m ?? 0, samtykker: r?.s ?? 0 };
}

async function nyeTillegg(db: D1Database, id: string, etter: number): Promise<{ rad: number; t: Tillegg }[]> {
  const r = await db
    .prepare(`SELECT rowid AS rad, data_json FROM hendelser WHERE foresporsel_id = ? AND type = 'tillegg' AND rowid > ? ORDER BY rowid`)
    .bind(id, etter)
    .all<{ rad: number; data_json: string | null }>();
  const ut: { rad: number; t: Tillegg }[] = [];
  for (const x of r.results) {
    try {
      ut.push({ rad: x.rad, t: JSON.parse(x.data_json ?? 'null') as Tillegg });
    } catch {
      // Ødelagt rad: hopp over, men flytt `dekket` forbi den.
      ut.push({ rad: x.rad, t: { hva: 'steg2' } });
    }
  }
  return ut;
}

/** Tar reservasjonen for innsamling. Bare når status er 'varslet' og ingen annen samler nå. */
async function reserver(db: D1Database, id: string, naa: Date): Promise<string | null> {
  const radId = crypto.randomUUID();
  const grense = new Date(naa.getTime() - TILLEGG_SAMLE_MS).toISOString();
  const r = await db
    .prepare(
      `INSERT INTO hendelser (id, foresporsel_id, type, data_json, opprettet)
       SELECT ?, ?, 'tillegg_varsel', NULL, ?
        WHERE (SELECT status FROM foresporsler WHERE id = ?) = 'varslet'
          AND NOT EXISTS (SELECT 1 FROM hendelser WHERE foresporsel_id = ? AND type = 'tillegg_varsel' AND opprettet > ?)`,
    )
    .bind(radId, id, naa.toISOString(), id, id, grense)
    .run();
  return r.meta.changes === 1 ? radId : null;
}

/**
 * Sender tillegg til Eirik når det finnes noe nytt etter varselet. Kaster aldri (kjøres i waitUntil).
 * `samle: true` etter et tillegg (reserverer og venter), `samle: false` rett etter hovedvarselet.
 */
export async function varsleTillegg(env: Env, id: string, valg: { samle: boolean }, deps: TilleggDeps = {}): Promise<void> {
  const db = env.DB;
  const naa = (deps.naa ?? (() => new Date()))();
  try {
    let reservasjon: string | null = null;
    if (valg.samle) {
      reservasjon = await reserver(db, id, naa);
      if (!reservasjon) return;
      await (deps.vent ?? standardVent)(TILLEGG_SAMLE_MS);
    } else {
      const s = await db.prepare('SELECT status FROM foresporsler WHERE id = ?').bind(id).first<{ status: string }>();
      if (s?.status !== 'varslet') return;
    }

    const { fra, samtykker: samtykkeDekket } = await dekketTil(db, id);
    const alleNye = await nyeTillegg(db, id, fra);
    // Samtykker som allerede sto i hovedvarselet, sendes ikke igjen (men `dekket` flyttes forbi dem).
    const nye = alleNye.filter((n) => !(n.t.hva === 'samtykke' && n.rad <= samtykkeDekket));
    const sist = alleNye.length ? alleNye[alleNye.length - 1].rad : fra;
    const avslutt = async (data: Record<string, unknown>) => {
      if (reservasjon) {
        await db.prepare('UPDATE hendelser SET data_json = ? WHERE id = ?').bind(JSON.stringify(data), reservasjon).run();
      } else if (alleNye.length) {
        await loggHendelse(db, id, 'tillegg_varsel_direkte', data);
      }
    };
    if (nye.length === 0) return avslutt({ dekket: sist, antall: 0 });

    const f = await hentForesporsel(db, id);
    if (!f) return avslutt({ feil: 'forespørselen finnes ikke' });
    const regler = regelsjekk(f);
    const ai = nye.some((n) => n.t.hva === 'steg2') ? await sorterTillegg(env, f, regler, deps.sorterer) : undefined;
    const tekst = await lagTilleggTekst(env, f, nye.map((n) => n.t), naa, regler, ai);
    const ok = await varsleEirik(env, deps.varsler, lagTilleggEmne(f, ai ?? null), tekst, 'tillegg');
    await avslutt(ok ? { dekket: sist, antall: nye.length } : { feil: 'e-post feilet' });
  } catch (e) {
    console.error(JSON.stringify({ hendelse: 'tillegg_feilet', feil: String(e).slice(0, 300) }));
  }
}

/**
 * Én AI-sortering av den komplette forespørselen etter steg 2. null når AI-en feiler eller ikke er
 * satt opp (logges som 'tillegg_sortering_feil'). Kaster aldri.
 */
async function sorterTillegg(env: Env, f: Foresporsel, regler: Regelsjekk, sorterer?: Sorterer): Promise<Sortering | null> {
  try {
    const ai = await (sorterer ?? new ClaudeSorterer(env.ANTHROPIC_API_KEY, { tidsavbruddMs: TILLEGG_AI_MS })).sorter(f, regler);
    await loggTrygt(env.DB, f.id, 'tillegg_sortering_ok', ai);
    return ai;
  } catch (e) {
    await loggTrygt(env.DB, f.id, 'tillegg_sortering_feil', { feil: (e instanceof Error ? e.message : String(e)).slice(0, 500) });
    return null;
  }
}

export function lagTilleggEmne(f: Foresporsel, ai: Sortering | null = null): string {
  const sted = f.stedTekst?.replace(/\s+/g, ' ').trim() || 'ukjent sted';
  const akutt = erAkutt(f, ai) ? 'AKUTT – ' : '';
  return `${akutt}Tillegg: ${f.tjeneste} – ${[...sted].length > 60 ? `${[...sted].slice(0, 59).join('')}…` : sted}`;
}

/**
 * Teksten i tillegget. `ai` er undefined når AI-en ikke ble kjørt (bare bilder eller samtykker),
 * null når den feilet.
 */
async function lagTilleggTekst(
  env: Env,
  f: Foresporsel,
  nye: Tillegg[],
  naa: Date,
  regler: Regelsjekk,
  ai: Sortering | null | undefined,
): Promise<string> {
  const l: string[] = ['TILLEGG TIL FORESPØRSEL – bare for Eirik, sendes ikke til kunden', ''];
  l.push(`Kunde: ${f.kunde.navn ?? '(ikke oppgitt)'}, ${f.kunde.telefon}`);
  l.push(`Tjeneste: ${f.tjeneste}`, `Sted: ${f.stedTekst?.trim() || '(ikke oppgitt)'}`, '');
  l.push(...regelLinjer(regler));
  if (ai !== undefined) l.push(...aiLinjer(ai));

  const bilder = nye.filter((t): t is Extract<Tillegg, { hva: 'bilde' }> => t.hva === 'bilde');
  if (bilder.length) {
    l.push(`NYE BILDER (${bilder.length})`);
    if (env.SKJEMA_HMAC) {
      const base = nettstedUrl(env);
      const utloper = Math.floor(naa.getTime() / 1000) + BILDELENKE_GYLDIG_SEK;
      l.push('Lenkene virker i 14 dager.');
      for (const b of bilder) {
        const lenke = base + (await signerBildeLenke(b.bildeId, env.SKJEMA_HMAC, utloper));
        l.push(b.merke ? `${lenke} (${b.merke})` : lenke);
      }
    } else {
      l.push('Lenker krever SKJEMA_HMAC.');
    }
    l.push('');
  }

  if (nye.some((t) => t.hva === 'steg2')) {
    l.push('STEG 2 ER FYLT UT ELLER ENDRET');
    l.push('Beskrivelse:', f.beskrivelse?.trim() || '(ingen)', '');
    l.push('Svar fra skjemaet:', ...svarLinjer(f.svar), '');
  }

  const samtykker = nye.filter((t): t is Extract<Tillegg, { hva: 'samtykke' }> => t.hva === 'samtykke');
  if (samtykker.length) {
    l.push('SAMTYKKER');
    for (const s of samtykker) l.push(`${s.type}: ${s.gitt ? 'ja' : 'nei'}`);
    l.push('');
  }

  l.push(`Forespørsel-id: ${f.id}`);
  return l.join('\n');
}
