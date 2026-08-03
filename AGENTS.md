# Repository instructions for Codex

## Mandatory handover check

At the beginning of every task concerning this repository, before planning,
editing files, reporting deployment status, or operating production:

1. Fetch `origin/main` read-only when network access is available, without
   pulling, resetting, or overwriting local work.
2. Read the complete `HANDOVER.md` from `origin/main` first. Then read the local
   `HANDOVER.md` as well if it differs or contains uncommitted changes.
3. If the remote handover cannot be fetched, read the complete local copy and
   state that the latest GitHub copy could not be verified.
4. Treat `HANDOVER.md` as the source of truth for current production URLs,
   deployment roles, environment modes, database IDs, version IDs, validation,
   security constraints, failover, and recovery procedures.

Any change to `HANDOVER.md` must be committed and pushed to GitHub
`origin/main` in the same task. The task is not complete until the remote branch
is verified to contain that commit. If GitHub is unavailable, report the
unsynced state explicitly instead of treating the local edit as complete.

Never expose, read back, commit, or log `SITE_PASSWORD`, `MIRROR_SECRET`, source
repository credentials, bypass tokens, cookies, or other production secrets.

## Deployment invariant

When the user asks to deploy a runtime code change, deploy the same validated
commit to both the Cloudflare primary site and the OpenAI Sites mirror, following
the release order and checks in `HANDOVER.md`. Keep OpenAI Sites in
`MIRROR_READ_ONLY=1` unless the user explicitly authorizes a failover. Song data
updates use the existing automatic mirror and do not require a code deployment.

Documentation-only, test-only, or local-only work does not imply production
deployment. Preserve unrelated user changes and do not use destructive Git
commands.
