import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { omtaleSchema, tekstSchema, tjenesteSchema, type Tjeneste } from '../../src/lib/innhold';

function load(locale: string): Tjeneste[] {
  const dir = `src/content/tjenester/${locale}`;
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(`${dir}/${f}`, 'utf8'))![1];
      return tjenesteSchema.parse(parse(fm));
    });
}

const nb = load('nb');
const en = load('en');

describe('tjenester', () => {
  it.each([['nb', nb], ['en', en]])('has exactly 5 services in %s with nummer 1-5', (_l, list) => {
    expect(list).toHaveLength(5);
    expect(list.map((t) => t.nummer).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('has every translationKey in both locales with the same nummer', () => {
    expect(en.map((t) => t.translationKey).sort()).toEqual(nb.map((t) => t.translationKey).sort());
    for (const t of nb) expect(en.find((e) => e.translationKey === t.translationKey)?.nummer).toBe(t.nummer);
  });

  it('uses the agreed slugs', () => {
    expect(readdirSync('src/content/tjenester/nb').sort()).toEqual(
      ['bad.md', 'bronn-og-vann.md', 'hytte.md', 'service-og-reparasjon.md', 'varmtvannstank.md'],
    );
    expect(readdirSync('src/content/tjenester/en').sort()).toEqual(
      ['bathroom.md', 'cabin.md', 'service-and-repairs.md', 'water-heater.md', 'well-and-water.md'],
    );
  });

  it('marks every image as placeholder', () => {
    for (const t of [...nb, ...en]) expect(t.bilder.every((b) => b.plassholder)).toBe(true);
  });
});

describe('tekster', () => {
  const read = (l: string) => tekstSchema.parse(JSON.parse(readFileSync(`src/content/tekster/${l}.json`, 'utf8')));
  it.each(['nb', 'en'])('is valid for %s with five leak points and the greeting template', (l) => {
    const t = read(l);
    expect(t.lekkerNaa.punkter).toHaveLength(5);
    expect(t.whatsappHilsen).toContain('{tjeneste}');
    expect(t.whatsappHilsen).toContain('{kilde}');
  });
});

describe('omtale', () => {
  it('has only non-real samples', () => {
    const files = readdirSync('src/content/omtale').filter((f) => f.startsWith('eksempel-'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const o = omtaleSchema.parse(JSON.parse(readFileSync(`src/content/omtale/${f}`, 'utf8')));
      expect(o.ekte).toBe(false);
    }
  });
});
