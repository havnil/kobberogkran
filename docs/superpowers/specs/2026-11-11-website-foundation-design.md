# Kobber og Kran AS website: foundation design

Date: 2026-11-11
Status: draft, awaiting approval

## Intent

Kobber og Kran AS needs a website at `kobberogkran.no` in Norwegian and English. The
layout and branding assets are not ready yet. This document covers the **foundation**:
repo, stack, hosting, content editing, and an automated upkeep agent. Once the assets
arrive, they slot into a working, deployed skeleton.

The owner wants upkeep to be mostly hands-off. An automated agent watches the site,
fixes small problems itself ("fire extinguishing") and opens a ticket to the owner when
something needs a human. Content (text and pictures) must be editable two ways:
through Claude (code/requests) and through a no-code editing screen.

## Goals

- A git repo on GitHub that is the single source of truth for code, content and images.
- Bilingual site: Norwegian (`nb`) as the default at `/`, English at `/en/`.
- Hosting that deploys automatically from GitHub, gives a preview link per change, and can
  run server code for forms and interactive features added later.
- A no-code editing screen whose saves become ordinary commits in the same repo.
- A watchdog that detects problems, attempts safe fixes as pull requests, and files
  GitHub issues to the owner otherwise.
- Repo instructions that make any Claude session (the owner's, the brother's, or the
  GitHub agent) effective immediately.

## Non-goals (for this phase)

- Visual design, real pages and copy. These wait for the layout and branding assets.
- Building specific forms or interactive features. The stack must support them, but none
  are built now.
- Moving the domain registration away from Uniweb.

## Anti-goals (a failure even if it "works")

- Email for the domain breaks during the DNS move.
- The agent can change live content/wording or DNS without a human seeing it.
- Content exists in only one language on the live site without anyone being told.
- Upkeep depends on one person's laptop or memory.
- Unbounded spending by the agent.

## Constraints and current state

- The domain is registered at Uniweb. Uniweb provides nothing else. The nameservers are
  likely `ns1.uniweb.no` / `ns3.uniweb.no` (unconfirmed).
- The domain may have existing email (MX/SPF/DKIM/DMARC) records that must be preserved.
- GitHub account: `havnil` (personal, no organization). The brother will be added as a
  collaborator.
- Local machine: Windows, git 2.53, Node 24, npm 11, gh CLI authenticated.
- Account creation, entering credentials and changing nameservers are done by the owner.
  The builder writes step-by-step checklists for these.

## Decisions

