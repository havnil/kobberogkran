// Pure evaluation functions for the watchdog. Each turns raw observations into a
// CheckResult; run.mjs gathers the observations and report.mjs files the issues.

/**
 * @typedef {object} CheckResult
 * @property {string} id          Check id: http | tls | dns-mx | links | lighthouse | translations
 * @property {boolean} ok
 * @property {string} summary     One line, used in the issue title.
 * @property {string} details     Markdown, used in the issue body and comments.
 * @property {boolean} needsHuman True when the agent must not try to fix it.
 */

export const EXPECTED_MX = 'kobberogkran-no.mail.protection.outlook.com';
export const MIN_TLS_DAYS = 14;

/** Check ids whose failures always need the owner (DNS/email, wording). */
const NEEDS_HUMAN = new Set(['dns-mx', 'translations']);

/**
 * @param {string} id
 * @param {boolean} ok
 * @param {string} summary
 * @param {string} details
 * @returns {CheckResult}
 */
export function result(id, ok, summary, details) {
  return { id, ok, summary, details, needsHuman: NEEDS_HUMAN.has(id) };
}

/**
 * @param {{url: string, status: number, error?: string}[]} results
 * @returns {CheckResult}
 */
export function evaluateHttp(results) {
  const failed = results.filter((r) => r.status !== 200);
  const lines = results.map(
    (r) => `- \`${r.url}\`: ${r.status === 0 ? 'no response' : r.status}${r.error ? ` (${r.error})` : ''}`,
  );
  if (failed.length === 0) {
    return result('http', true, 'all pages return 200', lines.join('\n'));
  }
  const summary = failed.map((r) => `${r.url} returned ${r.status === 0 ? 'no response' : r.status}`).join(', ');
  return result('http', false, summary, `Expected HTTP 200 from every page.\n\n${lines.join('\n')}`);
}

/**
 * @param {number} daysLeft
 * @param {number} [minDays]
 * @returns {CheckResult}
 */
export function evaluateTls(daysLeft, minDays = MIN_TLS_DAYS) {
  const days = Math.floor(daysLeft);
  const summary = days < 0 ? `certificate expired ${-days} days ago` : `expires in ${days} days`;
  const ok = daysLeft > minDays;
  return result(
    'tls',
    ok,
    summary,
    `The HTTPS certificate must be valid for more than ${minDays} days; it ${summary.replace(/^certificate /, '')}.`,
  );
}

/** @param {string} host */
const normalizeHost = (host) => host.trim().toLowerCase().replace(/\.$/, '');

/**
 * @param {{exchange: string, priority: number}[]} records
 * @param {string} [expected]
 * @returns {CheckResult}
 */
export function evaluateMx(records, expected = EXPECTED_MX) {
  const found = records.map((r) => `- ${r.priority} ${r.exchange}`).join('\n') || '- (none)';
  const ok = records.some((r) => normalizeHost(r.exchange) === normalizeHost(expected));
  return result(
    'dns-mx',
    ok,
    ok ? 'MX record present' : `MX record ${expected} missing`,
    `Expected an MX record pointing at \`${expected}\`.\n\nFound:\n${found}`,
  );
}

/**
 * Evaluates a lychee JSON report (`--format json`). Older lychee versions call the
 * map of failures `fail_map`; current ones call it `error_map`.
 * @param {{errors?: number, error_map?: Record<string, any[]>, fail_map?: Record<string, any[]>}} report
 * @returns {CheckResult}
 */
export function evaluateLinks(report) {
  const map = report.error_map ?? report.fail_map ?? {};
  const lines = [];
  for (const [page, failures] of Object.entries(map)) {
    for (const f of failures) {
      const status = f.status?.code ?? f.status?.text ?? 'error';
      lines.push(`- \`${f.url}\` (${status}) on ${page}`);
    }
  }
  const count = Math.max(report.errors ?? 0, lines.length);
  if (count === 0) return result('links', true, 'no broken links', '');
  return result(
    'links',
    false,
    `${count} broken link${count === 1 ? '' : 's'}`,
    `Broken links found by lychee:\n\n${lines.join('\n') || '- (see the workflow run log)'}`,
  );
}

/**
 * Evaluates Lighthouse CI assertion results (`assertion-results.json`).
 * @param {{name: string, auditId?: string, auditProperty?: string, actual?: number, expected?: number, operator?: string, level?: string, passed: boolean, url: string}[]} assertions
 * @returns {CheckResult}
 */
export function evaluateLighthouse(assertions) {
  const failed = assertions.filter((a) => !a.passed && a.level !== 'warn');
  if (failed.length === 0) return result('lighthouse', true, 'scores above thresholds', '');
  const label = (a) => (a.auditId === 'categories' ? a.auditProperty : [a.auditId, a.auditProperty].filter(Boolean).join('.'));
  const lines = failed.map(
    (a) => `- ${a.url}: ${label(a)} ${a.name} expected ${a.expected}, got ${a.actual}`,
  );
  const names = [...new Set(failed.map(label))].join(', ');
  return result('lighthouse', false, `below threshold: ${names}`, `Failed Lighthouse assertions:\n\n${lines.join('\n')}`);
}

/**
 * Evaluates one run of treosh/lighthouse-ci-action. The action fails the step
 * (core.setFailed) whenever an error-level assertion fails, and only writes
 * assertion-results.json when there is something to report. So the results are read
 * whenever they exist, whatever the outcome. Without results, a successful step means
 * everything passed and a failed step means Lighthouse itself broke.
 * @param {Parameters<typeof evaluateLighthouse>[0] | null} assertions parsed assertion-results.json, or null when the file is missing
 * @param {string} outcome GitHub step outcome of the Lighthouse step
 * @returns {CheckResult}
 */
export function evaluateLighthouseRun(assertions, outcome) {
  if (assertions) return evaluateLighthouse(assertions);
  if (outcome === 'success') return evaluateLighthouse([]);
  return result(
    'lighthouse',
    false,
    'Lighthouse produced no results',
    'Lighthouse CI did not write assertion results. See the workflow run log.',
  );
}

/**
 * @param {{translationKey: string, missing: string[], present: string[]}[]} missing
 * @returns {CheckResult}
 */
export function evaluateTranslations(missing) {
  if (missing.length === 0) return result('translations', true, 'all entries translated', '');
  const lines = missing.map(
    (m) => `- \`${m.translationKey}\`: exists in ${m.present.join(', ')}, missing in ${m.missing.join(', ')}`,
  );
  return result(
    'translations',
    false,
    `${missing.length} entr${missing.length === 1 ? 'y' : 'ies'} missing a translation`,
    `These entries exist in only some languages. Translations are wording, so a human must write them.\n\n${lines.join('\n')}`,
  );
}
