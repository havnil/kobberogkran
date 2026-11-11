import { describe, expect, it } from 'vitest';
import { evaluateTls } from '../../scripts/watchdog/checks.mjs';
import { issueTitle, planIssueAction } from '../../scripts/watchdog/report.mjs';

const failingTls = evaluateTls(10);
const failingTlsWithDifferentSummary = evaluateTls(9);
const okResult = evaluateTls(60);

describe('planIssueAction', () => {
  it('creates an issue for a new failure', () => {
    const plan = planIssueAction([], failingTls);
    expect(plan.action).toBe('create');
    expect(plan.title).toBe(issueTitle(failingTls));
    expect(plan.title.startsWith('[watchdog] tls: ')).toBe(true);
  });

  it('comments on the open issue for the same check even if the summary changed', () => {
    const plan = planIssueAction(
      [{ number: 7, title: '[watchdog] tls: expires in 10 days' }],
      failingTlsWithDifferentSummary,
    );
    expect(plan).toMatchObject({ action: 'comment', issueNumber: 7 });
  });

  it('does not match an issue for a different check', () => {
    const plan = planIssueAction(
      [{ number: 3, title: '[watchdog] http: / returned 500' }],
      failingTls,
    );
    expect(plan.action).toBe('create');
  });

  it('does nothing when the check passes and no issue is open', () => {
    expect(planIssueAction([], okResult).action).toBe('none');
  });

  it('comments (recovered) when the check passes and an issue is open', () => {
    const plan = planIssueAction(
      [{ number: 7, title: '[watchdog] tls: expires in 10 days' }],
      okResult,
    );
    expect(plan).toMatchObject({ action: 'comment', issueNumber: 7 });
  });
});
