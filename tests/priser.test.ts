import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { firmaSchema } from '../src/lib/firma';
import { aktivSesong, formatKr, regneeksempel } from '../src/lib/priser';

const firma = firmaSchema.parse(JSON.parse(readFileSync('src/content/firma/firma.json', 'utf8')).firma);

describe('regneeksempel', () => {
  it('is 1 hour + service van + consumables with the start prices', () => {
    expect(regneeksempel(firma.priser)).toBe(1875);
  });

  it('multiplies only the hourly rate by the number of hours', () => {
    expect(regneeksempel(firma.priser, 2)).toBe(2 * 1125 + 625 + 125);
  });
});

describe('formatKr', () => {
  it('formats with a thousands separator and kr (nb)', () => {
    expect(formatKr(1875, 'nb').replace(/[\s  ]/g, ' ')).toBe('1 875 kr');
  });

  it('formats english with the same unit', () => {
    expect(formatKr(1875, 'en').replace(/[\s  ,]/g, ' ')).toBe('1 875 kr');
  });
});

describe('aktivSesong', () => {
  it('is host from August to November', () => {
    expect(aktivSesong(new Date('2027-10-01'))).toBe('host');
    expect(aktivSesong(new Date('2027-08-01T12:00:00'))).toBe('host');
    expect(aktivSesong(new Date('2027-11-30T12:00:00'))).toBe('host');
  });

  it('is var the rest of the year', () => {
    expect(aktivSesong(new Date('2027-04-01'))).toBe('var');
    expect(aktivSesong(new Date('2027-07-31T12:00:00'))).toBe('var');
    expect(aktivSesong(new Date('2027-12-15T12:00:00'))).toBe('var');
    expect(aktivSesong(new Date('2027-01-15T12:00:00'))).toBe('var');
  });
});
