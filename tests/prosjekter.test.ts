import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { prosjektSchema } from '../src/lib/innhold';
import { formaterMaaned, paaSpraak, sorterProsjekter, synligeProsjekter } from '../src/lib/prosjekter';

const p = (dato: string, tittel: string, ekte = true) => ({ data: { dato, tittel, ekte } });

describe('referanseprosjekter', () => {
  it('sorts newest first, then by title', () => {
    const ut = sorterProsjekter([p('2026-03', 'B'), p('2026-09', 'A'), p('2026-03', 'A')]);
    expect(ut.map((x) => `${x.data.dato} ${x.data.tittel}`)).toEqual(['2026-09 A', '2026-03 A', '2026-03 B']);
  });

  it('hides examples in a launch build and always shows real projects', () => {
    const alle = [p('2026-01', 'Ekte'), p('2026-02', 'Eksempel', false)];
    expect(synligeProsjekter(alle, false).map((x) => x.data.tittel)).toEqual(['Ekte']);
    expect(synligeProsjekter(alle, true)).toHaveLength(2);
  });

  it('writes the month in the page language', () => {
    expect(formaterMaaned('2026-09', 'nb')).toBe('september 2026');
    expect(formaterMaaned('2026-09', 'en')).toBe('September 2026');
  });

  it('falls back to Norwegian on the English page when a project has no English text', () => {
    const data = prosjektSchema.parse({ tittel: 'Ny bereder', sted: 'Hemnes', tjeneste: 'varmtvannstank', dato: '2026-09', bilder: [{ bilde: '/x.jpg', alt: 'Bereder' }], ekte: true });
    const en = paaSpraak(data, 'en');
    expect(en.tittel).toBe('Ny bereder');
    expect(en.tekstEn).toBeNull();
    expect(en.norskReserve).toBe(true);
    expect(paaSpraak({ ...data, tittelEn: 'New heater', tekstEn: 'Done', bilder: [{ bilde: '/x.jpg', alt: 'Bereder', altEn: 'Heater' }] }, 'en')).toMatchObject({
      tittel: 'New heater',
      tekstEn: 'Done',
      norskReserve: false,
      bilder: [{ src: '/x.jpg', alt: 'Heater' }],
    });
  });

  it('rejects a date that is not YYYY-MM', () => {
    const base = { tittel: 'X', sted: 'Hemnes', tjeneste: 'bad', bilder: [{ bilde: '/x.jpg', alt: 'x' }], ekte: true };
    expect(prosjektSchema.safeParse({ ...base, dato: '2026-13' }).success).toBe(false);
    expect(prosjektSchema.safeParse({ ...base, dato: '2026-9' }).success).toBe(false);
  });

  it('every project file is valid, belongs to a service page and has its photos', () => {
    const tjenester = new Set(
      readdirSync('src/content/tjenester/nb').map((f) => readFileSync(`src/content/tjenester/nb/${f}`, 'utf8').match(/^translationKey: (.+)$/m)![1].trim()),
    );
    const filer = readdirSync('src/content/prosjekter').filter((f) => f.endsWith('.md'));
    expect(filer.length).toBeGreaterThan(0);
    for (const f of filer) {
      const fm = parse(readFileSync(`src/content/prosjekter/${f}`, 'utf8').split(/^---$/m)[1]);
      const data = prosjektSchema.parse(fm);
      expect(tjenester, f).toContain(data.tjeneste);
      for (const b of data.bilder) expect(readdirSync('public' + b.bilde.replace(/\/[^/]+$/, ''))).toContain(b.bilde.split('/').pop());
    }
  });
});
