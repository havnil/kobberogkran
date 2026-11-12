import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

type Field = { name: string; widget?: string; i18n?: boolean | string; default?: string };
type Collection = { name: string; folder?: string; fields: Field[] };

const config = parse(readFileSync('public/admin/config.yml', 'utf8'));
const pages: Collection = config.collections.find((c: Collection) => c.name === 'pages');
const field = (name: string) => pages.fields.find((f) => f.name === name);

describe('Sveltia CMS config', () => {
  it('saves to the GitHub repo main branch', () => {
    expect(config.backend.name).toBe('github');
    expect(config.backend.repo).toBe('havnil/kobberogkran');
    expect(config.backend.branch).toBe('main');
  });

  it('commits straight to main (no editorial workflow)', () => {
    expect(config).not.toHaveProperty('publish_mode');
  });

  it('edits nb and en in locale folders', () => {
    expect(config.i18n.structure).toBe('multiple_folders');
    expect(config.i18n.locales).toEqual(['nb', 'en']);
    expect(config.i18n.default_locale).toBe('nb');
  });

  it('edits the pages collection', () => {
    expect(pages.folder).toBe('src/content/pages');
  });

  it('translates title, description and body, and shares translationKey', () => {
    expect(field('title')?.i18n).toBe(true);
    expect(field('description')?.i18n).toBe(true);
    expect(field('body')?.i18n).toBe(true);
    expect(field('translationKey')?.i18n).toBe('duplicate');
  });

  it('fills a hidden locale field per locale', () => {
    expect(field('locale')).toMatchObject({ widget: 'hidden', i18n: true, default: '{{locale}}' });
  });

  it('stores media in the shared uploads folder', () => {
    expect(config.media_folder).toBe('public/images/uploads');
    expect(config.public_folder).toBe('/images/uploads');
  });
});

describe('Sveltia CMS collections for services, texts, company and testimonials', () => {
  const col = (name: string) => config.collections.find((c: { name: string }) => c.name === name);

  it('has all collections', () => {
    for (const n of ['pages', 'tjenester', 'tekster', 'firma', 'omtale']) expect(col(n), n).toBeDefined();
  });

  it('translates tjenester like pages, with canonical_slug from the top-level i18n', () => {
    expect(col('tjenester').folder).toBe('src/content/tjenester');
    expect(col('tjenester').i18n).toBe(true);
    expect(config.i18n.canonical_slug.key).toBe('translationKey');
    const names = col('tjenester').fields.map((f: Field) => f.name);
    for (const n of ['title', 'kundeTittel', 'fagord', 'nummer', 'kort', 'fakta', 'faq', 'sesong', 'bilder', 'translationKey', 'locale'])
      expect(names).toContain(n);
  });

  it('keeps firma as a non-i18n file collection', () => {
    const f = col('firma');
    expect(f.files[0].file).toBe('src/content/firma/firma.json');
    expect(f.i18n ?? false).toBe(false);
    expect(f.files[0].i18n ?? false).toBe(false);
  });

  it('labels placeholder flags as a boolean widget', () => {
    expect(JSON.stringify(config.collections)).toContain('Plassholder (blokkerer lansering)');
  });

  it('stores tekster per locale and omtale as a folder', () => {
    expect(col('tekster').files[0].file).toContain('{{locale}}');
    expect(col('omtale').folder).toBe('src/content/omtale');
  });
});
