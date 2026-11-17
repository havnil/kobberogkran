import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Miniflare } from 'miniflare';
import type { D1Database } from '@cloudflare/workers-types';
import { haandterUbesvartAnrop, HmacTelefoniVerifiserer, StandardTelefoniAdapter } from '../../src/server/telefoni';
import { FalskKanal } from '../../src/server/kanaler/falsk';
import type { Env } from '../../src/server/env';
import type { Varsler } from '../../src/server/varsling';
import { nullstill, startD1 } from './d1';

const HEMMELIG = 'telefoni-hemmelighet';
const FRA = '+4791234567';

async function hmacHex(hemmelig: string, tekst: string): Promise<string> {
  const nokkel = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(hemmelig),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', nokkel, new TextEncoder().encode(tekst)));
  return [...sig].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function anrop(kropp: unknown, signatur?: string | null): Promise<Request> {
  const tekst = typeof kropp === 'string' ? kropp : JSON.stringify(kropp);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const sig = signatur === undefined ? await hmacHex(HEMMELIG, tekst) : signatur;
  if (sig !== null) headers['x-signatur'] = sig;
  return new Request('https://kobberogkran.no/api/telefoni/ubesvart', { method: 'POST', headers, body: tekst });
}

let mf: Miniflare;
let db: D1Database;
let env: Env;
let kanaler: FalskKanal[];
let varsler: Varsler & { send: ReturnType<typeof vi.fn> };
let ventende: Promise<unknown>[];
let naa: Date;

const ctx = { waitUntil: (p: Promise<unknown>) => void ventende.push(p) };
const ferdig = () => Promise.all(ventende);
const kjor = (req: Request) => haandterUbesvartAnrop(req, env, ctx, { kanaler, varsler, naa: () => naa });
const sendinger = () => kanaler.reduce((sum, k) => sum + k.kall.length, 0);

beforeAll(async () => {
  ({ mf, db } = await startD1());
});
afterAll(async () => {
  await mf.dispose();
});
beforeEach(async () => {
  await nullstill(db);
  env = {
    DB: db,
    TELEFONI_WEBHOOK_SECRET: HEMMELIG,
    VARSEL_TIL: 'eirik@example.no',
    VARSEL_FRA: 'varsel@kobberogkran.no',
  } as unknown as Env;
  kanaler = [new FalskKanal('whatsapp'), new FalskKanal('rcs'), new FalskKanal('sms')];
  varsler = { send: vi.fn(async () => {}) };
  ventende = [];
  naa = new Date('2026-11-12T10:00:00.000Z');
});

describe('POST /api/telefoni/ubesvart', () => {
  it('ugyldig signatur gir 401, og ingenting sendes', async () => {
    const res = await kjor(await anrop({ fra: FRA }, 'deadbeef'));
    expect(res.status).toBe(401);
    await ferdig();
    expect(sendinger()).toBe(0);
    expect(varsler.send).not.toHaveBeenCalled();
  });

  it('signatur for en annen kropp gir 401', async () => {
    const sig = await hmacHex(HEMMELIG, JSON.stringify({ fra: '+4799999999' }));
    expect((await kjor(await anrop({ fra: FRA }, sig))).status).toBe(401);
  });

  it('manglende signatur gir 401', async () => {
    expect((await kjor(await anrop({ fra: FRA }, null))).status).toBe(401);
  });

  it('uten TELEFONI_WEBHOOK_SECRET avvises alt med 503', async () => {
    env = { ...env, TELEFONI_WEBHOOK_SECRET: undefined };
    expect((await kjor(await anrop({ fra: FRA }))).status).toBe(503);
    await ferdig();
    expect(sendinger()).toBe(0);
  });

  it('ugyldig JSON med gyldig signatur gir 400', async () => {
    expect((await kjor(await anrop('{ikke json'))).status).toBe(400);
  });

  it('sender tapt_anrop med skjemalenke og wa.me, og varsler Eirik', async () => {
    const res = await kjor(await anrop({ fra: FRA, tidspunkt: '2026-11-12T09:59:30Z' }));
    expect(res.status).toBe(200);
    await ferdig();
    expect(kanaler[0].kall).toHaveLength(1);
    const { til, mal } = kanaler[0].kall[0];
    expect(til).toBe(FRA);
    expect(mal.id).toBe('tapt_anrop');
    expect(mal.variabler.skjemaLenke).toBe('https://kobberogkran.no/?kilde=tapt-anrop#skjema');
    expect(mal.variabler.whatsappLenke).toMatch(/^https:\/\/wa\.me\/4700000000(\?text=.*)?$/);
    expect(decodeURIComponent(mal.variabler.whatsappLenke)).toContain('tapt-anrop');
    expect(varsler.send).toHaveBeenCalledTimes(1);
    const [tilEirik, emne, tekst] = varsler.send.mock.calls[0];
    expect(tilEirik).toBe('eirik@example.no');
    expect(emne + tekst).toContain(FRA);
    expect(tekst).toContain('whatsapp');
    const rad = await db.prepare('SELECT fra, melding_kanal FROM anrop').first();
    expect(rad).toEqual({ fra: FRA, melding_kanal: 'whatsapp' });
  });

  it('NETTSTED_URL brukes i skjemalenken', async () => {
    env = { ...env, NETTSTED_URL: 'https://preview.example.dev/' };
    await kjor(await anrop({ fra: FRA }));
    await ferdig();
    expect(kanaler[0].kall[0].mal.variabler.skjemaLenke).toBe('https://preview.example.dev/?kilde=tapt-anrop#skjema');
  });

  it('samme nummer to ganger innen 30 minutter gir én melding, men Eirik varsles begge gangene', async () => {
    await kjor(await anrop({ fra: FRA }));
    await ferdig();
    naa = new Date('2026-11-12T10:29:00.000Z');
    await kjor(await anrop({ fra: FRA }));
    await ferdig();
    expect(sendinger()).toBe(1);
    expect(varsler.send).toHaveBeenCalledTimes(2);
  });

  it('to samtidige anrop fra samme nummer gir én melding', async () => {
    const [a, b] = await Promise.all([kjor(await anrop({ fra: FRA })), kjor(await anrop({ fra: FRA }))]);
    expect([a.status, b.status]).toEqual([200, 200]);
    await ferdig();
    expect(sendinger()).toBe(1);
  });

  it('etter 30 minutter får samme nummer ny melding', async () => {
    await kjor(await anrop({ fra: FRA }));
    await ferdig();
    naa = new Date('2026-11-12T10:30:01.000Z');
    await kjor(await anrop({ fra: FRA }));
    await ferdig();
    expect(sendinger()).toBe(2);
  });

  it('ulike numre får hver sin melding', async () => {
    await kjor(await anrop({ fra: FRA }));
    await kjor(await anrop({ fra: '+4798765432' }));
    await ferdig();
    expect(sendinger()).toBe(2);
  });

  it.each([{}, { fra: '' }, { fra: 'anonymous' }, { fra: '12345' }])(
    'skjult eller ugyldig nummer %j gir ingen melding, bare varsel til Eirik',
    async (kropp) => {
      const res = await kjor(await anrop(kropp));
      expect(res.status).toBe(200);
      await ferdig();
      expect(sendinger()).toBe(0);
      expect(varsler.send).toHaveBeenCalledTimes(1);
      expect(await db.prepare('SELECT COUNT(*) AS n FROM anrop').first('n')).toBe(0);
    },
  );

  it('når alle kanalene feiler, får Eirik vite det', async () => {
    kanaler = [new FalskKanal('whatsapp', { ok: false }), new FalskKanal('sms', { ok: false })];
    await kjor(await anrop({ fra: FRA }));
    await ferdig();
    expect(varsler.send).toHaveBeenCalledTimes(1);
    expect(varsler.send.mock.calls[0][2]).toMatch(/ikke sendt/i);
    expect(await db.prepare('SELECT melding_kanal FROM anrop').first('melding_kanal')).toBeNull();
  });

  it('når D1 feiler: 200, ingen melding, men Eirik varsles om anropet', async () => {
    env = {
      ...env,
      DB: {
        prepare() {
          throw new Error('D1 nede');
        },
      },
    } as unknown as Env;
    const res = await kjor(await anrop({ fra: FRA }));
    expect(res.status).toBe(200);
    await ferdig();
    expect(sendinger()).toBe(0);
    expect(varsler.send).toHaveBeenCalledTimes(1);
    const [, emne, tekst] = varsler.send.mock.calls[0];
    expect(emne + tekst).toContain(FRA);
    expect(tekst).toMatch(/ikke sendt/i);
  });

  it('for stor kropp gir 413', async () => {
    const res = await kjor(await anrop({ fra: FRA, fyll: 'x'.repeat(70 * 1024) }));
    expect(res.status).toBe(413);
    await ferdig();
    expect(sendinger()).toBe(0);
  });

  it('svarer 200 selv om varselet til Eirik feiler', async () => {
    varsler.send.mockRejectedValue(new Error('e-post nede'));
    const res = await kjor(await anrop({ fra: FRA }));
    expect(res.status).toBe(200);
    await expect(ferdig()).resolves.toBeDefined();
    expect(sendinger()).toBe(1);
  });
});

describe('HmacTelefoniVerifiserer', () => {
  it('godtar riktig hex-signatur uansett store/små bokstaver', async () => {
    const kropp = '{"fra":"+4791234567"}';
    const sig = (await hmacHex(HEMMELIG, kropp)).toUpperCase();
    const v = new HmacTelefoniVerifiserer(HEMMELIG);
    const headers = new Headers({ 'x-signatur': sig });
    expect(await v.verifiser(headers, new TextEncoder().encode(kropp).buffer as ArrayBuffer)).toBe(true);
  });

  it('avviser signatur som ikke er hex', async () => {
    const v = new HmacTelefoniVerifiserer(HEMMELIG);
    expect(await v.verifiser(new Headers({ 'x-signatur': 'zz' }), new ArrayBuffer(0))).toBe(false);
  });
});

describe('StandardTelefoniAdapter', () => {
  const a = new StandardTelefoniAdapter();
  it('tolker fra og tidspunkt', () => {
    expect(a.tolk({ fra: '+47 912 34 567', tidspunkt: 'x' })).toEqual({ fra: FRA, tidspunkt: 'x' });
  });
  it('gir fra null for skjult nummer', () => {
    expect(a.tolk({ fra: 'anonymous' })).toEqual({ fra: null });
  });
  it('gir null for noe som ikke er et objekt', () => {
    expect(a.tolk([1, 2])).toBeNull();
  });
});
