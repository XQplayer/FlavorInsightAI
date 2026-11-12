# Browser PCA Phase 4 Integration Plan

> **For agentic workers:** Use the existing Superpowers execution workflow. This task is executed serially; no independent agent review is claimed.

**Goal:** Prepare a reviewable Browser PCA release candidate, verify the available online paths, and close the local AI opt-out gap without changing the PCA algorithm or production services.

**Architecture:** Keep numeric data, Worker execution and IndexedDB in the browser. The authenticated Gateway receives only bounded inspection or validated result facts after user action. Treat the current Pages preview as synthetic-only until it has a distinct browser origin.

**Tech Stack:** React, Vite, Web Worker, IndexedDB, Python Gateway, Responses API, Playwright, GitHub Pages.

**Spec:** Browser PCA Phase 4 user request, `docs/ai-development/BROWSER_ANALYSIS_ADAPTER.md`, and `AGENTS.md`.

## Tasks

- [x] Audit `origin/main`, Browser PCA, PR #24, PR #25, Mermaid discovery, and the actual deploy trigger. Produce ancestry and changed-file evidence before integration decisions.
- [x] Add a user-controlled AI analysis switch on `BrowserPcaPage.jsx`. A disabled switch prevents model requests and clears any pending plan or explanation while leaving local PCA available. The browser regression test failed on the absent switch before implementation.
- [x] Check the public Render health and AI routes without reading secrets; distinguish reachable HTTP results from transport failures. Both probes returned HTTP 000 timeout; source review is recorded separately from online status.
- [x] Inspect preview origin, storage and service-worker boundaries using synthetic canaries. Preserve the synthetic-only warning until a distinct origin is available.
- [x] Run available Chrome/Edge, focused Agent, frontend/Python, build, audit and diff checks. Firefox/WebKit installation stalled twice; their tests are explicitly unverified in the cross-browser report.
- [x] Deliver integration/security audit, PR order and file-conflict matrix, Render variable-name checklist, online acceptance evidence, and release/rollback gate. No formal merge, production deploy, migration or paid resource creation.

## Review focus

- A disabled AI switch must prevent a request even when a prior plan is visible.
- A late model response must not repopulate the plan after the user turns AI off.
- Failed model calls must leave the completed local PCA result and exports intact.
- Preview code must not acquire a production auth session through shared-origin storage.
- A future merge to `main` must account for automatic GitHub Pages and Render deployment.
