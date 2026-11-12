import { describe, expect, it } from 'vitest';
import { NETTSTED, nettstedUrl } from '../src/lib/nettsted';
import { SITE } from '../src/lib/jsonld';

describe('nettstedUrl', () => {
  it('bruker produksjonsadressen når NETTSTED_URL mangler eller er tom', () => {
    expect(nettstedUrl(undefined)).toBe('https://kobberogkran.no');
    expect(nettstedUrl({})).toBe(NETTSTED);
    expect(nettstedUrl({ NETTSTED_URL: '' })).toBe(NETTSTED);
    expect(nettstedUrl({ NETTSTED_URL: '   ' })).toBe(NETTSTED);
  });

  it('bruker NETTSTED_URL uten skråstrek til slutt', () => {
    expect(nettstedUrl({ NETTSTED_URL: 'https://preview.example.test//' })).toBe('https://preview.example.test');
    expect(nettstedUrl('https://x.test/')).toBe('https://x.test');
  });

  it('er samme adresse som JSON-LD bruker', () => {
    expect(SITE).toBe(NETTSTED);
  });
});
