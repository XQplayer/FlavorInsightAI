# Shimadzu CV Screening Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Shimadzu CV filtering opt-in with a user-controlled threshold while preserving Mean, SD, CV statistics and traceable output when filtering is disabled.

**Architecture:** Keep the existing V2 statistics algorithm as the single source of truth. Add an explicit `enableCvScreening` option beside `cvThreshold`, pass both values through the worker boundary, and persist them in the browser task and cloud job source metadata. The page exposes a checkbox and validated decimal-compatible number input; stage 5 always calculates statistics but only mutates post-screening tables when the checkbox is enabled.

**Tech Stack:** React, Web Worker, ES modules, Node test runner, JSZip, existing Shimadzu V2 core and Supabase job metadata.

---

### Task 1: Make the statistics core support opt-in screening

**Files:**
- Modify: `frontend/src/shimadzu-core/v2-statistics-stage.mjs`
- Test: `frontend/src/shimadzu-core/coreParity.test.mjs`

- [ ] **Step 1: Write failing tests for disabled and custom-threshold behavior**

Add two `processV2Statistics` cases: one with `enableCvScreening: false` and CV 40 that asserts `cvScreeningExecuted === false`, `cvReport.length === 0`, and the post-screening concentration/Mean+SD rows equal the pre-screening rows; another with `enableCvScreening: true`, `cvThreshold: 20` and CV 30 that asserts the group is filtered and the report records threshold 20.

- [ ] **Step 2: Run the focused core test and verify RED**

Run from `frontend`:

```powershell
$env:PATH='C:\Users\hanxq\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;'+$env:PATH
pnpm exec node --test src/shimadzu-core/coreParity.test.mjs
```

Expected failure: the new option and `cvScreeningExecuted` output are not implemented.

- [ ] **Step 3: Implement the minimal option-aware statistics behavior**

Change the function signature to `processV2Statistics({ stage4Data, cvThreshold = 30, enableCvScreening = true })`, validate the boolean, and compute Mean/SD/CV for every group. When enabled, apply the existing threshold comparison and set filtered post rows; when disabled, copy pre rows to post rows and use `CV_Screening_Not_Executed` as the group status. Return `cvScreeningExecuted` and retain `cvThreshold` in the result. Use threshold-neutral retained/filtered status names so custom values are not mislabeled.

- [ ] **Step 4: Run the focused core test and verify GREEN**

Run the same command; all core parity tests must pass, including the existing boundary case after updating its expected status to the threshold-neutral name.

- [ ] **Step 5: Commit the core change**

```powershell
git add frontend/src/shimadzu-core/v2-statistics-stage.mjs frontend/src/shimadzu-core/coreParity.test.mjs
git commit -m "feat: make Shimadzu CV screening optional"
```

### Task 2: Pass CV settings through the browser pipeline and outputs

**Files:**
- Modify: `frontend/src/workers/shimadzuPipeline.js`
- Modify: `frontend/src/workers/shimadzu.worker.js`
- Modify: `frontend/src/lib/shimadzuWorkerClient.js`
- Test: `frontend/src/workers/shimadzuPipeline.test.mjs`
- Test: `frontend/src/lib/shimadzuWorkerClient.test.mjs`

- [ ] **Step 1: Write failing pipeline and client tests**

Add a pipeline test that calls `runShimadzuBrowserPipeline` with `enableCvScreening: false` and `cvThreshold: 12.5`, then reads stage 5 `data.json` from the ZIP and asserts the stored settings and `cvScreeningExecuted: false`. Add a worker-client test that emits a start request and asserts the posted message includes both settings.

- [ ] **Step 2: Run the focused tests and verify RED**

```powershell
$env:PATH='C:\Users\hanxq\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;'+$env:PATH
pnpm exec node --test src/workers/shimadzuPipeline.test.mjs src/lib/shimadzuWorkerClient.test.mjs
```

Expected failure: the current client does not send CV settings and stage 5 always hard-codes 30.

- [ ] **Step 3: Implement parameter propagation and output labeling**

Extend `createShimadzuWorkerClient.run` and the worker start message with `enableCvScreening` and `cvThreshold`. Extend `runShimadzuBrowserPipeline` with backward-compatible defaults `enableCvScreening = true` and `cvThreshold = 30`, pass them into stage 5, and include them in stage 5 data. Update stage 5 QC rows and output workbook names/sheet labels to distinguish `CV30筛选后`, custom `CV12.5筛选后`, and `CV筛查未执行`. Keep existing direct pipeline tests’ default output compatible by leaving the pipeline default enabled.

