import { localizePath } from './alternates';
import type { Locale } from './locales';

/** Slug of each top-level page per locale. English slugs are English. */
const SLUGS = {
  nb: { tjenester: 'tjenester', priser: 'priser', omrader: 'omrader', om: 'om', kontakt: 'kontakt', vilkar: 'vilkar', personvern: 'personvern' },
  en: { tjenester: 'services', priser: 'prices', omrader: 'areas', om: 'about', kontakt: 'contact', vilkar: 'terms', personvern: 'privacy' },
} as const satisfies Record<Locale, Record<string, string>>;

export type NavKey = keyof (typeof SLUGS)['nb'];

export function navPath(locale: Locale, key: NavKey): string {
  return localizePath(locale, SLUGS[locale][key]);
}
