import { describe, expect, it } from 'vitest';
import {
  evaluateHttp,
  evaluateLighthouse,
  evaluateLinks,
  evaluateMx,
  evaluateTls,
  evaluateTranslations,
} from '../../scripts/watchdog/checks.mjs';

describe('evaluateTls', () => {
  it('passes when the certificate is valid for more than 14 days', () => {
    const result = evaluateTls(30);
    expect(result.ok).toBe(true);
    expect(result.id).toBe('tls');
    expect(result.needsHuman).toBe(false);
  });

  it('fails when the certificate expires within 14 days', () => {
    const result = evaluateTls(13);
    expect(result.ok).toBe(false);
    expect(result.summary).toContain('13');
  });

  it('honours a custom minimum', () => {
    expect(evaluateTls(20, 30).ok).toBe(false);
  });
});

describe('evaluateMx', () => {
  it('passes when the Microsoft 365 MX record is present', () => {
    const result = evaluateMx([
      { exchange: 'kobberogkran-no.mail.protection.outlook.com', priority: 1 },
    ]);
    expect(result.ok).toBe(true);
    expect(result.id).toBe('dns-mx');
  });

  it('ignores case and a trailing dot', () => {
    expect(
      evaluateMx([{ exchange: 'Kobberogkran-no.mail.protection.outlook.com.', priority: 0 }]).ok,
    ).toBe(true);
  });

  it('fails and needs a human when the MX record is missing', () => {
    const result = evaluateMx([]);
    expect(result.ok).toBe(false);
    expect(result.needsHuman).toBe(true);
  });
});

describe('evaluateHttp', () => {
  it('fails when any page does not return 200 and names it', () => {
    const result = evaluateHttp([
      { url: '/', status: 200 },
      { url: '/en/', status: 500 },
    ]);
    expect(result.ok).toBe(false);
    expect(result.id).toBe('http');
    expect(result.details).toContain('/en/');
  });

  it('passes when all pages return 200', () => {
    expect(
      evaluateHttp([
        { url: '/', status: 200 },
        { url: '/en/', status: 200 },
      ]).ok,
    ).toBe(true);
  });
});

describe('evaluateLinks', () => {
  it('fails and lists the broken links from a lychee JSON report', () => {
    const result = evaluateLinks({
      errors: 1,
      error_map: {
        'https://kobberogkran.no/': [
          { url: 'https://kobberogkran.no/missing/', status: { text: '404 Not Found', code: 404 } },
        ],
      },
    });
    expect(result.ok).toBe(false);
    expect(result.id).toBe('links');
    expect(result.needsHuman).toBe(false);
    expect(result.details).toContain('https://kobberogkran.no/missing/');
  });

  it('passes when lychee reports no errors', () => {
    expect(evaluateLinks({ errors: 0, error_map: {} }).ok).toBe(true);
  });
});

describe('evaluateLighthouse', () => {
  it('fails and lists failed error-level assertions', () => {
    const result = evaluateLighthouse([
      {
        name: 'minScore',
        auditId: 'categories',
        auditProperty: 'performance',
        actual: 0.7,
        expected: 0.85,
        operator: '>=',
        level: 'error',
        passed: false,
        url: 'https://kobberogkran.no/',
      },
    ]);
    expect(result.ok).toBe(false);
    expect(result.id).toBe('lighthouse');
    expect(result.details).toContain('https://kobberogkran.no/');
    expect(result.details).toContain('performance');
  });

  it('passes with no failed error-level assertions', () => {
    expect(evaluateLighthouse([]).ok).toBe(true);
  });
});

describe('evaluateTranslations', () => {
  it('fails and needs a human when entries are untranslated', () => {
    const result = evaluateTranslations([
      { translationKey: 'only-nb', missing: ['en'], present: ['nb'] },
    ]);
    expect(result.ok).toBe(false);
    expect(result.id).toBe('translations');
    expect(result.needsHuman).toBe(true);
    expect(result.details).toContain('only-nb');
  });

  it('passes with nothing missing', () => {
    expect(evaluateTranslations([]).ok).toBe(true);
  });
});
