import { describe, expect, it } from 'vitest';
import { ruterKlasse } from '../src/lib/ruter';

describe('ruterKlasse', () => {
  it('uses three columns when that fills every row and four would not', () => {
    expect(ruterKlasse(9)).toBe('ruter-3');
    expect(ruterKlasse(6)).toBe('ruter-3');
  });

  it('keeps four columns otherwise', () => {
    expect(ruterKlasse(8)).toBeUndefined();
    expect(ruterKlasse(10)).toBeUndefined();
    expect(ruterKlasse(12)).toBeUndefined();
  });
});
