# FlavorInsight AI Analysis Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkboxes for tracking.

**Goal:** Implement the approved local results, statistical analysis, evidence and reference-tool workflow without modifying Shimadzu calculations.

**Architecture:** React maintains immutable samples-by-features snapshots and recipes. A separate loopback-only service dispatches allowlisted JSON tasks to R 4.6.0, with a token, exact origins, size limits and cancellation. Existing proxy and Shimadzu workers remain independent. Optional model credentials are server-side; no cloud transmission by default.

**Tech Stack:** Existing React/Vite, SheetJS, JSZip, IndexedDB; Python standard-library HTTP service; R stats/jsonlite/ropls; SVG plots.

## Contract

Snapshot v1: `{schemaVersion:1,id,name,samples:[{id,name,group,biologicalUnitId,subjectId,batch,include}],features:[{id,name,cas,unit,isInternalStandard}],matrix:number|null[][],quality,provenance}`. Repeated names/CAS never merge silently. JSON nonfinite values are null. Source snapshots remain immutable. Inference needs confirmed independent units, aggregates declared technical repeats and excludes pre-imputed/QC cells. Runs bind snapshot/recipe/group versions.

## Task 1 — Data contracts, safe imports, storage and handoff

Completed core contracts at `2859daf`: 19 tests, spec/quality review approved; real Chromium IndexedDB save/list/reload/load/remove passed. Direct UI action is integrated in Task 3. HD archive read-only validation: 18 samples × 124 features.

Files: `frontend/src/analysis/{dataset,imports,storage,exports,shimadzuAdapter}.mjs`, corresponding `*.test.mjs`; minimal handoff changes in existing Shimadzu page.

- [ ] Write tests for duplicate IDs, nonnumeric cells, numeric CAS not becoming measurements, explicit orientation, null preservation, safe ZIP paths/hash validation and incomplete-run rejection.
- [ ] Run `node --test frontend/src/analysis/*.test.mjs` and verify failures before implementation.
- [ ] Implement XLSX/CSV/TSV/paste preview and explicit sample-column/header selection; cached formula values only, bounded imports, stable feature IDs; editable grouping and immutable version helpers.
- [ ] Implement verified complete Shimadzu archive adapter selecting sample concentration output, retaining imputation/CV masks/internal-standard metadata. Direct handoff uses the same archive adapter so equivalence is testable.
- [ ] Implement IndexedDB project save/load and portable JSON export, safe CSV cells and CSV/XLSX result exports.
- [ ] Run focused tests, independently review spec then quality, commit only these files.

## Task 2 — Local R engine and task service

Execution split: Task 2A implements preprocessing, basic statistics and local task service; Task 2B implements the supervised wrapper against the reviewed fit/apply contract. Each receives independent spec and quality review.

Task 2A completed at `51c114e`: independent specification and quality reviews passed, all R suites passed and HTTP/CLI/lifecycle tests passed 15/15. Quality review added mixed-matrix inference gates, selected-contrast scoping and cancellation/history race regressions. User confirmed retaining the Python startup approach after providing the security-software deletion log for the earlier PS1; do not restore that script or alter security settings.

Task 2B implemented at `622bbce`, with API index corrected at `2e7ba5d`.
Independent specification and quality reviews passed: seven R test entry points
and 21 Python tests passed. The default-200 permutation benchmark completed all
200 permutations through the real HTTP service in approximately 65 seconds.
The non-blocking review suggestion for lightweight supervised budget-boundary
regressions was completed at `97e60a8`. The isolated Python preview service was started
and verified at port 8890, with a 1200-second job timeout; the original 5174/8787
services remain independent.

Files: `services/analysis/{server.py,engine.R,preprocess.R,statistics.R,supervised.R,requirements.md}`, `services/analysis/tests/`. Startup uses the shipped `server.py` Python CLI directly; no new PS1 launcher is required. The earlier missing-script incident remains documented in `requirements.md`, and the real CLI startup/health/shutdown path is regression-tested without changing HTTP security.

