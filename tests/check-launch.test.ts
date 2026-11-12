import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findPlaceholders } from '../scripts/check-launch.mjs';

const script = resolve('scripts/check-launch.mjs');
let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'check-launch-'));
  mkdirSync(join(root, 'dist/client/en'), { recursive: true });
  mkdirSync(join(root, 'src/content/firma'), { recursive: true });
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const html = (name: string, body: string) =>
  writeFileSync(join(root, 'dist/client', name), body);
const dataPath = () => join(root, 'src/content/firma/firma.json');
const json = (body: string) => writeFileSync(dataPath(), body);

function run(launch: boolean) {
  const env = { ...process.env, LAUNCH: launch ? 'true' : '' };
  return spawnSync(process.execPath, [script], { cwd: root, env, encoding: 'utf8' });
}

describe('findPlaceholders', () => {
  it('finds data-plassholder in HTML and "plassholder": true in JSON', () => {
    html('index.html', '<p>a</p>\n<span data-plassholder>x</span>');
    json('{\n  "a": { "verdi": 1, "plassholder": true }\n}');
    const hits = findPlaceholders(join(root, 'dist/client'), [dataPath()]);
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatch(/index\.html:2/);
    expect(hits[1]).toMatch(/firma\.json:2/);
  });

  it('returns [] for clean HTML and data', () => {
    html('index.html', '<p>ren</p>');
    json('{ "a": { "verdi": 1, "plassholder": false } }');
    expect(findPlaceholders(join(root, 'dist/client'), [dataPath()])).toEqual([]);
  });

  it('scans nested directories', () => {
    html('en/index.html', '<span data-plassholder>x</span>');
    expect(findPlaceholders(join(root, 'dist/client'), [])).toHaveLength(1);
  });
});

describe('CLI', () => {
  it('exits 1 and prints paths with LAUNCH=true when placeholders exist', () => {
    html('index.html', '<span data-plassholder>x</span>');
    json('{ "a": { "verdi": 1, "plassholder": true } }');
    const r = run(true);
    expect(r.status).toBe(1);
    expect(r.stderr + r.stdout).toMatch(/index\.html:1/);
    expect(r.stderr + r.stdout).toMatch(/firma\.json:1/);
  });

  it('exits 0 without LAUNCH and reports the count', () => {
    html('index.html', '<span data-plassholder>x</span>');
    json('{ "a": { "verdi": 1, "plassholder": true } }');
    const r = run(false);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('2 plassholdere (tillatt før lansering)');
  });

  it('exits 0 with LAUNCH=true when clean', () => {
    html('index.html', '<p>ren</p>');
    json('{ "a": { "verdi": 1, "plassholder": false } }');
    expect(run(true).status).toBe(0);
  });
});
