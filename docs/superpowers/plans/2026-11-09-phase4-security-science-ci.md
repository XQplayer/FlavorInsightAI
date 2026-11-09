# Phase 4 Security, Science and CI Implementation Plan

> **For agentic workers:** Use the existing isolated worktree and follow the project `AGENTS.md`; execute each task with a test and review before committing.

**Goal:** Resolve the reachable workbook parser risk where safe, increase independent OPLS-DA evidence, and distinguish local from remote CI acceptance.

**Architecture:** Keep the seven-stage Worker and research formulas unchanged. Freeze import/export behavior before a dependency change, then evaluate the official patched SheetJS distribution against ExcelJS and alternatives. Run R in an isolated library. Commit reports and tests on `codex/ai-development-phase4`; never push or create a PR without authorization.

**Tech Stack:** React/Vite, pnpm 11, Node 22 in CI, Python stdlib tests, R/ropls, GitHub Actions.

**Spec:** User phase 4 request in this conversation; prior phase reports under `docs/ai-development/`.

## Global constraints

- Preserve original worktree changes and commits `a1aa947`, `650688c`, `9f1cb61`.
- Use only synthetic or approved reference data in CI; do not change original research files, scientific formulas or seven-stage processing semantics.
- Treat `pnpm audit --prod` failure, missing `ropls`, browser E2E gaps and missing remote run as distinct gate failures.
- No remote push, PR or production deployment without explicit authorization.

## Review focus

1. Formula cells with and without cached values must not be evaluated or silently replaced.
2. Excel date-formatted CAS cells must preserve source-row recovery behavior.
3. Malformed ZIP entries, traversal and oversized content must fail before parsing.
4. Workbook exports must remain reopenable with zero/NA, numeric formats, sheet names and no injected formula.
5. Supervised model validation must report held-out and permutation evidence without treating fit separation as generalization.

### Task 1: Freeze Excel behavior and compare parsers

**Files:** `frontend/src/analysis/imports.test.mjs`, relevant existing Worker tests; `docs/ai-development/XLSX_SECURITY_REMEDIATION.md`.

- [x] Add representative synthetic import tests and reject malformed archive cases.
- [x] Run focused tests before changing dependency and record count.
- [x] Compare official patched SheetJS package, ExcelJS and xlsx-populate using published metadata, browser support, size and migration cost; controlled parse-speed benchmark remains open.
- [x] Change only the selected dependency in the isolated branch; run focused tests, full frontend, audit and build. Full release browser E2E remains open.

### Task 2: Validate supervised science without changing formulas

**Files:** `services/analysis/tests/` reference tests; `docs/ai-development/OPLSDA_REFERENCE_VALIDATION.md`.

- [x] Create isolated R library and record the trusted Bioconductor source and `ropls` version.
- [x] Run existing supervised tests; add the published external ropls reference and small-n diagnostic. A small external OPLS-DA oracle remains open.
- [x] Record R²/Q² definitions, component orientation, scaling, CV/permutation settings, sample-size warnings and unresolved claims.

### Task 3: Verify scientific Skill behavior

**Files:** `docs/ai-development/SCIENTIFIC_SKILLS_BEHAVIOR.md`.

- [x] Send synthetic project-context tasks to fresh agent sessions, save exact skill-read commands and observed decisions.
- [x] Test all five, combined routing and unavailable-skill fallback; mark automatic dispatcher telemetry unverified.

### Task 4: Final gates and handoff

**Files:** six phase 4 reports under `docs/ai-development/`; existing gate matrix if needed.

- [x] Run seven frontend scripts, Python API, R references, browser E2E, lint, build and final audit; record the full-browser failure.
- [x] Check remote branch/PR/run read-only. Leave remote acceptance incomplete without authorization.
- [x] Review final diff, verify unchanged tracked research/Worker paths, commit locally, record rollback and clean worktree. External source-file hashes were not recomputed.
