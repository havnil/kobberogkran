import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { firmaSchema } from '../src/lib/firma';
import { tekstSchema } from '../src/lib/innhold';

const les = (f: string) => JSON.parse(readFileSync(f, 'utf8'));
const firma = firmaSchema.parse(les('src/content/firma/firma.json').firma);
const nb = tekstSchema.parse(les('src/content/tekster/nb.json')).sider.priser.fastpriser;
const en = tekstSchema.parse(les('src/content/tekster/en.json')).sider.priser.fastpriser;

describe('fastpriser', () => {
  it('lists 5 to 10 examples, each with a price in firma', () => {
    expect(nb.rader.length).toBeGreaterThanOrEqual(5);
    expect(nb.rader.length).toBeLessThanOrEqual(10);
    for (const r of nb.rader) expect(firma.priser[r.pris].verdi).toBeGreaterThan(0);
  });

  it('shows the same prices in the same order in both languages', () => {
    expect(en.rader.map((r) => r.pris)).toEqual(nb.rader.map((r) => r.pris));
  });

  it('includes the water heater, so its fixed price is listed with the others', () => {
    expect(nb.rader.map((r) => r.pris)).toContain('varmtvannstankArbeid');
  });
});
