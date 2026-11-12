// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { Opplaster, type Jobb } from '../../src/client/skjema/opplasting';

const fil = (navn = 'a.jpg') => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], navn, { type: 'image/jpeg' });
const ok = () => new Response(JSON.stringify({ bildeId: 'b' }), { status: 201 });
const utsatt = () => {
  let losFn!: (r: Response) => void;
  const p = new Promise<Response>((res) => (losFn = res));
  return { p, los: losFn };
};

function lag(fetchFn: (url: string, init: RequestInit) => Promise<Response>, ekstra: Partial<ConstructorParameters<typeof Opplaster>[0]> = {}) {
  const statuser: string[] = [];
  const opp = new Opplaster({
    id: 'f1',
    token: 'tok',
    locale: 'nb',
    fetch: fetchFn as unknown as typeof fetch,
    forbered: async (f) => f,
    vent: async () => {},
    onStatus: (j: Jobb) => statuser.push(`${j.fil.name}:${j.status}`),
    ...ekstra,
  });
  return { opp, statuser };
}

describe('Opplaster', () => {
  it('poster bildet til /api/bilde med id, token, locale og merke', async () => {
    const fetchFn = vi.fn(async () => ok());
    const { opp } = lag(fetchFn);
    const jobb = opp.leggTil(fil(), 'typeskilt');
    await opp.ferdig();
    expect(jobb.status).toBe('ok');
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    const u = new URL(url, 'https://x');
    expect(u.pathname).toBe('/api/bilde');
    expect(Object.fromEntries(u.searchParams)).toEqual({ id: 'f1', token: 'tok', locale: 'nb', merke: 'typeskilt' });
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['content-type']).toBe('image/jpeg');
  });

  it('laster opp høyst 2 samtidig', async () => {
    const ventende: ReturnType<typeof utsatt>[] = [];
    const fetchFn = vi.fn(() => {
      const u = utsatt();
      ventende.push(u);
      return u.p;
    });
    const { opp } = lag(fetchFn);
    for (const n of ['1', '2', '3', '4']) opp.leggTil(fil(`${n}.jpg`));
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchFn).toHaveBeenCalledTimes(2);
    ventende[0].los(ok());
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(3));
    ventende[1].los(ok());
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(4));
    ventende[2].los(ok());
    ventende[3].los(ok());
    await opp.ferdig();
  });

  it('prøver opptil 3 ganger til ved nettverksfeil og 5xx, med økende ventetid', async () => {
    const vent = vi.fn(async () => {});
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('nett'))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockRejectedValueOnce(new TypeError('nett'))
      .mockResolvedValueOnce(ok());
    const { opp } = lag(fetchFn, { vent });
    const jobb = opp.leggTil(fil());
    await opp.ferdig();
    expect(fetchFn).toHaveBeenCalledTimes(4);
    expect(jobb.status).toBe('ok');
    const ventetider = vent.mock.calls.map((c) => (c as unknown as [number])[0]);
    expect(ventetider).toHaveLength(3);
    expect(ventetider[1]).toBeGreaterThan(ventetider[0]);
    expect(ventetider[2]).toBeGreaterThan(ventetider[1]);
  });

  it('gir opp etter 3 nye forsøk og melder feilet', async () => {
    const fetchFn = vi.fn(async () => Promise.reject(new TypeError('nett')));
    const { opp, statuser } = lag(fetchFn);
    const jobb = opp.leggTil(fil());
    await opp.ferdig();
    expect(fetchFn).toHaveBeenCalledTimes(4);
    expect(jobb.status).toBe('feilet');
    expect(statuser.at(-1)).toBe('a.jpg:feilet');
  });

  it('prøver ikke på nytt når serveren avviser bildet (4xx)', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ feil: 'feil_type', telefon: '1' }), { status: 415 }));
    const { opp } = lag(fetchFn);
    const jobb = opp.leggTil(fil());
    await opp.ferdig();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(jobb).toMatchObject({ status: 'feilet', feil: 'feil_type' });
  });

  it('venter på nett når nettleseren er frakoblet, uten å bruke opp forsøkene', async () => {
    let online = false;
    let kobletTil!: () => void;
    const ventPaaNett = vi.fn(() => new Promise<void>((r) => (kobletTil = r)));
    const fetchFn = vi.fn(async () => ok());
    const { opp, statuser } = lag(fetchFn, { online: () => online, ventPaaNett });
    const jobb = opp.leggTil(fil());
    await vi.waitFor(() => expect(ventPaaNett).toHaveBeenCalled());
    expect(jobb.status).toBe('frakoblet');
    expect(fetchFn).not.toHaveBeenCalled();
    online = true;
    kobletTil();
    await opp.ferdig();
    expect(jobb.status).toBe('ok');
    expect(statuser).toContain('a.jpg:frakoblet');
  });

  it('sender originalen når forberedelsen feiler', async () => {
    const fetchFn = vi.fn(async () => ok());
    const original = fil();
    const { opp } = lag(fetchFn, { forbered: async () => Promise.reject(new Error('canvas')) });
    opp.leggTil(original);
    await opp.ferdig();
    expect((fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body).toBe(original);
  });
});
