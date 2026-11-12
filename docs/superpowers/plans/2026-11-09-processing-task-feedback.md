# Processing task feedback implementation plan

**Goal:** Make the existing Shimadzu processing page explain waiting, running, success and failure from real task state, with accessible feedback and no computation change.

**Architecture:** Derive short bilingual messages from the existing job object in one pure UI helper. Render the message and progress semantics in the existing task bar, and improve failed-task next-step guidance. Preserve worker events, Stage 0–6 computation, persistence and API calls.

**Tech stack:** React 19, Vite, Node `node:test`, existing CSS and Playwright E2E scripts.

**Acceptance:** queued/created, running, saving, complete, failed, cancelled/interrupted and review states have accurate text; failure shows reason and useful next action; status changes are announced without fake timers; layout works at 390px and desktop; seven-stage tests and build pass.

## Tasks

- [x] Record baseline focused tests and current rendering behavior.
- [x] Write failing pure tests for status feedback, including unknown status and failure guidance.
- [x] Implement pure status feedback helper; run red/green tests.
- [x] Write failing integration/layout contract for live region, progressbar and announcements; update JSX/CSS; verify.
- [x] Run affected unit, browser, lint and build checks; record any environmental gaps.
- [x] Review diff for worker/algorithm boundaries, accessibility, responsiveness and rollback; write phase-two reports.

## Boundaries

No raw workbook, formula, stage algorithm, sample name, database, auth setting or production deployment change. No extra timing logic. Existing task state remains the source of truth.
