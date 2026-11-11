#!/usr/bin/env node
// Decides whether an `auto-fix` PR may auto-merge: only when it touches no content.
// Usage: <one path per line on stdin> | node scripts/automerge/classify.mjs
// Prints {"allowed": boolean, "blocked": string[]} as JSON on stdout.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Content paths (Global Constraints). A PR touching any of these always waits for a human. */
export const BLOCKED_PREFIXES = ['src/content/', 'public/images/', 'public/admin/', 'brand/'];

/**
 * The agent's own guardrails. An agent PR must never loosen them without a human, so a
 * change here also blocks auto-merge. Other workflow fixes (e.g. ci.yml) stay technical.
 */
export const GUARD_PREFIXES = [
  'scripts/automerge/',
  '.github/workflows/auto-merge.yml',
  '.github/workflows/claude.yml',
  '.github/workflows/claude-watchdog.yml',
  '.github/prompts/',
];

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
  const blocked = paths.filter((p) => prefixes.some((prefix) => p.startsWith(prefix)));
  // An empty list means we could not see the change set, so never merge blind.
  return { allowed: paths.length > 0 && blocked.length === 0, blocked };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = readFileSync(0, 'utf8').split(/\r?\n/);
  process.stdout.write(`${JSON.stringify(classifyPaths(files))}\n`);
}
