import type { D1Database } from '@cloudflare/workers-types';

export interface ForesporselInput {
  /** Allerede normalisert til E.164 (+47...). Kallende kode (API-et) normaliserer. */
  telefon: string;
  navn?: string;
  epost?: string;
  foretrukketKanal?: string;
  tjeneste: string;
  hast?: string;
  stedTekst?: string;
  lat?: number;
  lon?: number;
  /** Null/utelatt betyr «ukjent». */
  kjoretidMin?: number;
  beskrivelse?: string;
  kilde?: string;
}

const na = () => new Date().toISOString();

/**
 * Oppretter en forespørsel, idempotent på `idemNokkel`.
 *
 * `input.telefon` må være normalisert (E.164); den brukes som nøkkel for å
 * gjenbruke kunden. Idempotensen hviler på UNIQUE(idem_nokkel): to samtidige
 * kall gir én rad, og taperen får vinnerens id med `ny: false`.
 */
export async function opprettForesporsel(
  db: D1Database,
  input: ForesporselInput,
  idemNokkel: string,
): Promise<{ id: string; ny: boolean }> {
  const finnes = await db
    .prepare('SELECT id FROM foresporsler WHERE idem_nokkel = ?')
    .bind(idemNokkel)
    .first<{ id: string }>();
  if (finnes) return { id: finnes.id, ny: false };

  const tid = na();
  await db
    .prepare(
      `INSERT INTO kunder (id, telefon, navn, epost, foretrukket_kanal, opprettet)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(telefon) DO UPDATE SET
         navn = COALESCE(excluded.navn, kunder.navn),
         epost = COALESCE(excluded.epost, kunder.epost),
         foretrukket_kanal = COALESCE(excluded.foretrukket_kanal, kunder.foretrukket_kanal)`,
    )
    .bind(
      crypto.randomUUID(),
      input.telefon,
      input.navn ?? null,
      input.epost ?? null,
      input.foretrukketKanal ?? null,
      tid,
    )
    .run();
  const kunde = await db
    .prepare('SELECT id FROM kunder WHERE telefon = ?')
    .bind(input.telefon)
    .first<{ id: string }>();
  if (!kunde) throw new Error('Kunde ble ikke funnet etter opprettelse');

  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO foresporsler
         (id, idem_nokkel, kunde_id, tjeneste, hast, sted_tekst, lat, lon,
          kjoretid_min, beskrivelse, kilde, status, opprettet, oppdatert)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ny', ?, ?)
       ON CONFLICT(idem_nokkel) DO NOTHING`,
    )
    .bind(
      id,
      idemNokkel,
      kunde.id,
      input.tjeneste,
      input.hast ?? null,
      input.stedTekst ?? null,
      input.lat ?? null,
      input.lon ?? null,
      input.kjoretidMin ?? null,
      input.beskrivelse ?? null,
      input.kilde ?? null,
      tid,
      tid,
    )
    .run();

  const rad = await db
    .prepare('SELECT id FROM foresporsler WHERE idem_nokkel = ?')
    .bind(idemNokkel)
    .first<{ id: string }>();
  if (!rad) throw new Error('Forespørsel ble ikke funnet etter opprettelse');
  return { id: rad.id, ny: rad.id === id };
}

/** Returnerer true hvis en forespørsel ble oppdatert. */
export async function oppdaterSteg2(db: D1Database, id: string, svar: unknown): Promise<boolean> {
  const r = await db
    .prepare('UPDATE foresporsler SET svar_json = ?, oppdatert = ? WHERE id = ?')
    .bind(JSON.stringify(svar), na(), id)
    .run();
  return (r.meta.changes ?? 0) > 0;
}

export async function leggTilBilde(db: D1Database, foresporselId: string, r2Nokkel: string): Promise<void> {
  await db
    .prepare('INSERT INTO bilder (id, foresporsel_id, r2_nokkel, opprettet) VALUES (?, ?, ?, ?)')
    .bind(crypto.randomUUID(), foresporselId, r2Nokkel, na())
    .run();
}

export async function loggHendelse(
  db: D1Database,
  foresporselId: string,
  type: string,
  data?: unknown,
): Promise<void> {
  await db
    .prepare('INSERT INTO hendelser (id, foresporsel_id, type, data_json, opprettet) VALUES (?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), foresporselId, type, data === undefined ? null : JSON.stringify(data), na())
    .run();
}

export type SamtykkeType = 'whatsapp' | 'paaminnelser';

/** Legger til en rad i samtykkehistorikken (append-only). */
export async function registrerSamtykke(
  db: D1Database,
  kundeId: string,
  type: SamtykkeType,
  gitt: boolean,
  kilde: string,
): Promise<void> {
  await db
    .prepare('INSERT INTO samtykker (id, kunde_id, type, gitt, kilde, opprettet) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), kundeId, type, gitt ? 1 : 0, kilde, na())
    .run();
}

/** Siste registrerte samtykke for typen, eller null hvis ingen. */
export async function sisteSamtykke(
  db: D1Database,
  kundeId: string,
  type: SamtykkeType,
): Promise<boolean | null> {
  const rad = await db
    .prepare('SELECT gitt FROM samtykker WHERE kunde_id = ? AND type = ? ORDER BY opprettet DESC, rowid DESC LIMIT 1')
    .bind(kundeId, type)
    .first<{ gitt: number }>();
  return rad ? rad.gitt === 1 : null;
}

export type ForesporselStatus = 'ny' | 'sortert' | 'varslet' | 'lukket';

/**
 * Formen på `svar_json` fra steg 2 (oppgave 8 eier skjemaet og må følge denne).
 * Alt er valgfritt; det som ikke finnes, regnes som manglende.
 * - `felles`: de felles spørsmålene (vann, avløp, byggeår, adkomst, kontaktform)
 * - `tjenesteSvar`: spørsmålene for den valgte tjenesten
 * - `bildeMerker`: hva de opplastede bildene viser, f.eks. `typeskilt`, `tank`, `pumpe`
 */
export interface SvarJson {
  felles?: Record<string, unknown>;
  tjenesteSvar?: Record<string, unknown>;
  bildeMerker?: string[];
  [annet: string]: unknown;
}

export interface Foresporsel {
  id: string;
  tjeneste: string;
  hast: string | null;
  stedTekst: string | null;
  lat: number | null;
  lon: number | null;
  kjoretidMin: number | null;
  beskrivelse: string | null;
  /** Tolket `svar_json`; null når det mangler eller ikke er gyldig JSON-objekt. */
  svar: SvarJson | null;
  kilde: string | null;
  status: ForesporselStatus;
  opprettet: string;
  kunde: { navn: string | null; telefon: string; epost: string | null };
  bilder: { id: string; r2Nokkel: string }[];
}

function tolkSvar(json: string | null): SvarJson | null {
  if (!json) return null;
  try {
    const v: unknown = JSON.parse(json);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as SvarJson) : null;
  } catch {
    return null;
  }
}

/** Forespørselen med kunde og bilder, eller null hvis den ikke finnes. */
export async function hentForesporsel(db: D1Database, id: string): Promise<Foresporsel | null> {
  const rad = await db
    .prepare(
      `SELECT f.id, f.tjeneste, f.hast, f.sted_tekst, f.lat, f.lon, f.kjoretid_min, f.beskrivelse,
              f.svar_json, f.kilde, f.status, f.opprettet,
              k.navn AS kunde_navn, k.telefon AS kunde_telefon, k.epost AS kunde_epost
         FROM foresporsler f JOIN kunder k ON k.id = f.kunde_id
        WHERE f.id = ?`,
    )
    .bind(id)
    .first<{
      id: string;
      tjeneste: string;
      hast: string | null;
      sted_tekst: string | null;
      lat: number | null;
      lon: number | null;
      kjoretid_min: number | null;
      beskrivelse: string | null;
      svar_json: string | null;
      kilde: string | null;
      status: ForesporselStatus;
      opprettet: string;
      kunde_navn: string | null;
      kunde_telefon: string;
      kunde_epost: string | null;
    }>();
  if (!rad) return null;
  const bilder = await db
    .prepare('SELECT id, r2_nokkel FROM bilder WHERE foresporsel_id = ? ORDER BY opprettet, rowid')
    .bind(id)
    .all<{ id: string; r2_nokkel: string }>();
  return {
    id: rad.id,
    tjeneste: rad.tjeneste,
    hast: rad.hast,
    stedTekst: rad.sted_tekst,
    lat: rad.lat,
    lon: rad.lon,
    kjoretidMin: rad.kjoretid_min,
    beskrivelse: rad.beskrivelse,
    svar: tolkSvar(rad.svar_json),
    kilde: rad.kilde,
    status: rad.status,
    opprettet: rad.opprettet,
    kunde: { navn: rad.kunde_navn, telefon: rad.kunde_telefon, epost: rad.kunde_epost },
    bilder: bilder.results.map((b) => ({ id: b.id, r2Nokkel: b.r2_nokkel })),
  };
}

/** Returnerer true hvis forespørselen fantes og fikk ny status. */
export async function settStatus(db: D1Database, id: string, status: ForesporselStatus): Promise<boolean> {
  const r = await db
    .prepare('UPDATE foresporsler SET status = ?, oppdatert = ? WHERE id = ?')
    .bind(status, na(), id)
    .run();
  return (r.meta.changes ?? 0) > 0;
}

/** Standard leietid for varsellåsen. Dekker AI-kallet (maks 20 s) og sendingen med god margin. */
export const VARSEL_LAAS_MS = 2 * 60 * 1000;

/**
 * Tar låsen for sortering og varsel atomisk. Gir true bare for én av flere samtidige kall.
 * Låsen kan tas når status er 'ny' eller 'sortert' og ingen har et gyldig lån.
 * Et lån fra en kjøring som krasjet, utløper etter `leieMs`, slik at et senere forsøk kan fortsette.
 */
export async function laasForVarsel(
  db: D1Database,
  id: string,
  naa: Date,
  leieMs: number = VARSEL_LAAS_MS,
): Promise<boolean> {
  const r = await db
    .prepare(
      `UPDATE foresporsler SET varsel_laast_til = ?
        WHERE id = ? AND status IN ('ny', 'sortert')
          AND (varsel_laast_til IS NULL OR varsel_laast_til < ?)`,
    )
    .bind(new Date(naa.getTime() + leieMs).toISOString(), id, naa.toISOString())
    .run();
  return r.meta.changes === 1;
}

export async function frigiVarselLaas(db: D1Database, id: string): Promise<void> {
  await db.prepare('UPDATE foresporsler SET varsel_laast_til = NULL WHERE id = ?').bind(id).run();
}
