import { describe, expect, it } from 'vitest';
import { ui } from '../../src/i18n/ui';

const required = ['nav', 'ring', 'whatsapp', 'skjemaKnapp', 'meny', 'lukk'];
const navKeys = ['tjenester', 'priser', 'omrader', 'om', 'kontakt'];

/** Every leaf of a (possibly nested) strings object as `path -> value`. */
function leaves(value: unknown, path = ''): [string, unknown][] {
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, inner]) => leaves(inner, path ? `${path}.${key}` : key));
  }
  return [[path, value]];
}

describe('ui strings', () => {
  it('has the header, bottom bar and menu keys', () => {
    for (const locale of ['nb', 'en'] as const) {
      for (const key of required) expect(Object.keys(ui[locale])).toContain(key);
      expect(Object.keys(ui[locale].nav).sort()).toEqual([...navKeys].sort());
    }
  });

  it('has the same keys in nb and en, all non-empty strings', () => {
    for (const key of Object.keys(ui.nb)) {
      expect(ui.en, `en is missing ${key}`).toHaveProperty(key);
    }
    expect(leaves(ui.en).map(([path]) => path).sort()).toEqual(leaves(ui.nb).map(([path]) => path).sort());
    for (const locale of ['nb', 'en'] as const) {
      for (const [path, value] of leaves(ui[locale])) {
        expect(typeof value, `${locale}.${path}`).toBe('string');
        expect((value as string).trim(), `${locale}.${path}`).not.toBe('');
      }
    }
  });

  it('uses the placeholder form button text', () => {
    expect(ui.nb.skjemaKnapp).toBe('PLASSHOLDER: Send forespørsel');
    expect(ui.en.skjemaKnapp).toMatch(/^\[EN\] /);
  });
});
