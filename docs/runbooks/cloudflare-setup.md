# Cloudflare setup (owner steps)

Goal: Cloudflare builds and hosts the site from GitHub, `kobberogkran.no` and
`www.kobberogkran.no` point at it, and the CMS at `/admin` can log in with GitHub.

You do every step here yourself in the Cloudflare and GitHub dashboards. Agents never
change Cloudflare settings.

The form, image storage, e-mail alerts and message channels (D1, R2, Turnstile, secrets,
vendors, launch day) are in [nettside-eiersteg.md](nettside-eiersteg.md). This file only covers
hosting, domains, CMS login and the watchdog.

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
fine-grained personal access token with *Contents* and *Pull requests: read and write* on this
repo only). Sveltia now uses a **GitHub App**, not a legacy OAuth App
([sveltia-cms-auth](https://github.com/sveltia/sveltia-cms-auth)).

Done so far: the Worker runs at `https://sveltia-cms-auth.hn-b14.workers.dev`, and `base_url` in
`public/admin/config.yml` points at it.

1. Open https://github.com/sveltia/sveltia-cms-auth and click **Deploy to Cloudflare
   Workers**. Project name `sveltia-cms-auth` (lowercase), **Protect with Cloudflare Access**
   off (Access would block the login popup), preview builds off. Note the Worker URL.
2. Register the GitHub App with Sveltia's pre-filled link:
   <https://github.com/settings/apps/new?name=Kobber+og+Kran+CMS&url=https://github.com/sveltia/sveltia-cms-auth&webhook_active=false&contents=write&pull_requests=write>
   | Field | Value |
   | --- | --- |
   | GitHub App name | `Kobber og Kran CMS` (must be unique on GitHub, max 34 characters) |
   | Callback URL | `<worker-url>/callback` |
   | Expire user authorization tokens | on |
   | Request user authorization (OAuth) during installation | off |
   | Webhook → Active | off |
   | Repository permissions | Contents: Read and write, Pull requests: Read and write (the editorial workflow needs it) |
   | Where can this GitHub App be installed | **Any account** (public). The repo is on a personal account, and a private app there can only be authorized by its owner: other collaborators get a GitHub 404 on sign-in ([GitHub docs](https://docs.github.com/en/apps/creating-github-apps/setting-up-a-github-app/making-a-github-app-public-or-private)). Public is safe: a user's token only reaches repos where the app is installed and the user already has access, and `ALLOWED_DOMAINS` limits which sites can sign in. To change an existing app: the app's settings → **Advanced** → **Make public**. |

   **Create GitHub App**, copy the **Client ID**, then **Generate a new client secret** and copy
   it. Never paste the secret into the repo, an issue, or a chat.
3. In the app's sidebar: **Install App** → **Install** → **Only select repositories** →
   `kobberogkran`. Editors with write access only authorize the app on their first sign-in.
   Access (in front of the `workers.dev` site) needs a login method for them too: Zero Trust →
   add **One-time PIN** as an identity provider, then tick it (and **Cloudflare**, for you) under the
   application's **Login methods**.
4. Cloudflare → **Workers & Pages** → `sveltia-cms-auth` → **Settings** → **Variables and
   Secrets**:
   | Name | Type | Value |
   | --- | --- | --- |
   | `GITHUB_CLIENT_ID` | Text | the Client ID |
   | `GITHUB_CLIENT_SECRET` | **Secret** (encrypted) | the client secret |
   | `ALLOWED_DOMAINS` | Text | `kobberogkran.no, *.hn-b14.workers.dev` |

   Save and deploy. `*.hn-b14.workers.dev` lets `/admin` log in from the `workers.dev` address
   and branch previews while the site isn't on `kobberogkran.no`; remove it after launch if you
   don't edit from previews.
5. Check: open `https://kobberogkran.hn-b14.workers.dev/admin/` (behind Access) → **Sign in with
   GitHub** → authorize → the editor shows the pages in both languages. A save opens a PR
   `cms/…` (editorial workflow, [github-setup.md](github-setup.md) step 3b).

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
