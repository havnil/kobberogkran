// Tillegg til Eirik: når kunden sender bilder eller steg 2 etter at varselet har gått, får Eirik en
// kort e-post med det som er nytt (signerte bildelenker, beskrivelse og svar). Ingen AI.
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
// - Mens status er 'ny' eller 'sortert', sendes ikke tillegg (hovedvarselet tar det med). Etter
//   'lukket' sendes ingenting.
// - Feiler e-posten, flyttes ikke `dekket`, og neste tillegg tar med det som mangler.
import type { D1Database } from '@cloudflare/workers-types';
import { hentForesporsel, loggHendelse, type Foresporsel } from './db';
import type { Env } from './env';
import { signerBildeLenke } from './bildelenke';
import { varsleEirik, type Varsler } from './varsling';
import { BILDELENKE_GYLDIG_SEK } from './sortering/index';

export const TILLEGG_SAMLE_MS = 20_000;
const STANDARD_NETTSTED = 'https://kobberogkran.no';

export type Tillegg =
  | { hva: 'bilde'; bildeId: string; merke?: string }
  | { hva: 'steg2' }
  | { hva: 'samtykke'; type: string; gitt: boolean };

export interface TilleggDeps {
  varsler?: Varsler;
  naa?: () => Date;
  vent?: (ms: number) => Promise<void>;
}

const standardVent = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Logger et tillegg. Kalles i request-et etter at selve endringen er lagret. */
export function loggTillegg(db: D1Database, id: string, tillegg: Tillegg): Promise<void> {
  return loggHendelse(db, id, 'tillegg', tillegg);
}

async function dekketTil(db: D1Database, id: string): Promise<number> {
  const r = await db
    .prepare(
      `SELECT MAX(CAST(json_extract(data_json, '$.dekket') AS INTEGER)) AS m FROM hendelser
        WHERE foresporsel_id = ? AND type IN ('varsel_ok', 'tillegg_varsel', 'tillegg_varsel_direkte')
          AND json_extract(data_json, '$.dekket') IS NOT NULL`,
    )
    .bind(id)
    .first<{ m: number | null }>();
  return r?.m ?? 0;
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

    const fra = await dekketTil(db, id);
    const nye = await nyeTillegg(db, id, fra);
    const avslutt = async (data: Record<string, unknown>) => {
      if (reservasjon) {
        await db.prepare('UPDATE hendelser SET data_json = ? WHERE id = ?').bind(JSON.stringify(data), reservasjon).run();
      } else if (nye.length) {
        await loggHendelse(db, id, 'tillegg_varsel_direkte', data);
      }
    };
    if (nye.length === 0) return avslutt({ dekket: fra, antall: 0 });

    const f = await hentForesporsel(db, id);
    if (!f) return avslutt({ feil: 'forespørselen finnes ikke' });
    const tekst = await lagTilleggTekst(env, f, nye.map((n) => n.t), naa);
    const ok = await varsleEirik(env, deps.varsler, lagTilleggEmne(f), tekst, 'tillegg');
    await avslutt(ok ? { dekket: nye[nye.length - 1].rad, antall: nye.length } : { feil: 'e-post feilet' });
  } catch (e) {
    console.error(JSON.stringify({ hendelse: 'tillegg_feilet', feil: String(e).slice(0, 300) }));
  }
}

export function lagTilleggEmne(f: Foresporsel): string {
  const sted = f.stedTekst?.replace(/\s+/g, ' ').trim() || 'ukjent sted';
  return `Tillegg: ${f.tjeneste} – ${[...sted].length > 60 ? `${[...sted].slice(0, 59).join('')}…` : sted}`;
}

async function lagTilleggTekst(env: Env, f: Foresporsel, nye: Tillegg[], naa: Date): Promise<string> {
  const l: string[] = ['TILLEGG TIL FORESPØRSEL – bare for Eirik, sendes ikke til kunden', ''];
  l.push(`Kunde: ${f.kunde.navn ?? '(ikke oppgitt)'}, ${f.kunde.telefon}`);
  l.push(`Tjeneste: ${f.tjeneste}`, `Sted: ${f.stedTekst?.trim() || '(ikke oppgitt)'}`, '');

  const bilder = nye.filter((t): t is Extract<Tillegg, { hva: 'bilde' }> => t.hva === 'bilde');
  if (bilder.length) {
    l.push(`NYE BILDER (${bilder.length})`);
    if (env.SKJEMA_HMAC) {
      const base = (env.NETTSTED_URL || STANDARD_NETTSTED).replace(/\/+$/, '');
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
    l.push('Svar fra skjemaet:', f.svar ? JSON.stringify(f.svar, null, 2) : '(ingen)', '');
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
