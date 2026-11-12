import { getCollection, type CollectionEntry } from 'astro:content';
import { LOCALES, type Locale } from './locales';
import { navPath } from './nav';
import type { Alternate } from './alternates';

export type ServiceEntry = CollectionEntry<'tjenester'>;

/** The slug part of an entry id `<locale>/<slug>`. */
export function serviceSlugOf(entry: ServiceEntry): string {
  return entry.id.slice(entry.id.indexOf('/') + 1);
}

/** URL of a service page, e.g. `/tjenester/hytte/` or `/en/services/cabin/`. */
export function servicePath(locale: Locale, slug: string): string {
  return `${navPath(locale, 'tjenester')}${slug}/`;
}

/** All services of one locale, in `nummer` order. */
export async function getServices(locale: Locale): Promise<ServiceEntry[]> {
  const all = await getCollection('tjenester');
  return all.filter((e) => e.data.locale === locale).sort((a, b) => a.data.nummer - b.data.nummer);
}

/** Static paths for one locale's `[slug].astro` under the services section; mirrors `pagePaths`. */
export async function servicePaths(locale: Locale) {
  const all = await getCollection('tjenester');
  return all
    .filter((entry) => entry.data.locale === locale)
    .map((entry) => {
      const alternates: Alternate[] = LOCALES.flatMap((l) => {
        const other = all.find((e) => e.data.locale === l && e.data.translationKey === entry.data.translationKey);
        return other ? [{ locale: l, href: servicePath(l, serviceSlugOf(other)) }] : [];
      });
      return { params: { slug: serviceSlugOf(entry) }, props: { entry, alternates } };
    });
}
