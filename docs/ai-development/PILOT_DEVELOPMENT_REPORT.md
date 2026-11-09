# Processing task feedback pilot

Date: 2026-11-09. Plan: `docs/superpowers/plans/2026-11-09-processing-task-feedback.md`. Implemented in existing `codex/ai-development` worktree; no production deploy.

## Contract and implementation

Input is the existing browser `job` object and language. Output is a concise status message plus accessible numeric progress, without modifying Worker events, seven-stage processing, formulas, persistence, sample data or completion rules. Waiting/queued, running, saving, review, complete, failed, cancelled and interrupted states are covered. Failure guidance distinguishes transient retries from replacing invalid files with a new task. Existing detailed error code/message remains visible in a `role="alert"` panel.

Changed application files: `frontend/src/components/shimadzu/taskFeedback.mjs` (pure bilingual status text), `ShimadzuAnalysisPage.jsx` (live status and progress semantics), `ShimadzuAnalysisPage.css` (responsive message treatment), `frontend/package.json` (test commands). Tests: `taskFeedback.test.mjs`, the existing `ShimadzuAnalysisPage.layout.test.mjs`, and `scripts/e2e/verify_processing_feedback.mjs` using the repository's explicitly synthetic public workbook templates. No timer drives completion: the page still uses real Worker and job state.

## Red, green and regression evidence

- Baseline before implementation: `node --test ...ShimadzuAnalysisPage.layout.test.mjs ...shimadzuWorkerClient.test.mjs ...shimadzuWorkerProtocol.test.mjs` passed 45/45.
- New unit and integration assertions were written first. `node --test ...taskFeedback.test.mjs ...ShimadzuAnalysisPage.layout.test.mjs` failed because `taskFeedback.mjs` and the new live status/progress markup did not yet exist. After implementation the focused suite passed 41/41; a later accessibility assertion for terminal announcements failed before its JSX change and then passed.
- Final selected frontend suites: `pnpm run test:book-search` 23/23, `test:platform` 31/31, `test:search-workbench` 74/74, `test:static-routes` 3/3, `test:shimadzu` 6/6, `test:shimadzu-browser` 115/115. Total 252 passing tests across these commands. `pnpm run lint` and `pnpm run build` passed; build emitted existing RDKit/3Dmol externalization, eval and large-chunk warnings.
- `CODEX_E2E_PLAYWRIGHT=file:///C:/Users/hanxq/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs pnpm run test:e2e:processing-feedback` passed after a selector correction. It exercised real browser Worker completion with a synthetic template at 1440px, `aria-valuenow=100` and download availability; a deliberately invalid workbook at 390px produced a failed state and visible alert. Both checked page-level horizontal overflow. The first run failed because the platform defaults to English and the test used a Chinese-only checkbox selector; the test was corrected, not the product language policy.
- Python API/service tests ran 15/15 after test isolation repair. Local R `services/analysis/tests/test_methods.R` passed its engine, regression and method checks on the configured R 4.6.0/project library; synthetic fixtures are labeled as such. Neither computes a new research result for this pilot.

## Review and limits

An independent Code Reviewer subagent reviewed the diff and found two P2 issues: retry text implied invalid files could be replaced by rerunning, and a fixed E2E port could attach to an old preview. Both were fixed and the reviewer confirmed resolution. A smaller duplicate live-announcement concern was addressed by leaving monitor announcements active during running and using the task message for terminal state. This is an actual independent review, not a claim of multiple independent implementations.

The focused E2E covers one successful desktop run and one failed mobile run; it does not exercise every visual state, every screen reader, cloud persistence or production deployment. Rollback: revert the phase-two commit(s) on `codex/ai-development`, keeping `a1aa947` and original user changes; `taskFeedback.mjs` is UI-only and the existing Worker/stage code remains the reference.
