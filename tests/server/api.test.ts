// API-et for skjemaet (oppgave 7): steg 1, steg 2, bildeopplasting, signerte bildelenker og
// tilleggsvarsel til Eirik. Kjører handlerne direkte mot Miniflare-D1 og et falskt R2.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Miniflare } from 'miniflare';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { nullstill, startD1 } from './d1';
import { hentForesporsel, opprettForesporsel, settStatus, sisteSamtykke } from '../../src/server/db';
import { sorterOgVarsle } from '../../src/server/sortering/index';
import type { Env } from '../../src/server/env';
import type { Varsler } from '../../src/server/varsling';
import { FalskKanal } from '../../src/server/kanaler/falsk';
import { FalskSorterer, type Sorterer } from '../../src/server/sortering/ai';
import { signerBildeLenke } from '../../src/server/bildelenke';
import { lagSkjemaToken, verifiserSkjemaToken } from '../../src/server/token';
import { normaliserTelefon, rensKilde, MAKS_BILDE_BYTES, MAKS_BILDER } from '../../src/server/validering';
import {
  haandterBildeOpplasting,
  haandterHentBilde,
  haandterSteg1,
  haandterSteg2,
  type SkjemaDeps,
} from '../../src/server/skjema';

// Miniflare-D1 bruker noen hundre ms per test; testene med mange opplastinger trenger mer tid.
vi.setConfig({ testTimeout: 30_000 });

const SKJEMA = 'skjema-hemmelighet';
const TURN = 'turnstile-hemmelighet';
const BASE = 'https://kobberogkran.no';

// --- Falskt R2 (put/get/delete i minnet) ---
class FalskR2 {
  readonly objekter = new Map<string, { data: Uint8Array<ArrayBuffer>; type?: string }>();
  async put(nokkel: string, verdi: ArrayBuffer | Uint8Array, valg?: { httpMetadata?: { contentType?: string } }) {
    const data = verdi instanceof Uint8Array ? new Uint8Array(verdi) : new Uint8Array(verdi);
    this.objekter.set(nokkel, { data, type: valg?.httpMetadata?.contentType });
    return {};
  }
  async get(nokkel: string) {
    const o = this.objekter.get(nokkel);
    if (!o) return null;
    return { body: new Blob([o.data]).stream(), size: o.data.byteLength, httpMetadata: { contentType: o.type } };
  }
  async delete(nokkel: string) {
    this.objekter.delete(nokkel);
  }
}

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 2, 3, 4, 5]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);
const HEIC = Uint8Array.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0]);

let mf: Miniflare;
let db: D1Database;
let env: Env;
let r2: FalskR2;
let kanaler: FalskKanal[];
let varsler: Varsler & { send: ReturnType<typeof vi.fn> };
let turnstile: ReturnType<typeof vi.fn>;
let sorterer: Sorterer;
let ventende: Promise<unknown>[];
let naa: Date;
let vent: (ms: number) => Promise<void>;

const ctx = { waitUntil: (p: Promise<unknown>) => void ventende.push(p) };
/** Venter til alle waitUntil-løftene (også de som legges til underveis) er ferdige. */
async function ferdig() {
  for (let i = 0; i < ventende.length; i++) await ventende[i];
}
const deps = (): SkjemaDeps => ({ kanaler, varsler, sorterer, turnstileFetch: turnstile as unknown as typeof fetch, naa: () => naa, vent });
const kvitteringer = () => kanaler[0].kall.filter((k) => k.mal.id === 'kvittering');

function steg1(over: Record<string, unknown> = {}) {
  return {
    tjeneste: 'varmtvannstank',
    hast: 'snart',
    sted: { tekst: 'Bjerkeveien 1, Bjørkelangen' },
    navn: 'Ola Nordmann',
    telefon: '912 34 567',
    idemNokkel: 'idem-0000000000000001',
    turnstileToken: 'tt-ok',
    honning: '',
    ...over,
  };
}

const postJson = (kropp: unknown) =>
  new Request(`${BASE}/api/foresporsel`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(kropp),
  });

const kjorSteg1 = (req: Request) => haandterSteg1(req, env, ctx, deps());

async function opprett(over: Record<string, unknown> = {}): Promise<{ id: string; token: string }> {
  const res = await kjorSteg1(postJson(steg1(over)));
  expect(res.status).toBe(201);
  return res.json();
}

