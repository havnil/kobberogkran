// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { feilNokkel, lesSteg1, sendSteg1, sendSteg2, sjekkSteg1 } from '../../src/client/skjema/steg';
import { validerSteg1 } from '../../src/server/validering';

function skjema(ekstra = '') {
  document.body.innerHTML = `
    <form>
      <select name="tjeneste"><option value="bad" selected>Bad</option></select>
      <input type="radio" name="hast" value="snart" checked />
      <input name="sted" value="hytta ved Mangen" />
      <input type="hidden" name="lat" value="" /><input type="hidden" name="lon" value="" />
      <input name="gnr" value="" /><input name="bnr" value="" />
      <input name="navn" value="Kari" />
      <input name="telefon" value="912 34 567" />
      <input name="epost" value="" />
      <input type="radio" name="kundetype" value="privat" checked />
      <input type="radio" name="kundetype" value="bedrift" />
      <input name="firmanavn" value="" /><input name="orgnr" value="" />
      <input type="hidden" name="kilde" value="qr-bil" />
      <input name="honning" value="" />
      <input type="hidden" name="locale" value="nb" />
      <input type="hidden" name="cf-turnstile-response" value="ts-token" />
      ${ekstra}
    </form>`;
  return document.querySelector('form')!;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('lesSteg1', () => {
  it('lager JSON-kroppen API-et forventer, med idemNokkel fra nettleseren', () => {
    const data = lesSteg1(skjema(), 'abcdefgh-1234-5678');
    expect(data).toEqual({
      tjeneste: 'bad',
      hast: 'snart',
      sted: { tekst: 'hytta ved Mangen', lat: '', lon: '', gnr: '', bnr: '' },
      navn: 'Kari',
      telefon: '912 34 567',
      epost: '',
      kundetype: 'privat',
      firmanavn: '',
      orgnr: '',
      kilde: 'qr-bil',
      honning: '',
      locale: 'nb',
      idemNokkel: 'abcdefgh-1234-5678',
      turnstileToken: 'ts-token',
    });
    // Serveren godtar den (hytte uten adresse).
    expect(validerSteg1(data).ok).toBe(true);
  });
});

describe('sjekkSteg1', () => {
  it('godtar et gyldig skjema, også uten e-post', () => {
    expect(sjekkSteg1(lesSteg1(skjema(), 'abcdefgh-1234-5678'))).toEqual([]);
  });

  it('melder alle feil i skjemarekkefølge', () => {
    const f = skjema();
    (f.elements.namedItem('sted') as HTMLInputElement).value = '';
    (f.elements.namedItem('telefon') as HTMLInputElement).value = '123';
    (f.elements.namedItem('navn') as HTMLInputElement).value = ' ';
    expect(sjekkSteg1(lesSteg1(f, 'abcdefgh-1234-5678'))).toEqual([
      { felt: 'sted', feil: 'mangler' },
      { felt: 'navn', feil: 'mangler' },
      { felt: 'telefon', feil: 'ugyldig' },
    ]);
  });

  it('bedrift krever firmanavn og gyldig org.nr.', () => {
    const f = skjema();
    (f.querySelector('[value="bedrift"]') as HTMLInputElement).checked = true;
    (f.elements.namedItem('orgnr') as HTMLInputElement).value = '123456789';
    expect(sjekkSteg1(lesSteg1(f, 'abcdefgh-1234-5678'))).toEqual([
      { felt: 'firmanavn', feil: 'mangler' },
      { felt: 'orgnr', feil: 'ugyldig' },
    ]);
  });

  it('ugyldig e-post meldes, tom e-post er greit', () => {
    const f = skjema();
    (f.elements.namedItem('epost') as HTMLInputElement).value = 'kari@';
    expect(sjekkSteg1(lesSteg1(f, 'abcdefgh-1234-5678'))).toEqual([{ felt: 'epost', feil: 'ugyldig' }]);
  });
});

describe('sendSteg1 og sendSteg2', () => {
  it('poster JSON og gir id og token', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ id: 'f1', token: 't1' }), { status: 201 }));
    const svar = await sendSteg1({ navn: 'Kari' }, fetchFn as unknown as typeof fetch);
    expect(svar).toEqual({ ok: true, id: 'f1', token: 't1' });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/foresporsel');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({ navn: 'Kari' });
  });

  it('gir feilkoden og feltet fra API-et', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ feil: 'mangler', felt: 'telefon', telefon: '000' }), { status: 400 }));
    expect(await sendSteg1({}, fetchFn as unknown as typeof fetch)).toEqual({ ok: false, feil: 'mangler', felt: 'telefon' });
  });

  it('nettverksfeil gir koden nettverk', async () => {
    const fetchFn = vi.fn(async () => Promise.reject(new TypeError('offline')));
    expect(await sendSteg1({}, fetchFn as unknown as typeof fetch)).toEqual({ ok: false, feil: 'nettverk' });
  });

  it('steg 2 er PATCH med Bearer-token', async () => {
    const fetchFn = vi.fn(async () => new Response('{"ok":true}', { status: 200 }));
    expect(await sendSteg2('f1', 't1', { beskrivelse: 'x' }, fetchFn as unknown as typeof fetch)).toEqual({ ok: true });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/foresporsel/f1');
    expect(init.method).toBe('PATCH');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer t1');
  });
});

describe('feilNokkel', () => {
  it('gir nøkkelen i tekster.skjema.feil for hver kode', () => {
    expect(feilNokkel('mangler')).toBe('mangler');
    expect(feilNokkel('ugyldig')).toBe('ugyldig');
    expect(feilNokkel('for_lang')).toBe('forLang');
    expect(feilNokkel('turnstile')).toBe('turnstile');
    expect(feilNokkel('nettverk')).toBe('nettverk');
    expect(feilNokkel('serverfeil')).toBe('server');
    expect(feilNokkel('ikke_konfigurert')).toBe('server');
  });
});
