import { DEFAULT_LOCALE, LOCALES, type Locale } from './locales';

export interface Alternate {
  locale: Locale;
  href: string;
}

export interface TranslatableEntry {
  locale: Locale;
  slug: string;
  translationKey: string;
}

/** Path for a page: the default locale has no prefix, others get `/<locale>/`. */
export function localizePath(locale: Locale, slug: string): string {
  const prefix = locale === DEFAULT_LOCALE ? '/' : `/${locale}/`;
  return slug === 'index' ? prefix : `${prefix}${slug}/`;
}

/** The locales that have a page with this translationKey, in LOCALES order. */
export function alternates(translationKey: string, entries: TranslatableEntry[]): Alternate[] {
  return LOCALES.flatMap((locale) => {
    const entry = entries.find((e) => e.locale === locale && e.translationKey === translationKey);
    return entry ? [{ locale, href: localizePath(locale, entry.slug) }] : [];
  });
}
