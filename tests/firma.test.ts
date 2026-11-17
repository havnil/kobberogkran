import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { firmaSchema } from '../src/lib/firma';

const data = JSON.parse(readFileSync('src/content/firma/firma.json', 'utf8')).firma;

describe('firmaSchema', () => {
  it('accepts the shipped firma.json', () => {
    expect(firmaSchema.parse(data).priser.timepris.verdi).toBe(1125);
  });

  it('rejects a missing telefon.verdi', () => {
    const bad = structuredClone(data);
    delete bad.telefon.verdi;
    expect(firmaSchema.safeParse(bad).success).toBe(false);
  });
});
