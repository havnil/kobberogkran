// Files watchdog results as deduplicated GitHub issues.
//
//   node scripts/watchdog/report.mjs <results.json>
//
// Needs the `gh` CLI with GH_TOKEN. There is exactly one open issue per check id:
// a new failure opens one (and dispatches the agent unless it needs a human), later
// failures and recovery only add comments, and the agent is never dispatched on a comment.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const OWNER = 'havnil';
export const AGENT_WORKFLOW = 'claude-watchdog.yml';
const RECOVERED_MARKER = '<!-- watchdog:recovered -->';

/** @typedef {import('./checks.mjs').CheckResult} CheckResult */

/** @param {string} id */
export const titlePrefix = (id) => `[watchdog] ${id}:`;

/** @param {CheckResult} result */
export const issueTitle = (result) => `${titlePrefix(result.id)} ${result.summary}`;

/**
 * @param {{number: number, title: string}[]} openIssues
 * @param {CheckResult} result
 * @returns {{action: 'create'|'comment'|'none', issueNumber?: number, title: string}}
 */
export function planIssueAction(openIssues, result) {
  const title = issueTitle(result);
  const existing = openIssues.find((issue) => issue.title.startsWith(titlePrefix(result.id)));
  if (existing) return { action: 'comment', issueNumber: existing.number, title };
  if (result.ok) return { action: 'none', title };
  return { action: 'create', title };
}

/** @param {string[]} args */
function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
}

function runLink() {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
  if (!GITHUB_SERVER_URL || !GITHUB_REPOSITORY || !GITHUB_RUN_ID) return '';
  return `\n\nWorkflow run: ${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;
}

/** @param {CheckResult} result */
function failureBody(result) {
  const handling = result.needsHuman
    ? 'This needs a human (DNS, email or wording), so the agent will not try to fix it.'
    : 'The Claude agent has been asked to look at this.';
  return `**${result.summary}**\n\n${result.details}\n\n${handling}${runLink()}`;
}

/** @param {number} issueNumber */
function lastCommentIsRecovered(issueNumber) {
  const comments = JSON.parse(gh(['issue', 'view', String(issueNumber), '--json', 'comments'])).comments;
  return comments.length > 0 && comments.at(-1).body.includes(RECOVERED_MARKER);
}

/** @param {CheckResult[]} results */
export function report(results) {
  const openIssues = JSON.parse(
    gh(['issue', 'list', '--label', 'watchdog', '--state', 'open', '--limit', '200', '--json', 'number,title']),
  );
  let failures = 0;
  for (const result of results) {
    const plan = planIssueAction(openIssues, result);
    try {
      if (plan.action === 'create') {
        const args = ['issue', 'create', '--title', plan.title, '--body', failureBody(result)];
        args.push('--label', 'watchdog', '--assignee', OWNER);
        if (result.needsHuman) args.push('--label', 'needs-human');
        const url = gh(args);
        const issueNumber = Number(url.split('/').pop());
        console.log(`${result.id}: opened #${issueNumber}`);
        if (!result.needsHuman) {
          gh(['workflow', 'run', AGENT_WORKFLOW, '-f', `issue_number=${issueNumber}`]);
          console.log(`${result.id}: dispatched ${AGENT_WORKFLOW} for #${issueNumber}`);
        }
      } else if (plan.action === 'comment' && plan.issueNumber !== undefined) {
        if (result.ok) {
          if (lastCommentIsRecovered(plan.issueNumber)) {
            console.log(`${result.id}: #${plan.issueNumber} already marked recovered`);
            continue;
          }
          const body = `${RECOVERED_MARKER}\nRecovered: ${result.summary}. Close this issue once you are satisfied.${runLink()}`;
          gh(['issue', 'comment', String(plan.issueNumber), '--body', body]);
          console.log(`${result.id}: recovered, commented on #${plan.issueNumber}`);
        } else {
          gh(['issue', 'comment', String(plan.issueNumber), '--body', `Still failing: **${result.summary}**\n\n${result.details}${runLink()}`]);
          console.log(`${result.id}: still failing, commented on #${plan.issueNumber}`);
        }
      } else {
        console.log(`${result.id}: ok`);
      }
    } catch (error) {
      failures += 1;
      console.error(`${result.id}: reporting failed: ${error instanceof Error ? error.message : error}`);
    }
  }
  return failures;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/watchdog/report.mjs <results.json>');
    process.exit(2);
  }
  const results = JSON.parse(readFileSync(file, 'utf8'));
  process.exitCode = report(results) > 0 ? 1 : 0;
}
