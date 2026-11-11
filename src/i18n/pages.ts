import { getCollection, type CollectionEntry } from 'astro:content';
import { alternates, type Alternate } from './alternates';
import type { Locale } from './locales';

export type PageEntry = CollectionEntry<'pages'>;

/** The slug part of an entry id `<locale>/<slug>`. */
export function slugOf(entry: PageEntry): string {
  return entry.id.slice(entry.id.indexOf('/') + 1);
}

/** Static paths for one locale's `[...slug].astro`; `index` maps to `slug: undefined`. */
export async function pagePaths(locale: Locale) {
  const all = await getCollection('pages');
  const index = all.map((e) => ({ locale: e.data.locale, slug: slugOf(e), translationKey: e.data.translationKey }));
  return all
    .filter((entry) => entry.data.locale === locale)
    .map((entry) => {
      const slug = slugOf(entry);
      const pageAlternates: Alternate[] = alternates(entry.data.translationKey, index);
      return {
        params: { slug: slug === 'index' ? undefined : slug },
        props: { entry, alternates: pageAlternates },
      };
    });
}
