# Working with the watchdog

The watchdog is a set of scheduled GitHub Actions that check the live site. When a check
fails, it files an issue. For technical problems, it asks the Claude agent to try a fix
as a PR.

It's separate from the **Grok Bot** in the Grok Bot app. The Grok Bot checks uptime
from outside and notifies you directly. It has no integration with this repo and
never opens issues or PRs. The GitHub watchdog below works the same way whether or not
the Grok Bot is running.

## Checks

| Check id | When | What it checks | Fails when | Agent? |
| --- | --- | --- | --- | --- |
| `http` | hourly (`:17`) | `https://kobberogkran.no/` and `/en/` | either doesn't return 200 | yes |
| `tls` | hourly | HTTPS certificate on `kobberogkran.no` | it expires in **14 days or fewer** | yes |
| `dns-mx` | hourly | MX records (queried at `1.1.1.1`) | `kobberogkran-no.mail.protection.outlook.com` is missing | **no**, `needs-human` |
| `links` | daily (05:43 UTC) | all links on the live site, internal and external (lychee) | any link returns 4xx/5xx | yes |
| `lighthouse` | daily | Lighthouse scores | performance < 0.85, accessibility < 0.95, SEO < 0.95, or best practices < 0.9 | yes |
| `translations` | daily | each page exists in both `nb` and `en` (`scripts/check-translations.mjs`) | any page is missing a language | **no**, `needs-human` |

Workflows: `.github/workflows/watchdog-hourly.yml` (`http`, `tls`, `dns-mx`) and
`.github/workflows/watchdog-daily.yml` (`links`, `lighthouse`, `translations`).
The checks themselves are in `scripts/watchdog/` and `lighthouserc.json`.

Every PR is also checked separately by the required `ci` workflow (type check, tests,
build, built-output check, offline link check).

## What happens on a failure

1. `scripts/watchdog/report.mjs` looks for an open issue titled `[watchdog] <check id>: …`.
   - **None open:** it opens `[watchdog] <check id>: <summary>`, labelled `watchdog`
     (plus `needs-human` for `dns-mx` and `translations`), and assigns it to `havnil`.
     GitHub emails you. For a check that isn't `needs-human`, it starts the agent with
     `gh workflow run claude-watchdog.yml -f issue_number=<n>`.
   - **One already open:** it adds a comment with the new details. The agent is
     **not** started again. There's exactly one open issue per check, however long it keeps
     failing.
2. When the check passes again and an issue is still open, it comments "recovered".
   **It never closes issues.** Close them yourself once you're happy.

## What the agent does

`claude-watchdog.yml` runs Claude with the rules in `.github/prompts/watchdog.md`:

- **Purely technical** (broken links, build/type errors, dependency patch/minor,
  workflow/config errors): it opens a PR that references the issue and labels it
  `auto-fix`. Cloudflare adds a preview URL to the PR.
- **Wording (including alt text), prices, legal text, translations, DNS, email, or
  anything uncertain:** it comments with its findings, adds `needs-human`, and stops.
- It never pushes to `main` and never touches secrets, DNS or Cloudflare.

Auto-merge (`auto-merge.yml`): a PR opened by `claude[bot]` with the `auto-fix` label
merges by itself once `ci` is green, **unless** it touches `src/content/`,
`public/images/`, `public/admin/` or `brand/`. If it does, the label is removed, a comment
lists the blocked files, and `needs-human` is added. You get a GitHub notification for
every merge. To undo one, see [rollback.md](rollback.md).

## Labels

| Label | Meaning | Who sets it |
| --- | --- | --- |
| `watchdog` | Opened by a scheduled check | the watchdog |
| `needs-human` | The agent must not act. You decide | the watchdog, the agent, the cap step, auto-merge, or you |
| `auto-fix` | A technical agent PR, eligible for auto-merge | the agent (and removed by auto-merge when it touches content) |

To stop the agent from working on an issue, add `needs-human`. The agent workflow
skips issues with that label.

To ask the agent to retry a `watchdog` issue: remove `needs-human` (if set), then either
remove and re-add the `watchdog` label, or run:

```sh
gh workflow run claude-watchdog.yml --repo havnil/kobberogkran -f issue_number=<n>
```

You can also comment `@claude …` on any issue or PR for a one-off request. Those PRs are
never auto-merged.

## Limits (spending guard)

The agent runs on your Claude subscription (`CLAUDE_CODE_OAUTH_TOKEN`), so it's bounded:

- **Daily cap: 10** `claude-watchdog` runs per UTC day. When the cap is reached, the
  workflow comments "Daily agent cap reached", adds `needs-human`, and stops (the run
  shows green). It resets at 00:00 UTC.
- At most 30 turns per run (`--max-turns 30`) and a 30-minute job timeout.
- One agent run at a time (concurrency group `claude-agent`). Others wait in line.

To change the cap, edit the number in the cap step of `.github/workflows/claude-watchdog.yml`
through a PR.

## Pausing and resuming

The scheduled jobs only run when the repo variable `WATCHDOG_ENABLED` is `true`.
Otherwise they show as **skipped** and file nothing. It stays off until the site is live
on `kobberogkran.no` (see [cloudflare-setup.md](cloudflare-setup.md)).

```sh
# pause (for example during DNS work or planned downtime)
gh variable set WATCHDOG_ENABLED --body false --repo havnil/kobberogkran

# resume
gh variable set WATCHDOG_ENABLED --body true --repo havnil/kobberogkran

# run a check now, without waiting for the schedule
gh workflow run watchdog-hourly.yml --repo havnil/kobberogkran
gh workflow run watchdog-daily.yml --repo havnil/kobberogkran
```

To stop only the agent and keep the checks running, delete or rotate the
`CLAUDE_CODE_OAUTH_TOKEN` secret. The agent step then fails, and the issues stay open for
you.

Note: GitHub turns off scheduled workflows in public repos after 60 days without
commits. If it does, re-enable them in the **Actions** tab, or push any commit.

## Typical cases

- **`dns-mx` failed:** email may be broken. Check the MX record in Cloudflare DNS
  against [dns-migration.md](dns-migration.md). The agent never touches this.
- **`tls` failed:** Cloudflare renews certificates automatically, so this usually
  means the custom domain or proxy setup changed. See
  [cloudflare-setup.md](cloudflare-setup.md#2-custom-domains-and-the-www-redirect-after-the-dns-migration).
- **`http` failed:** check the latest Cloudflare deployment. Roll back if it was a bad
  deploy ([rollback.md](rollback.md)).
- **`translations` failed:** the issue lists each `translationKey` and the missing
  language. Write the missing page in the CMS (same `translationKey`). The issue
  shows "recovered" the next day, and then you close it.
