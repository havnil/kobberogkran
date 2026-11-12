import { readFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import {
  frigiVarselLaas,
  hentForesporsel,
  laasForVarsel,
  lagreSteg2,
  leggTilBildeMaks,
  leggTilBildeMerke,
  loggHendelse,
  opprettForesporsel,
  registrerSamtykke,
  settStatus,
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
  for (const t of ['anrop', 'hendelser', 'samtykker', 'bilder', 'foresporsler', 'kunder']) {
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

describe('leggTilBildeMaks og loggHendelse', () => {
  it('avviser bilde med ukjent foresporsel_id (FK)', async () => {
    await expect(leggTilBildeMaks(db, 'finnes-ikke', 'b1', 'x.jpg', 10)).rejects.toThrow();
  });

  it('legger til bilde', async () => {
    const r = await opprettForesporsel(db, input(), 'k');
    expect(await leggTilBildeMaks(db, r.id, 'b1', 'bilder/abc.jpg', 10)).toBe(true);
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

describe('hentForesporsel og settStatus', () => {
  it('gir null for ukjent id', async () => {
    expect(await hentForesporsel(db, 'finnes-ikke')).toBeNull();
  });

  it('returnerer raden med kunde, tolket svar og bilder', async () => {
    const r = await opprettForesporsel(
      db,
      input({ epost: 'a@b.no', stedTekst: 'Hemnes', lat: 59.9, lon: 11.4, kjoretidMin: 5, kilde: 'qr' }),
      'k',
    );
    await lagreSteg2(db, r.id, 'Drypper', { felles: { vann: 'brønn' } });
    await leggTilBildeMerke(db, r.id, 'typeskilt');
    await leggTilBildeMaks(db, r.id, 'b1', 'bilder/a.jpg', 10);
    const f = await hentForesporsel(db, r.id);
    expect(f).toMatchObject({
      id: r.id,
      tjeneste: 'rorlegger',
      hast: 'snart',
      stedTekst: 'Hemnes',
      lat: 59.9,
      lon: 11.4,
      kjoretidMin: 5,
      beskrivelse: 'Drypper',
      kilde: 'qr',
      status: 'ny',
      svar: { felles: { vann: 'brønn' }, bildeMerker: ['typeskilt'] },
      kunde: { navn: 'Test', telefon: '+4799999999', epost: 'a@b.no' },
    });
    expect(f!.bilder).toHaveLength(1);
    expect(f!.bilder[0].r2Nokkel).toBe('bilder/a.jpg');
    expect(typeof f!.bilder[0].id).toBe('string');
  });

  it('gir svar null når svar_json mangler eller er ugyldig', async () => {
    const r = await opprettForesporsel(db, input(), 'k');
    expect((await hentForesporsel(db, r.id))!.svar).toBeNull();
    await db.prepare('UPDATE foresporsler SET svar_json = ? WHERE id = ?').bind('{ikke json', r.id).run();
    expect((await hentForesporsel(db, r.id))!.svar).toBeNull();
  });

  it('settStatus oppdaterer status og gir false for ukjent id', async () => {
    const r = await opprettForesporsel(db, input(), 'k');
    expect(await settStatus(db, r.id, 'sortert')).toBe(true);
    expect((await hentForesporsel(db, r.id))!.status).toBe('sortert');
    expect(await settStatus(db, 'finnes-ikke', 'varslet')).toBe(false);
  });
});

describe('laasForVarsel', () => {
  const t0 = new Date('2026-11-12T10:00:00.000Z');
  const om = (ms: number) => new Date(t0.getTime() + ms);

  it('bare én av flere samtidige får låsen', async () => {
    const r = await opprettForesporsel(db, input(), 'k');
    const res = await Promise.all(Array.from({ length: 5 }, () => laasForVarsel(db, r.id, t0)));
    expect(res.filter((t) => t !== null)).toHaveLength(1);
  });

  it('låsen utløper etter leietiden', async () => {
    const r = await opprettForesporsel(db, input(), 'k');
    expect(await laasForVarsel(db, r.id, t0, 120_000)).toEqual(expect.any(String));
    expect(await laasForVarsel(db, r.id, om(119_000), 120_000)).toBeNull();
    expect(await laasForVarsel(db, r.id, om(121_000), 120_000)).toEqual(expect.any(String));
  });

  it('frigitt lås kan tas igjen', async () => {
    const r = await opprettForesporsel(db, input(), 'k');
    const token = await laasForVarsel(db, r.id, t0);
    expect(token).toEqual(expect.any(String));
    await frigiVarselLaas(db, r.id, token!);
    expect(await laasForVarsel(db, r.id, t0)).toEqual(expect.any(String));
  });

  it('en holder som overskred lånet, kan ikke frigi den nye holderens lås', async () => {
    const r = await opprettForesporsel(db, input(), 'k');
    const a = await laasForVarsel(db, r.id, t0, 120_000);
    const b = await laasForVarsel(db, r.id, om(121_000), 120_000);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(b).not.toBe(a);
    await frigiVarselLaas(db, r.id, a!);
    // Bs lås står fortsatt: et tredje forsøk før Bs lån utløper feiler.
    expect(await laasForVarsel(db, r.id, om(122_000), 120_000)).toBeNull();
    await frigiVarselLaas(db, r.id, b!);
    expect(await laasForVarsel(db, r.id, om(122_000), 120_000)).not.toBeNull();
  });

  it('to lås-tokener med samme utløpstid er ulike', async () => {
    const r1 = await opprettForesporsel(db, input(), 'k1');
    const r2 = await opprettForesporsel(db, input(), 'k2');
    expect(await laasForVarsel(db, r1.id, t0)).not.toBe(await laasForVarsel(db, r2.id, t0));
  });

  it('varslet, lukket og ukjent id gir ingen lås', async () => {
    const r = await opprettForesporsel(db, input(), 'k');
    await settStatus(db, r.id, 'varslet');
    expect(await laasForVarsel(db, r.id, t0)).toBeNull();
    await settStatus(db, r.id, 'lukket');
    expect(await laasForVarsel(db, r.id, t0)).toBeNull();
    expect(await laasForVarsel(db, 'finnes-ikke', t0)).toBeNull();
  });

  it('sortert kan låses (nytt forsøk etter varsel_feil)', async () => {
    const r = await opprettForesporsel(db, input(), 'k');
    await settStatus(db, r.id, 'sortert');
    expect(await laasForVarsel(db, r.id, t0)).toEqual(expect.any(String));
  });
});