const patch = (id: string, kropp: unknown, token?: string) =>
  haandterSteg2(
    new Request(`${BASE}/api/foresporsel/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(kropp),
    }),
    env,
    ctx,
    id,
    deps(),
  );

const lastOpp = (id: string, token: string, bytes: Uint8Array | ReadableStream, type = 'image/jpeg', ekstra = '', headers: Record<string, string> = {}) =>
  haandterBildeOpplasting(
    new Request(`${BASE}/api/bilde?id=${id}&token=${token}${ekstra}`, {
      method: 'POST',
      headers: { 'content-type': type, ...headers },
      body: bytes as BodyInit,
      // @ts-expect-error Node trenger duplex for strømmer
      duplex: 'half',
    }),
    env,
    ctx,
    deps(),
  );

async function antall(tabell: string): Promise<number> {
  const r = await db.prepare(`SELECT COUNT(*) AS n FROM ${tabell}`).first<{ n: number }>();
  return r!.n;
}

async function hendelser(id: string): Promise<{ type: string; data_json: string | null }[]> {
  const r = await db.prepare('SELECT type, data_json FROM hendelser WHERE foresporsel_id = ? ORDER BY rowid').bind(id).all<{ type: string; data_json: string | null }>();
  return r.results;
}

beforeAll(async () => {
  ({ mf, db } = await startD1());
});
afterAll(async () => {
  await mf.dispose();
});
// Ingen waitUntil-jobb fra en test får kjøre videre inn i den neste.
afterEach(async () => {
  await ferdig();
});
beforeEach(async () => {
  await nullstill(db);
  r2 = new FalskR2();
  env = {
    DB: db,
    BILDER: r2 as unknown as R2Bucket,
    SKJEMA_HMAC: SKJEMA,
    TURNSTILE_SECRET: TURN,
    VARSEL_TIL: 'eirik@example.no',
    VARSEL_FRA: 'varsel@kobberogkran.no',
    NETTSTED_URL: BASE,
  } as unknown as Env;
  kanaler = [new FalskKanal('whatsapp')];
  varsler = { send: vi.fn(async () => {}) };
  turnstile = vi.fn(async () => Response.json({ success: true }));
  sorterer = new FalskSorterer({ sammendrag: 'Bytte tank', hast: 'snart', svarutkast: 'Hei' });
  ventende = [];
  naa = new Date('2026-11-12T10:00:00.000Z');
  vent = async () => {};
});

describe('validering', () => {
  it('normaliserer norske nummer til E.164', () => {
    expect(normaliserTelefon('912 34 567')).toBe('+4791234567');
    expect(normaliserTelefon('+47 912-34-567')).toBe('+4791234567');
    expect(normaliserTelefon('0047 91234567')).toBe('+4791234567');
    expect(normaliserTelefon('4791234567')).toBe('+4791234567');
    expect(normaliserTelefon('(+47) 63 85 00 00')).toBe('+4763850000');
  });

  it('avviser andre nummer', () => {
    for (const n of ['', '1234567', '0123 45 67', '+46 70 123 45 67', '912345678', 'abc', '+47 112']) {
      expect(normaliserTelefon(n), n).toBeNull();
    }
  });

  it('renser kilde til [a-z0-9-], maks 40', () => {
    expect(rensKilde('Tapt-Anrop')).toBe('tapt-anrop');
    expect(rensKilde('<script>alert(1)</script>')).toBe('scriptalert1script');
    expect(rensKilde('x'.repeat(100))).toHaveLength(40);
    expect(rensKilde('!!!')).toBeNull();
    expect(rensKilde(42)).toBeNull();
  });
});

describe('token', () => {
  it('er HMAC-SHA256 hex av skjema:<id>, og verifiseres i konstant tid', async () => {
    const t = await lagSkjemaToken('abc', SKJEMA);
    expect(t).toMatch(/^[0-9a-f]{64}$/);
    expect(await verifiserSkjemaToken('abc', t, SKJEMA)).toBe(true);
    expect(await verifiserSkjemaToken('abd', t, SKJEMA)).toBe(false);
    expect(await verifiserSkjemaToken('abc', t, 'annen')).toBe(false);
    expect(await verifiserSkjemaToken('abc', 'zz', SKJEMA)).toBe(false);
    // Skiller seg fra bildelenkene (prefiks bilde:)
    expect((await signerBildeLenke('abc', SKJEMA, 1)).includes(t)).toBe(false);
  });
});

describe('POST /api/foresporsel (steg 1)', () => {
  it('gyldige data gir 201 med id og token, og en rad finnes', async () => {
    const res = await kjorSteg1(postJson(steg1({ epost: 'ola@example.no', kilde: 'Tapt-Anrop!' })));
    expect(res.status).toBe(201);
    const { id, token } = (await res.json()) as { id: string; token: string };
    expect(await verifiserSkjemaToken(id, token, SKJEMA)).toBe(true);
    const f = await hentForesporsel(db, id);
    expect(f).not.toBeNull();
    expect(f!.kunde.telefon).toBe('+4791234567');
    expect(f!.kunde.epost).toBe('ola@example.no');
    expect(f!.tjeneste).toBe('varmtvannstank');
    expect(f!.hast).toBe('snart');
    expect(f!.kilde).toBe('tapt-anrop');
    expect(f!.stedTekst).toBe('Bjerkeveien 1, Bjørkelangen');
  });

  it('sender kvittering med lenke til send-bilder, og sorterer og varsler i waitUntil', async () => {
    const { id, token } = await opprett();
    await ferdig();
    const k = kvitteringer();
    expect(k).toHaveLength(1);
    expect(k[0].til).toBe('+4791234567');
    expect(k[0].mal.variabler.sendBilderLenke).toBe(`${BASE}/send-bilder/?id=${id}&token=${token}`);
    expect(varsler.send).toHaveBeenCalledTimes(1);
    expect((await hentForesporsel(db, id))!.status).toBe('varslet');
  });

  it('engelsk skjema lenker til /en/send-photos/', async () => {
    const { id, token } = await opprett({ locale: 'en' });
    await ferdig();
    expect(kvitteringer()[0].mal.variabler.sendBilderLenke).toBe(`${BASE}/en/send-photos/?id=${id}&token=${token}`);
  });

  it('samme idemNokkel to ganger gir én rad og én kvittering (200 med samme id og token)', async () => {
    const forste = await kjorSteg1(postJson(steg1()));
    const andre = await kjorSteg1(postJson(steg1()));
    expect(forste.status).toBe(201);
    expect(andre.status).toBe(200);
    expect(await andre.json()).toEqual(await forste.json());
    await ferdig();
    expect(await antall('foresporsler')).toBe(1);
    expect(kvitteringer()).toHaveLength(1);
    expect(varsler.send).toHaveBeenCalledTimes(1);
    // Turnstile-tokenet er engangs; gjentaket trenger det ikke.
    expect(turnstile).toHaveBeenCalledTimes(1);
  });

  it('samme idemNokkel med et annet telefonnummer gir 409', async () => {
    await opprett();
    const res = await kjorSteg1(postJson(steg1({ telefon: '41234567' })));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ feil: 'konflikt', felt: 'idemNokkel' });
  });

  it('manglende telefon gir 400 med felt telefon', async () => {
    const { telefon: _t, ...uten } = steg1();
    const res = await kjorSteg1(postJson(uten));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ feil: 'mangler', felt: 'telefon' });
    expect(await antall('foresporsler')).toBe(0);
  });

  it('utenlandsk telefon gir 400 med felt telefon', async () => {
    const res = await kjorSteg1(postJson(steg1({ telefon: '+46 70 123 45 67' })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ feil: 'ugyldig', felt: 'telefon' });
  });

  it.each([
    ['tjeneste', { tjeneste: 'elektro' }],
    ['hast', { hast: 'i-går' }],
    ['navn', { navn: '' }],
    ['navn', { navn: 'x'.repeat(201) }],
    ['epost', { epost: 'ikke-en-adresse' }],
    ['sted', { sted: {} }],
    ['sted', { sted: { tekst: 'x'.repeat(301) } }],
    ['sted', { sted: { lat: 200, lon: 11 } }],
    ['idemNokkel', { idemNokkel: 'kort' }],
    ['turnstileToken', { turnstileToken: '' }],
  ])('ugyldig %s gir 400 med felt', async (felt, over) => {
    const res = await kjorSteg1(postJson(steg1(over)));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { felt: string }).felt).toBe(felt);
  });

  it('ugyldig JSON gir 400 med feil-form', async () => {
    const res = await kjorSteg1(
      new Request(`${BASE}/api/foresporsel`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ feil: 'ugyldig_kropp' });
  });

  it('kropp over 64 KB gir 413', async () => {
    const res = await kjorSteg1(postJson(steg1({ navn: 'x'.repeat(70_000) })));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ feil: 'for_stor' });
  });

  it('utfylt honning gir 201 uten rad, uten kvittering og uten Turnstile', async () => {
    const res = await kjorSteg1(postJson(steg1({ honning: 'http://spam.example' })));
    expect(res.status).toBe(201);
    const svar = (await res.json()) as { id: string; token: string };
    expect(svar.id).toBeTruthy();
    expect(svar.token).toMatch(/^[0-9a-f]{64}$/);
    await ferdig();
    expect(await antall('foresporsler')).toBe(0);
    expect(kvitteringer()).toHaveLength(0);
    expect(turnstile).not.toHaveBeenCalled();
  });

  it('verifiserer Turnstile på serveren med hemmeligheten', async () => {
    await opprett();
    expect(turnstile).toHaveBeenCalledTimes(1);
    const [url, init] = turnstile.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    const form = init.body as URLSearchParams;
    expect(form.get('secret')).toBe(TURN);
    expect(form.get('response')).toBe('tt-ok');
  });

  it('avvist Turnstile gir 403 og ingen rad', async () => {
    turnstile.mockImplementation(async () => Response.json({ success: false, 'error-codes': ['invalid-input-response'] }));
    const res = await kjorSteg1(postJson(steg1()));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ feil: 'turnstile', felt: 'turnstileToken' });
    expect(await antall('foresporsler')).toBe(0);
  });

  it('Turnstile utilgjengelig gir 503', async () => {
    turnstile.mockImplementation(async () => {
      throw new Error('nett nede');
    });
    const res = await kjorSteg1(postJson(steg1()));
    expect(res.status).toBe(503);
    expect(await antall('foresporsler')).toBe(0);
  });

  it('manglende TURNSTILE_SECRET gir 503 (stengt)', async () => {
    env.TURNSTILE_SECRET = undefined;
    const res = await kjorSteg1(postJson(steg1()));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ feil: 'ikke_konfigurert' });
    expect(await antall('foresporsler')).toBe(0);
  });

  it('manglende SKJEMA_HMAC eller DB gir 503', async () => {
    env.SKJEMA_HMAC = undefined;
    expect((await kjorSteg1(postJson(steg1()))).status).toBe(503);
    env.SKJEMA_HMAC = SKJEMA;
    (env as { DB?: unknown }).DB = undefined;
    expect((await kjorSteg1(postJson(steg1()))).status).toBe(503);
  });

  it('Gjennomgangsfokus 3: sted med bare tekst «hytta ved Mangen» gir 201', async () => {
    const res = await kjorSteg1(postJson(steg1({ tjeneste: 'hytte', sted: { tekst: 'hytta ved Mangen' } })));
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    const f = await hentForesporsel(db, id);
    expect(f!.stedTekst).toBe('hytta ved Mangen');
    expect(f!.lat).toBeNull();
    expect(f!.kjoretidMin).toBeNull();
  });

  it('sted med bare gårds- og bruksnummer gir 201', async () => {
    const { id } = await opprett({ sted: { gnr: 12, bnr: '3' } });
    expect((await hentForesporsel(db, id))!.stedTekst).toBe('gnr. 12, bnr. 3');
  });

  it('sted med bare koordinater gir 201', async () => {
    const { id } = await opprett({ sted: { lat: 59.85, lon: 11.56 } });
    const f = await hentForesporsel(db, id);
    expect(f!.lat).toBe(59.85);
    expect(f!.stedTekst).toBeNull();
  });

  describe('skjema uten JavaScript', () => {
    const skjemaPost = (felt: Record<string, string>, type: 'urlencoded' | 'multipart' = 'urlencoded') => {
      let body: BodyInit;
      const headers: Record<string, string> = { accept: 'text/html,application/xhtml+xml' };
      if (type === 'urlencoded') {
        body = new URLSearchParams(felt);
        headers['content-type'] = 'application/x-www-form-urlencoded';
      } else {
        const fd = new FormData();
        for (const [k, v] of Object.entries(felt)) fd.set(k, v);
        body = fd;
      }
      return new Request(`${BASE}/api/foresporsel`, { method: 'POST', headers, body });
    };
    const felt = {
      tjeneste: 'bad',
      hast: 'kan-planlegges',
      sted: 'Hemnes',
      navn: 'Kari',
      telefon: '41234567',
      'cf-turnstile-response': 'tt-ok',
      honning: '',
    };

    it('urlencoded gir 303 til takkesiden og lagrer forespørselen', async () => {
      const res = await kjorSteg1(skjemaPost(felt));
      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toBe('/takk/');
      expect(await antall('foresporsler')).toBe(1);
      await ferdig();
      expect(kvitteringer()).toHaveLength(1);
    });

    it('multipart på engelsk gir 303 til /en/thanks/', async () => {
      const res = await kjorSteg1(skjemaPost({ ...felt, locale: 'en' }, 'multipart'));
      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toBe('/en/thanks/');
    });

    it('valideringsfeil gir 303 til takkesiden med feilkode og felt', async () => {
      const res = await kjorSteg1(skjemaPost({ ...felt, telefon: '' }));
      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toBe('/takk/?feil=mangler&felt=telefon');
      expect(await antall('foresporsler')).toBe(0);
    });

    it('honning gir 303 uten rad', async () => {
      const res = await kjorSteg1(skjemaPost({ ...felt, honning: 'spam' }));
      expect(res.status).toBe(303);
      expect(await antall('foresporsler')).toBe(0);
    });

    it('uten idemNokkel gir to innsendinger to rader', async () => {
      await kjorSteg1(skjemaPost(felt));
      await kjorSteg1(skjemaPost(felt));
      expect(await antall('foresporsler')).toBe(2);
    });
  });
});

describe('PATCH /api/foresporsel/:id (steg 2)', () => {
  it('feil token gir 401', async () => {
    const { id } = await opprett();
    const res = await patch(id, { beskrivelse: 'Lekker' }, 'f'.repeat(64));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ feil: 'uautorisert' });
  });

  it('manglende token gir 401, og token for en annen id gir 401', async () => {
    const { id } = await opprett();
    expect((await patch(id, { beskrivelse: 'x' })).status).toBe(401);
    const annen = await lagSkjemaToken('annen-id', SKJEMA);
    expect((await patch(id, { beskrivelse: 'x' }, annen)).status).toBe(401);
  });

  it('gyldig token lagrer beskrivelse, svar og samtykker', async () => {
    const { id, token } = await opprett();
    const res = await patch(
      id,
      {
        beskrivelse: 'Tanken lekker i bunnen',
        felles: { vann: 'kommunalt', byggeaar: 1985 },
        tjenesteSvar: { etasje: 'kjeller', tilkobling: 'stikkontakt' },
        hvorHorte: 'nabo',
        samtykker: { paaminnelser: true, whatsapp: false },
      },
      token,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const f = await hentForesporsel(db, id);
    expect(f!.beskrivelse).toBe('Tanken lekker i bunnen');
    expect(f!.svar).toEqual({
      felles: { vann: 'kommunalt', byggeaar: 1985 },
      tjenesteSvar: { etasje: 'kjeller', tilkobling: 'stikkontakt' },
      hvorHorte: 'nabo',
    });
    const kunde = await db.prepare('SELECT kunde_id FROM foresporsler WHERE id = ?').bind(id).first<{ kunde_id: string }>();
    expect(await sisteSamtykke(db, kunde!.kunde_id, 'paaminnelser')).toBe(true);
    expect(await sisteSamtykke(db, kunde!.kunde_id, 'whatsapp')).toBe(false);
    const kilde = await db.prepare("SELECT kilde FROM samtykker WHERE type = 'paaminnelser'").first<{ kilde: string }>();
    expect(kilde!.kilde).toBe('skjema');
  });

  it('samme samtykke to ganger gir én rad i historikken', async () => {
    const { id, token } = await opprett();
    await patch(id, { samtykker: { paaminnelser: true } }, token);
    await patch(id, { samtykker: { paaminnelser: true } }, token);
    expect(await antall('samtykker')).toBe(1);
    await patch(id, { samtykker: { paaminnelser: false } }, token);
    expect(await antall('samtykker')).toBe(2);
  });

  it('ugyldige felt gir 400 med felt', async () => {
    const { id, token } = await opprett();
    const tilfeller: [unknown, string][] = [
      [{ beskrivelse: 'x'.repeat(4001) }, 'beskrivelse'],
      [{ felles: 'tekst' }, 'felles'],
      [{ tjenesteSvar: { nested: { dypt: true } } }, 'tjenesteSvar'],
      [{ hvorHorte: 'Facebook!!' }, 'hvorHorte'],
      [{ samtykker: { paaminnelser: 'ja' } }, 'samtykker'],
    ];
    for (const [kropp, felt] of tilfeller) {
      const res = await patch(id, kropp, token);
      expect(res.status, felt).toBe(400);
      expect(((await res.json()) as { felt: string }).felt).toBe(felt);
    }
  });

  it('ukjent id med gyldig token gir 404', async () => {
    const token = await lagSkjemaToken('finnes-ikke', SKJEMA);
    expect((await patch('finnes-ikke', { beskrivelse: 'x' }, token)).status).toBe(404);
  });
});

describe('POST /api/bilde', () => {
  it('lagrer bildet i R2 under foresporsler/<id>/<uuid> og gir 201 med bildeId', async () => {
    const { id, token } = await opprett();
    const res = await lastOpp(id, token, JPEG);
    expect(res.status).toBe(201);
    const { bildeId } = (await res.json()) as { bildeId: string };
    const nokkel = `foresporsler/${id}/${bildeId}`;
    expect(r2.objekter.get(nokkel)?.type).toBe('image/jpeg');
    const f = await hentForesporsel(db, id);
    expect(f!.bilder).toEqual([{ id: bildeId, r2Nokkel: nokkel }]);
  });

  it('godtar png og heic, og multipart med feltet bilde', async () => {
    const { id, token } = await opprett();
    expect((await lastOpp(id, token, PNG, 'image/png')).status).toBe(201);
    const fd = new FormData();
    fd.set('bilde', new File([HEIC], 'IMG_0001.HEIC', { type: 'image/heic' }));
    const res = await haandterBildeOpplasting(
      new Request(`${BASE}/api/bilde?id=${id}&token=${token}`, { method: 'POST', body: fd }),
      env,
      ctx,
      deps(),
    );
    expect(res.status).toBe(201);
    const typer = [...r2.objekter.values()].map((o) => o.type).sort();
    expect(typer).toEqual(['image/heic', 'image/png']);
  });

  it('typen bestemmes av innholdet: tekst med image/jpeg gir 415', async () => {
    const { id, token } = await opprett();
    const res = await lastOpp(id, token, new TextEncoder().encode('<html>hei</html>'));
    expect(res.status).toBe(415);
    expect(await res.json()).toEqual({ feil: 'feil_type', felt: 'bilde' });
    expect(r2.objekter.size).toBe(0);
  });

  it('feil token gir 401', async () => {
    const { id } = await opprett();
    expect((await lastOpp(id, 'f'.repeat(64), JPEG)).status).toBe(401);
    expect(r2.objekter.size).toBe(0);
  });

  it('bilde over 10 MB gir 413 (Content-Length)', async () => {
    const { id, token } = await opprett();
    const stor = new Uint8Array(MAKS_BILDE_BYTES + 1);
    stor.set(JPEG);
    const res = await lastOpp(id, token, stor, 'image/jpeg', '', { 'content-length': String(stor.byteLength) });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ feil: 'for_stor', felt: 'bilde' });
    expect(r2.objekter.size).toBe(0);
    expect(await antall('bilder')).toBe(0);
  });

  it('bilde over 10 MB uten Content-Length gir 413 når strømmen passerer grensen', async () => {
    const { id, token } = await opprett();
    let sendt = 0;
    const bit = new Uint8Array(1024 * 1024);
    bit.set(JPEG);
    const strom = new ReadableStream<Uint8Array>({
      pull(c) {
        if (sendt > 20) return c.close();
        sendt++;
        c.enqueue(bit.slice());
      },
    });
    const res = await lastOpp(id, token, strom);
    expect(res.status).toBe(413);
    expect(sendt).toBeLessThanOrEqual(12); // sluttet å lese like etter grensen
    expect(r2.objekter.size).toBe(0);
  });

  it(`maks ${MAKS_BILDER} bilder per forespørsel (det neste gir 409)`, async () => {
    const { id, token } = await opprett();
    for (let i = 0; i < MAKS_BILDER; i++) expect((await lastOpp(id, token, JPEG)).status).toBe(201);
    const res = await lastOpp(id, token, JPEG);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ feil: 'for_mange', felt: 'bilde' });
    expect(r2.objekter.size).toBe(MAKS_BILDER);
    expect(await antall('bilder')).toBe(MAKS_BILDER);
  });

  it('merke legges i svar_json.bildeMerker og overlever steg 2', async () => {
    const { id, token } = await opprett();
    await lastOpp(id, token, JPEG, 'image/jpeg', '&merke=typeskilt');
    await patch(id, { beskrivelse: 'x', tjenesteSvar: { etasje: '1' } }, token);
    await lastOpp(id, token, JPEG, 'image/jpeg', '&merke=tank');
    const f = await hentForesporsel(db, id);
    expect(f!.svar).toEqual({ tjenesteSvar: { etasje: '1' }, bildeMerker: ['typeskilt', 'tank'] });
  });

  it('skjema uten JavaScript gir 303 tilbake til send-bilder-siden', async () => {
    const { id, token } = await opprett();
    const fd = new FormData();
    fd.set('bilde', new File([JPEG], 'a.jpg', { type: 'image/jpeg' }));
    fd.set('locale', 'en');
    const res = await haandterBildeOpplasting(
      new Request(`${BASE}/api/bilde?id=${id}&token=${token}`, { method: 'POST', body: fd, headers: { accept: 'text/html' } }),
      env,
      ctx,
      deps(),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe(`/en/send-photos/?id=${id}&token=${token}&ok=1`);
  });

  it('Gjennomgangsfokus 1: steg 1 uten bilder, så en avbrutt opplasting. Forespørselen står, og kvitteringen er sendt én gang', async () => {
    const { id, token } = await opprett();
    const strom = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(JPEG);
      },
      pull(c) {
        c.error(new Error('forbindelsen brøt'));
      },
    });
    const res = await lastOpp(id, token, strom);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ feil: 'avbrutt', felt: 'bilde' });
    await ferdig();
    const f = await hentForesporsel(db, id);
    expect(['ny', 'sortert', 'varslet']).toContain(f!.status);
    expect(f!.bilder).toHaveLength(0);
    expect(r2.objekter.size).toBe(0);
    expect(kvitteringer()).toHaveLength(1);
  });
});

describe('GET /api/bilde/:id', () => {
  async function medBilde() {
    const { id, token } = await opprett();
    const { bildeId } = (await (await lastOpp(id, token, PNG, 'image/png')).json()) as { bildeId: string };
    return bildeId;
  }
  const hent = (sti: string, nu = naa) => haandterHentBilde(new Request(`${BASE}${sti}`), env, { naa: () => nu });

  it('gyldig signatur gir bildet med private, no-store og riktig type', async () => {
    const bildeId = await medBilde();
    const sti = await signerBildeLenke(bildeId, SKJEMA, Math.floor(naa.getTime() / 1000) + 60);
    const res = await hent(sti);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('content-disposition')).toBe('inline');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);
  });

  it('utløpt lenke gir 403', async () => {
    const bildeId = await medBilde();
    const sti = await signerBildeLenke(bildeId, SKJEMA, Math.floor(naa.getTime() / 1000) + 60);
    expect((await hent(sti, new Date(naa.getTime() + 61_000))).status).toBe(403);
  });

  it('feil signatur eller signatur for et annet bilde gir 403', async () => {
    const bildeId = await medBilde();
    const utl = Math.floor(naa.getTime() / 1000) + 60;
    expect((await hent(`/api/bilde/${bildeId}?utloper=${utl}&sig=${'0'.repeat(64)}`)).status).toBe(403);
    const annen = await signerBildeLenke('annet-bilde', SKJEMA, utl);
    expect((await hent(annen.replace('annet-bilde', bildeId))).status).toBe(403);
    expect((await hent(`/api/bilde/${bildeId}`)).status).toBe(403);
  });

  it('ukjent bilde med gyldig signatur gir 404', async () => {
    const sti = await signerBildeLenke('finnes-ikke', SKJEMA, Math.floor(naa.getTime() / 1000) + 60);
    expect((await hent(sti)).status).toBe(404);
  });

  it('manglende SKJEMA_HMAC gir 503', async () => {
    const bildeId = await medBilde();
    const sti = await signerBildeLenke(bildeId, SKJEMA, Math.floor(naa.getTime() / 1000) + 60);
    env.SKJEMA_HMAC = undefined;
    expect((await hent(sti)).status).toBe(503);
  });
});

describe('tillegg til Eirik etter varselet', () => {
  const tillegg = () => varsler.send.mock.calls.filter((c) => String(c[1]).startsWith('Tillegg'));

  it('ingen tillegg mens status er ny (hovedvarselet tar det med)', async () => {
    const { id } = await opprettForesporsel(db, { telefon: '+4791234567', tjeneste: 'bad' }, 'idem-direkte-0000001');
    const token = await lagSkjemaToken(id, SKJEMA);
    expect((await lastOpp(id, token, JPEG)).status).toBe(201);
    await ferdig();
    expect(varsler.send).not.toHaveBeenCalled();
    await sorterOgVarsle(env, id, { sorterer, varsler, naa: () => naa });
    expect(varsler.send).toHaveBeenCalledTimes(1);
    expect(String(varsler.send.mock.calls[0][2])).toContain('/api/bilde/');
    // En senere endring tar ikke med bildet på nytt.
    naa = new Date(naa.getTime() + 60_000);
    await patch(id, { beskrivelse: 'mer' }, token);
    await ferdig();
    expect(tillegg()).toHaveLength(1);
    expect(String(tillegg()[0][2])).not.toContain('/api/bilde/');
  });

  it('8 bilder i en støt etter varselet gir ett tillegg med alle lenkene', async () => {
    const { id, token } = await opprett();
    await ferdig();
    expect((await hentForesporsel(db, id))!.status).toBe('varslet');
    let slipp!: () => void;
    const port = new Promise<void>((r) => (slipp = r));
    vent = vi.fn(() => port);
    for (let i = 0; i < 8; i++) {
      naa = new Date(naa.getTime() + 1000);
      expect((await lastOpp(id, token, JPEG, 'image/jpeg', i === 0 ? '&merke=typeskilt' : '')).status).toBe(201);
    }
    slipp();
    await ferdig();
    expect(tillegg()).toHaveLength(1);
    const [til, emne, tekst] = tillegg()[0] as [string, string, string];
    expect(til).toBe('eirik@example.no');
    expect(emne).toContain('varmtvannstank');
    expect(tekst.match(/\/api\/bilde\/[0-9a-f-]+\?utloper=\d+&sig=[0-9a-f]{64}/g)).toHaveLength(8);
    expect(tekst).toContain('typeskilt');
    expect(tekst).not.toContain('Sammendrag'); // ingen AI
  });

  it('nytt tillegg først når samlevinduet er over', async () => {
    const { id, token } = await opprett();
    await ferdig();
    await lastOpp(id, token, JPEG);
    await ferdig();
    expect(tillegg()).toHaveLength(1);
    naa = new Date(naa.getTime() + 60_000);
    expect((await patch(id, { beskrivelse: 'Det drypper fra ventilen' }, token)).status).toBe(200);
    await ferdig();
    expect(tillegg()).toHaveLength(2);
    const tekst = String(tillegg()[1][2]);
    expect(tekst).toContain('Det drypper fra ventilen');
    expect(tekst).not.toContain('/api/bilde/'); // bildet var med i forrige tillegg
  });

  it('bilder som kommer mens AI-en sorterer, kommer med i et tillegg rett etter hovedvarselet', async () => {
    let slippAi!: () => void;
    const aiPort = new Promise<void>((r) => (slippAi = r));
    sorterer = {
      sorter: async () => {
        await aiPort;
        return { sammendrag: 'Bytte tank', hast: 'snart', svarutkast: 'Hei' };
      },
    };
    const { id, token } = await opprett();
    // Sorteringen er i gang (har lest forespørselen uten bilder).
    await new Promise((r) => setTimeout(r, 50));
    expect((await lastOpp(id, token, JPEG)).status).toBe(201);
    slippAi();
    await ferdig();
    expect(varsler.send).toHaveBeenCalledTimes(2);
    expect(String(varsler.send.mock.calls[0][1])).toMatch(/^Ny forespørsel/);
    expect(String(varsler.send.mock.calls[0][2])).not.toContain('/api/bilde/');
    expect(String(varsler.send.mock.calls[1][1])).toMatch(/^Tillegg/);
    expect(String(varsler.send.mock.calls[1][2])).toContain('/api/bilde/');
  });

  it('feilet tillegg prøves igjen ved neste endring', async () => {
    const { id, token } = await opprett();
    await ferdig();
    varsler.send.mockImplementationOnce(async () => {
      throw new Error('e-post nede');
    });
    await lastOpp(id, token, JPEG);
    await ferdig();
    naa = new Date(naa.getTime() + 60_000);
    await lastOpp(id, token, PNG, 'image/png');
    await ferdig();
    const sendt = tillegg();
    expect(sendt).toHaveLength(2);
    expect(String(sendt[1][2]).match(/\/api\/bilde\//g)).toHaveLength(2);
  });

  it('lukket forespørsel gir ikke tillegg', async () => {
    const { id, token } = await opprett();
    await ferdig();
    await settStatus(db, id, 'lukket');
    await lastOpp(id, token, JPEG);
    await ferdig();
    expect(tillegg()).toHaveLength(0);
    // Hendelsen er likevel logget.
    expect((await hendelser(id)).some((h) => h.type === 'tillegg')).toBe(true);
  });
});
