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
- Private GitHub repo `havnil/kobberogkran` (builder's call on the name). Default branch
  `main`. It can be transferred to a company organization later without losing history.
- `main` is protected: changes go through pull requests, and the build check must pass.
  The owner can still merge directly.

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

**Agent:** an issue labelled `watchdog` triggers Claude via `claude-code-action` with
repo-level instructions:
- Diagnose the problem. If the fix is safe and technical (a broken link, a build error, a
  dependency bump, a missing alt text), open a PR with the fix, which gives it a preview URL.
- If it involves wording, prices, legal text, DNS, email or anything uncertain, comment with
  findings, label the issue `needs-human`, and stop.
- Never push to `main` directly. Never touch secrets, DNS or Cloudflare settings.
- Bounded by `--max-turns` and a workflow timeout.
- Anyone with repo access (owner, brother) can also write `@claude` in any issue or PR
  to ask for a change.

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

1. `git init`, `.gitignore`, `.gitattributes` (LF line endings), the private GitHub repo,
   and branch protection.
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

## Open questions for the owner

(Filled after the builder check.)
