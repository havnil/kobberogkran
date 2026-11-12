#!/usr/bin/env node
// Decides whether an `auto-fix` PR may auto-merge: only when it touches no content and
// none of the agent's guardrails.
// Usage: <one path per line on stdin> | node scripts/automerge/classify.mjs
// Prints {"allowed": boolean, "blocked": string[]} as JSON on stdout.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Content paths (Global Constraints). A PR touching any of these always waits for a human. */
export const BLOCKED_PREFIXES = ['src/content/', 'public/images/', 'public/admin/', 'brand/'];

/**
 * The agent's own guardrails: its instructions, the workflows and scripts that decide what
 * it is dispatched to and what may merge, and production routing. An agent PR must never
 * change them without a human, so a change here also blocks auto-merge. Other workflow
 * fixes (e.g. ci.yml) stay technical. `scripts/` covers `scripts/automerge/` and
 * `scripts/watchdog/` too; they stay listed so the intent is explicit.
 */
export const GUARD_PREFIXES = [
  'CLAUDE.md',
  'AGENTS.md',
  '.claude/',
  'scripts/automerge/',
  'scripts/watchdog/',
  '.github/workflows/auto-merge.yml',
  '.github/workflows/claude.yml',
  '.github/workflows/claude-watchdog.yml',
  '.github/workflows/watchdog-',
  '.github/prompts/',
  '.github/dependabot.yml',
  'wrangler.jsonc',
  // Safety-critical code: the form API, notifications and AI sorting, the database schema,
  // the build and launch checks, the launch flag and the UI strings (customer-facing copy).
  'scripts/',
  'migrations/',
  'src/server/',
  'src/pages/api/',
  'src/lib/lansering.ts',
  'src/i18n/ui.ts',
];

/** Media served from public/ (favicon, fonts, images outside uploads) is brand content. */
export const PUBLIC_MEDIA = /^public\/.*\.(svg|png|jpe?g|gif|webp|avif|ico|bmp|tiff?|woff2?|ttf|otf|eot|mp4|webm|mov|mp3|pdf)$/i;

/** @param {string} path */
function normalize(path) {
  return path.trim().replaceAll('\\', '/').replace(/^(\.\/)+/, '');
}

/**
 * @param {string[]} files changed paths (renames should list both old and new path)
 * @returns {{ allowed: boolean, blocked: string[] }}
 */
export function classifyPaths(files) {
  const paths = files.map(normalize).filter((p) => p.length > 0);
  const prefixes = [...BLOCKED_PREFIXES, ...GUARD_PREFIXES];
  const blocked = paths.filter((p) => PUBLIC_MEDIA.test(p) || prefixes.some((prefix) => p.startsWith(prefix)));
  // An empty list means we could not see the change set, so never merge blind.
  return { allowed: paths.length > 0 && blocked.length === 0, blocked };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = readFileSync(0, 'utf8').split(/\r?\n/);
  process.stdout.write(`${JSON.stringify(classifyPaths(files))}\n`);
}
