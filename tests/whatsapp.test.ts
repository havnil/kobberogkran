import { describe, expect, it } from 'vitest';
import { fyllHilsen, renKilde, waLenke } from '../src/lib/whatsapp';

const MAL = 'Hei! Jeg trenger hjelp[ med {tjeneste}].[ (Fra: {kilde})]';

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
  it('drops an empty tjeneste segment cleanly', () => {
    expect(fyllHilsen(MAL, { tjeneste: '', kilde: 'gbp' })).toBe('Hei! Jeg trenger hjelp. (Fra: gbp)');
  });
  it('drops an empty kilde segment cleanly', () => {
    expect(fyllHilsen(MAL, { tjeneste: 'Bad', kilde: '' })).toBe('Hei! Jeg trenger hjelp med Bad.');
  });
  it('drops both', () => {
    expect(fyllHilsen(MAL, {})).toBe('Hei! Jeg trenger hjelp.');
    expect(fyllHilsen('Hi! I need help[ with {tjeneste}].[ (From: {kilde})]', {})).toBe('Hi! I need help.');
  });
  it('does not eat words outside segments', () => {
    expect(fyllHilsen('Hei, jeg lurer på {tjeneste}', {})).toBe('Hei, jeg lurer på');
    expect(fyllHilsen('{tjeneste} takk', {})).toBe('takk');
    expect(fyllHilsen('{tjeneste}-arbeid', {})).toBe('-arbeid');
    expect(fyllHilsen('{tjeneste}-arbeid', { tjeneste: 'Bad' })).toBe('Bad-arbeid');
  });
  it('drops a bracketed segment without leaving empty brackets', () => {
    expect(fyllHilsen('Hei [Fra {kilde}]', {})).toBe('Hei');
    expect(fyllHilsen('Hei [Fra {kilde}]', { kilde: 'x' })).toBe('Hei Fra x');
  });
  it('treats a segment with several placeholders as all-or-nothing', () => {
    expect(fyllHilsen('Hei[ {tjeneste} fra {kilde}]!', { tjeneste: 'Bad' })).toBe('Hei!');
    expect(fyllHilsen('Hei[ {tjeneste} fra {kilde}]!', { tjeneste: 'Bad', kilde: 'x' })).toBe('Hei Bad fra x!');
  });
  it('keeps brackets without placeholders and unbalanced brackets literal', () => {
    expect(fyllHilsen('[EN] Hi[ {kilde}]', {})).toBe('[EN] Hi');
    expect(fyllHilsen('Hi [ {kilde}', { kilde: 'x' })).toBe('Hi [ x');
    expect(fyllHilsen('Hi {kilde}]', { kilde: 'x' })).toBe('Hi x]');
  });
  it('does not nest: an outer pair containing brackets is literal, the inner segment works', () => {
    expect(fyllHilsen('A [b [c {kilde}] d]', {})).toBe('A [b d]');
    expect(fyllHilsen('A [b [c {kilde}] d]', { kilde: 'x' })).toBe('A [b c x d]');
  });
  it('leaves line breaks alone when values are filled and when segments are removed', () => {
    const mal = 'Hei!\n\nJeg trenger hjelp[ med {tjeneste}].\n[Fra: {kilde}]\nTakk  igjen';
    expect(fyllHilsen(mal, { tjeneste: 'Bad', kilde: 'x' })).toBe('Hei!\n\nJeg trenger hjelp med Bad.\nFra: x\nTakk  igjen');
    expect(fyllHilsen(mal, {})).toBe('Hei!\n\nJeg trenger hjelp.\n\nTakk  igjen');
  });
  it('leaves the link unchanged when kilde sanitises to empty (client path)', () => {
    const mal = 'Hei[ med {tjeneste}].[ (Fra: {kilde})]';
    const bygg = (k: string) => waLenke('+47 000 00 000', fyllHilsen(mal, { tjeneste: 'Bad', kilde: renKilde(k) }));
    expect(bygg('!!!')).toBe(bygg(''));
  });
});
