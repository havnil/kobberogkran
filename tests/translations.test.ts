import { describe, expect, it } from 'vitest';
import { findMissingTranslations, withCollection } from '../scripts/lib/translations.mjs';

const LOCALES = ['nb', 'en'];

describe('findMissingTranslations', () => {
  it('reports entries that exist in only some locales', () => {
    const entries = [
      { locale: 'nb', translationKey: 'about', path: 'src/content/pages/nb/om-oss.md' },
      { locale: 'en', translationKey: 'about', path: 'src/content/pages/en/about.md' },
      { locale: 'nb', translationKey: 'only-nb', path: 'src/content/pages/nb/kun-norsk.md' },
    ];
    expect(findMissingTranslations(entries, LOCALES)).toEqual([
      { translationKey: 'only-nb', missing: ['en'], present: ['nb'] },
    ]);
  });

  it('returns an empty list when every entry is translated', () => {
    const entries = [
      { locale: 'nb', translationKey: 'home', path: 'src/content/pages/nb/index.md' },
      { locale: 'en', translationKey: 'home', path: 'src/content/pages/en/index.md' },
      { locale: 'en', translationKey: 'about', path: 'src/content/pages/en/about.md' },
      { locale: 'nb', translationKey: 'about', path: 'src/content/pages/nb/om-oss.md' },
    ];
    expect(findMissingTranslations(entries, LOCALES)).toEqual([]);
  });
});

describe('withCollection', () => {
  it('namespaces keys so a missing translated service is reported', () => {
    const services = withCollection(
      [
        { locale: 'nb', translationKey: 'hytte', path: 'src/content/tjenester/nb/hytte.md' },
        { locale: 'en', translationKey: 'hytte', path: 'src/content/tjenester/en/cabin.md' },
        { locale: 'nb', translationKey: 'bad', path: 'src/content/tjenester/nb/bad.md' },
      ],
      'tjenester',
    );
    expect(findMissingTranslations(services, LOCALES)).toEqual([
      { translationKey: 'tjenester:bad', missing: ['en'], present: ['nb'] },
    ]);
  });
});
