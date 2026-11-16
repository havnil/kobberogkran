// Reference projects: which may be shown, in what order, and how the month is written. Pure functions (tests
// import them without Astro); `getProsjekter` reads the collection.
import type { Locale } from '../i18n/locales';
import type { Prosjekt } from './innhold';

/** Newest first (`dato` is `YYYY-MM`), then by title, so the order is stable. */
export function sorterProsjekter<T extends { data: Pick<Prosjekt, 'dato' | 'tittel'> }>(alle: T[]): T[] {
  return [...alle].sort((a, b) => b.data.dato.localeCompare(a.data.dato) || a.data.tittel.localeCompare(b.data.tittel, 'nb'));
}

/** Real projects always; examples only where `eksempler` is true (see `visEksempler` in ./omtale). */
export function synligeProsjekter<T extends { data: Pick<Prosjekt, 'ekte'> }>(alle: T[], eksempler: boolean): T[] {
  return alle.filter((p) => p.data.ekte || eksempler);
}

/** «september 2026» / «September 2026». */
export function formaterMaaned(dato: string, locale: Locale): string {
  const [aar, maaned] = dato.split('-').map(Number);
  return new Intl.DateTimeFormat(locale === 'nb' ? 'nb-NO' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    Date.UTC(aar, maaned - 1, 1),
  );
}

/** Title, text and alt text in the page's language, falling back to Norwegian. */
export function paaSpraak(p: Prosjekt, locale: Locale) {
  const en = locale === 'en';
  return {
    tittel: (en && p.tittelEn) || p.tittel,
    /** English text, or null when the Norwegian markdown body must be shown. */
    tekstEn: en && p.tekstEn ? p.tekstEn : null,
    /** True when the page is English but this project has no English title or text. */
    norskReserve: en && (!p.tittelEn || !p.tekstEn),
    bilder: p.bilder.map((b) => ({ src: b.bilde, alt: (en && b.altEn) || b.alt })),
  };
}

/** Every project, newest first (Astro only). */
export async function getProsjekter() {
  const { getCollection } = await import('astro:content');
  return sorterProsjekter(await getCollection('prosjekter'));
}
