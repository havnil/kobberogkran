// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  KOMMUNER,
  koblAdressefelt,
  punktsokUrl,
  sokAdresser,
  sokUrler,
  stedFraInput,
  tolkAdresser,
} from '../../src/client/skjema/sted';

describe('stedFraInput', () => {
  it('hytte uten adresse: fritekst er gyldig uten koordinater', () => {
    expect(stedFraInput({ tekst: 'hytta ved Mangen' })).toEqual({ ok: true, sted: { tekst: 'hytta ved Mangen' } });
  });

  it('gårds- og bruksnummer alene er gyldig', () => {
    expect(stedFraInput({ gnr: '81', bnr: '1' })).toEqual({ ok: true, sted: { gnr: 81, bnr: 1 } });
  });

  it('koordinater alene er gyldig («Bruk der jeg er nå»)', () => {
    expect(stedFraInput({ lat: '59.74', lon: '11.42' })).toEqual({ ok: true, sted: { lat: 59.74, lon: 11.42 } });
  });

  it('adresse med koordinater fra forslaget', () => {
    expect(stedFraInput({ tekst: ' Haldenveien 2013 ', lat: 59.7, lon: 11.4 })).toEqual({
      ok: true,
      sted: { tekst: 'Haldenveien 2013', lat: 59.7, lon: 11.4 },
    });
  });

  it('ingenting gir mangler', () => {
    expect(stedFraInput({ tekst: '  ', lat: '', lon: '', gnr: '', bnr: '' })).toEqual({ ok: false, feil: 'mangler' });
  });

  it('bare gnr uten bnr, eller ugyldige koordinater, gir ugyldig', () => {
    expect(stedFraInput({ gnr: '81' })).toEqual({ ok: false, feil: 'ugyldig' });
    expect(stedFraInput({ lat: '200', lon: '11' })).toEqual({ ok: false, feil: 'ugyldig' });
    expect(stedFraInput({ tekst: 'x', gnr: '0', bnr: '1' })).toEqual({ ok: false, feil: 'ugyldig' });
  });

  it('for lang fritekst gir for_lang', () => {
    expect(stedFraInput({ tekst: 'a'.repeat(301) })).toEqual({ ok: false, feil: 'for_lang' });
  });
});

const adresse = (tekst: string, postnr: string, poststed: string, lat: number, lon: number) => ({
  adressetekst: tekst,
  postnummer: postnr,
  poststed,
  representasjonspunkt: { epsg: 'EPSG:4258', lat, lon },
});

describe('Kartverket', () => {
  it('søker i kommunene 3226 og 3205, ett kall per kommune', () => {
    expect(KOMMUNER).toEqual(['3226', '3205']);
    const urler = sokUrler('Haldenv').map((u) => new URL(u));
    expect(urler).toHaveLength(2);
    expect(urler.map((u) => u.searchParams.get('kommunenummer'))).toEqual(['3226', '3205']);
    for (const u of urler) {
      expect(u.origin + u.pathname).toBe('https://ws.geonorge.no/adresser/v1/sok');
      expect(u.searchParams.get('sok')).toBe('Haldenv*');
    }
  });

  it('punktsok bruker lat og lon', () => {
    const u = new URL(punktsokUrl(59.74, 11.42));
    expect(u.origin + u.pathname).toBe('https://ws.geonorge.no/adresser/v1/punktsok');
    expect(u.searchParams.get('lat')).toBe('59.74');
    expect(u.searchParams.get('lon')).toBe('11.42');
  });

  it('tolker svaret og hopper over adresser uten punkt', () => {
    const json = { adresser: [adresse('Haldenveien 2013', '1970', 'HEMNES', 59.7, 11.4), { adressetekst: 'Uten punkt' }] };
    expect(tolkAdresser(json)).toEqual([{ tekst: 'Haldenveien 2013, 1970 HEMNES', lat: 59.7, lon: 11.4 }]);
    expect(tolkAdresser(null)).toEqual([]);
  });

  it('slår sammen svarene fra begge kommunene', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      const k = new URL(url).searchParams.get('kommunenummer');
      const json = { adresser: [adresse(`Storgata ${k}`, '1', 'X', 59, 11)] };
      return new Response(JSON.stringify(json), { status: 200 });
    });
    const svar = await sokAdresser('Storgata', new AbortController().signal, fetchFn as unknown as typeof fetch);
    expect(svar.map((a) => a.tekst)).toEqual(['Storgata 3226, 1 X', 'Storgata 3205, 1 X']);
  });

  it('feil fra API-et gir en tom liste (fritekst virker videre)', async () => {
    const fetchFn = vi.fn(async () => new Response('nei', { status: 500 }));
    expect(await sokAdresser('Storgata', new AbortController().signal, fetchFn as unknown as typeof fetch)).toEqual([]);
  });
});

