// WCAG 2.1 AA-kontrast for fargeparene komponentene bruker. Verdiene leses fra tokens.css,
// så en endret farge som bryter kravet, feiler her.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { kontrast } from '../../src/lib/kontrast';

const css = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8');

/** Løser `--navn` til en hex-farge, også via var(--annet). */
function farge(navn: string, dybde = 0): string {
  const m = new RegExp(`--${navn}:\\s*([^;]+);`).exec(css);
  if (!m) throw new Error(`fant ikke --${navn}`);
  const verdi = m[1].trim();
  const ref = /^var\(--([\w-]+)\)$/.exec(verdi);
  if (ref && dybde < 5) return farge(ref[1], dybde + 1);
  return verdi;
}

describe('kontrast()', () => {
  it('gir 21 for svart på hvitt og 1 for lik farge', () => {
    expect(kontrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(kontrast('#F26A0F', '#F26A0F')).toBeCloseTo(1, 5);
  });

  it('er symmetrisk', () => {
    expect(kontrast('#2E170B', '#F26A0F')).toBeCloseTo(kontrast('#F26A0F', '#2E170B'), 10);
  });
});

describe('fargeparene i komponentene', () => {
  // [forgrunn, bakgrunn, krav]
  const tekst: [string, string][] = [
    ['color-on-orange', 'color-orange'], // knapper og merker
    ['color-on-orange', 'color-orange-light'], // knapp ved hover
    ['color-text', 'color-cream'],
    ['color-text', 'color-white'],
    ['color-muted', 'color-cream'],
    ['color-muted', 'color-sand'],
    ['color-muted', 'color-white'],
    ['color-accent', 'color-cream'],
    ['color-accent', 'color-white'],
  ];
  for (const [fg, bg] of tekst) {
    it(`tekst --${fg} på --${bg} er minst 4,5:1`, () => {
      expect(kontrast(farge(fg), farge(bg))).toBeGreaterThanOrEqual(4.5);
    });
  }

  // Kanten på skjemafelt er en grafisk komponent (WCAG 1.4.11): minst 3:1 mot bakgrunnen.
  for (const bg of ['color-white', 'color-cream', 'color-sand']) {
    it(`feltkanten --color-border-field på --${bg} er minst 3:1`, () => {
      expect(kontrast(farge('color-border-field'), farge(bg))).toBeGreaterThanOrEqual(3);
    });
  }
});