- [ ] Write real R reference tests: PCA eigenvalues/reconstruction, Welch p, BH, Pareto sample-SD, missing/log/constant errors, paired IDs, technical-unit handling and protected missing values.
- [ ] Implement validated fixed-order filtering/imputation (none/constant/median/half-min/KNN), normalization (none/sum/median/PQN/IS), transform and scaling. Keep observed inference separate from exploration.
- [ ] Implement PCA, heatmap distances/trees, two/multigroup tests with posthoc/effects/n/FC/FDR, correlation and distribution payloads.
- [ ] Implement ropls PLS-DA/OPLS-DA, training-fold preprocessing, grouped nested validation, seeded permutation and feasibility gates. Export fitted versus held-out results distinctly.
- [ ] Implement allowlisted loopback service with token/exact-origin/Host checks, queued jobs, timeout, cancellation and bounded JSON. No arbitrary code/path execution. Tests use real subprocesses plus malformed requests.
- [ ] Pin actual package versions and licenses, run numeric and service/security tests, independent spec/quality review and scoped commit.

## Task 3 — Research workbench UI and external directory

Execution split to keep reviews tractable: **3A** delivers the import/group/recipe/run workbench, persistence, service client and completed Shimadzu handoff, with honest raw result tables; **3B** adds the result visualizations, visual/table exports and curated external directory. Each split requires its own specification and quality review; raw-table completion alone is not the finished workbench.

Task 3A completed and independently reviewed through `85b51f5`: 47 analysis
tests passed; specification and quality review findings are closed. Corrections
include revision-aware save status, preprocessing freshness, complete paged
matrix values, bounded group controls, and fresh UI snapshot identities on
repeated archive imports/handoffs so existing run history is preserved. The
verified archive adapter remains unchanged. Real browser checks covered actual
basic and supervised service jobs, independence gates, HD archive exploration,
offline controls, cancellation, portable projects and immediate reload after
saving. Details and limitations are in `docs/analysis-workbench-browser-checks.md`.
Task 3B is in progress; graphs and local evidence queries are not yet complete.

Files: `frontend/src/pages/DataAnalysisPage.jsx`, `frontend/src/components/analysis/`, `frontend/src/analysis/client.mjs`, `frontend/src/styles/analysis.css`, `frontend/src/pages/ResourcesPage.jsx`, platform contracts.

- [ ] Add failing UI contracts for real import/group/preprocess/run controls and unavailable-service state.
- [ ] Implement bilingual accessible data/group editor, preprocessing controls, versioned run list, analysis settings, cancel/retry, diagnostics and evidence inspector. Never rerun on style changes.
- [ ] Render scores/loadings/scree/heatmap/volcano/box/correlation and supervised validation from real payloads; download SVG/PNG plus complete tables/recipe/methods and reproducible request/script.
- [ ] Connect completed Shimadzu handoff and portable snapshots; show stale runs after edits; preserve run errors without clearing source data.
- [ ] Integrate only seven curated public reference links from the audited catalogue, new-tab/no automatic upload/no iframe, retain verification limits.
- [ ] Run UI contracts, full frontend lint/build/regression tests, independent spec/quality review, scoped commit.

## Task 4 — Evidence assistant, reports and acceptance

User confirmed on 2026-10-23: complete local evidence queries first; model configuration is deferred. Do not implement or enable cloud model transmission in this delivery. Clearly label deterministic evidence lookup rather than AI generation.

Files: `frontend/src/analysis/evidence.mjs`, `frontend/src/components/analysis/EvidenceAssistant.jsx`, service optional assistant handler, `scripts/e2e/verify_analysis_workbench.mjs`, `docs/analysis-workbench.md`.

- [ ] Test summary/results/methods/feature references against run IDs; unknown claims return no evidence; no cross-project context.
- [ ] Implement deterministic local evidence lookup explicitly labelled as such. Model configuration remains deferred by the user's explicit choice; no credentials or cloud calls are needed.
- [ ] Add report composition with methods/limitations/data source and linked result tables. Public reference search uses generic terms only and user activation.
- [ ] Exercise real HD result archive read-only and a known synthetic independent-unit dataset; test import, PCA, heatmap, comparisons, PLS/OPLS, persistence, cancellation, export and offline/model-unconfigured behavior.
- [ ] Run complete automated checks and browser visual checks, final independent review. Document verified capabilities versus credentials/deployment prerequisites. Start isolated preview and local analysis service; do not push or bump versions.

## Completion boundary

No original experiment file edits, main dirty-file staging, production deployment, cloud data upload or GitHub push. R package installation is project-local. Remote AI live validation requires user-owned credentials and consent; never report it tested when absent. Server configuration and private bookmark inventory must not enter Git. Complete local functionality and report any remaining externally blocked feature explicitly.
