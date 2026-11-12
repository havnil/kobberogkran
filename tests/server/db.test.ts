import { readFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import {
  leggTilBilde,
  loggHendelse,
  oppdaterSteg2,
  opprettForesporsel,
  registrerSamtykke,
  sisteSamtykke,
  type ForesporselInput,
} from '../../src/server/db';

const migrering = readFileSync(new URL('../../migrations/0001_init.sql', import.meta.url), 'utf8');

let mf: Miniflare;
let db: D1Database;

beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok"); } }',
    d1Databases: { DB: 'test-db' },
  });
  db = (await mf.getD1Database('DB')) as unknown as D1Database;
});

afterAll(async () => {
  await mf.dispose();
});

beforeEach(async () => {
  for (const t of ['hendelser', 'samtykker', 'bilder', 'foresporsler', 'kunder']) {
    await db.exec(`DROP TABLE IF EXISTS ${t}`);
  }
  const uten = migrering.replace(/^--.*$/gm, '');
  const stmts = uten.split(';').map((s) => s.trim()).filter(Boolean);
  await db.batch(stmts.map((s) => db.prepare(s)));
});

const input = (over: Partial<ForesporselInput> = {}): ForesporselInput => ({
  telefon: '+4799999999',
  navn: 'Test',
  tjeneste: 'rorlegger',
  hast: 'snart',
  ...over,
});

const tell = async (tabell: string) =>
  (await db.prepare(`SELECT COUNT(*) AS n FROM ${tabell}`).first<{ n: number }>())!.n;

describe('opprettForesporsel', () => {
  it('oppretter ny forespørsel med status ny', async () => {
    const r = await opprettForesporsel(db, input(), 'nokkel-1');
    expect(r.ny).toBe(true);
    const rad = await db.prepare('SELECT status FROM foresporsler WHERE id = ?').bind(r.id).first<{ status: string }>();
    expect(rad?.status).toBe('ny');
  });

  it('er idempotent på idemNokkel', async () => {
    const a = await opprettForesporsel(db, input(), 'nokkel-1');
    const b = await opprettForesporsel(db, input(), 'nokkel-1');
    expect(b.id).toBe(a.id);
    expect(a.ny).toBe(true);
    expect(b.ny).toBe(false);
    expect(await tell('foresporsler')).toBe(1);
  });

  it('er idempotent under samtidige kall med samme nøkkel', async () => {
    const res = await Promise.all(
      Array.from({ length: 8 }, () => opprettForesporsel(db, input(), 'race-1')),
    );
    expect(new Set(res.map((r) => r.id)).size).toBe(1);
    expect(res.filter((r) => r.ny)).toHaveLength(1);
    expect(await tell('foresporsler')).toBe(1);
    expect(await tell('kunder')).toBe(1);
  });

  it('gjenbruker kunde med samme telefon', async () => {
    await opprettForesporsel(db, input(), 'a');
    await opprettForesporsel(db, input({ navn: 'Annet' }), 'b');
    expect(await tell('kunder')).toBe(1);
    expect(await tell('foresporsler')).toBe(2);
  });

  it('fyller tom epost ved ny forespørsel fra samme kunde', async () => {
    await opprettForesporsel(db, input(), 'a');
    await opprettForesporsel(db, input({ epost: 'a@b.no', foretrukketKanal: 'epost' }), 'b');
    const k = await db.prepare('SELECT epost, foretrukket_kanal, navn FROM kunder').first<{ epost: string; foretrukket_kanal: string; navn: string }>();
    expect(k).toMatchObject({ epost: 'a@b.no', foretrukket_kanal: 'epost', navn: 'Test' });
  });

  it('sletter ikke eksisterende kundedata med null', async () => {
    await opprettForesporsel(db, input({ epost: 'a@b.no' }), 'a');
    await opprettForesporsel(db, input({ navn: undefined, epost: undefined }), 'b');
    const k = await db.prepare('SELECT epost, navn FROM kunder').first<{ epost: string; navn: string }>();
    expect(k).toMatchObject({ epost: 'a@b.no', navn: 'Test' });
  });

  it('lager ulike kunder for ulike telefonnumre', async () => {
    await opprettForesporsel(db, input(), 'a');
    await opprettForesporsel(db, input({ telefon: '+4788888888' }), 'b');
    expect(await tell('kunder')).toBe(2);
  });

  it('godtar forespørsel uten koordinater og kjøretid', async () => {
    const r = await opprettForesporsel(db, input({ stedTekst: 'Hytte, gnr 12 bnr 3' }), 'hytte');
    const rad = await db
      .prepare('SELECT lat, kjoretid_min FROM foresporsler WHERE id = ?')
      .bind(r.id)
      .first<{ lat: number | null; kjoretid_min: number | null }>();
    expect(rad?.lat).toBeNull();
    expect(rad?.kjoretid_min).toBeNull();
  });
});