### Repo
- **Public** GitHub repo `havnil/kobberogkran` (owner's decision; the name is the
  builder's call). Public because free accounts only get enforced branch rules on public
  repos, and public repos get unlimited Actions minutes. Secrets live only in GitHub
  Actions secrets and Cloudflare, never in the repo. Default branch `main`. The repo can
  be transferred to a company organization later without losing history.
- `main` is protected by a ruleset: changes go through pull requests, and the CI check
  must pass. The owner (`havnil`) is on the bypass list, so the owner and the CMS can
  commit directly. Neither the agent nor anyone else can.
- `claude-code-action` only responds to users with write access (owner and brother), so
  strangers opening issues on the public repo can't drive the agent.

### Stack
- **Astro** (current major) with built-in i18n routing: `defaultLocale: "nb"`,
  `locales: ["nb", "en"]`, no prefix for Norwegian.
- **`@astrojs/cloudflare` adapter.** Pages are prerendered (static) by default. Individual
  routes opt into server rendering when forms/interactive features need it.
- TypeScript. Content as Astro content collections (Markdown/JSON) under `src/content/`,
  one folder per locale.
- Styling: plain CSS with design tokens (colors, fonts, spacing) in one file, so the
  branding assets plug into one place. (Builder's call. Tailwind would also be acceptable.)

### Hosting: Cloudflare
- Cloudflare Workers with static assets, connected to the GitHub repo (Workers Builds), so
  every push to `main` deploys and every PR gets a preview URL.
- Later features have a home on the same platform: server routes, Turnstile (form spam
  protection), D1 (database), R2 (files), email sending.
- DNS: move the domain's nameservers from Uniweb to Cloudflare (free plan). Registration
  stays at Uniweb. **Before switching, all existing records (especially email) are
  exported from Uniweb and recreated in Cloudflare, then verified.** This is written as an
  owner checklist in `docs/runbooks/dns-migration.md`.
- `www.kobberogkran.no` redirects to `kobberogkran.no`.

### Content editing: Sveltia CMS
- Served at `/admin`. Config lives in the repo. Saves go straight to GitHub as commits.
- Login with GitHub through the Sveltia CMS authenticator, deployed as a small Cloudflare
  Worker.
- i18n configured so each entry has `nb` and `en` versions edited side by side. Images go
  to a shared media folder in the repo.
- Saves commit **straight to `main`** and go live within minutes (builder's call: the
  editing screen is for quick picture and text swaps, and every save can be undone with
  a revert). Editors are the owner and the brother, both GitHub users with write access,
  and both on the ruleset bypass list. The brother is added once he has a GitHub account.

### Missing translations (builder's call)
- A page that exists in only one language is still published in that language. The
  language switcher hides the missing counterpart, and `hreflang` only lists the
  languages that exist. The build does **not** fail, because that would block every
  CMS save.
- The daily watchdog check files a `needs-human` issue listing the untranslated entries.
  The agent never writes translations on its own, since that would be wording.

### Watchdog (automated upkeep)
Built on GitHub Actions plus Anthropic's official `anthropics/claude-code-action@v1`.

**Checks** (scheduled workflow):
- Hourly: both language homepages return 200, the HTTPS certificate is valid for more than
  14 days, and DNS still has the expected records (including MX).
- Daily: broken internal and external links, Lighthouse scores (performance,
  accessibility, SEO) against thresholds, missing translations (an entry in one locale
  without its counterpart).
- On every PR: build, type check, link check on the built site.

**On failure:** open a GitHub issue labelled `watchdog`, or update the existing open one for
the same check instead of duplicating it. Assign it to `havnil`, which makes GitHub email
the owner.

**Agent:** a newly opened or newly labelled `watchdog` issue triggers Claude via
`claude-code-action`. Updates to an existing issue do **not** trigger it again. Repo-level
instructions:
- Diagnose the problem. If the fix is purely technical, open a PR with the fix, which
  gives it a preview URL. Technical means: broken links, build/type errors, dependency
  patch/minor updates, and workflow or config errors. The PR is labelled `auto-fix`.
- If it involves wording (including alt text, which is content), prices, legal text,
  translations, DNS, email or anything uncertain, comment with findings, label the issue
  `needs-human`, and stop.
- Never push to `main` directly. Never touch secrets, DNS or Cloudflare settings.
- Bounded by `--max-turns`, a workflow timeout, a concurrency group (one agent run at a
  time) and a daily cap of agent runs (builder sets the number, around 10). Once the cap is
  hit, the workflow comments and labels `needs-human` instead of running.
- Anyone with write access (owner, brother) can also write `@claude` in any issue or PR
  to ask for a change. Those PRs are never auto-merged.

**Auto-merge (owner's decision):** PRs labelled `auto-fix` that were opened by the agent
and only touch files outside `src/content/`, `public/` media and `brand/` are
auto-merged once CI passes. A CI job verifies the file paths and removes the label if
the PR touches content. The owner gets a GitHub notification for each merge. Everything
else waits for a human to merge.

**Billing (owner's decision):** the agent runs on the owner's Claude subscription via
`CLAUDE_CODE_OAUTH_TOKEN` (created with `claude setup-token`, stored as a repo secret).
Agent runs therefore share the owner's personal usage limits. This is why the trigger
rules and the daily cap above matter.

**Rollback:** document the one-click Cloudflare rollback and `git revert` in
`docs/runbooks/` so a human (or Claude when asked) can put out a fire fast.

### Agent guidance in the repo
- `CLAUDE.md` covers structure, commands, i18n rules (always update both locales), what
  the agent may and may not touch, and how deployment works.
- `docs/runbooks/` holds the DNS migration, Cloudflare setup, adding the brother as a
  collaborator, secrets setup, rollback, and how to work with the watchdog.

### Asset intake
- `brand/` holds the incoming layout and branding files (logo, fonts, colors, layout
  mockups). The design-implementation phase reads from here.

## What gets built in this phase

1. `git init`, `.gitignore`, `.gitattributes` (LF line endings), the public GitHub repo,
   and the `main` ruleset.
2. An Astro skeleton with i18n, the Cloudflare adapter, a base layout, a placeholder home
   page in both languages, a language switcher, `hreflang` tags, sitemap and `robots.txt`.
3. Sveltia CMS config and the admin page (the authenticator Worker is deployed once the
   Cloudflare account exists).
4. CI workflow (build, checks), watchdog check workflows, issue-creation logic, and the
   Claude agent workflow.
5. `CLAUDE.md` and the runbooks.
6. Owner checklists for: the Cloudflare account, connecting the repo, the DNS migration,
   installing the Claude GitHub app, and adding secrets.

## Left to the builder

- The exact Lighthouse thresholds, check implementation (scripts vs. existing actions),
  and folder layout inside `src/`.
- Choice of link checker and uptime check tooling within GitHub Actions.
- Placeholder content wording.

## Owner decisions (2026-11-11)

- Public repo.
- Technical agent fixes auto-merge once CI passes. Content always waits for a human.
- The agent is billed through the owner's Claude subscription.
