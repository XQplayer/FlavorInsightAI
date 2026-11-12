# Phase 5 rollback guide

Recorded 2026-11-11 (Asia/Singapore). Applies to Release 1 candidate `a6f9cbc`, Release 2 candidate `3e1c7d6`, baseline `origin/main=595fb931`. No release has been merged or deployed, so current rollback is to close Draft PR #27 or #26 and leave `main` unchanged.

Before any approved merge, capture the exact `main` SHA and Pages deployment ID. For a bad Browser PCA release, stop the entry point through a reviewed flag or revert the merge via a new PR, then verify Pages build and the previous formal site with synthetic data. Keep existing local R workbench. Do not clear IndexedDB/localStorage: users' local analysis archives may be the only copy.

For a bad AI release, disable the public assistant route or `FLAVOR_AI_MODE` via reviewed Render configuration, preserving stored conversations and Browser PCA. Roll back Render to the last healthy deployment SHA after checking whether the AI Gateway shares the legacy API process. Do not drop `ai_conversations`, `ai_messages` or links to undo code; a destructive data rollback needs a separately reviewed plan. Restore Secrets by versioned operator procedure, never by committing them.

After rollback: verify formal Pages URL/Worker, GC-MS regression, Gateway health and session errors, monitoring for file import failure, browser errors, API timeouts and auth failures. Record incident, current/previous SHA, operator, time and result. Any actual production rollback is pending a real release.

## Release 1 actual baseline — 2026-11-12

PR #27 merged as `3735f7b6e555d7c7f97f314d008b7b7a35e2b4ec`; the previous main was `5547e8b4572d5e2f3262ad928ca7d56d4f6360ff`. [Pages run 43210459242](https://github.com/XQplayer/FlavorInsightAI/actions/runs/43210459242) succeeded; the formal Browser PCA route and Worker asset returned HTTP 200 and Chrome synthetic smoke passed. To undo the new feature, prepare a PR reverting the PR #27 merge commit, run its checks, merge it and verify the restored Pages artifact. Keep user IndexedDB archives intact. The existing Render API remained at healthy deployed commit `4c5c7d9` during the observed release window; no API rollback was needed. Release 2 has not been deployed, so its rollback remains to keep PR #26 Draft and leave AI Gateway disabled.
