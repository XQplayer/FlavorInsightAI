# Phase 5 rollback guide

Recorded 2026-11-11 (Asia/Singapore). Applies to Release 1 candidate `a6f9cbc`, Release 2 candidate `421c770`, baseline `origin/main=595fb931`. No release has been merged or deployed, so current rollback is to close Draft PR #27 or #26 and leave `main` unchanged.

Before any approved merge, capture the exact `main` SHA and Pages deployment ID. For a bad Browser PCA release, stop the entry point through a reviewed flag or revert the merge via a new PR, then verify Pages build and the previous formal site with synthetic data. Keep existing local R workbench. Do not clear IndexedDB/localStorage: users' local analysis archives may be the only copy.

For a bad AI release, disable the public assistant route or `FLAVOR_AI_MODE` via reviewed Render configuration, preserving stored conversations and Browser PCA. Roll back Render to the last healthy deployment SHA after checking whether the AI Gateway shares the legacy API process. Do not drop `ai_conversations`, `ai_messages` or links to undo code; a destructive data rollback needs a separately reviewed plan. Restore Secrets by versioned operator procedure, never by committing them.

After rollback: verify formal Pages URL/Worker, GC-MS regression, Gateway health and session errors, monitoring for file import failure, browser errors, API timeouts and auth failures. Record incident, current/previous SHA, operator, time and result. Any actual production rollback is pending a real release.