- [ ] **Step 4: Run focused pipeline/client tests and verify GREEN**

Run:

```powershell
$env:PATH='C:\Users\hanxq\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;'+$env:PATH
pnpm exec node --test src/workers/shimadzuPipeline.test.mjs src/lib/shimadzuWorkerClient.test.mjs
```

The new opt-out and propagation assertions plus existing archive tests must pass.

- [ ] **Step 5: Commit the pipeline change**

```powershell
git add frontend/src/workers/shimadzuPipeline.js frontend/src/workers/shimadzu.worker.js frontend/src/lib/shimadzuWorkerClient.js frontend/src/workers/shimadzuPipeline.test.mjs frontend/src/lib/shimadzuWorkerClient.test.mjs
git commit -m "feat: propagate Shimadzu CV screening settings"
```

### Task 3: Add the pre-analysis UI setting and task persistence

**Files:**
- Modify: `frontend/src/components/shimadzu/ShimadzuAnalysisPage.jsx`
- Modify: `frontend/src/components/shimadzu/ShimadzuAnalysisPage.css`
- Test: `frontend/src/components/shimadzu/ShimadzuAnalysisPage.layout.test.mjs`
- Test: `frontend/src/lib/shimadzuTaskStore.test.mjs`

- [ ] **Step 1: Write failing UI and persistence tests**

Add static assertions for the default-off checkbox, `CV 阈值 (%)`, `min="0"`, `max="1000"`, `step="1"`, and the task run call carrying both settings. Add a task-store test that saves and reloads `enableCvScreening` and a decimal `cvThreshold` unchanged.

- [ ] **Step 2: Run focused UI/store tests and verify RED**

```powershell
$env:PATH='C:\Users\hanxq\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;'+$env:PATH
pnpm exec node --test src/components/shimadzu/ShimadzuAnalysisPage.layout.test.mjs src/lib/shimadzuTaskStore.test.mjs
```

Expected failure: the page has no CV controls or task configuration fields.

- [ ] **Step 3: Implement the settings block and validation**

Add `enableCvScreening` state defaulting to `false` and string-backed `cvThreshold` state defaulting to `'30'` so blank/decimal typing remains possible. Add a checkbox and disabled-unless-enabled number input in the existing run settings area. Validate enabled thresholds as finite numbers in `[0, 1000]`; include the validation message in `startFeedback` and block `canStart` when invalid. Save normalized settings on each new task, include them in `cloud.createJob(...sourceNames)`, restore them from old/new tasks, and pass them to the worker client. For tasks without these fields, use the compatibility defaults `true` and `30`. Update stage 5 descriptions to say CV screening follows the setting and add compact CSS for the fieldset/help text without changing existing layout behavior.

- [ ] **Step 4: Run focused UI/store tests and verify GREEN**

Run the same command; all existing layout assertions and the new settings assertions must pass.

- [ ] **Step 5: Commit the page change**

```powershell
git add frontend/src/components/shimadzu/ShimadzuAnalysisPage.jsx frontend/src/components/shimadzu/ShimadzuAnalysisPage.css frontend/src/components/shimadzu/ShimadzuAnalysisPage.layout.test.mjs frontend/src/lib/shimadzuTaskStore.test.mjs
git commit -m "feat: add Shimadzu CV screening controls"
```

### Task 4: Full regression, documentation, and integration

**Files:**
- Modify: `docs/superpowers/specs/2026-08-08-shimadzu-cv-screening-toggle-design.md` if any implementation wording needs alignment

- [ ] **Step 1: Run the complete Shimadzu verification set**

```powershell
$env:PATH='C:\Users\hanxq\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;'+$env:PATH
pnpm run lint
pnpm run test:shimadzu
pnpm run test:shimadzu-browser
pnpm run build
```

Expected: lint passes, all Node tests pass, and Vite build completes. Existing build warnings from third-party RDKit/3Dmol bundles are acceptable if no new errors appear.

- [ ] **Step 2: Review output semantics**

Confirm the default UI path produces Mean/SD/CV with `CV_Screening_Executed = false`, while an enabled custom threshold produces filtered Stage 5/6 outputs and a report using that exact threshold. Confirm old direct pipeline calls remain compatible through the `true/30` API defaults.

- [ ] **Step 3: Commit any documentation alignment and inspect the diff**

```powershell
git diff --check
git status -sb
git log --oneline -5
```

Only the CV feature worktree files may be committed; the main checkout’s unrelated `fema_flavor_cache.json` remains untouched.
