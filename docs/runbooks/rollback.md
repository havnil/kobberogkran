# Rollback: undo a bad deploy

There are two layers. Use them in this order:

1. **Cloudflare rollback**: puts the previous build back online in seconds. No code
   changes.
2. **`git revert`**: removes the bad change from `main`, so the next deploy doesn't bring
   it back.

Always do step 2 after step 1. Otherwise the next push to `main`, including a CMS save,
redeploys the broken code.

## 1. Cloudflare rollback (fast, minutes)

Dashboard:

1. Cloudflare → **Workers & Pages** → `kobberogkran` → **Deployments**.
2. Find the last good version. Each one lists the commit it was built from.
3. Click the **⋯** (three dots) menu next to it → **Rollback** → confirm.
4. Check `https://kobberogkran.no/` and `https://kobberogkran.no/en/`.

CLI alternative (needs `wrangler login` on your machine):

```sh
npx wrangler deployments list     # find the good version id
npx wrangler rollback <version-id>
```

Limits: you can only roll back to the 100 most recent versions. Rollback doesn't restore
data in connected resources (D1, R2, KV) if those are added later.

## 2. Revert the change in git (through a PR)

Find the bad commit:

```sh
git fetch origin
git log --oneline origin/main -20
```

Revert it on a branch and open a PR:

```sh
git switch -c revert-<short-sha> origin/main
git revert <sha>              # for a merge commit: git revert -m 1 <sha>
git push -u origin revert-<short-sha>
gh pr create --fill --base main
```

Merge once `ci` is green. The merge deploys the reverted code.

Notes:

- For a squash-merged PR, revert the single squash commit. GitHub's **Revert** button on
  the merged PR page does the same thing and opens the PR for you.
- A bad **CMS save** is an ordinary commit on `main` (its message names the entry). Revert
  it the same way. As the owner you may also revert it straight on `main`, since you're
  exempt from the ruleset. A PR is still preferred.
- If an `auto-fix` PR caused it, also add `needs-human` to the original watchdog issue,
  so the agent doesn't try the same fix again.
- You can also ask in an issue: `@claude revert <sha> in a PR`. The agent opens the PR,
  and you merge it. `@claude` PRs are never auto-merged.

## After a rollback

- Open (or comment on) an issue describing what broke, with the commit SHA.
- If the watchdog opened an issue, close it once the site is healthy. The watchdog only
  comments "recovered" and doesn't close issues itself.
