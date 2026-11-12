# Analysis Console implementation plan

**Route / level:** Frontend/UI, L3. Branch `codex/analysis-console` in the existing isolated worktree, based on `be8b230`. No new package, Worker, scientific-rule, source-data, output-schema or deployment changes.

**Measured baseline:** At 1440×900 the idle monitor region is 1142 px high, with a 430 px monitor and a separate 400 px workflow dock. At 390×844 it is 1510 px high, with a 410 px monitor and a 762 px workflow dock. Actual screenshots are preserved in ignored `_local/console-before-{desktop,tablet,mobile,dark}.png`.

**Design contract:** One `Analysis Console` region contains a compact task/status/progress/QC/engine bar, 00–07 clickable step navigation, a single selected-step detail, collapsed log, error/QC evidence and completed-task actions. 00 is preflight input setup and is outside the denominator. 01–07 map exactly to Worker stage indexes 0–6; progress remains `getStageProgress(job)` with denominator seven. The previous result-package rail node becomes a completion action, not an eighth Worker stage. Step descriptions reuse `WORKFLOW`; expected inputs/outputs are descriptions derived from the actual pipeline workbooks. They are labeled planned until the stage runs. Selected-step runtime status/counts/log come only from task events or persisted task state. No synthetic completion.

**State contract:** No job = waiting (or checking while submitting); stage 0 running = validating; later running = processing; `waiting_review` or a failed stage gate = QC blocked; `failed` without gate code = failed; `saving` = finalizing; `complete` = complete. Engine state is independent. A failed/QC-blocked job opens the log and shows the existing issue details and partial archive link. Existing cancel, continue, retry, reset, handoff, downloads and history remain available.

**Change ownership:**

- `frontend/src/components/shimadzu/analysisConsoleModel.mjs`: pure display status, QC gate, 00–07 mapping and default selection derived from existing job fields.
- `frontend/src/components/shimadzu/analysisConsoleModel.test.mjs`: synthetic fixtures for idle, running, review, failed and complete display semantics, especially 0/7.
- `frontend/src/components/shimadzu/ShimadzuAnalysisPage.jsx`: replace duplicate WorkflowMap/StageRail/LiveMonitor/stage list composition with one console, preserve task actions and evidence.
- `frontend/src/components/shimadzu/ShimadzuAnalysisPage.css`: scoped console layout, color semantics, responsive nav and disclosure styling using existing theme tokens.
- Existing layout and Playwright tests: update obsolete structural checks and add state, keyboard, responsive, result and real Worker regression checks.
- `docs/ai-development/ANALYSIS_CONSOLE_REPORT.md` and screenshots: measured before/after evidence, commands, failures, review and rollback.

## Sequence

- [x] Write pure state/step mapping tests and verify they fail before implementation.
- [x] Implement the minimal pure model; verify state tests pass.
- [x] Add failing UI/E2E assertions for one console, 00–07 buttons, selected detail, closed/auto-open log, results and compact height.
- [x] Refactor JSX and scoped CSS, preserving task callbacks, QC issues, logs and exports.
- [x] Run focused tests, inspect desktop/tablet/phone screenshots and keyboard interactions; fix concrete failures.
- [x] Run all affected frontend tests, real Worker E2E, API regression, lint/build, diff/data check and code review.
- [x] Save after screenshots and report, then commit locally. No remote push, PR or deployment.
