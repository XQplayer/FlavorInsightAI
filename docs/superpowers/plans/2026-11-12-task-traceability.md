# Unified Task Traceability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consistently identify each processing run and its derived analysis using a timestamp-based task number plus task name.

**Architecture:** Add a shared public identity beside the existing UUID. Persist in existing JSON metadata, thread through worker messages and hash-covered archives, and use one filename formatter for browser and cloud downloads. Preserve archive-derived identity on downstream analysis import.

**Tech Stack:** Existing React, browser Web Crypto/IndexedDB, Web Worker, Supabase JSON fields, JSZip, Node tests and Playwright; no new packages.

**Spec:** `docs/superpowers/specs/2026-11-12-task-traceability-design.md`

## Global Constraints

- Version stays 1.5.0. No production deploy, database migration or raw data changes.
- Public number `FI-YYYYMMDD-HHmmss-XXXXXX`; UTC+08:00; six cryptographically random uppercase hexadecimal characters.
- UUID remains primary key; restore retains identity; explicit rerun creates new identity with parent linkage.
- Metadata additions preserve existing manifest/run schema markers and regenerate affected hashes.
- Main checkout has user changes: use isolated worktree based on b3be4c7.

## Review Focus

- Date crosses midnight/year in UTC+8: helper test fixes exact expected number.
- Same-second starts and retries: helper and browser tests ensure distinct numbers and retained parent.
- Old cloud jobs and archives: cloud/download/import tests require legacy compatibility without invented numbers.
- Failure/cancellation before first stage: pipeline tests require readable identity and matching filename even without stage manifests.
- Non-ASCII/unsafe/long names: helper and mobile/browser tests require original name preserved and bounded safe filename.

### Task 1: Shared identity and persistence contract

**Files:** Create `frontend/src/lib/taskIdentity.mjs` and `taskIdentity.test.mjs`; modify `frontend/src/lib/shimadzuTaskStore.js`, `shimadzuCloud.js` and their tests only as needed.

**Interfaces:** `createTaskIdentity({name, now, parent})` returns `{taskNumber, taskName, taskCreatedAt, parentTaskId, parentTaskNumber}`; `taskIdentity(record)` normalizes browser/cloud/archive identity without inventing it; `taskLabel(record)` returns public number plus name or a legacy label; `taskArchiveFileName(record, status)` sanitizes names and selects the approved suffix. Crypto may be injected in tests but production must use Web Crypto.

- [ ] Add failing helper tests for timestamp boundaries, randomness, parent, sanitization and legacy shapes; run `node --test src/lib/taskIdentity.test.mjs`.
- [ ] Implement the helper; test round-trip identity persistence through browser storage and cloud `source_names.taskIdentity`. Extend signed URL helper with optional download filename; preserve other callers.
- [ ] Run helper, task store and cloud tests; inspect diff and commit scoped files.

### Task 2: Worker identity and verifiable ZIPs

**Files:** `frontend/src/lib/shimadzuWorkerClient.js`, `frontend/src/workers/shimadzu.worker.js`, `shimadzuPipeline.js` and their tests.

**Interfaces:** Optional `taskIdentity` on worker run/start; include in pipeline parameters and all terminal results. Pipeline and UI both use `taskArchiveFileName(record, status)`; missing identity preserves legacy compatibility.

- [ ] Add failing complete/failure/cancel tests asserting identical identity across ZIP task information, parameters, run documents, manifests and filenames; verify regenerated hashes with the existing importer.
- [ ] Thread identity through messages and archive builders without altering numerical tables or gate rules. Ensure early failures and cancellation have identity.
- [ ] Run `pnpm run test:shimadzu-browser`, compare scientific regression outputs, inspect and commit.

### Task 3: Creation, rerun, displays and cloud downloads

**Files:** `frontend/src/components/shimadzu/ShimadzuAnalysisPage.jsx`, associated layout/model tests, relevant processing workspace models/CSS only where necessary; `scripts/e2e/verify_processing_feedback.mjs` or new focused traceability E2E.

**Interfaces:** Creation calls `createTaskIdentity` once, freezes name, persists before run. Explicit retry creates a new UUID/public identity with parent fields, resets stages/terminal artifacts and starts from 0. Restore passes stored fields unchanged. All displays and downloads normalize via the shared helper; cloud downloads use a server-specified signed download filename.

- [ ] Add failing lifecycle tests: start, restore, language change, rerun and historical cloud download. Pin no new UUID/number on restore and new identity on rerun.
- [ ] Implement lifecycle/persistence and number/name/parent displays across monitor, results and task history; preserve existing routes and account gates.
- [ ] Verify desktop/mobile (390px), long names, keyboard, result/failure/cancel downloads and rerun parent association; inspect and commit.

### Task 4: Downstream provenance and final integration

**Files:** `frontend/src/analysis/shimadzuAdapter.mjs`, `archiveImport.mjs`, `handoff.mjs`, existing export/provenance modules as identified by trace; corresponding tests; README and verification report.

**Interfaces:** Import identity only from integrity-verified archive metadata into dataset provenance. Derived analysis exports include origin task identity and retain dataset-specific identity. Legacy imports without identity still work.

- [ ] Add failing tests for complete archive handoff, analysis export lineage, legacy imports and tampered metadata/hash rejection.
- [ ] Implement origin identity propagation using existing provenance/export mechanisms; no statistical or scientific behavior changes.
- [ ] Run `pnpm run test:shimadzu-browser`, `pnpm run test:analysis`, `pnpm run test:platform`, `pnpm run lint`, `pnpm run build`, focused browser E2E and `git diff --check`.
- [ ] Perform serial second-pass review and record tests actually run, any gaps and rollback to b3be4c7 by reverting feature commits. Verify a reachable preview serves this worktree/build and report its URL; do not push or deploy.

## Plan self-review

The shared identity is additive, avoids production schema changes and leaves UUID ownership untouched. Tasks cover all approved naming and tracing rules, including cloud downloads and subsequent analysis. Statistical formulas and raw research inputs are out of scope. Execution approach awaits user review per the planning skill; native execution is recommended because these steps share a small identity contract and this task does not require parallel agents.
