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
       ON CONFLICT(telefon) DO NOTHING`,
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

export async function oppdaterSteg2(db: D1Database, id: string, svar: unknown): Promise<void> {
  await db
    .prepare('UPDATE foresporsler SET svar_json = ?, oppdatert = ? WHERE id = ?')
    .bind(JSON.stringify(svar), na(), id)
    .run();
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
