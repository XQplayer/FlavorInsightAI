# Task traceability verification

## Scope and source

Local candidate on `codex/task-traceability`, isolated at `.worktrees/task-traceability`; base `b3be4c7`. Version remains 1.5.0. User authorised direct implementation and testing, explicitly not online publication. No push, merge, production migration, secret change or original research-file rewrite is part of this delivery.

Skills actually used: executing-plans (continuous inline execution), test-driven-development and writing-good-tests (failing tests before changes), flavor-data-integrity (archive source identity/hash preservation), systematic-debugging (baseline Edge test diagnosis), verification-before-completion (fresh evidence), requesting-code-review (final review) and finishing-a-development-branch (retain isolated candidate). No statistical/scientific algorithms changed.

## Contract coverage

- Public task numbers use fixed UTC+8 date/time and secure random six-hex suffix, preserving UUID as storage key.
- Browser restore/pause and language changes do not regenerate identity. Explicit rerun creates a fresh UUID/public number, resets completed stages/terminal artifacts and retains parent identity. Cloud parent rows are not overwritten.
- Successful, failed and cancelled ZIPs use the approved number/name/status pattern. Cloud history signed downloads explicitly specify this filename, leaving storage paths intact.
- Existing browser/cloud JSON fields carry identity without schema migration. Processing run/completeness/stage manifests and error/cancel evidence include it under parameters, with regenerated SHA-256 values. Human-readable task information is derivative; integrity verification uses structured hash-covered metadata.
- Completed ZIP import requires consistent identity across signed run, completeness and stage manifests; mismatches/tampering reject import. Origin identity survives dataset derivation and portable JSON/XLSX export. CSV matrix layout remains unchanged.
- Each subsequent statistical analysis has a separate public number and source/parent reference. Existing exact server request fields are unchanged. Result polling retains the public identity; report/table/reproduction archives include both public identity and service/dataset IDs.
- Old tasks and archives keep original identities; no invented historical timestamps or backfill. Long/unsafe filenames are bounded, original metadata names are preserved.

## Executed evidence

1. Initial 14 console/workspace model tests passed on base.
2. Helper/cloud download tests failed before implementation; then 21/21 helper/store/cloud tests passed.
3. Worker/pipeline tests failed on absent identity and old ZIP names; then 104/104 Shimadzu browser tests passed. Public fixture scientific tables/counts match no-identity baseline; input byte hash unchanged. JSON evidence hashes verified.
4. Actual browser task flow initially failed because UI did not expose the number; after integration, desktop 1440px and mobile 390px passed complete/failure downloads, refresh, language switching, fresh rerun with parent and verified analysis handoff. Real Worker cancellation via Enter and long Chinese names also passed. Only public/synthetic fixtures used; no observed research results invented.
5. Downstream tests failed for absent verified provenance; implementation tests then passed consistency/tampering rejection, analysis identity retention, dataset export and report/table/reproduction ZIP tracing.
6. Full Node suite initially passed 455 with one Edge smoke skipped under system Node (bundled Playwright unavailable via that runtime). Running with bundled Node exposed an old readiness-selector failure. The identical failure was reproduced in unchanged baseline worktree `71f059e`: test waited for removed hero title `仪器数据处理平台`. Changed only that test to wait for the actual `.processing-preflight` surface. Full bundled-runtime suite then passed 456/456, with no skips.
7. Full ESLint and production build passed. Existing third-party bundle-size, browser-externalized fs/crypto and 3Dmol eval warnings remain; they are not new task-identity behavior.

Remote CI and production authenticated downloads are deliberately not exercised; cloud adapter boundary tests verify the signed filename option without touching production.

## Final independent review and corrective pass

A read-only independent reviewer found three Important defects: strict analysis settings rejected the new run identity, local rerun overwrote the only parent evidence copy, and analysis retry linked the processing source instead of the selected analysis parent. No Critical or actionable Minor findings. All three were reproduced with failing integration tests, then fixed in one pass.

The restore contract now explicitly validates the additive identity shape and still accepts legacy runs. Analysis retries retain a separate selected parent and unchanged numerical request. Browser task history now preserves UUID-keyed terminal metadata and evidence before replacing the active pointer: evidence seven days, metadata ninety days, scoped by owner. No raw workbooks are duplicated in history. Maximum 100 unexpired local records per scope; quota/capacity failures warn and never silently evict existing evidence or replace an unsafe-to-archive parent. Parent ZIP downloads after rerun and refresh were verified in desktop/mobile browsers.

Visual review also caught a mobile-only ellipsis hiding part of the task number/name. A real-browser clipping assertion failed first, then passed after the existing console label was allowed to wrap fully. Desktop/mobile screenshots were inspected.

### Final accepted checks

- Bundled Node 24 `node --test` in `frontend`: **461 passed, zero failed, zero skipped**, including actual Edge router smoke. System Node had previously skipped that browser test; the accepted run does not.
- `pnpm run test:shimadzu-browser`: 104/104 before the review fixes; final full suite includes these tests and added history/restore cases.
- `pnpm run test:analysis`: 108/108 before the review fixes; final full suite includes added strict restoration and analysis retry cases.
- `pnpm run test:platform`: 33/33; full ESLint exit 0; production build/static routes exit 0; `git diff --check` exit 0.
- Bundled Node `scripts/e2e/verify_task_traceability.mjs`: 1440px and 390px actual complete/failure downloads, refresh/language stability, explicit rerun, UUID-keyed parent evidence download after rerun and refresh, verified analysis handoff, full unclipped label, keyboard cancellation and bounded long-name downloads passed.
- Existing `verify_processing_feedback.mjs`: desktop completion/mobile failure passed. Existing `verify_shimadzu_failure_details.mjs`: all eight viewport/language/theme cases passed.
- Verified candidate preview HTTP 200 at `http://127.0.0.1:5176/FlavorInsightAI/data-processing/`, including its current compiled task-history code. Serves this isolated worktree's production build, not the original 5174 checkout. Original 5174 also remains reachable. No push, PR, merge or production deployment performed.

### Main changed modules

`lib/taskIdentity.mjs`, `shimadzuTaskLifecycle.mjs`, `shimadzuTaskStore.js`, `shimadzuCloud.js`: identity, rerun persistence, scoped history and signed download names. Worker client/worker/pipeline: metadata propagation and complete/failed/cancelled archives. Shimadzu console/workspace/CSS: frozen identity displays, parent/history access and mobile wrapping. Analysis adapter/traceability/exports/report/workbench/UI: verified origin, independent analysis identity, strict restore/retry compatibility and export provenance. Related tests, focused E2E, package test routing, README, plan and design/verification documentation are included. No formula or source research file was changed.

## Decisions and rollback

- Legacy archive builders preserve their old filenames when identity is absent. Legacy cloud downloads may use UUID plus name, without fabricated task numbers.
- Subsequent statistical analysis also receives a public number, preserving its source processing identity and service run ID; no backend numerical request schema change.
- Repaired one stale baseline browser test selector to test the current UI, not an obsolete heading.
- Original dirty main checkout remains untouched. Keep the local branch/worktree for review; rollback is to stop using the candidate preview and continue using the unchanged main checkout. No data migration must be undone.
