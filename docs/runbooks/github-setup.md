# GitHub setup (owner steps)

Goal: the Claude agent can run on this repo using your Claude subscription, the
brother can edit, and the `main` ruleset behaves as intended.

The repo (`havnil/kobberogkran`), its labels (`watchdog`, `needs-human`, `auto-fix`) and
the `main` ruleset are created by the build. What's left needs your accounts and
credentials, so you do it yourself.

## 1. Install the Claude GitHub app

1. Open https://github.com/apps/claude → **Install** (or **Configure** if it's already
   installed).
2. Choose **Only select repositories** → `havnil/kobberogkran` → **Install**.

Without the app, the `claude` and `claude-watchdog` workflows fail at the agent step.

## 2. Add the agent token (`CLAUDE_CODE_OAUTH_TOKEN`)

The agent runs on your Claude subscription (Pro or Max), so its runs count toward your
personal usage limits. The daily cap of 10 automated runs (see [watchdog.md](watchdog.md))
keeps that bounded.

1. On your own machine, in a terminal: `claude setup-token`. Log in in the browser when
   asked. It prints a long-lived token that starts with `sk-ant-oat…`.
2. Store it as a repo secret. Run this and **paste the token at the prompt** (don't put it
   on the command line, so it stays out of your shell history):

   ```sh
   gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo havnil/kobberogkran
   ```

3. Check: `gh secret list --repo havnil/kobberogkran` lists `CLAUDE_CODE_OAUTH_TOKEN`
   (the value is never shown).
4. Test: in any issue, write a comment containing `@claude say hello`. Expected: the
   `claude` workflow runs and replies in the issue.

If the token is ever leaked or revoked, run steps 1 and 2 again. The new value replaces
the old one.

## 3. Add the brother as a collaborator

Once he has a GitHub account:

```sh
gh api repos/havnil/kobberogkran/collaborators/<his-username> -X PUT
```

He gets an email invite and must accept it.

> **Important limit on personal repos.** This repo belongs to a personal account, not an
> organization. On personal repos, GitHub gives every collaborator **write** access, and the
> API ignores `-f permission=admin` (GitHub's docs say that parameter is "only valid on
> organization-owned repositories"). Rulesets on a personal repo can only exempt people
> by role, and the ruleset exempts the **Admin** role, which only the owner has.
>
> So with write access the brother can:
> - open and merge PRs (once `ci` is green)
> - use `@claude` in issues and PRs
> - edit through the CMS, **but CMS saves to `main` are rejected** by the ruleset
>
> To let his CMS saves go straight to `main` as the spec intends, pick one:
> 1. **Recommended:** move the repo into a free GitHub organization (repo **Settings** →
>    **Transfer**), then give him the **Admin** role on the repo. The ruleset's Admin
>    exemption then covers him. After the transfer, update the repo name in
>    `public/admin/config.yml` (`backend.repo`), `CLAUDE.md`, the runbooks and
>    the watchdog assignee, and reconnect the repo in Cloudflare Workers Builds. GitHub
>    redirects the old URLs, but don't rely on that.
> 2. Leave it as is. He edits through PRs (or asks `@claude`), and you merge.

## 4. Manual ruleset check

The `main` ruleset requires a PR and a green `ci` check, blocks force-pushes and branch
deletion, and exempts the Admin role. Its exact definition is
[`main-ruleset.json`](main-ruleset.json). It is created (once the `ci` check has run
green at least once) with:

```sh
gh api repos/havnil/kobberogkran/rulesets -X POST --input docs/runbooks/main-ruleset.json
```

Check it once now, and again whenever someone is added:

1. **As the owner (admin):** a small direct push to `main` succeeds. GitHub prints a
   note that you bypassed the rules. A CMS save, made while signed in as you, appears as
   a commit on `main`.
2. **As a collaborator with write access** (for example, the brother):
   - `git push origin main` with a new commit → **rejected** ("Changes must be made through
     a pull request" / "Required status check `ci` is expected").
   - Open a PR → the **Merge** button stays disabled until the `ci` check is green.
3. **Force-push** to `main` (by anyone without bypass) → rejected.
4. Look at the rules: `gh api repos/havnil/kobberogkran/rulesets` → one active ruleset
   targeting `main`.

Write down the date and the result at the bottom of this file.

## 5. Repo variable for the watchdog

`WATCHDOG_ENABLED` stays unset until the site is live on `kobberogkran.no`. See
[cloudflare-setup.md](cloudflare-setup.md#4-turn-on-the-watchdog-once-the-site-is-live).

## Check log

| Date | Who | Check | Result |
| --- | --- | --- | --- |
| | | | |