describe('skjema', () => {
  it('avviser ugyldig status via CHECK', async () => {
    const r = await opprettForesporsel(db, input(), 'k');
    await expect(
      db.prepare('UPDATE foresporsler SET status = ? WHERE id = ?').bind('ugyldig', r.id).run(),
    ).rejects.toThrow();
  });

  it('avviser ugyldig samtykketype via CHECK', async () => {
    const r = await opprettForesporsel(db, input(), 'k');
    const kunde = await db.prepare('SELECT kunde_id FROM foresporsler WHERE id = ?').bind(r.id).first<{ kunde_id: string }>();
    await expect(
      db
        .prepare('INSERT INTO samtykker (id, kunde_id, type, gitt, kilde, opprettet) VALUES (?,?,?,?,?,?)')
        .bind('s1', kunde!.kunde_id, 'sms', 1, 'skjema', 'nå')
        .run(),
    ).rejects.toThrow();
  });
});

describe('samtykker', () => {
  const kundeId = async () => {
    const r = await opprettForesporsel(db, input(), 'k');
    return (await db.prepare('SELECT kunde_id FROM foresporsler WHERE id = ?').bind(r.id).first<{ kunde_id: string }>())!.kunde_id;
  };

  it('gir null uten registrert samtykke', async () => {
    expect(await sisteSamtykke(db, await kundeId(), 'whatsapp')).toBeNull();
  });

  it('returnerer siste og beholder historikken', async () => {
    const id = await kundeId();
    await registrerSamtykke(db, id, 'whatsapp', true, 'skjema');
    await registrerSamtykke(db, id, 'whatsapp', false, 'stopp');
    await registrerSamtykke(db, id, 'paaminnelser', true, 'skjema');
    expect(await sisteSamtykke(db, id, 'whatsapp')).toBe(false);
    expect(await sisteSamtykke(db, id, 'paaminnelser')).toBe(true);
    expect(await tell('samtykker')).toBe(3);
  });

  it('avviser gitt utenfor 0 og 1', async () => {
    const id = await kundeId();
    await expect(
      db.prepare('INSERT INTO samtykker (id, kunde_id, type, gitt, kilde, opprettet) VALUES (?,?,?,?,?,?)').bind('x', id, 'whatsapp', 2, 's', 'n').run(),
    ).rejects.toThrow();
  });
});

describe('oppdaterSteg2, leggTilBilde, loggHendelse', () => {
  it('lagrer svar som JSON og oppdaterer tidspunkt', async () => {
    const r = await opprettForesporsel(db, input(), 'k');
    const før = await db.prepare('SELECT oppdatert FROM foresporsler WHERE id = ?').bind(r.id).first<{ oppdatert: string }>();
    await new Promise((res) => setTimeout(res, 5));
    await oppdaterSteg2(db, r.id, { problem: 'lekkasje' });
    const rad = await db.prepare('SELECT svar_json, oppdatert FROM foresporsler WHERE id = ?').bind(r.id).first<{ svar_json: string; oppdatert: string }>();
    expect(JSON.parse(rad!.svar_json)).toEqual({ problem: 'lekkasje' });
    expect(rad!.oppdatert > før!.oppdatert).toBe(true);
  });

  it('oppdaterSteg2 gir false for ukjent id', async () => {
    expect(await oppdaterSteg2(db, 'finnes-ikke', {})).toBe(false);
    const r = await opprettForesporsel(db, input(), 'k');
    expect(await oppdaterSteg2(db, r.id, {})).toBe(true);
  });

  it('avviser bilde med ukjent foresporsel_id (FK)', async () => {
    await expect(leggTilBilde(db, 'finnes-ikke', 'x.jpg')).rejects.toThrow();
  });

  it('legger til bilde', async () => {
    const r = await opprettForesporsel(db, input(), 'k');
    await leggTilBilde(db, r.id, 'bilder/abc.jpg');
    const rad = await db.prepare('SELECT r2_nokkel FROM bilder WHERE foresporsel_id = ?').bind(r.id).first<{ r2_nokkel: string }>();
    expect(rad?.r2_nokkel).toBe('bilder/abc.jpg');
  });

  it('logger hendelse med data', async () => {
    const r = await opprettForesporsel(db, input(), 'k');
    await loggHendelse(db, r.id, 'varslet', { kanal: 'epost' });
    const rad = await db.prepare('SELECT type, data_json FROM hendelser WHERE foresporsel_id = ?').bind(r.id).first<{ type: string; data_json: string }>();
    expect(rad?.type).toBe('varslet');
    expect(JSON.parse(rad!.data_json)).toEqual({ kanal: 'epost' });
  });
});
