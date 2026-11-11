import { describe, expect, it } from 'vitest';
import { BLOCKED_PREFIXES, classifyPaths } from '../../scripts/automerge/classify.mjs';

describe('classifyPaths', () => {
  it('allows purely technical changes', () => {
    expect(classifyPaths(['package.json', 'src/layouts/BaseLayout.astro'])).toEqual({
      allowed: true,
      blocked: [],
    });
  });

  it('blocks a PR that also touches content and lists the content files', () => {
    expect(classifyPaths(['package.json', 'src/content/pages/nb/index.md'])).toEqual({
      allowed: false,
      blocked: ['src/content/pages/nb/index.md'],
    });
  });

  it('blocks media uploads', () => {
    expect(classifyPaths(['public/images/uploads/a.jpg']).allowed).toBe(false);
  });

  it('blocks brand assets', () => {
    expect(classifyPaths(['brand/logo.svg']).allowed).toBe(false);
  });

  it('blocks the CMS admin', () => {
    expect(classifyPaths(['public/admin/config.yml']).allowed).toBe(false);
  });

  it('matches whole path segments only', () => {
    expect(classifyPaths(['src/contentful.ts', 'branding.md']).allowed).toBe(true);
  });

  it('normalises Windows separators and a leading ./', () => {
    expect(classifyPaths(['.\\src\\content\\pages\\en\\index.md']).allowed).toBe(false);
  });

  it('ignores blank lines from gh output', () => {
    expect(classifyPaths(['', 'package.json', '  '])).toEqual({ allowed: true, blocked: [] });
  });

  it('refuses an empty change list', () => {
    expect(classifyPaths([]).allowed).toBe(false);
  });

  it('uses the blocked prefixes from the Global Constraints', () => {
    expect(BLOCKED_PREFIXES).toEqual(['src/content/', 'public/images/', 'public/admin/', 'brand/']);
  });
});
