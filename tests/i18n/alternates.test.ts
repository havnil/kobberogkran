import { describe, expect, it } from 'vitest';
import { alternates, localizePath } from '../../src/i18n/alternates';
import type { Locale } from '../../src/i18n/locales';

describe('localizePath', () => {
  it('maps index and slugs to locale-prefixed paths', () => {
    expect(localizePath('nb', 'index')).toBe('/');
    expect(localizePath('nb', 'om-oss')).toBe('/om-oss/');
    expect(localizePath('en', 'index')).toBe('/en/');
    expect(localizePath('en', 'about')).toBe('/en/about/');
  });
});

describe('alternates', () => {
  const entries: { locale: Locale; slug: string; translationKey: string }[] = [
    { locale: 'nb', slug: 'om-oss', translationKey: 'about' },
    { locale: 'en', slug: 'about', translationKey: 'about' },
    { locale: 'nb', slug: 'kun-norsk', translationKey: 'only-nb' },
  ];

  it('lists every locale that has the translation', () => {
    expect(alternates('about', entries)).toEqual([
      { locale: 'nb', href: '/om-oss/' },
      { locale: 'en', href: '/en/about/' },
    ]);
  });

  it('lists only the existing locale when a translation is missing', () => {
    expect(alternates('only-nb', entries)).toEqual([{ locale: 'nb', href: '/kun-norsk/' }]);
  });
});
