import { describe, expect, it } from 'vitest';
import { lengsteOrd, ordstil } from '../src/lib/ordstil';

describe('ordstil', () => {
  it('finds the longest word across all parts of a title', () => {
    expect(lengsteOrd('Er varmtvannsberederen', 'din gammel?')).toBe(19);
  });

  it('counts Norwegian letters as one character each', () => {
    expect(lengsteOrd('Rørlegger på Hemnes', 'Aurskog-Høland')).toBe(14);
  });

  it('treats a non-breaking space as a word break', () => {
    expect(lengsteOrd('Kobber og Kran')).toBe(6);
  });

  it('never returns less than 1, so the CSS never divides by zero', () => {
    expect(lengsteOrd(undefined, '')).toBe(1);
  });

  it('writes the custom property', () => {
    expect(ordstil('Varmtvannsbereder')).toBe('--lengste-ord: 17');
  });
});
