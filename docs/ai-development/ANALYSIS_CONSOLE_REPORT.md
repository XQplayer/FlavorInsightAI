# Analysis Console local acceptance

Date: 2026-11-10. Route: frontend/UI, L3. Local branch: `codex/analysis-console` in `.worktrees/processing-gsap-hierarchy`, based on `be8b230`. The original checkout and its uncommitted changes were not used. No remote push or deployment.

## Contract and implementation

- One `分析任务控制台 / Analysis Console` replaces the separate live monitor, 00–07 rail, and workflow dock. `00` is input setup; `01–07` map to Worker indexes `0–6`. The result ZIP is an action, not an eighth Worker stage. The progress denominator is always seven.
- The bar derives state, progress and QC from the existing job; engine connection remains independent. A selected step shows one method/input/expected-output block, real status, the available runtime log and counts. Expected output is not labeled as produced until a stage has finished.
- The log starts closed, opens for failure or QC block, and resets closed for a new task. QC issues retain code, affected sample/CAS where present, recovery guidance, and partial evidence archive. Completed tasks expose the QC summary, QC report and result files in the ZIP, task log, full archive download, and existing data-analysis handoff.
- Existing cancellation, rerun, task history, local restoration and research parameter controls remain. No Worker file, formula, source data, QC rule or output schema changed. Existing GSAP progress presentation was reused; no new animation or package was added.

## Before and after screenshots

Full-page idle captures: [desktop before](screenshots/analysis-console/console-before-desktop.png) / [desktop after](screenshots/analysis-console/console-after-desktop.png), [tablet before](screenshots/analysis-console/console-before-tablet.png) / [tablet after](screenshots/analysis-console/console-after-tablet.png), [mobile before](screenshots/analysis-console/console-before-mobile.png) / [mobile after](screenshots/analysis-console/console-after-mobile.png), [dark before](screenshots/analysis-console/console-before-dark.png) / [dark after](screenshots/analysis-console/console-after-dark.png). Real browser Worker cases: [seven-stage completion](screenshots/analysis-console/console-runtime-complete.png), [QC-blocked failure](screenshots/analysis-console/console-runtime-failed.png). The E2E fixture uses repository example workbooks; screenshots are UI test evidence, not observed research findings.

`shimadzu-monitor-results-region` heights from Playwright bounding boxes at equal viewports:

| Viewport | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Desktop 1440×900 | 1142 px | 670 px | 41.3% |
| Tablet 768×1024 | 1466 px | 794 px | 45.8% |
| Mobile 390×844 | 1510 px | 895 px | 40.7% |

No page-level horizontal overflow or page errors were observed in these captures. The step rail itself scrolls horizontally on narrow screens.

## Executed checks

1. TDD: `node --test src/components/shimadzu/analysisConsoleModel.test.mjs` first failed with `MODULE_NOT_FOUND`; a new one-console structural assertion failed against the old UI. After implementation, the state/model and layout tests passed.
2. `pnpm run test:shimadzu-browser`: 129/129 passed, including six new state/model tests.
3. `pnpm run test:shimadzu`, `test:platform`, `test:analysis`, `test:search-workbench`, `test:book-search`, `test:static-routes`: respectively 6/6, 33/33, 104/104, 74/74, 23/23, 3/3 passed. Total frontend tests in these commands: 372/372.
4. `python -m unittest scripts.tests.test_shimadzu_analysis_service scripts.tests.test_shimadzu_proxy -v`: 15/15 passed.
5. `pnpm run test:e2e:processing-feedback` with `CODEX_E2E_PLAYWRIGHT` set to the isolated Playwright install: passed desktop real Worker completion, 7/7, QC/results/log actions; mobile malformed-workbook QC block, automatic log expansion, evidence link and reset to 0/7.
6. `CODEX_E2E_SCOPE=routes CODEX_E2E_ROUTE=processing pnpm run test:e2e:platform`: PASS at 375, 768, 1024, 1366, 1920 and 2560 px. Checked 00–07 selection, compact height, log/history keyboard interaction, reduced motion, file input and horizontal overflow.
7. `pnpm run test:e2e` initially could not launch the proxy because its default Python path (`D:\Apps\python\python.exe`) does not exist. Repeated with `CODEX_E2E_PYTHON=D:/Apps/Python313/python.exe`: passed desktop/tablet/mobile release candidate browser checks, with no console/page errors or fixed-bottom overlap.
8. `pnpm run lint`, `pnpm run build`, `git diff --check`: passed. Build retains pre-existing RDKit browser-externalization, 3Dmol `eval`, and chunk-size warnings; no new dependency was installed.

## Review and limits

Serial code review checked the 00/01 index boundary, actual Worker event binding, QC block/error evidence, completion links, log reset, theme contrast, keyboard access, and no Worker/data file diff. Two defects found during review were fixed: the light-theme log initially inherited a dark background with dark text, and the log initially stayed open after creating a new task. Focused browser tests were repeated after both fixes. No independent agent review is claimed.

The browser tests cover a completed example and an invalid workbook that reaches a QC gate. They do not exercise every possible stage-specific failure or cloud account permission scenario. Scientific formulas and output values were outside this UI task; existing Worker tests passed, but no new independent reference-value claim is made. Remote CI and production deployment were not run.

## Rollback

Revert the local Analysis Console commit with `git revert <commit-sha>` on this branch. The prior UI and tests remain in Git history. Reverting does not touch source data or task archives.
