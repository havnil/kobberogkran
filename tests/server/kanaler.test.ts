import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Miniflare } from 'miniflare';
import type { D1Database } from '@cloudflare/workers-types';
import {
  fyllMal,
  hendelseLogger,
  lagKanaler,
  sendMedReserve,
  tekstForMal,
  type Kanal,
  type Mal,
} from '../../src/server/kanaler/index';
import { FalskKanal } from '../../src/server/kanaler/falsk';
import { opprettForesporsel } from '../../src/server/db';
import type { Env } from '../../src/server/env';
import { nullstill, startD1 } from './d1';

const mal: Mal = { id: 'tapt_anrop', variabler: { skjemaLenke: 'https://a', whatsappLenke: 'https://b' } };
const TIL = '+4791234567';

describe('sendMedReserve', () => {
  it('prøver RCS og så SMS når WhatsApp feiler, og returnerer sms', async () => {
    const wa = new FalskKanal('whatsapp', { ok: false, feil: 'ikke på WhatsApp' });
    const rcs = new FalskKanal('rcs', { ok: false, feil: 'ikke RCS' });
    const sms = new FalskKanal('sms');
    const r = await sendMedReserve([wa, rcs, sms], TIL, mal, { logg: () => {} });
    expect(r.kanal).toBe('sms');
    expect(r.forsok).toEqual([
      { kanal: 'whatsapp', ok: false, feil: 'ikke på WhatsApp' },
      { kanal: 'rcs', ok: false, feil: 'ikke RCS' },
      { kanal: 'sms', ok: true },
    ]);
    expect(sms.kall).toEqual([{ til: TIL, mal }]);
  });

  it('bruker fast rekkefølge WhatsApp → RCS → SMS uansett rekkefølge i lista', async () => {
    const rekkefolge: string[] = [];
    const lag = (navn: Kanal['navn'], ok: boolean): Kanal => ({
      navn,
      async send() {
        rekkefolge.push(navn);
        return { ok };
      },
    });
    const r = await sendMedReserve([lag('sms', true), lag('rcs', false), lag('whatsapp', false)], TIL, mal, {
      logg: () => {},
    });
    expect(rekkefolge).toEqual(['whatsapp', 'rcs', 'sms']);
    expect(r.kanal).toBe('sms');
  });

  it('stopper ved første kanal som lykkes', async () => {
    const wa = new FalskKanal('whatsapp');
    const sms = new FalskKanal('sms');
    const r = await sendMedReserve([wa, sms], TIL, mal);
    expect(r).toEqual({ kanal: 'whatsapp', forsok: [{ kanal: 'whatsapp', ok: true }] });
    expect(sms.kall).toHaveLength(0);
  });

  it('når alle feiler: kanal null, alle tre forsøkene, og en hendelse logges', async () => {
    const logg = vi.fn();
    const r = await sendMedReserve(
      [new FalskKanal('whatsapp', { ok: false }), new FalskKanal('rcs', { ok: false }), new FalskKanal('sms', { ok: false })],
      TIL,
      mal,
      { logg },
    );
    expect(r.kanal).toBeNull();
    expect(r.forsok.map((f) => f.kanal)).toEqual(['whatsapp', 'rcs', 'sms']);
    expect(r.forsok.every((f) => !f.ok)).toBe(true);
    expect(logg).toHaveBeenCalledTimes(1);
    expect(logg).toHaveBeenCalledWith('melding_feilet', { mal: 'tapt_anrop', forsok: r.forsok });
    // Telefonnummeret logges ikke.
    expect(JSON.stringify(logg.mock.calls)).not.toContain(TIL);
  });

  it('en kanal som kaster, regnes som feilet, og neste prøves', async () => {
    const wa = new FalskKanal('whatsapp', { kast: true });
    const sms = new FalskKanal('sms');
    const r = await sendMedReserve([wa, sms], TIL, mal, { logg: () => {} });
    expect(r.kanal).toBe('sms');
    expect(r.forsok[0]).toMatchObject({ kanal: 'whatsapp', ok: false });
    expect(r.forsok[0].feil).toBeTruthy();
  });

  it('uten kanaler: kanal null, ingen forsøk, og det logges', async () => {
    const logg = vi.fn();
    const r = await sendMedReserve([], TIL, mal, { logg });
    expect(r).toEqual({ kanal: null, forsok: [] });
    expect(logg).toHaveBeenCalledWith('melding_ingen_kanal', { mal: 'tapt_anrop', forsok: [] });
  });

  it('en logger som feiler, endrer ikke resultatet', async () => {
    const r = await sendMedReserve([], TIL, mal, {
      logg: () => {
        throw new Error('logg nede');
      },
    });
    expect(r.kanal).toBeNull();
  });
});

describe('lagKanaler', () => {
  it('gir ingen kanaler før leverandører er valgt (oppgave 10)', () => {
    expect(lagKanaler({} as Env)).toEqual([]);
  });
});

describe('maltekst', () => {
  it('fyllMal erstatter kjente {variabler} og lar ukjente stå', () => {
    expect(fyllMal('Hei {navn}, se {lenke} {ukjent}', { navn: 'Kari', lenke: 'https://x' })).toBe(
      'Hei Kari, se https://x {ukjent}',
    );
  });

  it('tekstForMal henter teksten fra tekster (nb som standard)', () => {
    const t = tekstForMal({ id: 'kvittering', variabler: {} });
    expect(t).toContain('PLASSHOLDER');
  });

  it('tekstForMal på engelsk bruker en.json', () => {
    expect(tekstForMal({ id: 'kvittering', variabler: {} }, 'en')).toContain('[EN]');
  });

  it('tekstForMal bruker malens locale (kundens språk) når det er satt', () => {
    expect(tekstForMal({ id: 'kvittering', locale: 'en', variabler: {} })).toContain('[EN]');
    expect(tekstForMal({ id: 'kvittering', locale: 'nb', variabler: {} })).toContain('PLASSHOLDER');
  });

  it('tapt_anrop har alltid begge lenkene, også når malen mangler plassholderne', () => {
    const t = tekstForMal(mal);
    expect(t).toContain('https://a');
    expect(t).toContain('https://b');
  });
});

describe('hendelseLogger', () => {
  let mf: Miniflare;
  let db: D1Database;
  beforeAll(async () => {
    ({ mf, db } = await startD1());
  });
  afterAll(async () => {
    await mf.dispose();
  });
  beforeEach(async () => {
    await nullstill(db);
  });

  it('logger en hendelse på forespørselen når alle kanalene feiler', async () => {
    const { id } = await opprettForesporsel(db, { telefon: TIL, tjeneste: 'service-og-reparasjon' }, 'k1');
    const r = await sendMedReserve(
      [new FalskKanal('whatsapp', { ok: false }), new FalskKanal('rcs', { ok: false }), new FalskKanal('sms', { ok: false })],
      TIL,
      { id: 'kvittering', variabler: {} },
      { logg: hendelseLogger(db, id) },
    );
    expect(r.kanal).toBeNull();
    const rader = await db.prepare('SELECT type, data_json FROM hendelser WHERE foresporsel_id = ?').bind(id).all<{
      type: string;
      data_json: string;
    }>();
    expect(rader.results).toHaveLength(1);
    expect(rader.results[0].type).toBe('melding_feilet');
    expect(JSON.parse(rader.results[0].data_json).forsok).toHaveLength(3);
  });
});
