# Cloudflare setup (owner steps)

Goal: Cloudflare builds and hosts the site from GitHub, `kobberogkran.no` and
`www.kobberogkran.no` point at it, and the CMS at `/admin` can log in with GitHub.

You do every step here yourself in the Cloudflare and GitHub dashboards. Agents never
change Cloudflare settings.

Order:

1. Connect the repo (section 1). You can do this right away; the site gets a
   `*.workers.dev` address.
2. Do the [DNS migration](dns-migration.md).
3. Add the domains (section 2).
4. Set up CMS login (section 3).
5. Turn on the watchdog (section 4).

## 1. Connect the repo (Workers Builds)

1. Create a free Cloudflare account if you don't have one, then sign in.
2. **Workers & Pages** → **Create application** → **Import a repository** → connect
   GitHub. This installs the **Cloudflare Workers and Pages** GitHub app; give it access
   to `havnil/kobberogkran` only. Then pick `havnil/kobberogkran`.
3. Settings:
   | Field | Value |
   | --- | --- |
   | Project / Worker name | `kobberogkran`. It must match `name` in `wrangler.jsonc`, or the build fails. |
   | Production branch | `main` |
   | Build command | `npm run build` |
   | Deploy command | `npx wrangler deploy` |
   | Root directory | leave empty (the repo root) |
4. Under **Settings** → **Build** → **Branch control**, tick **Enable Preview Builds**
   (builds for non-production branches). Keep the default **Preview command**
   (`npx wrangler preview` for new Workers). Every PR then gets a check run and a comment
   with its preview URL.
5. Node version: the build reads `.nvmrc` (`24`). No `NODE_VERSION` variable is needed.
6. Save and deploy. Expected: the first build goes green, and the site loads at
   `https://kobberogkran.<your-subdomain>.workers.dev/` (nb) and `/en/`.

Check: in GitHub, the latest commit on `main` shows a Cloudflare check run.

## 2. Custom domains and the www redirect (after the DNS migration)

Do this only after [dns-migration.md](dns-migration.md) is finished and Cloudflare says
the zone `kobberogkran.no` is **Active**.

1. Cloudflare → `kobberogkran.no` → **DNS** → **Records**: delete the two old Uniweb
   website records:
   - `A  @    104.37.39.71`
   - `A  www  104.37.39.71`

   Do **not** touch MX, TXT (`MS=…`, `v=spf1 …`) or the `autodiscover` CNAME. Those are
   email.
2. **Workers & Pages** → `kobberogkran` → **Settings** → **Domains & Routes** → **Add** →
   **Custom Domain** → `kobberogkran.no` → **Add Custom Domain**. Cloudflare creates the DNS
   record and the certificate.
3. Repeat for `www.kobberogkran.no`.
4. `kobberogkran.no` → **Rules** → **Redirect Rules** → **Create rule** → use the template
   **Redirect from WWW to root** (or build it by hand):
   - When: hostname equals `www.kobberogkran.no`
   - Then: dynamic redirect to `concat("https://kobberogkran.no", http.request.uri.path)`,
     status **301**, **preserve query string** on.
5. Check, from a terminal or a browser:
   - `https://kobberogkran.no/` and `https://kobberogkran.no/en/` load (200).
   - `https://www.kobberogkran.no/en/` ends up at `https://kobberogkran.no/en/` (301).
   - `https://kobberogkran.no/finnes-ikke` shows the Norwegian 404 page.
   - Email still works (send one message each way).

## 3. CMS login (Sveltia CMS authenticator)

Until this is done, editors can still use **Sign in with token** on `/admin` (a GitHub
fine-grained personal access token with *Contents: read and write* on this repo only).

1. Open https://github.com/sveltia/sveltia-cms-auth and click **Deploy to Cloudflare
   Workers**. Follow the prompts. Note the Worker URL, for example
   `https://sveltia-cms-auth.<your-subdomain>.workers.dev`.
2. GitHub → **Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App**:
   | Field | Value |
   | --- | --- |
   | Application name | `Kobber og Kran CMS` |
   | Homepage URL | `https://kobberogkran.no` |
   | Authorization callback URL | `<worker-url>/callback` |

   Register it, then **Generate a new client secret**. Copy the Client ID and the secret.
   Never paste the secret into the repo, an issue, or a chat.
3. Cloudflare → **Workers & Pages** → `sveltia-cms-auth` → **Settings** → **Variables and
   Secrets**:
   | Name | Type | Value |
   | --- | --- | --- |
   | `GITHUB_CLIENT_ID` | Text | the Client ID |
   | `GITHUB_CLIENT_SECRET` | **Secret** (encrypted) | the client secret |
   | `ALLOWED_DOMAINS` | Text | `kobberogkran.no` |

   Save and deploy.
4. In `public/admin/config.yml`, under `backend:`, replace the commented-out line
   `# base_url: …  # TODO(runbook cloudflare-setup.md) …` with
   `base_url: <worker-url>` (no trailing slash). This is the only repo change; you or
   `@claude` can make it. Because it's under `public/admin/`, it's never auto-merged.
5. Check: open `https://kobberogkran.no/admin/` → **Sign in with GitHub** → authorize →
   the editor shows the pages in both languages.

If you later want to edit from a preview URL too, add that hostname to `ALLOWED_DOMAINS`
(it takes a comma-separated list, and wildcards work, like `*.workers.dev`).

## 4. Turn on the watchdog (once the site is live)

The scheduled watchdog checks do nothing until this repo variable is set, so they don't
file issues about a site that isn't live yet.

```sh
gh variable set WATCHDOG_ENABLED --body true --repo havnil/kobberogkran
```

Or: GitHub → the repo → **Settings** → **Secrets and variables** → **Actions** →
**Variables** → **New repository variable** → `WATCHDOG_ENABLED` = `true`.

Then run it once by hand (`gh workflow run watchdog-hourly.yml --repo havnil/kobberogkran`)
and check that the run is green and no issue is opened. See [watchdog.md](watchdog.md).

Also point your Grok Bot (in the Grok Bot app) at `https://kobberogkran.no/` and
`https://kobberogkran.no/en/` for outside uptime checks. Nothing in the repo needs to
change for that.
