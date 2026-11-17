import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { erLansering, erTurnstileTestnokkel, launchVerdi, turnstileNokkelForBygg } from '../src/lib/lansering';
import { synligeOmtale, visEksempler } from '../src/lib/omtale';

const filer = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? filer(p) : [p];
  });

describe('Turnstile-testnøkler', () => {
  it('kjenner igjen Cloudflares testnøkler og testhemmeligheter', () => {
    for (const k of [
      '1x00000000000000000000AA',
      '2x00000000000000000000AB',
      '1x00000000000000000000BB',
      '2x00000000000000000000BB',
      '3x00000000000000000000FF',
      '1x0000000000000000000000000000000AA',
      '2x0000000000000000000000000000000AA',
      '3x0000000000000000000000000000000AA',
    ]) {
      expect(erTurnstileTestnokkel(k), k).toBe(true);
    }
    expect(erTurnstileTestnokkel('0x4AAAAAAABkMYinukE8nzY')).toBe(false);
    expect(erTurnstileTestnokkel('')).toBe(false);
  });

  it('et lanseringsbygg avviser manglende nøkkel og testnøkler; ellers brukes testnøkkelen som standard', () => {
    expect(() => turnstileNokkelForBygg('', true)).toThrow(/PUBLIC_TURNSTILE_SITE_KEY/);
    expect(() => turnstileNokkelForBygg('1x00000000000000000000AA', true)).toThrow(/testnøkkel/);
    expect(turnstileNokkelForBygg('0x4AAAAAAABkMYinukE8nzY', true)).toBe('0x4AAAAAAABkMYinukE8nzY');
    expect(turnstileNokkelForBygg('', false)).toBe('1x00000000000000000000AA');
    expect(turnstileNokkelForBygg('2x00000000000000000000AB', false)).toBe('2x00000000000000000000AB');
  });
});

describe('lansering', () => {
  it('bare LAUNCH=true teller', () => {
    expect(erLansering({ LAUNCH: 'true' })).toBe(true);
    expect(erLansering({ LAUNCH: true })).toBe(true);
    for (const v of [undefined, '', 'false', '1', 'TRUE']) expect(erLansering({ LAUNCH: v })).toBe(false);
    expect(launchVerdi({ LAUNCH: 'true' })).toBe('true');
    expect(launchVerdi({})).toBeUndefined();
  });

  it('eksempelomtaler skjules i en lanseringsbygg', () => {
    const omtale = [
      { type: 'anmeldelse' as const, tekst: 'Eksempel', ekte: false },
      { type: 'anmeldelse' as const, tekst: 'Ekte', ekte: true },
    ];
    expect(synligeOmtale(omtale, visEksempler(true, launchVerdi({ LAUNCH: 'true' }))).map((o) => o.tekst)).toEqual(['Ekte']);
  });

  it('ingen kode i src/ leser LAUNCH fra process.env (undefined under forhåndsrenderingen i workerd)', () => {
    const treff = filer('src').filter((f) => /process\.env\.LAUNCH|process\.env\[['"]LAUNCH/.test(readFileSync(f, 'utf8')));
    expect(treff).toEqual([]);
  });
});
