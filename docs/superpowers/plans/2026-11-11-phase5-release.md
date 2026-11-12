# Phase 5 release plan

Baseline: `codex/browser-pca` at `f6923c4`. Worktree: `codex/phase5-release`.

## Release 1: Browser PCA

1. Freeze the exact PR/main ancestry and separate the Browser PCA release from Hosted PCA.
2. Move the synthetic-only preview to a different hostname and verify storage, authentication, and network isolation.
3. Run the production build on Chromium, Firefox, and WebKit in CI, then check the deployed preview with synthetic CSV/XLSX data.
4. Review the PR, CI, rollback point, and deployment triggers. Merge through a PR only when every release gate passes. Smoke test the formal Pages URL without real research data.

## Release 2: Agents SAI

1. Add an auditable Supabase schema/RLS migration for owned conversations, messages, and analysis links. Review it before a separately authorized production migration.
2. Replace process-memory conversations for authenticated users with durable storage; preserve guest Mock behavior. Add rename, activity timestamps, automatic title, and bounded context.
3. Link a browser analysis ID and result ID to the conversation only after user confirmation and result validation. Keep the raw matrix browser-local and make the computation usable when AI is unavailable.
4. Deploy a separately reviewed AI Gateway; verify authentication, CORS, limits, stop/stream, costs, session isolation, and 10 consecutive real online model turns.
5. Release the user-facing chat only after the actual online flow and failure cases pass.

## Acceptance and stop conditions

- Record each check's commit, environment, command, result, and evidence. Local tests cannot satisfy remote deployment gates.
- Do not merge either release, migrate production, create paid resources, or change production secrets until the relevant reviewed prerequisites and approvals are in place.
- If an external dependency is unavailable, complete independent local work, then mark that release BLOCKED with the precise action needed.
