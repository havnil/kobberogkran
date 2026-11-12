import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { LOCALES } from './i18n/locales';
import { firmaSchema } from './lib/firma';

/**
 * Pages live in `src/content/pages/<locale>/<slug>.md`, so entry ids are `<locale>/<slug>`.
 * Slugs may differ per language; `translationKey` links the translations of one page.
 */
const pages = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/pages',
    // Keep `index` in the id (the default drops it), so ids are always `<locale>/<slug>`.
    generateId: ({ entry }) => entry.replace(/\\/g, '/').replace(/\.md$/, ''),
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    translationKey: z.string(),
    locale: z.enum(LOCALES),
  }),
});

/** Company data: one entry, id `firma`. Edit `src/content/firma/firma.json`. */
const firma = defineCollection({
  loader: file('./src/content/firma/firma.json'),
  schema: firmaSchema,
});

export const collections = { pages, firma };
