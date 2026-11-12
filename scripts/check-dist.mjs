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

function expectNotContains(file, needles) {
  const html = read(file);
  if (html === null) return;
  for (const needle of needles) {
    if (html.includes(needle)) failures.push(`${join(STATIC_DIR, file)} contains ${needle}`);
  }
}

const chrome = ['class="mobil-bunnlinje"', 'href="tel:', 'href="https://wa.me/'];
expectContains('index.html', ['lang="nb"', 'hreflang="en"', 'hreflang="x-default"', ...chrome, 'id="lekker-naa"', 'id="skjema"', 'href="#skjema"']);
expectContains('en/index.html', ['lang="en"', ...chrome, 'id="lekker-naa"', 'id="skjema"', 'href="#skjema"']);
// The full-width night-duty stripe is not part of the brand; the marker must never appear.
expectNotContains('index.html', ['data-dognvakt-stripe']);
expectNotContains('en/index.html', ['data-dognvakt-stripe']);
// Service pages: all five exist in both languages, each with a form section for its service.
const tjenester = {
  nb: ['service-og-reparasjon', 'varmtvannstank', 'bronn-og-vann', 'hytte', 'bad'],
  en: ['service-and-repairs', 'water-heater', 'well-and-water', 'cabin', 'bathroom'],
};
for (const slug of tjenester.nb) expectContains(`tjenester/${slug}/index.html`, ['lang="nb"', 'id="skjema"', 'data-tjeneste=', 'href="#skjema"', 'application/ld+json']);
for (const slug of tjenester.en) expectContains(`en/services/${slug}/index.html`, ['lang="en"', 'id="skjema"', 'data-tjeneste=', 'href="#skjema"', 'application/ld+json']);
// The bathroom page must not show any price (no `data-pris` element at all).
expectNotContains('tjenester/bad/index.html', ['data-pris']);
expectNotContains('en/services/bathroom/index.html', ['data-pris']);
// The price page shows prices and the contact page has the form.
expectContains('priser/index.html', ['data-pris']);
expectContains('en/prices/index.html', ['data-pris']);
expectContains('kontakt/index.html', ['id="skjema"']);
expectContains('en/contact/index.html', ['id="skjema"']);
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