describe('koblAdressefelt (combobox)', () => {
  let input: HTMLInputElement;
  let liste: HTMLUListElement;
  let lat: HTMLInputElement;
  let lon: HTMLInputElement;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <input id="sted" role="combobox" aria-expanded="false" aria-controls="sted-forslag" />
      <ul id="sted-forslag" role="listbox" hidden></ul>
      <input type="hidden" id="lat" /><input type="hidden" id="lon" />`;
    input = document.getElementById('sted') as HTMLInputElement;
    liste = document.getElementById('sted-forslag') as HTMLUListElement;
    lat = document.getElementById('lat') as HTMLInputElement;
    lon = document.getElementById('lon') as HTMLInputElement;
  });
  afterEach(() => vi.useRealTimers());

  const skriv = (v: string) => {
    input.value = v;
    input.dispatchEvent(new Event('input'));
  };
  const tast = (key: string) => input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

  it('venter 250 ms, søker fra 3 tegn, og avbryter gamle søk', async () => {
    const signaler: AbortSignal[] = [];
    const sok = vi.fn(async (_t: string, signal: AbortSignal) => {
      signaler.push(signal);
      return [{ tekst: 'Haldenveien 2013, 1970 HEMNES', lat: 59.7, lon: 11.4 }];
    });
    koblAdressefelt({ input, liste, lat, lon, sok });
    skriv('Ha');
    await vi.advanceTimersByTimeAsync(300);
    expect(sok).not.toHaveBeenCalled();
    skriv('Hal');
    await vi.advanceTimersByTimeAsync(200);
    expect(sok).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60);
    expect(sok).toHaveBeenCalledTimes(1);
    skriv('Hald');
    await vi.advanceTimersByTimeAsync(260);
    expect(sok).toHaveBeenCalledTimes(2);
    expect(signaler[0].aborted).toBe(true);
    expect(liste.hidden).toBe(false);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(liste.querySelectorAll('[role="option"]')).toHaveLength(1);
  });

  it('piltast og Enter velger et forslag og fyller de skjulte koordinatfeltene', async () => {
    const sok = async () => [
      { tekst: 'A 1', lat: 1, lon: 2 },
      { tekst: 'B 2', lat: 3, lon: 4 },
    ];
    const valgt = vi.fn();
    koblAdressefelt({ input, liste, lat, lon, sok, onVelg: valgt });
    skriv('Sto');
    await vi.advanceTimersByTimeAsync(260);
    tast('ArrowDown');
    tast('ArrowDown');
    const aktiv = input.getAttribute('aria-activedescendant')!;
    expect(document.getElementById(aktiv)?.textContent).toBe('B 2');
    expect(document.getElementById(aktiv)?.getAttribute('aria-selected')).toBe('true');
    tast('Enter');
    expect(input.value).toBe('B 2');
    expect([lat.value, lon.value]).toEqual(['3', '4']);
    expect(liste.hidden).toBe(true);
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(valgt).toHaveBeenCalledWith({ tekst: 'B 2', lat: 3, lon: 4 });
  });

  it('Escape lukker listen, og ny skriving fjerner koordinatene fra et tidligere valg', async () => {
    koblAdressefelt({ input, liste, lat, lon, sok: async () => [{ tekst: 'A 1', lat: 1, lon: 2 }] });
    skriv('Sto');
    await vi.advanceTimersByTimeAsync(260);
    tast('ArrowDown');
    tast('Enter');
    expect(lat.value).toBe('1');
    skriv('Storgata 9');
    expect(lat.value).toBe('');
    expect(lon.value).toBe('');
    await vi.advanceTimersByTimeAsync(260);
    tast('Escape');
    expect(liste.hidden).toBe(true);
  });

  it('melder antall forslag (for skjermlesere)', async () => {
    const onAntall = vi.fn();
    koblAdressefelt({ input, liste, lat, lon, onAntall, sok: async () => [{ tekst: 'A 1', lat: 1, lon: 2 }, { tekst: 'B', lat: 1, lon: 2 }] });
    skriv('Sto');
    await vi.advanceTimersByTimeAsync(260);
    expect(onAntall).toHaveBeenLastCalledWith(2);
  });

  it('feil i søket lukker listen stille', async () => {
    koblAdressefelt({ input, liste, lat, lon, sok: async () => Promise.reject(new Error('nede')) });
    skriv('Storgata');
    await vi.advanceTimersByTimeAsync(260);
    expect(liste.hidden).toBe(true);
  });
});
