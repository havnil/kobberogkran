#!/usr/bin/env node
// Launch gate: finds placeholders in the built HTML and in src/content (markers below).
// Without LAUNCH=true it only reports the count; with LAUNCH=true any hit fails (exit 1)
// and the file paths and line numbers are printed. `npm run build` runs this after
// `astro build`, so setting LAUNCH=true in Cloudflare Workers Builds blocks a deploy.
// Usage: [LAUNCH=true] node scripts/check-launch.mjs   (run after `astro build`)
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Static output dir of the Cloudflare adapter (same as scripts/check-dist.mjs). */
const STATIC_DIR = 'dist/client';
const DATA_DIR = 'src/content';

// Markers: `data-plassholder` as an attribute (not a CSS selector), `"plassholder": true`
// in data, the literal `PLASSHOLDER` anywhere, and the `[EN] ` prefix of English placeholder
// copy (start of a line or of a text/value, also inside an HTML-escaped attribute value such as
// `data-tekster="{&quot;x&quot;:&quot;[EN] …"`) in English files only.
const ATTR = /<[^>]*\sdata-plassholder\b/;
const DATA_FLAG = /"plassholder"\s*:\s*true/;
const LITERAL = /PLASSHOLDER/;
const EN_PREFIX = /(^\s*|[:>"'-]\s*|&quot;\s*|&#3[49];\s*|&#x2[27];\s*)\[EN\] /;

function walk(dir, ext) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(path, ext));
    else if (entry.name.endsWith(ext)) files.push(path);
  }
  return files;
}

function scan(file, markers) {
  const hits = [];
  readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (markers.some((m) => m.test(line))) hits.push(`${file.replace(/\\/g, '/')}:${i + 1}`);
    });
  return hits;
}

/**
 * English files: anything under an `en/` directory, and `en.json` / `en.md` (e.g.
 * src/content/tekster/en.json, whose strings are only rendered by SSR pages such as takk and
 * send-bilder and so never appear in the static HTML).
 */
const isEnglish = (path) => /(^|[\\/])en([\\/]|\.(json|md)$)/.test(path);

/**
 * @param {string} distDir directory scanned recursively for .html files
 * @param {string[]} dataFiles content files (.json, .md) to scan
 * @returns {string[]} `path:line` for every placeholder found
 */
export function findPlaceholders(distDir, dataFiles) {
  const html = walk(distDir, '.html').flatMap((f) =>
    scan(f, [ATTR, LITERAL, ...(isEnglish(relative(distDir, f)) ? [EN_PREFIX] : [])]),
  );
  const data = dataFiles.flatMap((f) =>
    scan(f, [DATA_FLAG, LITERAL, ...(isEnglish(f) ? [EN_PREFIX] : [])]),
  );
  return [...html, ...data];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const files = [...walk(DATA_DIR, '.json'), ...walk(DATA_DIR, '.md')];
  const hits = findPlaceholders(STATIC_DIR, files);
  if (process.env.LAUNCH === 'true' && hits.length > 0) {
    console.error(`check-launch: ${hits.length} plassholdere funnet, kan ikke lanseres:`);
    for (const hit of hits) console.error(`  ${hit}`);
    process.exit(1);
  }
  console.log(`${hits.length} plassholdere (tillatt før lansering)`);
}
