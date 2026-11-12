# Failure diagnostics verification

Implementation branch: `codex/shimadzu-error-diagnostics` in `.worktrees/shimadzu-error-diagnostics`. Baseline: `5e2056e`. No merge or production deployment performed.

## Changed behavior and files

- `frontend/src/lib/shimadzuIssues.js`: deterministic bilingual cause, evidence and remedy model, warning/blocker counts, legacy fallback.
- `frontend/src/components/shimadzu/ShimadzuFailureDetails.jsx`: readable error explanation, locations, reminders, native technical disclosure and evidence download. The existing analysis page delegates to this component; existing CSS adds responsive layout and focus styling.
- `frontend/src/shimadzu-core/parse-shimadzu.mjs`: structural error metadata only (section rows and whether the section is empty).
- `frontend/src/workers/shimadzuPipeline.js`: workbook names on issues, independent example-configuration reminders and serializable archive/error details. No gate, scientific calculation or exclusion behavior changed.
- Focused tests, browser verification script, package test routing, README, spec and plan.

## Executed checks

1. Baseline issue-order/parser tests: 2/2 passed before editing.
2. New tests reproduced missing explanation/row metadata before implementation.
3. `cd frontend; pnpm run test:shimadzu-browser`: 118/118 passed.
4. Focused ESLint on changed production modules and tests: exit 0.
5. `cd frontend; node node_modules/vite/bin/vite.js build`, followed by `node scripts/create-static-routes.mjs`: exit 0. Existing bundle-size and third-party build warnings remain.
6. `node scripts/e2e/verify_shimadzu_failure_details.mjs` using the bundled Node/Playwright runtime: 8/8 desktop/mobile, Chinese/English, light/dark combinations passed. Checks include loaded production CSS, no horizontal overflow, Enter-key disclosure, cause priority and download attributes. Desktop and mobile screenshots visually inspected.
7. Read-only replay of all 36 sheets from the user's archived input snapshot against the original baseline parser: all 683 retained records, lineage, issue counts and existing issue fields are identical. Added evidence locates the empty peak-table title at row 6 and next section at row 7. The user's current workbook changed after the archived run, so snapshot evidence was used rather than mixing versions.
8. `git diff --check`: exit 0.

## Review and remaining boundaries

Primary-agent serial review performed; no independent agent review was run. Raw cell data is not copied into diagnostic metadata. React text rendering escapes filenames, sample names and error messages. Scientific records and gates remain unchanged. Unknown codes retain the original message rather than guessing a cause. Historical tasks cannot show source rows or template notices that were never recorded. Production cloud-session testing awaits authorised deployment; local/online builds use the same error component and existing serializable error path.

Rollback: the main checkout and production remained unchanged during initial verification. After an authorised merge, revert the feature changes to restore baseline UI/metadata; no migration or raw-data rewrite is required.

## Authorised release integration

The user authorised merging and production publication without changing version 1.5.0. Integrated remote main at 595fb931fd2a2972bbac1132ddd3c48211ca5000, retaining the new four-workspace console and patched SheetJS 0.20.3. Replaced the new console's generic error block with the detailed diagnostics component; retained upstream layout assertions and added the diagnostics integration assertion.

Fresh integrated checks: 100/100 Shimadzu browser workflow tests; full ESLint; production build and static routes; complete desktop processing and mobile failure E2E; all eight bilingual/theme/viewport diagnostics E2E combinations; git diff --check. All passed. The reduced test count relative to the historical 118 reflects upstream replacement of obsolete layout assertions, not deletion of scientific regression tests. Existing third-party build warnings remain. Publication is subject to remote PR quality checks and Pages deployment verification.
