import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { erLansering, launchVerdi } from '../src/lib/lansering';
import { synligeOmtale, visEksempler } from '../src/lib/omtale';

const filer = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? filer(p) : [p];
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
