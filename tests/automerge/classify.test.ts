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

  it('blocks changes to the agent guardrails themselves', () => {
    const guards = [
      'scripts/automerge/classify.mjs',
      '.github/workflows/auto-merge.yml',
      '.github/workflows/claude.yml',
      '.github/workflows/claude-watchdog.yml',
      '.github/prompts/watchdog.md',
    ];
    expect(classifyPaths(['package.json', ...guards])).toEqual({ allowed: false, blocked: guards });
  });

  it('blocks the agent instructions, the watchdog and production config', () => {
    const guards = [
      'CLAUDE.md',
      'AGENTS.md',
      '.claude/settings.json',
      'scripts/watchdog/checks.mjs',
      'scripts/watchdog/report.mjs',
      '.github/workflows/watchdog-hourly.yml',
      '.github/workflows/watchdog-daily.yml',
      '.github/dependabot.yml',
      'wrangler.jsonc',
    ];
    for (const path of guards) {
      expect(classifyPaths(['package.json', path]), path).toEqual({ allowed: false, blocked: [path] });
    }
  });

  it('blocks the safety-critical server, migration, script and launch paths', () => {
    const guards = [
      'scripts/check-launch.mjs',
      'scripts/check-dist.mjs',
      'migrations/0001_init.sql',
      'src/server/skjema.ts',
      'src/server/sortering/ai.ts',
      'src/pages/api/foresporsel.ts',
      'src/pages/api/bilde/[id].ts',
      'src/lib/lansering.ts',
      'src/i18n/ui.ts',
      'wrangler.jsonc',
    ];
    for (const path of guards) {
      expect(classifyPaths(['package.json', path]), path).toEqual({ allowed: false, blocked: [path] });
    }
  });

  it('blocks media anywhere under public/', () => {
    for (const path of ['public/favicon.svg', 'public/og.png', 'public/fonts/brand.woff2', 'public/icon.ICO', 'public/a/b.jpeg', 'public/x.webp']) {
      expect(classifyPaths([path]).allowed, path).toBe(false);
    }
  });

  it('still allows robots.txt', () => {
    expect(classifyPaths(['public/robots.txt']).allowed).toBe(true);
  });

  it('does not treat similarly named files as guardrails', () => {
    expect(classifyPaths(['docs/CLAUDE.md.bak', 'src/favicon.svg.ts', 'src/serverless.md', 'src/lib/lanseringer.ts']).allowed).toBe(true);
  });

  it('still allows other workflow fixes', () => {
    expect(classifyPaths(['.github/workflows/ci.yml']).allowed).toBe(true);
  });

  it('uses the blocked prefixes from the Global Constraints', () => {
    expect(BLOCKED_PREFIXES).toEqual(['src/content/', 'public/images/', 'public/admin/', 'brand/']);
  });
});
