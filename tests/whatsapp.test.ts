import { describe, expect, it } from 'vitest';
import { fyllHilsen, renKilde, waLenke } from '../src/lib/whatsapp';

const MAL = 'Hei! Jeg trenger hjelp med {tjeneste}. (Fra: {kilde})';

describe('waLenke', () => {
  it('builds a wa.me link with digits only and an encoded text', () => {
    expect(waLenke('+47 000 00 000', 'Hei')).toBe('https://wa.me/4700000000?text=Hei');
    expect(waLenke('+47 000 00 000', 'Hei der & du')).toBe('https://wa.me/4700000000?text=Hei%20der%20%26%20du');
  });
  it('leaves out ?text= when the text is empty', () => {
    expect(waLenke('+47 000 00 000', '')).toBe('https://wa.me/4700000000');
  });
});

describe('renKilde', () => {
  it('keeps only a-z, 0-9 and -, lowercased, max 40 chars', () => {
    expect(renKilde('Google_Ads!')).toBe('googleads');
    expect(renKilde('a'.repeat(60))).toHaveLength(40);
    expect(renKilde(null)).toBe('');
  });
});

describe('fyllHilsen', () => {
  it('fills both placeholders', () => {
    expect(fyllHilsen(MAL, { tjeneste: 'Rørlegger', kilde: 'gbp' })).toBe('Hei! Jeg trenger hjelp med Rørlegger. (Fra: gbp)');
  });
  it('drops an empty tjeneste cleanly', () => {
    expect(fyllHilsen(MAL, { tjeneste: '', kilde: 'gbp' })).toBe('Hei! Jeg trenger hjelp. (Fra: gbp)');
  });
  it('drops an empty kilde cleanly', () => {
    expect(fyllHilsen(MAL, { tjeneste: 'Bad', kilde: '' })).toBe('Hei! Jeg trenger hjelp med Bad.');
  });
  it('drops both', () => {
    expect(fyllHilsen(MAL, {})).toBe('Hei! Jeg trenger hjelp.');
    expect(fyllHilsen('Hi! I need help with {tjeneste}. (From: {kilde})', {})).toBe('Hi! I need help.');
  });
});
