# Shimadzu Hybrid Research Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reorganize the Shimadzu GC-MS page into a hybrid research workbench while preserving all existing analysis, task, auth, history, and download behavior.

**Architecture:** Keep the existing `ShimadzuAnalysisPage` state and worker-facing callbacks. Move the existing workflow render into a compact dock below the header, replace the idle monitor with a readiness strip, and add small presentation-only components for job summaries, workspace tabs, and an optional collapsed stage rail. Use CSS media queries for the desktop/tablet/mobile topology; no new dependencies or data contracts.

**Tech Stack:** React 19, existing GSAP/useGSAP, CSS custom properties, Node test runner, Playwright E2E.

---

### Task 1: Lock the hybrid UI contract with tests

**Files:**
- Modify: `frontend/src/components/shimadzu/ShimadzuAnalysisPage.layout.test.mjs`
- Modify: `scripts/e2e/verify_shimadzu_workbench.mjs`

- [ ] Add source assertions for `hybrid-research-workbench-v3`, `shimadzu-workflow-dock`, `shimadzu-readiness-strip`, `shimadzu-stage-rail`, `shimadzu-workspace-tabs`, and `LiveMonitor` being conditional on `job`.
- [ ] Add assertions that the existing settings, readiness feedback, account/history controls, and seven workflow nodes remain present.
- [ ] Update the E2E revision assertion and idle-state check so it expects the readiness strip instead of a monitor before a job exists; retain the running-job monitor assertions.
- [ ] Run the focused layout test and verify it fails on the missing new UI markers before implementation.

### Task 2: Restructure the presentation-only JSX

**Files:**
- Modify: `frontend/src/components/shimadzu/ShimadzuAnalysisPage.jsx`

- [ ] Add `AnalysisReadinessStrip` that reports validated `.xlsx`, size limit, browser worker readiness, and waiting/missing-file state without inventing counts.
- [ ] Add `AnalysisSummary` that maps only existing `job.stages[*].counts` keys into compact metrics; render nothing for missing values.
- [ ] Add `WorkspaceTabs` with `Overview`, `Stages`, and `Logs` presentation tabs; keep Overview selected and do not fabricate Results content.
- [ ] Add `StageRail` rendered only when `job` exists, with collapsed default, an accessible toggle, and the same `WORKFLOW`/`StageMark` statuses.
- [ ] Move `<WorkflowMap job={job} />` directly below the account/header content so it is the single workflow dock; do not duplicate it after setup/job content.
- [ ] Replace the idle `<LiveMonitor job={null} ... />` with `AnalysisReadinessStrip`; retain the existing monitor render inside the job workspace.
- [ ] Add `Job Command Bar`/stage rail hooks without changing event handlers, Worker messages, task persistence, or API calls.
- [ ] Set `data-ui-revision="hybrid-research-workbench-v3"` and preserve `data-motion`, ARIA, `aria-live`, and keyboard order.

### Task 3: Apply the hybrid visual system and responsive layout

**Files:**
- Modify: `frontend/src/components/shimadzu/ShimadzuAnalysisPage.css`

- [ ] Reduce the header/hero to the compact 92–120px workbench header and keep the browser engine status visible.
- [ ] Style the workflow as a sticky compact horizontal dock on desktop, with state colors and no oversized cards; use horizontal scrolling at tablet/mobile widths.
- [ ] Make idle setup a research workspace with the input region and 340px settings column; style readiness as a light strip rather than dark monitor.
- [ ] Style running job command controls, summary metrics, workspace tabs, and collapsed/expanded stage rail using existing cold blue/graphite tokens.
- [ ] Keep the dark graphite treatment limited to the monitor/console and preserve warning/danger/success semantics.
- [ ] Add breakpoints for 1440/1024/768/375 behavior, prevent page horizontal overflow, and preserve 44px controls.
- [ ] Keep reduced-motion rules and use only short transitions for rail/tabs/state changes.

### Task 4: Verify visual contract and full regression

**Files:**
- Modify: `frontend/src/components/shimadzu/ShimadzuAnalysisPage.layout.test.mjs` only if a verified selector needs correction.

- [ ] Run `pnpm exec node --test src/components/shimadzu/ShimadzuAnalysisPage.layout.test.mjs` and the focused E2E source checks.
- [ ] Run `pnpm run lint`.
- [ ] Run `pnpm run test:shimadzu`.
- [ ] Run `pnpm run test:shimadzu-browser`.
- [ ] Run `pnpm run build`.
- [ ] Run `pnpm run test:e2e` when the local Playwright fixture and browser dependencies are available; record a blocked dependency rather than changing analysis code if unavailable.
- [ ] Run `node E:/codex/codex-personal-skills/impeccable/scripts/detect.mjs --json frontend/src/components/shimadzu/ShimadzuAnalysisPage.jsx frontend/src/components/shimadzu/ShimadzuAnalysisPage.css` and resolve unexplained findings.
- [ ] Merge the verified branch into local `main`, preserve the pre-existing `fema_flavor_cache.json` change, restart the local runtime, and verify the Shimadzu URL returns HTTP 200.
