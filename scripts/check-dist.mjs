#!/usr/bin/env node
// Asserts that the built site is complete. Run after `npm run build`.
// Usage: node scripts/check-dist.mjs
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Static output dir of the Cloudflare adapter (server code goes to dist/server). */
export const STATIC_DIR = 'dist/client';

const failures = [];

function read(file) {
  const path = join(STATIC_DIR, file);
  if (!existsSync(path)) {
    failures.push(`${path} is missing`);
    return null;
  }
  return readFileSync(path, 'utf8');
}

function expectContains(file, needles) {
  const html = read(file);
  if (html === null) return;
  for (const needle of needles) {
    if (!html.includes(needle)) failures.push(`${join(STATIC_DIR, file)} does not contain ${needle}`);
  }
}

expectContains('index.html', ['lang="nb"', 'hreflang="en"', 'hreflang="x-default"']);
expectContains('en/index.html', ['lang="en"']);
expectContains('404.html', ['lang="nb"']);
expectContains('en/404.html', ['lang="en"']);
read('sitemap-index.xml');
read('robots.txt');
read('admin/index.html');
read('admin/config.yml');

if (failures.length > 0) {
  for (const failure of failures) console.error(`check-dist: ${failure}`);
  process.exit(1);
}
console.log(`check-dist: ${STATIC_DIR} OK`);
