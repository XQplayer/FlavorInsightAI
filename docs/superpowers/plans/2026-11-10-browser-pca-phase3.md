# Browser PCA Phase 3 Implementation Plan

> For agentic workers: follow the existing Superpowers workflow. Steps use checkboxes for evidence; this run uses a serial implementation and self-review.

**Goal:** Run Browser PCA on an isolated online preview and connect its browser Worker to a consent-gated Agents SAI flow with local recovery.

**Architecture:** The browser owns the dataset, Worker, charts, and IndexedDB. The Gateway receives only an approved inspection summary or bounded validated result facts; it returns a structured plan or explanation and never executes browser code. A separate Pages repository serves the preview artifact without affecting the formal site.

**Tech Stack:** React, Vite, Web Worker, IndexedDB, Python Gateway, Responses API, Playwright.

**Spec:** User's Browser PCA Phase 3 request and `docs/ai-development/BROWSER_ANALYSIS_ADAPTER.md`.

## Tasks

- [x] Audit Git ancestry, production deployment trigger, and isolate the preview target before code changes.
- [x] Add versioned local run archive with dataset snapshot, validated result, owner namespace, hash, restore, delete, rerun, and JSON export; failing contract tests preceded implementation.
- [x] Add Gateway plan and explanation endpoints with auth, limits, strict schemas, no raw matrix, and mock/live tests.
- [x] Wire the existing adapter to the Browser PCA page with user confirmation for compute and separate confirmation for sharing bounded facts.
- [x] Build the preview artifact under its own base and run local production-build E2E.
- [x] Publish to an isolated Pages address, run real online E2E with synthetic data, collect screenshots and Worker URL/status. See `docs/ai-development/BROWSER_PCA_PHASE3_TEST_REPORT.md`.
- [x] Run affected unit/API/browser/security checks and serial code review; record gaps and rollback in the final report.
