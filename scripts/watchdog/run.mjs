// Gathers watchdog observations and writes CheckResults for report.mjs.
//
//   node scripts/watchdog/run.mjs --hourly                       http, tls, dns-mx
//   node scripts/watchdog/run.mjs --daily-translations           translations
//   node scripts/watchdog/run.mjs --links <lychee.json>          links (lychee JSON report)
//   node scripts/watchdog/run.mjs --lighthouse <assertion-results.json> [--outcome <step outcome>]
//   node scripts/watchdog/run.mjs --pages                        print page URLs from the sitemap
//
// Results go to results.json (override with --out <file>). The script exits 0 when
// checks fail; failing checks are data for report.mjs, not errors.
import { execFileSync } from 'node:child_process';
import { promises as dns } from 'node:dns';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import tls from 'node:tls';
import {
  evaluateHttp,
  evaluateLighthouseRun,
  evaluateLinks,
  evaluateMx,
  evaluateTls,
  evaluateTranslations,
  result,
} from './checks.mjs';

// WATCHDOG_SITE exists only for trying the script against another site locally.
export const SITE = process.env.WATCHDOG_SITE ?? 'https://kobberogkran.no';
const HOST = new URL(SITE).hostname;
const HOMEPAGES = [`${SITE}/`, `${SITE}/en/`];
const TIMEOUT_MS = 15_000;

/** @param {unknown} error */
const message = (error) => (error instanceof Error ? error.message : String(error));

/** @param {string} url */
async function fetchStatus(url) {
  let last = { url, status: 0, error: '' };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      // Don't follow redirects: a homepage that redirects is itself a problem.
      const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) });
      await res.body?.cancel();
      return { url, status: res.status };
    } catch (error) {
      last = { url, status: 0, error: message(error) };
    }
  }
  return last;
}

async function checkHttp() {
  return evaluateHttp(await Promise.all(HOMEPAGES.map(fetchStatus)));
}

async function checkTls() {
  try {
    const validTo = await new Promise((resolve, reject) => {
      const socket = tls.connect({ host: HOST, port: 443, servername: HOST, timeout: TIMEOUT_MS }, () => {
        const cert = socket.getPeerCertificate();
        const authorized = socket.authorized;
        const authError = socket.authorizationError;
        socket.end();
        if (!authorized) reject(new Error(`certificate not trusted: ${authError}`));
        else resolve(cert.valid_to);
      });
      socket.on('timeout', () => socket.destroy(new Error('TLS connection timed out')));
      socket.on('error', reject);
    });
    const daysLeft = (Date.parse(String(validTo)) - Date.now()) / 86_400_000;
    return evaluateTls(daysLeft);
  } catch (error) {
    return result('tls', false, 'TLS check failed', `Could not verify the certificate for ${HOST}: ${message(error)}`);
  }
}

async function checkMx() {
  const resolver = new dns.Resolver({ timeout: 5_000, tries: 3 });
  resolver.setServers(['1.1.1.1']);
  try {
    return evaluateMx(await resolver.resolveMx(HOST));
  } catch (error) {
    const failed = evaluateMx([]);
    return { ...failed, details: `${failed.details}\n\nLookup error: ${message(error)}` };
  }
}

function checkTranslations() {
  try {
    const stdout = execFileSync(process.execPath, ['scripts/check-translations.mjs', '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    return evaluateTranslations(JSON.parse(stdout));
  } catch (error) {
    return result('translations', false, 'translation check failed to run', message(error));
  }
}

/** @param {string | undefined} file */
function checkLinks(file) {
  if (!file || !existsSync(file)) {
    return result('links', false, 'link check produced no report', 'lychee did not write a JSON report. See the workflow run log.');
  }
  return evaluateLinks(JSON.parse(readFileSync(file, 'utf8')));
}

/**
 * @param {string | undefined} file assertion-results.json
 * @param {string} outcome GitHub step outcome of the Lighthouse step.
 */
function checkLighthouse(file, outcome) {
  const assertions = file && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
  return evaluateLighthouseRun(assertions, outcome);
}

/** @param {string} xml */
const locs = (xml) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);

/** Page URLs from the sitemap (falls back to the homepages). */
async function listPages() {
  try {
    const get = async (url) => {
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`${url} returned ${res.status}`);
      return res.text();
    };
    const pages = [];
    for (const sitemap of locs(await get(`${SITE}/sitemap-index.xml`))) {
      pages.push(...locs(await get(sitemap)));
    }
    // The list ends up on a lychee command line, so keep only plain same-site URLs.
    const sameSite = pages.filter((p) => /^https:\/\/[\w.\-~%/:@+,=]+$/.test(p) && new URL(p).hostname === HOST);
    return [...new Set([...HOMEPAGES, ...sameSite])];
  } catch (error) {
    console.error(`Sitemap unavailable (${message(error)}); using the homepages only.`);
    return HOMEPAGES;
  }
}

async function main(argv) {
  const outIndex = argv.indexOf('--out');
  const out = outIndex >= 0 ? argv[outIndex + 1] : 'results.json';
  const arg = (flag) => argv[argv.indexOf(flag) + 1];

  let results;
  if (argv.includes('--pages')) {
    console.log((await listPages()).join('\n'));
    return;
  } else if (argv.includes('--hourly')) {
    results = await Promise.all([checkHttp(), checkTls(), checkMx()]);
  } else if (argv.includes('--daily-translations')) {
    results = [checkTranslations()];
  } else if (argv.includes('--links')) {
    results = [checkLinks(arg('--links'))];
  } else if (argv.includes('--lighthouse')) {
    results = [checkLighthouse(arg('--lighthouse'), argv.includes('--outcome') ? arg('--outcome') : 'success')];
  } else {
    console.error('Usage: run.mjs --hourly | --daily-translations | --links <file> | --lighthouse <file> | --pages [--out <file>]');
    process.exitCode = 2;
    return;
  }
  writeFileSync(out, `${JSON.stringify(results, null, 2)}\n`);
  for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.id}: ${r.summary}`);
}

await main(process.argv.slice(2));
