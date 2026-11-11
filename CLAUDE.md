# kobberogkran.no

Website for **Kobber og Kran AS** at `https://kobberogkran.no`. It's an Astro site
deployed to Cloudflare Workers (static assets). It has two languages: Norwegian
Bokmål (`nb`, default, served at `/`) and English (`en`, served at `/en/`).
`www.kobberogkran.no` redirects to the apex domain (a Cloudflare redirect rule, not code).

Repo: public `havnil/kobberogkran`, branch `main`. The repo is the single source of
truth for code, content and images. The owner is `havnil`.

## Commands

Requires Node 24 (`.nvmrc`).

| Command | What it does |
| --- | --- |
| `npm ci` | Install the exact locked dependencies |
| `npm run dev` | Local dev server |
| `npm run build` | Build. Static output goes to `dist/client/`, server code to `dist/server/` |
| `npm run preview` | Serve the built site locally |
| `npm run check` | Type-check (`astro check`) |
| `npm test` | Unit tests (Vitest, `tests/**`) |
| `npm run check:dist` | Assert the build output is complete (run after `build`) |
| `node scripts/check-translations.mjs [--json]` | List pages missing a translation (never fails the build) |

Before opening a PR, run `npm run check && npm test && npm run build && npm run check:dist`.
This is what the required `ci` check runs, plus an offline link check on the build output.

## Folder map

| Path | Contents |
| --- | --- |
| `src/content/pages/<locale>/<slug>.md` | Page content (**content**) |
| `src/i18n/` | Locales, localized paths, `hreflang` alternates, UI strings (`ui.ts`) |
| `src/layouts/`, `src/components/` | Base layout and language switcher |
| `src/pages/` | Routes: `[...slug].astro` (nb), `en/[...slug].astro`, and a 404 page per locale |
| `src/styles/tokens.css` | Design tokens (colours, fonts, spacing). Branding replaces these values |
| `public/admin/` | Sveltia CMS (`/admin`) and its `config.yml` (**content**) |
| `public/images/uploads/` | Images uploaded through the CMS (**content**) |
| `brand/` | Incoming logo, fonts, colours and layout files (**content**) |
| `integrations/` | Small Astro build integrations (such as moving each locale's 404 page) |
| `scripts/` | `check-dist`, `check-translations`, `watchdog/*`, `automerge/*` |
| `tests/` | Vitest tests |
| `.github/workflows/` | `ci`, `watchdog-hourly`, `watchdog-daily`, `claude`, `claude-watchdog`, `auto-merge` |
| `.github/prompts/watchdog.md` | The prompt the watchdog agent runs with |
| `docs/runbooks/` | Owner checklists. See [Runbooks](#runbooks) |

## i18n rules

- A page is one file per locale, `src/content/pages/nb/<slug>.md` and
  `src/content/pages/en/<slug>.md`. Slugs may differ (`om-oss` / `about`).
  Frontmatter: `title`, `description`, `translationKey`, `locale`.
- Both language versions share the **same `translationKey`**. That's how the language
  switcher and `hreflang` find the other version.
- Every page change goes in **both** locales. A page that exists in only one locale is
  still published. The switcher and `hreflang` leave out the missing language, and the
  daily watchdog files a `needs-human` issue.
- UI strings (the switcher label, the 404 text, the skip link) live in `src/i18n/ui.ts`
  and need a value for every locale.
- **Agents never write translation copy on their own.** Wording in either language,
  including alt text, is for a human to write or approve. You may draft wording when a
  human asks for it in the conversation, and the human reviews it.

## Content vs. technical changes

Content (needs a human, never auto-merged):

- `src/content/`
- `public/images/`
- `public/admin/`
- `brand/`
- Plus anything that's wording, alt text, prices, legal text or translations, wherever it lives.

Technical (an agent may fix it): broken links, build or type errors, dependency
patch/minor updates, workflow or config errors.

An `auto-fix` PR is auto-merged only when `claude[bot]` opened it **and**
`scripts/automerge/classify.mjs` finds no file under the content paths above. If the PR
touches content, the `auto-merge` workflow removes the `auto-fix` label, comments with
the blocked files, and adds `needs-human`. PRs started with `@claude` are never
auto-merged.

## What agents may never touch

- **Secrets.** Never commit, print or change them (`CLAUDE_CODE_OAUTH_TOKEN`,
  `GITHUB_CLIENT_SECRET`, `.dev.vars`, `.env*`).
- **DNS and email records**, and **Cloudflare settings** (dashboard, custom domains,
  redirect rules, the CMS auth Worker).
- **`main` directly.** Always use a branch and a PR. The `main` ruleset requires a PR, a
  green `ci` check and an approval from someone other than the last pusher, and only
  repository admins can bypass it. Never approve or merge a PR yourself.
- Repo settings, rulesets and the `WATCHDOG_ENABLED` variable.

If a problem falls in one of these areas, or you're unsure: comment with your findings, add
the `needs-human` label (`gh issue edit <n> --add-label needs-human`), and stop.

## Labels

- `watchdog`: opened by the scheduled checks.
- `needs-human`: an agent must not act on it.
- `auto-fix`: a technical agent PR that's eligible for auto-merge.

## How deploys work

- Cloudflare **Workers Builds** is connected to this repo. Every push to `main` runs
  `npm run build`, then `npx wrangler deploy`. The site is live within minutes.
- Every other branch gets a **preview build**. Cloudflare comments the preview URL on the
  PR and adds a check run.
- CMS saves at `/admin` commit straight to `main`, so they deploy like any other push.
- Rollback: [`docs/runbooks/rollback.md`](docs/runbooks/rollback.md).
- The Worker name (`wrangler.jsonc` `name: "kobberogkran"`) must match the Worker in
  Cloudflare. Don't rename it.

## Brand assets

Logo, fonts, colours and layout mockups go in `brand/` (see `brand/README.md`). The design
phase moves the values into `src/styles/tokens.css` and the layout and components. Agents
read from `brand/` and never change it.

## Monitoring

- The **GitHub watchdog** (`watchdog-*` workflows) files `watchdog` issues and, for
  technical problems, dispatches the Claude agent. See [`docs/runbooks/watchdog.md`](docs/runbooks/watchdog.md).
- Separately, the owner's **Grok Bot** (in the Grok Bot app) checks uptime from
  outside and notifies the owner. It has no integration with this repo. Nothing here
  needs to change for it, beyond the public pages returning 200.

## Runbooks

- [`docs/runbooks/dns-migration.md`](docs/runbooks/dns-migration.md): move DNS from Uniweb to Cloudflare without breaking email
- [`docs/runbooks/cloudflare-setup.md`](docs/runbooks/cloudflare-setup.md): connect the repo, domains, and the CMS login Worker
- [`docs/runbooks/github-setup.md`](docs/runbooks/github-setup.md): the Claude app, the token secret, adding a collaborator, the ruleset check
- [`docs/runbooks/rollback.md`](docs/runbooks/rollback.md): undo a bad deploy
- [`docs/runbooks/watchdog.md`](docs/runbooks/watchdog.md): checks, labels, pausing, the daily cap
