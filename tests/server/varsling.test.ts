import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import type { Miniflare } from 'miniflare';
import { startD1, nullstill } from './d1';
import { hentForesporsel, lagreSteg2, leggTilBildeMaks, leggTilBildeMerke, opprettForesporsel, settStatus } from '../../src/server/db';
import type { Env } from '../../src/server/env';
import { EpostVarsler, kodEmne, lagMime, type Varsler } from '../../src/server/varsling';
import { FalskSorterer } from '../../src/server/sortering/ai';
import { lagEmne, lagVarselTekst, sorterOgVarsle } from '../../src/server/sortering/index';
import type { Sorterer } from '../../src/server/sortering/ai';
import { regelsjekk } from '../../src/server/sortering/regler';
import { verifiserBildeLenke } from '../../src/server/bildelenke';

const fraBase64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s+/g, '')), (c) => c.charCodeAt(0)));

/** Dekoder et RFC 2047-kodet emne (bare B-koding, som vi bruker). */
const dekodEmne = (s: string) =>
  s
    .split(/\r\n /)
    .map((ord) => {
      const m = /^=\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=$/.exec(ord);
      return m ? fraBase64(m[1]) : ord;
    })
    .join('');

describe('kodEmne', () => {
  it('lar rent ASCII-emne stå', () => {
    expect(kodEmne('Ny forespørsel'.replace('ø', 'o'))).toBe('Ny foresporsel');
  });

  it('koder ikke-ASCII som RFC 2047 og deler i ord på maks 75 tegn', () => {
    const emne = 'Ny forespørsel – varmtvannstank – Bjørkelangen – «akutt» – ærlig øl på å'.repeat(2);
    const kodet = kodEmne(emne);
    for (const ord of kodet.split('\r\n ')) {
      expect(ord).toMatch(/^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
      expect(ord.length).toBeLessThanOrEqual(75);
    }
    expect(dekodEmne(kodet)).toBe(emne);
  });

  it('fjerner linjeskift (hindrer header-injeksjon)', () => {
    expect(kodEmne('Hei\r\nBcc: x@y.no')).not.toMatch(/[\r\n]/);
  });
});

describe('lagMime', () => {
  const mime = lagMime({
    fra: 'varsel@kobberogkran.no',
    til: 'eirik@example.no',
    emne: 'Ny forespørsel',
    tekst: 'Linje én\nLinje to med æøå',
    dato: new Date('2026-11-12T10:00:00Z'),
    meldingsId: '<abc@kobberogkran.no>',
  });
  const [hode, kropp] = mime.split('\r\n\r\n');

  it('har nødvendige headere', () => {
    expect(hode).toContain('From: varsel@kobberogkran.no');
    expect(hode).toContain('To: eirik@example.no');
    expect(hode).toContain('Message-ID: <abc@kobberogkran.no>');
    expect(hode).toContain('MIME-Version: 1.0');
    expect(hode).toContain('Content-Type: text/plain; charset=UTF-8');
    expect(hode).toContain('Content-Transfer-Encoding: base64');
    expect(hode).toMatch(/Date: Thu, 12 Nov 2026 10:00:00 GMT/);
    expect(dekodEmne(/Subject: (.*(?:\r\n .*)*)/.exec(hode)![1])).toBe('Ny forespørsel');
  });

  it('bruker CRLF og base64-kropp i linjer på maks 76 tegn', () => {
    expect(hode.split('\r\n').every((l) => !l.includes('\n'))).toBe(true);
    for (const linje of kropp.trimEnd().split('\r\n')) expect(linje.length).toBeLessThanOrEqual(76);
    expect(fraBase64(kropp)).toBe('Linje én\r\nLinje to med æøå');
  });
});

describe('EpostVarsler', () => {
  it('sender én rå MIME-melding via bindingen', async () => {
    const send = vi.fn(async () => ({ messageId: 'x' }));
    const lagMelding = vi.fn((fra: string, til: string, raw: string) => ({ from: fra, to: til, raw }));
    const v = new EpostVarsler({ send } as never, 'varsel@kobberogkran.no', lagMelding as never);
    await v.send('eirik@example.no', 'Emne', 'Tekst');
    expect(lagMelding).toHaveBeenCalledTimes(1);
    const [fra, til, raw] = lagMelding.mock.calls[0];
    expect(fra).toBe('varsel@kobberogkran.no');
    expect(til).toBe('eirik@example.no');
    expect(raw).toContain('To: eirik@example.no');
    expect(raw).toMatch(/Message-ID: <[^@>]+@kobberogkran\.no>/);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('kaster når bindingen feiler', async () => {
    const v = new EpostVarsler({ send: vi.fn(async () => { throw new Error('avvist'); }) } as never, 'a@b.no', ((f: string, t: string, r: string) => ({ from: f, to: t, raw: r })) as never);
    await expect(v.send('c@d.no', 'e', 't')).rejects.toThrow('avvist');
  });
});

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

const env = (over: Partial<Env> = {}): Env =>
  ({
    DB: db,
    BILDER: {} as never,
    EPOST: { send: vi.fn() } as never,
    SKJEMA_HMAC: 'hemmelig',
    VARSEL_TIL: 'eirik@example.no',
    VARSEL_FRA: 'varsel@kobberogkran.no',
    ...over,
  }) as Env;

/**
 * Lagrer slik API-et gjør: steg 1 uten beskrivelse (opprettForesporsel), så beskrivelsen i steg 2
 * (lagreSteg2). `beskrivelse: null` hopper over steg 2.
 */
const nyForesporsel = async (over: Record<string, unknown> = {}) => {
  const { beskrivelse = 'Tanken lekker, har kjøpt delene selv.', ...steg1 } = over;
  const { id } = await opprettForesporsel(
    db,
    {
      telefon: '+4791234567',
      navn: 'Kari Kunde',
      epost: 'kari@example.no',
      tjeneste: 'varmtvannstank',
      hast: 'lekker-naa',
      stedTekst: 'Storgata 1, Bjørkelangen',
      lat: 59.885,
      lon: 11.567,
      kilde: 'qr',
      ...steg1,
    } as Parameters<typeof opprettForesporsel>[1],
    crypto.randomUUID(),
  );
  if (typeof beskrivelse === 'string') await lagreSteg2(db, id, beskrivelse, {});
  return id;
};

const hendelser = async (id: string) =>
  (
    await db.prepare('SELECT type, data_json FROM hendelser WHERE foresporsel_id = ? ORDER BY rowid').bind(id).all<{ type: string; data_json: string | null }>()
  ).results;

const falskVarsler = (feil?: Error) => {
  const send = vi.fn(async (_til: string, _emne: string, _tekst: string) => {
    if (feil) throw feil;
  });
  return { varsler: { send } as Varsler, send };
};

const aiSvar = { sammendrag: 'Lekker varmtvannstank, kunden har deler.', hast: 'akutt' as const, svarutkast: 'Hei! Jeg kan se på tanken.' };
const naa = () => new Date('2026-11-12T10:00:00Z');

describe('sorterOgVarsle', () => {
  it('sorterer, varsler én gang og setter status varslet', async () => {
    const id = await nyForesporsel();
    const { varsler, send } = falskVarsler();
    await sorterOgVarsle(env(), id, { sorterer: new FalskSorterer(aiSvar), varsler, naa });
    expect(send).toHaveBeenCalledTimes(1);
    const [til, emne, tekst] = send.mock.calls[0];
    expect(til).toBe('eirik@example.no');
    expect(emne).toMatch(/AKUTT/);
    expect(tekst).toContain(aiSvar.sammendrag);
    expect(tekst).toContain('Utkast – sendes ikke automatisk');
    expect(tekst).toContain(aiSvar.svarutkast);
    expect(tekst).toContain('+4791234567');
    expect(tekst).toContain('kjøpt delene selv');
    expect((await hentForesporsel(db, id))!.status).toBe('varslet');
    expect((await hendelser(id)).map((h) => h.type)).toEqual(['sortering_ok', 'varsel_ok']);
  });

  it('når FalskSorterer kaster, sendes varselet likevel én gang og status blir varslet', async () => {
    const id = await nyForesporsel();
    const { varsler, send } = falskVarsler();
    await sorterOgVarsle(env(), id, { sorterer: new FalskSorterer(new Error('AI nede')), varsler, naa });
    expect(send).toHaveBeenCalledTimes(1);
    const tekst = send.mock.calls[0][2];
    expect(tekst).toContain('Tanken lekker, har kjøpt delene selv.');
    expect(tekst).toContain('kjøpt delene selv');
    expect(tekst).toMatch(/AI-sortering feilet/);
    expect(tekst).not.toContain('Utkast – sendes ikke automatisk');
    expect((await hentForesporsel(db, id))!.status).toBe('varslet');
    const h = await hendelser(id);
    expect(h.map((x) => x.type)).toEqual(['sortering_feil', 'varsel_ok']);
    expect(JSON.parse(h[0].data_json!).feil).toContain('AI nede');
  });

  it('uten ANTHROPIC_API_KEY sendes varselet med bare reglene', async () => {
    const id = await nyForesporsel();
    const { varsler, send } = falskVarsler();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    try {
      await sorterOgVarsle(env({ ANTHROPIC_API_KEY: undefined }), id, { varsler, naa });
    } finally {
      vi.unstubAllGlobals();
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
    expect((await hentForesporsel(db, id))!.status).toBe('varslet');
    expect((await hendelser(id))[0].type).toBe('sortering_feil');
  });

  it('er idempotent: andre kall for en varslet rad sender ikke igjen', async () => {
    const id = await nyForesporsel();
    const { varsler, send } = falskVarsler();
    const deps = { sorterer: new FalskSorterer(aiSvar), varsler, naa };
    await sorterOgVarsle(env(), id, deps);
    await sorterOgVarsle(env(), id, deps);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('når varsleren feiler, blir status sortert, varsel_feil logges og ingenting kastes', async () => {
    const id = await nyForesporsel();
    const { varsler, send } = falskVarsler(new Error('e-post avvist'));
    await expect(sorterOgVarsle(env(), id, { sorterer: new FalskSorterer(aiSvar), varsler, naa })).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledTimes(1);
    expect((await hentForesporsel(db, id))!.status).toBe('sortert');
    const h = await hendelser(id);
    expect(h.map((x) => x.type)).toEqual(['sortering_ok', 'varsel_feil']);
    expect(JSON.parse(h[1].data_json!).feil).toContain('e-post avvist');
  });

  it('et nytt forsøk etter varsel_feil sender og setter varslet', async () => {
    const id = await nyForesporsel();
    await sorterOgVarsle(env(), id, { sorterer: new FalskSorterer(aiSvar), varsler: falskVarsler(new Error('x')).varsler, naa });
    const { varsler, send } = falskVarsler();
    await sorterOgVarsle(env(), id, { sorterer: new FalskSorterer(aiSvar), varsler, naa });
    expect(send).toHaveBeenCalledTimes(1);
    expect((await hentForesporsel(db, id))!.status).toBe('varslet');
  });

  it('uten VARSEL_TIL logges varsel_feil og status blir sortert', async () => {
    const id = await nyForesporsel();
    const { varsler, send } = falskVarsler();
    await sorterOgVarsle(env({ VARSEL_TIL: undefined }), id, { sorterer: new FalskSorterer(aiSvar), varsler, naa });
    expect(send).not.toHaveBeenCalled();
    expect((await hentForesporsel(db, id))!.status).toBe('sortert');
    expect((await hendelser(id)).map((h) => h.type)).toContain('varsel_feil');
  });

  it('ukjent id kaster ikke og sender ikke', async () => {
    const { varsler, send } = falskVarsler();
    await expect(sorterOgVarsle(env(), 'finnes-ikke', { sorterer: new FalskSorterer(aiSvar), varsler, naa })).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });

  it('to parallelle kall gir nøyaktig én sending', async () => {
    const id = await nyForesporsel();
    const { varsler, send } = falskVarsler();
    const treg: Sorterer = { sorter: () => new Promise((ok) => setTimeout(() => ok(aiSvar), 50)) };
    await Promise.all([
      sorterOgVarsle(env(), id, { sorterer: treg, varsler, naa }),
      sorterOgVarsle(env(), id, { sorterer: treg, varsler, naa }),
      sorterOgVarsle(env(), id, { sorterer: treg, varsler, naa }),
    ]);
    expect(send).toHaveBeenCalledTimes(1);
    expect((await hentForesporsel(db, id))!.status).toBe('varslet');
    expect((await hendelser(id)).filter((h) => h.type === 'sortering_ok')).toHaveLength(1);
  });

  it('en aktiv lås hindrer sending, en utløpt lås (krasjet holder) gjør det ikke', async () => {
    const id = await nyForesporsel();
    // En annen kjøring tok låsen og krasjet; lånet varer til 10:02.
    await db.prepare('UPDATE foresporsler SET varsel_laast_til = ? WHERE id = ?').bind('2026-11-12T10:02:00.000Z|krasjet-holder', id).run();
    const { varsler, send } = falskVarsler();
    await sorterOgVarsle(env(), id, { sorterer: new FalskSorterer(aiSvar), varsler, naa: () => new Date('2026-11-12T10:01:00Z') });
    expect(send).not.toHaveBeenCalled();
    await sorterOgVarsle(env(), id, { sorterer: new FalskSorterer(aiSvar), varsler, naa: () => new Date('2026-11-12T10:03:00Z') });
    expect(send).toHaveBeenCalledTimes(1);
    expect((await hentForesporsel(db, id))!.status).toBe('varslet');
  });

  it('låsen frigis etter varsel_feil, så et nytt forsøk kan sende med en gang', async () => {
    const id = await nyForesporsel();
    await sorterOgVarsle(env(), id, { sorterer: new FalskSorterer(aiSvar), varsler: falskVarsler(new Error('x')).varsler, naa });
    const rad = await db.prepare('SELECT varsel_laast_til FROM foresporsler WHERE id = ?').bind(id).first<{ varsel_laast_til: string | null }>();
    expect(rad!.varsel_laast_til).toBeNull();
  });

  it('feiler loggingen av sortering_ok, brukes AI-svaret likevel', async () => {
    const id = await nyForesporsel();
    const feilendeDb = new Proxy(db, {
      get(mål, navn, mottaker) {
        if (navn !== 'prepare') return Reflect.get(mål, navn, mottaker);
        return (sql: string) => {
          const stmt = mål.prepare(sql);
          if (!sql.includes('INSERT INTO hendelser')) return stmt;
          return {
            bind: (...args: unknown[]) =>
              args[2] === 'sortering_ok' ? { run: () => Promise.reject(new Error('D1 nede')) } : stmt.bind(...args),
          };
        };
      },
    });
    const { varsler, send } = falskVarsler();
    await sorterOgVarsle(env({ DB: feilendeDb }), id, { sorterer: new FalskSorterer(aiSvar), varsler, naa });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][2]).toContain(aiSvar.sammendrag);
    expect((await hentForesporsel(db, id))!.status).toBe('varslet');
  });

  it('lukket forespørsel varsles ikke', async () => {
    const id = await nyForesporsel();
    await settStatus(db, id, 'lukket');
    const { varsler, send } = falskVarsler();
    await sorterOgVarsle(env(), id, { sorterer: new FalskSorterer(aiSvar), varsler, naa });
    expect(send).not.toHaveBeenCalled();
  });

  it('legger ved signerte, gyldige bildelenker', async () => {
    const id = await nyForesporsel();
    await leggTilBildeMaks(db, id, crypto.randomUUID(), 'bilder/a.jpg', 10);
    await leggTilBildeMerke(db, id, 'typeskilt');
    const { varsler, send } = falskVarsler();
    await sorterOgVarsle(env(), id, { sorterer: new FalskSorterer(aiSvar), varsler, naa });
    const tekst = send.mock.calls[0][2];
    const m = /https:\/\/kobberogkran\.no\/api\/bilde\/([^?\s]+)\?utloper=(\d+)&sig=([0-9a-f]+)/.exec(tekst);
    expect(m).not.toBeNull();
    const [, bildeId, utloper, sig] = m!;
    const naaSek = Math.floor(naa().getTime() / 1000);
    expect(Number(utloper)).toBeGreaterThan(naaSek);
    expect(await verifiserBildeLenke(decodeURIComponent(bildeId), Number(utloper), sig, 'hemmelig', naaSek)).toBe(true);
  });
});

describe('lagEmne', () => {
  it('korter ned lang stedtekst til 60 tegn', async () => {
    const id = await nyForesporsel({ stedTekst: 'x'.repeat(200), hast: 'snart' });
    const f = (await hentForesporsel(db, id))!;
    const emne = lagEmne(f, null);
    expect(emne).not.toContain('x'.repeat(60));
    expect(emne).toContain('x'.repeat(59) + '…');
    expect(emne.startsWith('AKUTT')).toBe(false);
  });
});

describe('AKUTT i emnet', () => {
  const emne = async (hast: string, ai: Parameters<typeof lagEmne>[1]) => {
    const id = await nyForesporsel({ hast });
    return lagEmne((await hentForesporsel(db, id))!, ai);
  };
  const ai = (hast: 'akutt' | 'snart' | 'planlegges') => ({ sammendrag: 's', hast, svarutkast: 'u' });

  it('«Det lekker nå» gir AKUTT når AI-en er nede', async () => {
    expect(await emne('lekker-naa', null)).toMatch(/^AKUTT – /);
  });

  it('AI-en kan ikke nedgradere kundens «Det lekker nå»', async () => {
    expect(await emne('lekker-naa', ai('snart'))).toMatch(/^AKUTT – /);
    expect(await emne('lekker-naa', ai('planlegges'))).toMatch(/^AKUTT – /);
  });

  it('AI-en kan oppgradere til AKUTT', async () => {
    expect(await emne('snart', ai('akutt'))).toMatch(/^AKUTT – /);
  });

  it('snart og kan-planlegges uten AI-akutt gir ikke AKUTT', async () => {
    expect(await emne('snart', null)).not.toMatch(/AKUTT/);
    expect(await emne('kan-planlegges', ai('snart'))).not.toMatch(/AKUTT/);
  });

  it('hele flyten med AI nede gir AKUTT for «Det lekker nå»', async () => {
    const id = await nyForesporsel({ hast: 'lekker-naa' });
    const { varsler, send } = falskVarsler();
    await sorterOgVarsle(env(), id, { sorterer: new FalskSorterer(new Error('AI nede')), varsler, naa });
    expect(send.mock.calls[0][1]).toMatch(/^AKUTT – /);
  });
});

describe('lagVarselTekst', () => {
  it('viser «Mottatt» i norsk tid', async () => {
    const id = await nyForesporsel();
    const f = { ...(await hentForesporsel(db, id))!, opprettet: '2026-07-01T22:30:00.000Z' };
    expect(lagVarselTekst(f, regelsjekk(f), null, [])).toContain('Mottatt: 02.07.2026 kl. 00:30');
    const vinter = { ...f, opprettet: '2026-11-12T10:00:00.000Z' };
    expect(lagVarselTekst(vinter, regelsjekk(vinter), null, [])).toContain('Mottatt: 12.11.2026 kl. 11:00');
  });

  it('viser svarene som lesbare linjer, ikke rå JSON', async () => {
    const id = await nyForesporsel();
    await lagreSteg2(db, id, undefined, { felles: { vann: 'kommunalt' }, tjenesteSvar: { etasje: 'kjeller' }, hvorHorte: 'nabo' });
    const f = (await hentForesporsel(db, id))!;
    const tekst = lagVarselTekst(f, regelsjekk(f), null, []);
    expect(tekst).toContain('  vann: kommunalt');
    expect(tekst).toContain('  etasje: kjeller');
    expect(tekst).toContain('Hvor de hørte om oss: nabo');
    expect(tekst).not.toContain('"felles"');
  });

  it('viser «ukjent» kjøretid for hytte uten adresse', async () => {
    const id = await nyForesporsel({ stedTekst: 'Gnr 12 bnr 3, Setskog', lat: undefined, lon: undefined, tjeneste: 'hytte' });
    const f = (await hentForesporsel(db, id))!;
    const tekst = lagVarselTekst(f, regelsjekk(f), null, []);
    expect(tekst).toMatch(/Kjøretid fra Hemnes: ukjent/);
    expect(tekst).toContain('Gnr 12 bnr 3, Setskog');
  });
});
