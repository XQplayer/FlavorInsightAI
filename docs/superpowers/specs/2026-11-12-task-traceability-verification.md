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

Final post-review commands/results are recorded in the release review section before delivery. Remote CI and production authenticated downloads are deliberately not exercised; cloud adapter boundary tests verify the signed filename option without touching production.

## Decisions and rollback

- Legacy archive builders preserve their old filenames when identity is absent. Legacy cloud downloads may use UUID plus name, without fabricated task numbers.
- Subsequent statistical analysis also receives a public number, preserving its source processing identity and service run ID; no backend numerical request schema change.
- Repaired one stale baseline browser test selector to test the current UI, not an obsolete heading.
- Original dirty main checkout remains untouched. Keep the local branch/worktree for review; rollback is to stop using the candidate preview and continue using the unchanged main checkout. No data migration must be undone.
