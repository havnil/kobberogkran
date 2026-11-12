#!/usr/bin/env node
// Launch gate: finds placeholders in the built HTML (`data-plassholder`) and in the data
// files (`"plassholder": true`). Without LAUNCH=true it only reports the count; with
// LAUNCH=true any hit fails (exit 1) and the file paths and line numbers are printed.
// Usage: [LAUNCH=true] node scripts/check-launch.mjs   (run after `npm run build`)
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Static output dir of the Cloudflare adapter (same as scripts/check-dist.mjs). */
const STATIC_DIR = 'dist/client';
const DATA_DIR = 'src/content';

const HTML_MARKER = /data-plassholder/;
const DATA_MARKER = /"plassholder"\s*:\s*true/;

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

function scan(file, marker) {
  const hits = [];
  readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (marker.test(line)) hits.push(`${file.replace(/\\/g, '/')}:${i + 1}`);
    });
  return hits;
}

/**
 * @param {string} distDir directory scanned recursively for .html files
 * @param {string[]} dataFiles JSON data files to scan
 * @returns {string[]} `path:line` for every placeholder found
 */
export function findPlaceholders(distDir, dataFiles) {
  return [
    ...walk(distDir, '.html').flatMap((f) => scan(f, HTML_MARKER)),
    ...dataFiles.flatMap((f) => scan(f, DATA_MARKER)),
  ];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const hits = findPlaceholders(STATIC_DIR, walk(DATA_DIR, '.json'));
  if (process.env.LAUNCH === 'true' && hits.length > 0) {
    console.error(`check-launch: ${hits.length} plassholdere funnet, kan ikke lanseres:`);
    for (const hit of hits) console.error(`  ${hit}`);
    process.exit(1);
  }
  console.log(`${hits.length} plassholdere (tillatt før lansering)`);
}
