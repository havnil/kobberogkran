// UI texts of one language (Astro only: reads the `tekster` content collection).
import type { Locale } from '../i18n/locales';
import { tekstSchema, type Tekster } from './innhold';

export async function getTekster(locale: Locale): Promise<Tekster> {
  const { getEntry } = await import('astro:content');
  const entry = await getEntry('tekster', locale);
  if (!entry) throw new Error(`Missing src/content/tekster/${locale}.json`);
  return tekstSchema.parse(entry.data);
}
