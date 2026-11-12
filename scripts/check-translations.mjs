#!/usr/bin/env node
// Lists pages that are missing a translation. Never fails the build (exit 0), see the spec.
// Usage: node scripts/check-translations.mjs [--json]
//   --json  write the result array to stdout (used by the watchdog)
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { findMissingTranslations, withCollection } from './lib/translations.mjs';

const PAGES_DIR = 'src/content/pages';
const SERVICES_DIR = 'src/content/tjenester';
// Keep in sync with src/i18n/locales.ts (that file is TypeScript, so it can't be imported here).
const LOCALES = ['nb', 'en'];

/** Reads the YAML front matter of a Markdown file. */
function frontMatter(path) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(path, 'utf8'));
  return match ? (parse(match[1]) ?? {}) : {};
}

/** @returns {import('./lib/translations.mjs').PageEntry[]} */
function readEntries(dir) {
  const entries = [];
  for (const file of readdirSync(dir, { recursive: true, encoding: 'utf8' })) {
    if (!file.endsWith('.md')) continue;
    const path = join(dir, file).replace(/\\/g, '/');
    const folderLocale = path.slice(dir.length + 1).split('/')[0];
    const data = frontMatter(path);
    entries.push({
      locale: folderLocale,
      // A page without a translationKey can't be linked, so it is its own group.
      translationKey: data.translationKey ?? path,
      path,
    });
  }
  return entries;
}

const missing = findMissingTranslations(
  [...readEntries(PAGES_DIR), ...withCollection(readEntries(SERVICES_DIR), 'tjenester')],
  LOCALES,
);

if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(missing, null, 2)}\n`);
} else if (missing.length === 0) {
  console.log('check-translations: every page exists in all locales');
} else {
  console.log(`check-translations: ${missing.length} page(s) missing a translation`);
  for (const { translationKey, missing: lacks, present } of missing) {
    console.log(`  ${translationKey}: missing ${lacks.join(', ')} (exists in ${present.join(', ')})`);
  }
}
