import { describe, expect, it } from 'vitest';
import { telHref, waDigits } from '../src/lib/telefon';

describe('telefon', () => {
  it('keeps the leading + in tel: links', () => {
    expect(telHref('+47 000 00 000')).toBe('tel:+4700000000');
    expect(telHref('000 00 000')).toBe('tel:00000000');
  });
  it('gives digits only for wa.me', () => {
    expect(waDigits('+47 000 00 000')).toBe('4700000000');
    expect(waDigits('+4700000000')).toBe('4700000000');
  });
});
