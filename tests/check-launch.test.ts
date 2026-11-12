import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
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

describe('text markers', () => {
  const content = (rel: string, body: string) => {
    const p = join(root, 'src/content', rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, body);
    return p;
  };
  const dist = () => join(root, 'dist/client');

  it('flags PLASSHOLDER in markdown and in built HTML text', () => {
    const md = content('pages/nb/x.md', '---\ntitle: PLASSHOLDER: Tittel\n---\n');
    html('index.html', '<h1>PLASSHOLDER: Tittel</h1>');
    const hits = findPlaceholders(dist(), [md]);
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatch(/index\.html:1/);
    expect(hits[1]).toMatch(/x\.md:2/);
  });

  it('flags a [EN] prefix in English content and English HTML only', () => {
    const en = content('pages/en/x.md', '---\ntitle: "[EN] Title"\n---\n[EN] Body\n');
    const nb = content('pages/nb/x.md', '---\ntitle: "[EN] Title"\n---\n');
    html('en/index.html', '<h1>[EN] Title</h1>');
    html('index.html', '<h1>[EN] Title</h1>');
    const hits = findPlaceholders(dist(), [en, nb]).map((h) => h.replaceAll('\\', '/'));
    expect(hits).toHaveLength(3);
    expect(hits.filter((h) => /dist\/client\/en\/index\.html:1/.test(h))).toHaveLength(1);
    expect(hits.some((h) => /pages\/nb\//.test(h))).toBe(false);
    expect(hits.some((h) => /dist\/client\/index\.html/.test(h))).toBe(false);
  });

  it('flags [EN] at the start of a JSON text value in English data', () => {
    const en = content('pages/en/d.json', '{ "t": "[EN] Title" }');
    expect(findPlaceholders(dist(), [en])).toHaveLength(1);
  });

  it('treats en.json (and */en.json) as English and flags [EN] in the real tekster file', () => {
    const real = resolve('src/content/tekster/en.json');
    const hits = findPlaceholders(dist(), [real]);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.replaceAll('\\', '/').includes('src/content/tekster/en.json:'))).toBe(true);
    const nb = content('tekster/nb.json', '{ "t": "[EN] Title" }');
    const en = content('tekster/en.json', '{ "t": "[EN] Title" }');
    expect(findPlaceholders(dist(), [nb])).toEqual([]);
    expect(findPlaceholders(dist(), [en])).toHaveLength(1);
  });

  it('flags [EN] inside an HTML attribute value (data-tekster JSON) in English pages', () => {
    html('en/index.html', '<form data-tekster="{&quot;feil&quot;:&quot;[EN] Something went wrong&quot;}"></form>');
    html('en/b.html', "<div data-x='{&#34;a&#34;:&#34;[EN] b&#34;}'></div>");
    expect(findPlaceholders(dist(), [])).toHaveLength(2);
  });

  it('ignores [data-plassholder] in CSS', () => {
    html('index.html', '<style>[data-plassholder]{outline:1px solid}</style><p>ren</p>');
    expect(findPlaceholders(dist(), [])).toEqual([]);
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
