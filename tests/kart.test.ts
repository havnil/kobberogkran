import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { avstandKm, KOORDINATER, lagKart } from '../src/lib/kart';
import { alleSteder, firmaSchema } from '../src/lib/firma';

const firma = firmaSchema.parse(JSON.parse(readFileSync('src/content/firma/firma.json', 'utf8')).firma);

describe('områdekartet', () => {
  it('has coordinates for every place in firma, so all of them are drawn', () => {
    expect(lagKart(firma.omrade.regioner).utenKoordinater).toEqual([]);
  });

  it('measures straight-line distances in km', () => {
    // Hemnes–Lillestrøm is about 37 km in a straight line.
    expect(avstandKm(KOORDINATER.Hemnes, KOORDINATER.Lillestrøm)).toBeGreaterThan(33);
    expect(avstandKm(KOORDINATER.Hemnes, KOORDINATER.Lillestrøm)).toBeLessThan(41);
  });

  it('keeps every place inside the canvas, with north up', () => {
    const k = lagKart(firma.omrade.regioner);
    for (const p of k.punkter) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(k.bredde);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(k.hoyde);
    }
    const y = (n: string) => k.punkter.find((p) => p.navn === n)!.y;
    expect(y('Aurskog')).toBeLessThan(y('Hemnes'));
    expect(y('Mysen')).toBeGreaterThan(y('Hemnes'));
  });

  it('marks the first place of the first region as the base', () => {
    const k = lagKart(firma.omrade.regioner);
    expect(k.punkter.filter((p) => p.base).map((p) => p.navn)).toEqual([alleSteder(firma.omrade)[0]]);
    expect(k.base).not.toBeNull();
  });

  it('lists a new place without coordinates instead of failing', () => {
    const k = lagKart([{ steder: ['Hemnes', 'Fetsund'] }]);
    expect(k.utenKoordinater).toEqual(['Fetsund']);
    expect(k.punkter.map((p) => p.navn)).toEqual(['Hemnes']);
  });
});
