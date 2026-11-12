// Finds pages that exist in some locales but not in others.

/**
 * @typedef {{ locale: string, translationKey: string, path: string }} PageEntry
 * @typedef {{ translationKey: string, missing: string[], present: string[] }} MissingTranslation
 */

/**
 * Groups entries by `translationKey` and lists the locales each group lacks.
 * Locales are reported in the order of `locales`; results are sorted by `translationKey`.
 * @param {PageEntry[]} entries
 * @param {string[]} locales
 * @returns {MissingTranslation[]}
 */
export function findMissingTranslations(entries, locales) {
  /** @type {Map<string, Set<string>>} */
  const byKey = new Map();
  for (const { locale, translationKey } of entries) {
    if (!byKey.has(translationKey)) byKey.set(translationKey, new Set());
    byKey.get(translationKey)?.add(locale);
  }

  /** @type {MissingTranslation[]} */
  const result = [];
  for (const [translationKey, found] of [...byKey].sort(([a], [b]) => a.localeCompare(b))) {
    const missing = locales.filter((locale) => !found.has(locale));
    if (missing.length === 0) continue;
    const present = locales.filter((locale) => found.has(locale));
    result.push({ translationKey, missing, present });
  }
  return result;
}

/**
 * Namespaces the keys of one collection (`<collection>:<key>`) so they can't clash with page keys.
 * @param {PageEntry[]} entries
 * @param {string} collection
 * @returns {PageEntry[]}
 */
export function withCollection(entries, collection) {
  return entries.map((e) => ({ ...e, translationKey: `${collection}:${e.translationKey}` }));
}
