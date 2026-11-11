# Website Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployed-ready bilingual Astro skeleton for kobberogkran.no, with a no-code editor, CI, a watchdog, and a Claude upkeep agent, all on a public GitHub repo.

**Architecture:** Astro (static by default, Cloudflare adapter for later server routes) builds to Cloudflare Workers static assets, deployed by Cloudflare Workers Builds from `main`. Content lives in a locale-split content collection that Sveltia CMS edits through GitHub. GitHub Actions run the CI and the scheduled checks, open deduplicated issues, and dispatch `anthropics/claude-code-action@v1`, which opens fix PRs. Technical-only fix PRs auto-merge once CI passes.

**Tech Stack:** Node 24, Astro 7.x, `@astrojs/cloudflare` 14.x, `@astrojs/sitemap`, wrangler 4.x, Vitest, `yaml`, Sveltia CMS (CDN), GitHub Actions, lychee, Lighthouse CI, `gh` CLI.

**Spec:** `docs/superpowers/specs/2026-11-11-website-foundation-design.md`

## Global Constraints

- Locales: `nb` (default, no URL prefix) and `en` (prefix `/en/`). Site URL `https://kobberogkran.no`.
- `www.kobberogkran.no` → `kobberogkran.no` (done in Cloudflare, see runbook).
- Repo: public `havnil/kobberogkran`, branch `main`, owner `havnil`.
- Never commit secrets. Secrets: `CLAUDE_CODE_OAUTH_TOKEN` (repo secret), `GITHUB_CLIENT_SECRET` (Cloudflare authenticator Worker only).
- Agent: `anthropics/claude-code-action@v1`, `claude_code_oauth_token` input, `--max-turns 30`, job `timeout-minutes: 30`, concurrency group `claude-agent`, daily cap **10** agent runs.
- Watchdog thresholds: TLS cert valid more than **14 days**. MX must contain `kobberogkran-no.mail.protection.outlook.com`. Lighthouse minimums: performance 0.85, accessibility 0.95, SEO 0.95, best-practices 0.9 (builder's call; spec left it open).
- Auto-merge blocked paths (content): `src/content/`, `public/images/`, `public/admin/`, `brand/`. Also any PR whose author is not in repo variable `AUTOFIX_AUTHORS` (comma-separated, default `claude[bot]`) or that is not labelled `auto-fix`.
- **Agent-agnostic watchdog (owner wants a Grok bot as watchdog):** GitHub issues labelled `watchdog` are the interface, and `docs/watchdog/bot-contract.md` defines it. Repo variable `WATCHDOG_AGENT` selects the fixer: `claude` (default, works today), `grok` (Grok Build CLI headless with secret `XAI_API_KEY`; a prepared adapter, verified once a key exists), or `external` (no in-Actions agent; an external bot such as Grok Bot with its GitHub plugin reads the issues itself). `AGENTS.md` is the canonical agent instruction file, and `CLAUDE.md` imports it with `@AGENTS.md`.
- Labels: `watchdog`, `needs-human`, `auto-fix`, `bot-queue`.
- Watchdog scheduled jobs are gated on repo variable `WATCHDOG_ENABLED == 'true'` (off until DNS points at Cloudflare).
- Issues created with `GITHUB_TOKEN` do not trigger workflows, so the watchdog dispatches the agent with `gh workflow run watchdog-agent.yml -f issue_number=N`.
- Line endings LF (`.gitattributes: * text=auto eol=lf`).

## Review Focus

1. **Page exists in only one locale.** It is published, the switcher hides the missing language, and `hreflang` lists only the existing locales. Covered by `alternates` tests in Task 2 and `check-translations` tests in Task 3.
2. **A check keeps failing hour after hour.** There is exactly one open issue per check id, later failures add comments, and the agent is dispatched only when the issue is first created. Covered by `planIssueAction` tests in Task 5.
3. **An `auto-fix` PR also touches content.** The label is removed, the PR is not merged, and a comment explains why. Covered by `classifyPaths` tests in Task 6.
4. **Watchdog runs before the site is live.** No issues are filed, because of the `WATCHDOG_ENABLED` gate. Verified in Task 5's workflow review step.
5. **Unknown path in either language.** It returns a 404 page in the visitor's language. Covered by the `check-dist` assertion in Task 2.

---

### Task 1: Repository hygiene and GitHub repo

**Files:**
- Create: `.gitignore` (node_modules, dist, .astro, .wrangler, .dev.vars, .env*), `.gitattributes`, `README.md`, `brand/README.md`, `.nvmrc` (`24`)

- [ ] **Step 1:** Write the files. `README.md` covers the project purpose, `npm` commands (filled in Task 2), and links to `CLAUDE.md` and `docs/runbooks/`. `brand/README.md` tells the owner to drop logo, fonts, colours and layout files here.
- [ ] **Step 2:** `git add --renormalize . && git commit`.
- [ ] **Step 3:** Create the remote: `gh repo create havnil/kobberogkran --public --source . --push --description "Kobber og Kran AS – kobberogkran.no"`. Expected: the push succeeds.
- [ ] **Step 4:** Repo settings: `gh repo edit havnil/kobberogkran --enable-auto-merge --delete-branch-on-merge --enable-wiki=false`. Create the labels `watchdog` (red), `needs-human` (orange), `auto-fix` (green) and `bot-queue` (purple) with `gh label create`.
- [ ] **Step 5:** Verify with `gh repo view havnil/kobberogkran --json visibility,autoMergeAllowed`. Expected: `PUBLIC`, `true`.

(The ruleset is added in Task 4, once the `ci` check exists.)

### Task 2: Astro bilingual skeleton

**Files:**
- Create: `package.json`, `astro.config.mjs`, `wrangler.jsonc`, `tsconfig.json`, `vitest.config.ts`
- Create: `src/i18n/locales.ts`, `src/i18n/ui.ts`, `src/i18n/alternates.ts`
- Create: `src/content.config.ts`, `src/content/pages/nb/index.md`, `src/content/pages/en/index.md`
- Create: `src/styles/tokens.css`, `src/styles/global.css`
- Create: `src/layouts/BaseLayout.astro`, `src/components/LanguageSwitcher.astro`
- Create: `src/pages/[...slug].astro`, `src/pages/en/[...slug].astro`, `src/pages/404.astro`, `src/pages/en/404.astro`
- Create: `public/robots.txt`, `public/favicon.svg` (placeholder)
- Create: `scripts/check-dist.mjs`
- Test: `tests/i18n/alternates.test.ts`

**Interfaces:**
- Produces: `LOCALES = ['nb','en'] as const`, `type Locale`, `DEFAULT_LOCALE = 'nb'` in `src/i18n/locales.ts`.
- Produces: `localizePath(locale: Locale, slug: string): string`, which gives `'nb','index'` → `/`, `'nb','om-oss'` → `/om-oss/`, `'en','index'` → `/en/`, `'en','about'` → `/en/about/`.
- Produces: `alternates(translationKey: string, entries: {locale: Locale, slug: string, translationKey: string}[]): {locale: Locale, href: string}[]`, which returns only the locales that have an entry with that key.
- Produces: content collection `pages`. Entry ids are `<locale>/<slug>`. Frontmatter schema: `title: string`, `description: string`, `translationKey: string`, `locale: 'nb'|'en'`. `translationKey` links the translations, because slugs may differ per language (`om-oss` / `about`).
- Produces: `npm` scripts `dev`, `build`, `preview`, `check` (`astro check`), `test` (`vitest run`), `check:dist` (`node scripts/check-dist.mjs`).

- [ ] **Step 1: Scaffold.** Run `npm create astro@latest . -- --template minimal --no-install --no-git --skip-houston --yes`, then `npm install`, then `npx astro add cloudflare sitemap --yes`. Add `vitest` and `yaml` as dev dependencies. Configure `astro.config.mjs` with `site: 'https://kobberogkran.no'`, `i18n: { defaultLocale: 'nb', locales: ['nb','en'], routing: { prefixDefaultLocale: false } }`, the cloudflare adapter and sitemap with `i18n: { defaultLocale: 'nb', locales: { nb: 'nb-NO', en: 'en' } }`. Set `wrangler.jsonc` `name` to `kobberogkran`. Commit.
- [ ] **Step 2: Write the failing test** `tests/i18n/alternates.test.ts`:

```ts
expect(localizePath('nb','index')).toBe('/');
expect(localizePath('en','about')).toBe('/en/about/');
const entries = [
  { locale:'nb', slug:'om-oss', translationKey:'about' },
  { locale:'en', slug:'about',  translationKey:'about' },
  { locale:'nb', slug:'kun-norsk', translationKey:'only-nb' },
];
expect(alternates('about', entries)).toEqual([
  { locale:'nb', href:'/om-oss/' }, { locale:'en', href:'/en/about/' }]);
expect(alternates('only-nb', entries)).toEqual([{ locale:'nb', href:'/kun-norsk/' }]);
```

- [ ] **Step 3:** `npm test`. Expected: FAIL (module not found).
- [ ] **Step 4:** Implement `src/i18n/locales.ts` and `src/i18n/alternates.ts`. `ui.ts` exports `ui: Record<Locale, {...}>` holding the switcher label, the 404 text and the skip link.
- [ ] **Step 5:** `npm test`. Expected: PASS.
- [ ] **Step 6:** Build the pages and layout.
  - Each `[...slug].astro` `getStaticPaths` filters `pages` by locale and maps `index` → `slug: undefined`.
  - `BaseLayout` props: `{ locale: Locale, title: string, description: string, alternates: {locale, href}[] }`. It renders `<html lang>` (`nb` / `en`), `<link rel="alternate" hreflang>` for each alternate plus `x-default` pointing to the nb version when it exists, the canonical link, `LanguageSwitcher` (links only to the alternates that exist), and imports `global.css`.
  - `tokens.css` holds CSS custom properties: `--color-*`, `--font-*`, `--space-*`, with neutral placeholder values and a comment saying branding replaces them.
  - Placeholder copy: nb "Kobber og Kran AS – nettsiden kommer snart", en "Kobber og Kran AS – website coming soon".
  - `robots.txt` allows all and lists `Sitemap: https://kobberogkran.no/sitemap-index.xml`.
- [ ] **Step 7:** Write `scripts/check-dist.mjs`, which exits with code 1 and a message per failure. It asserts:
  - `dist/client/index.html` (or the adapter's static output dir, whichever the build produces; resolve it once and use a constant) contains `lang="nb"`, `hreflang="en"`, `hreflang="x-default"`.
  - `en/index.html` contains `lang="en"`.
  - `404.html` and `en/404.html` exist with `lang` `nb` and `en` respectively.
  - `sitemap-index.xml` and `robots.txt` exist.
  - `admin/index.html` exists (skipped until Task 3 adds it; guard with a `--skip-admin` flag that Task 3 removes).
- [ ] **Step 8:** Run `npm run check && npm run build && npm run check:dist -- --skip-admin`. Expected: all pass. Run `npm run preview`, then fetch `/`, `/en/` and `/finnes-ikke` with curl. Expected: 200, 200, 404 with the nb 404 page.
- [ ] **Step 9:** Commit with `feat: bilingual Astro skeleton on Cloudflare adapter`.

### Task 3: Sveltia CMS and translation check

**Files:**
- Create: `public/admin/index.html`, `public/admin/config.yml`, `public/images/uploads/.gitkeep`
- Create: `scripts/check-translations.mjs`, `scripts/lib/translations.mjs`
- Test: `tests/cms/config.test.ts`, `tests/translations.test.ts`

**Interfaces:**
- Consumes: the `pages` collection layout from Task 2 (`src/content/pages/<locale>/<slug>.md`, `translationKey`).
- Produces: `findMissingTranslations(entries: {locale, translationKey, path}[], locales: string[]): {translationKey: string, missing: string[], present: string[]}[]` in `scripts/lib/translations.mjs`.
- Produces: `node scripts/check-translations.mjs [--json]`. It reads `src/content/pages/**`, prints the result, and exits 0 even when translations are missing (the spec says not to block builds). With `--json` it writes the array to stdout for the watchdog.

- [ ] **Step 1: Write the failing tests.**
  - `tests/translations.test.ts`: entries `about` in nb+en and `only-nb` in nb produce `[{ translationKey:'only-nb', missing:['en'], present:['nb'] }]`. Two complete pairs produce `[]`.
  - `tests/cms/config.test.ts`: parse `public/admin/config.yml` with `yaml` and assert all of the following:
    - `backend.name === 'github'`, `backend.repo === 'havnil/kobberogkran'`, `backend.branch === 'main'`
    - `i18n.structure === 'multiple_folders'`, `i18n.locales` deep-equals `['nb','en']`, `i18n.default_locale === 'nb'`
    - the `pages` collection `folder === 'src/content/pages'`
    - fields `title`, `description` and `body` have `i18n: true`, and `translationKey` has `i18n: 'duplicate'`
    - `media_folder === 'public/images/uploads'`, `public_folder === '/images/uploads'`
    - `publish_mode` is absent (saves go straight to `main`, per the spec)
- [ ] **Step 2:** `npm test`. Expected: both new tests FAIL.
- [ ] **Step 3:** Implement `findMissingTranslations` and the CLI. Write `config.yml` to satisfy the test, and add a hidden `locale` field filled per locale.
  - `base_url` is a commented-out line with `# TODO(runbook cloudflare-setup.md): set to the sveltia-cms-auth Worker URL`. Until it's set, editors use "Sign in with token".
  - `index.html` loads `https://unpkg.com/@sveltia/cms/dist/sveltia-cms.js` (unversioned, as the Sveltia docs recommend) and sets `<meta name="robots" content="noindex">`.
- [ ] **Step 4:** `npm test`. Expected: PASS. Remove `--skip-admin` from `check-dist`. `npm run build && npm run check:dist` passes.
- [ ] **Step 5:** Manual: `npm run preview`, open `/admin/`. Expected: the Sveltia login screen loads, with no console errors about the config.
- [ ] **Step 6:** Commit with `feat: Sveltia CMS with nb/en editing and translation check`.

### Task 4: CI workflow and `main` ruleset

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/dependabot.yml`

**Interfaces:**
- Produces: a required status check named exactly **`ci`** (the job id `ci`).

- [ ] **Step 1:** Write `ci.yml`.
  - Triggers: `pull_request` and `push` to `main`, plus `workflow_dispatch`. Permissions: `contents: read`.
  - Job `ci` steps: checkout, setup-node 24 with npm cache, `npm ci`, `npm run check`, `npm test`, `npm run build`, `npm run check:dist`, then `lycheeverse/lychee-action@v2` with `--offline --root-dir <static output dir> '<static output dir>/**/*.html'` (internal links only).
  - `dependabot.yml`: weekly npm and github-actions updates, grouped minor and patch.
- [ ] **Step 2:** Push on a branch `ci-setup` and open a PR. Expected: the `ci` check goes green. Merge.
- [ ] **Step 3:** Create the ruleset with `gh api repos/havnil/kobberogkran/rulesets -X POST --input <json>`:
  - target branch `main`
  - rules: `pull_request` (`required_approving_review_count: 0`), `required_status_checks` with context `ci` and `strict: false`, `non_fast_forward`, `deletion`
  - `bypass_actors`: repository role Admin (`actor_id: 5`, `actor_type: RepositoryRole`, `bypass_mode: always`), so the owner and the owner's CMS saves can push directly
- [ ] **Step 4:** Verify with `gh api repos/havnil/kobberogkran/rulesets`. Expected: one active ruleset. A test push from a non-admin can't be done here, so record that in the runbook as a manual check for when the brother is added.
- [ ] **Step 5:** Commit and merge any doc changes.

### Task 5: Watchdog checks and issue reporting

**Files:**
- Create: `scripts/watchdog/checks.mjs`, `scripts/watchdog/run.mjs`, `scripts/watchdog/report.mjs`
- Create: `.github/workflows/watchdog-hourly.yml`, `.github/workflows/watchdog-daily.yml`, `lighthouserc.json`
- Test: `tests/watchdog/checks.test.ts`, `tests/watchdog/report.test.ts`

**Interfaces:**
- Produces (in `checks.mjs`, pure functions):
  - `evaluateHttp(results: {url, status}[]): CheckResult`
  - `evaluateTls(daysLeft: number, minDays = 14): CheckResult`
  - `evaluateMx(records: {exchange, priority}[], expected = 'kobberogkran-no.mail.protection.outlook.com'): CheckResult`
  - `type CheckResult = { id: string, ok: boolean, summary: string, details: string, needsHuman: boolean }`
  - Check ids: `http`, `tls`, `dns-mx`, `links`, `lighthouse`, `translations`. `dns-mx` and `translations` set `needsHuman: true`.
- Produces (in `report.mjs`): `planIssueAction(openIssues: {number, title}[], result: CheckResult): {action: 'create'|'comment'|'none', issueNumber?: number, title: string}`. The title is `[watchdog] <id>: <summary>`, matched by prefix `[watchdog] <id>:`. When `ok` it returns `none`. Recovery doesn't auto-close; it adds a "recovered" comment when an issue is open, so `planIssueAction` returns `comment` for an ok result with an open issue.
- Produces: the `report.mjs` CLI `node scripts/watchdog/report.mjs <results.json>`, which uses `gh` with `GH_TOKEN`.
  - On `create`: open the issue with labels `watchdog` (plus `needs-human` if `needsHuman`) and assignee `havnil`. If not `needsHuman`, run `gh workflow run watchdog-agent.yml -f issue_number=<n>`.
  - On `comment`: append the details. The agent is never dispatched on a comment.
- Produces: `node scripts/watchdog/run.mjs --hourly|--daily-translations` writes `results.json`. Hourly runs http (`https://kobberogkran.no/`, `https://kobberogkran.no/en/`), tls (node `tls.connect` → `getPeerCertificate().valid_to`), and dns-mx (`dns.promises.Resolver` with servers `['1.1.1.1']`).

- [ ] **Step 1: Write the failing tests.**
  - `evaluateTls(30).ok === true`, `evaluateTls(13).ok === false`
  - `evaluateMx([{exchange:'kobberogkran-no.mail.protection.outlook.com',priority:1}]).ok === true`, `evaluateMx([]).ok === false` with `needsHuman === true`
  - `evaluateHttp([{url:'/',status:200},{url:'/en/',status:500}]).ok === false`, and `details` contains `/en/`
  - `planIssueAction([], failingTls)` returns `{action:'create'}`
  - `planIssueAction([{number:7,title:'[watchdog] tls: expires in 10 days'}], failingTlsWithDifferentSummary)` returns `{action:'comment', issueNumber:7}`
  - `planIssueAction([], okResult)` returns `{action:'none'}`
- [ ] **Step 2:** `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement the checks, `run.mjs` and `report.mjs`.
- [ ] **Step 4:** `npm test`. Expected: PASS.
- [ ] **Step 5:** Write the workflows.
  - Both have `if: vars.WATCHDOG_ENABLED == 'true'` on every job, plus `workflow_dispatch`. Permissions: `contents: read`, `issues: write`, `actions: write` (for `gh workflow run`).
  - Hourly: cron `'17 * * * *'`. Steps: setup-node, `node scripts/watchdog/run.mjs --hourly`, then `report.mjs`.
  - Daily: cron `'43 5 * * *'`, three jobs, each writing its own `results.json` and calling `report.mjs`:
    - `links`: lychee against `https://kobberogkran.no/` and `/en/`, recursive within the domain, fails on 4xx/5xx. A failure becomes a `links` result.
    - `lighthouse`: `treosh/lighthouse-ci-action@v12` with `lighthouserc.json` using the Global Constraints thresholds as `assert` minScores. A failure becomes a `lighthouse` result.
    - `translations`: `node scripts/check-translations.mjs --json`. A non-empty list becomes a failing `translations` result with `needsHuman: true`.
- [ ] **Step 6: Review the workflows.** With `WATCHDOG_ENABLED` unset, run `gh workflow run watchdog-hourly.yml`. Expected: the job is skipped and no issue is created.
- [ ] **Step 7:** Commit with `feat: watchdog checks with deduplicated issue reporting`.

### Task 6: Claude agent and auto-merge

**Files:**
- Create: `.github/workflows/claude.yml`, `.github/workflows/watchdog-agent.yml`, `.github/workflows/auto-merge.yml`
- Create: `.github/prompts/watchdog.md`
- Create: `scripts/automerge/classify.mjs`
- Test: `tests/automerge/classify.test.ts`

**Interfaces:**
- Consumes: the `planIssueAction` dispatch contract (`watchdog-agent.yml` input `issue_number`), labels from Task 1, and the `ci` check from Task 4.
- Produces: `classifyPaths(files: string[]): { allowed: boolean, blocked: string[] }`. Blocked prefixes come from Global Constraints.

- [ ] **Step 1: Write the failing test.**
  - `classifyPaths(['package.json','src/layouts/BaseLayout.astro'])` returns `{allowed:true, blocked:[]}`
  - `classifyPaths(['package.json','src/content/pages/nb/index.md'])` returns `{allowed:false, blocked:['src/content/pages/nb/index.md']}`
  - `classifyPaths(['public/images/uploads/a.jpg']).allowed === false`
  - `classifyPaths(['brand/logo.svg']).allowed === false`
- [ ] **Step 2:** `npm test`. Expected: FAIL. Implement. Expected: PASS.
- [ ] **Step 3:** `claude.yml` handles interactive `@claude`.
  - Triggers: `issue_comment` created, `pull_request_review_comment` created, `issues` opened/assigned, and `pull_request_review` submitted. Condition: the body contains `@claude`.
  - Permissions: `contents: write`, `pull-requests: write`, `issues: write`, `id-token: write`, `actions: read`. Same concurrency group and timeout as Global Constraints.
  - Uses `claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}` and `claude_args: --max-turns 30`.
  - The action's default write-access requirement stays on. Do not set `allowed_non_write_users`.
- [ ] **Step 4:** `watchdog-agent.yml` handles automated runs and is provider-agnostic. A first job `route` reads `vars.WATCHDOG_AGENT` (default `claude`). Then:
  - `claude`: job `claude-fix` uses `claude-code-action` (below).
  - `grok`: job `grok-fix` installs Grok Build (`curl -fsSL https://x.ai/cli/install.sh | bash`) and runs it headless with `XAI_API_KEY` and the same prompt file. Its exact headless flags come from docs.x.ai/build at implementation time; if they can't be confirmed, implement the job behind `if: false`-style gating with a `TODO(grok)` comment and document it in the runbook. It must never fail silently: if `XAI_API_KEY` is missing, comment on the issue and add `needs-human`.
  - `external`: job `handoff` only comments "Waiting for external watchdog bot" and adds the label `bot-queue`.
  - The cap and concurrency below apply to all routes.
  The remaining details below describe the `claude` route.
  - Triggers: `workflow_dispatch` with input `issue_number`, and `issues` `labeled` when the label is `watchdog`.
  - Skip when the issue has `needs-human`.
  - A cap step runs before the agent: `gh run list --workflow watchdog-agent.yml --created ">=$(date -u +%F)" --json databaseId --jq length`. If it is ≥ 10, comment "Daily agent cap reached", add `needs-human`, and exit successfully.
  - The agent step uses `prompt` = the contents of `.github/prompts/watchdog.md` with the issue number substituted, plus the same auth and `--max-turns 30`.
- [ ] **Step 5:** Write `.github/prompts/watchdog.md` with the spec's agent rules, verbatim in substance:
  - Read the issue and `CLAUDE.md`, then diagnose.
  - A purely technical fix (broken links, build/type errors, dependency patch/minor, workflow/config errors) goes on a branch with a PR that references the issue. Add the label `auto-fix` with `gh pr edit --add-label auto-fix`.
  - Wording (including alt text), prices, legal text, translations, DNS, email, or anything uncertain: comment with findings, `gh issue edit --add-label needs-human`, and stop.
  - Never push to `main`. Never touch secrets, DNS or Cloudflare settings.
- [ ] **Step 6:** `auto-merge.yml`.
  - Trigger: `pull_request` (`opened`, `synchronize`, `labeled`, `reopened`). Permissions: `contents: write`, `pull-requests: write`.
  - Job condition: author is in `vars.AUTOFIX_AUTHORS` (default `claude[bot]`) and label `auto-fix`.
  - Steps: list the changed files with `gh pr diff --name-only`, then `node scripts/automerge/classify.mjs`.
    - Not allowed: remove `auto-fix`, comment listing the blocked files, add `needs-human`.
    - Allowed: `gh pr merge --auto --squash`.
- [ ] **Step 7:** Verify with `npx --yes @action-validator/cli` (or `actionlint`, if available) over all workflow files. Expected: no errors. Commit with `feat: Claude upkeep agent and guarded auto-merge`.

### Task 7: Agent guidance and runbooks

**Files:**
- Create: `AGENTS.md` (the canonical, tool-neutral agent instructions), `CLAUDE.md` (`@AGENTS.md` plus Claude-specific notes only), `docs/watchdog/bot-contract.md`
- Create: `docs/runbooks/cloudflare-setup.md`, `docs/runbooks/github-setup.md`, `docs/runbooks/rollback.md`, `docs/runbooks/watchdog.md`
- Existing: `docs/runbooks/dns-migration.md` (already written; link to it)

- [ ] **Step 0:** Write `docs/watchdog/bot-contract.md`, the contract any watchdog bot (Grok, Claude, a future one) follows:
  - **Inputs:** open issues labelled `watchdog` or `bot-queue`. Issue titles look like `[watchdog] <check-id>: <summary>`. Read `AGENTS.md` first.
  - **Allowed:** comment, create a branch `bot/<issue-number>-<slug>`, and open a PR that references the issue and carries the label `auto-fix` only for technical fixes.
  - **Forbidden:** pushing to `main`, editing content paths, secrets, DNS or Cloudflare, closing issues not created by the watchdog.
  - **Escalation:** add `needs-human` with a findings comment.
  - **Auto-merge eligibility:** the bot's GitHub login must be added to `AUTOFIX_AUTHORS`.
  - **Setup for Grok:** two options. (a) `WATCHDOG_AGENT=grok` and add `XAI_API_KEY`. (b) Grok Bot with the GitHub plugin, a routine that reads `bot-queue` issues, and `WATCHDOG_AGENT=external`.
- [ ] **Step 1:** Write `AGENTS.md` (and a thin `CLAUDE.md`), covering:
  - The project and the domain.
  - Commands (from Task 2).
  - The folder map.
  - i18n rules: every page change goes in both locales with a shared `translationKey`, and the agent never writes translation copy without a human.
  - The content-vs-technical boundary (the blocked paths).
  - What the agent may never touch: secrets, DNS, Cloudflare, `main` directly.
  - How deploys work (Workers Builds on push to `main`, a preview per branch).
  - Where the brand assets go.
- [ ] **Step 2:** `cloudflare-setup.md` (owner steps):
  - Workers & Pages → Create → Import a repository → `havnil/kobberogkran`. Build command `npm run build`, deploy command `npx wrangler deploy`, and enable preview builds for non-production branches.
  - After the DNS migration, add the custom domains `kobberogkran.no` and `www.kobberogkran.no`, plus a redirect rule from www to the apex. Delete the old `104.37.39.71` A records.
  - Deploy `sveltia-cms-auth` (via its Deploy button) and create the GitHub OAuth app with callback `<worker-url>/callback`. Set the variables `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (encrypted) and `ALLOWED_DOMAINS=kobberogkran.no`, then set `base_url` in `public/admin/config.yml`.
  - Set the repo variable `WATCHDOG_ENABLED=true` once the site is live.
- [ ] **Step 3:** `github-setup.md`:
  - Install https://github.com/apps/claude on the repo.
  - Run `claude setup-token` locally and save the result as `gh secret set CLAUDE_CODE_OAUTH_TOKEN`.
  - Add the brother: `gh api repos/havnil/kobberogkran/collaborators/<user> -X PUT -f permission=admin`. The spec puts him on the ruleset bypass list so his CMS saves go straight to `main`. Rulesets on personal repos can only bypass by role, so that means `admin`.
  - Run a manual ruleset check.
- [ ] **Step 4:** `rollback.md` (Cloudflare dashboard → Deployments → Rollback; `git revert <sha>` via PR) and `watchdog.md` (what each check means, labels, how to pause it with `WATCHDOG_ENABLED=false`, the daily cap).
- [ ] **Step 5:** Commit and push. Expected: the `ci` check is green on `main`.

## Execution note

Tasks 1 → 7 run in order, because each consumes interfaces from the earlier ones. The owner's manual steps (Cloudflare connect, DNS, Claude app, token) are listed in the runbooks and aren't required for any task's verification.
