# Data processing workbench: layout and GSAP closeout

## Scope and implementation

Route: frontend/UI/GSAP, L3. Isolated worktree `codex/processing-gsap-hierarchy`, based on `5ae695268f70e9475061bc0a71d8a024647f8fb8`. The three work stages, two workbook inputs, advanced scientific controls, seven Worker stages, QC evidence, downloads and account actions remain present. No Worker, formula, source data, result schema or deployment file changed.

The compact first view moves GC–MS, Shimadzu and browser-local execution into a status row. Advanced CAS, threshold, OAV and CV controls start collapsed and remain keyboard accessible. Workbook cards use two columns on wide screens and one on phones. The current task monitor precedes the 00–07 workflow reference; logs and historical jobs have separate disclosures. The history section is below the current task, including for administrators.

GSAP is already in the project dependencies. `useGSAP` scopes page entry, file-ready feedback, preflight, progress, error and result transitions; `gsap.matchMedia()` handles viewport and reduced-motion changes. The entry hook has no job-state dependency, and its context/listeners are cleaned up on unmount. Progress remains `getStageProgress(job)` and the existing Worker stage statuses; animation only interpolates presentation. No ScrollTrigger pin or continuous decorative animation was added. The implementation follows [GSAP React guidance](https://gsap.com/resources/React/) and [GSAP matchMedia guidance](https://gsap.com/docs/v3/GSAP/gsap.matchMedia%28%29/).

## Screenshot evidence

Playwright captured the actual route in light desktop 1440×900, tablet 768×1024 and phone 390×844, plus dark desktop. Full-page screenshots are versioned beside this report in `screenshots/processing-gsap/`:

| Viewport | Before | After | First upload card top |
| --- | --- | --- | --- |
| Desktop | [before-desktop.png](screenshots/processing-gsap/before-desktop.png) | [processing-desktop.png](screenshots/processing-gsap/processing-desktop.png) | 1569 → 750 px |
| Tablet | [before-tablet.png](screenshots/processing-gsap/before-tablet.png) | [processing-tablet.png](screenshots/processing-gsap/processing-tablet.png) | 1964 → 713 px |
| Phone | [before-mobile.png](screenshots/processing-gsap/before-mobile.png) | [processing-mobile.png](screenshots/processing-gsap/processing-mobile.png) | 2416 → 742 px |
| Dark desktop | [before-dark.png](screenshots/processing-gsap/before-dark.png) | [processing-dark.png](screenshots/processing-gsap/processing-dark.png) | 1569 → 750 px |

The capture script in ignored `_local/processing-screenshot.mjs` checked `document.documentElement.scrollWidth`, page errors and first input position: no page errors or document-level horizontal overflow at the captured sizes. The route E2E additionally checks all its configured viewports against the first-viewport card, upload columns, three stage links, eight workflow nodes, closed disclosures, current-task ordering, keyboard history access, advanced-control focus, reduced motion and file selection feedback. The first input itself starts at y≈799/779/809 px for desktop/tablet/phone after the change.

## Commands and results

Executed from this worktree unless stated otherwise. `CODEX_E2E_PLAYWRIGHT=file:///C:/Users/hanxq/AppData/Local/Temp/flavor-phase4-playwright/node_modules/playwright/index.mjs`; `CODEX_E2E_PYTHON=D:\Apps\Python313\python.exe`; `PUBLIC_SPECTRUM_INDEX_AUTO_INSTALL=false` were set for the applicable local browser runs.

| Check | Command | Actual result |
| --- | --- | --- |
| Frontend tests | `pnpm -C frontend run test:book-search`, `test:platform`, `test:search-workbench`, `test:static-routes`, `test:shimadzu`, `test:shimadzu-browser`, `test:analysis` | 23+33+74+3+6+122+104 = **365/365** passed |
| Python API | `python -m unittest scripts.tests.test_shimadzu_analysis_service scripts.tests.test_shimadzu_proxy -q` | **15/15** passed |
| R scientific regression | `R_LIBS_USER=E:\codex\Projects\FlavorThresholdDB\_local\analysis-r-library`; `D:\R-4.6.0\bin\Rscript.exe services/analysis/tests/{test_methods,test_reference_values,test_supervised,test_supervised_resource_limits,test_ropls_published_reference}.R` | All five scripts exited 0; no algorithm changed |
| Processing route | `CODEX_E2E_SCOPE=routes CODEX_E2E_ROUTE=processing pnpm -C frontend run test:e2e:platform` | Passed after layout and GSAP changes across configured viewports |
| Real Worker feedback | `pnpm -C frontend run test:e2e:processing-feedback` | Desktop seven-stage completion and mobile malformed-workbook failure passed |
| Full release browser E2E | `pnpm -C frontend run test:e2e` | Final rerun exited 0; earlier attempts failed as explained below |
| Static/build | `pnpm -C frontend run lint`; `pnpm -C frontend run build`; `git diff --check` | All exited 0. Existing RDKit direct-eval and large-chunk build warnings remain. |

The first full E2E attempt could not start the proxy because its default `D:\Apps\python\python.exe` was absent. After setting `CODEX_E2E_PYTHON`, the next attempt timed out on an external spectrum mirror (`.mirror-spectrum-plot`) and the local proxy logged aborted connections. The following rerun passed, with no failed browser requests in its final report. This external provider remains a source of test instability. Logs are preserved locally in ignored `_local/full-e2e.log` and `_local/full-e2e-retry.log`.

Production build's processing-page JavaScript asset measured 198,980 bytes in the prior worktree snapshot and 158,235 bytes here (uncompressed); removing broad ScrollTrigger behavior is the main change. This is a bundle-size spot check, not a full loading-performance benchmark.

## Review, limitations and rollback

The implementing agent reviewed correctness, keyboard behavior, code structure, input validation, security and animation cost using `agent-skills:code-review-and-quality`; this is **not** an independent agent review. Browser checks exercised real Worker completion/failure, and the source diff contains no Worker or scientific-computation edits. The screenshots are visual evidence, not an automated accessibility or pixel-perfect audit. External spectrum availability can make the full release E2E flaky. No remote CI or production deployment was performed for this branch.

The work is split into three local commits in order: first-view/configuration, uploads/monitoring, then animation/responsive closeout. To roll back the whole feature without touching other worktrees, revert those three commits in reverse order on this branch, or discard the isolated worktree after preserving its branch and screenshots. Do not reset the original checkout.
