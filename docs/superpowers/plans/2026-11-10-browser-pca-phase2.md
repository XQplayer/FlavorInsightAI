# Browser PCA phase 2 implementation plan

**Goal:** Make the production build auditable for GitHub Pages and establish a versioned PCA result and browser-side Agent adapter without deploying or changing the production database.

**Architecture:** Preserve the existing Worker/SVD result internally, normalize its output at the export/adapter boundary, and keep model planning separate from user-authorized browser execution. Design IndexedDB/cloud persistence now; implement cloud or restore only in a later approved stage.

**Tech stack:** React/Vite, module Web Worker, Node test runner, Playwright Chrome, JSON.

**Spec:** User's “Browser PCA 第二阶段” request, 2026-11-10.

## Constraints and acceptance

- Branch remains `codex/browser-pca`; no push, PR change, Pages deployment, production database migration, real research data upload, or unrelated dependency upgrade.
- `frontend/src/pages/LocalAnalysisWorkbench.jsx` and scientific `runBrowserPca` calculations remain unchanged.
- Browser and Hosted PCA use the same documented JSON envelope, with engine and execution environment provenance distinct; all numeric arrays are finite or validation fails.
- Gateway may propose a plan; only a UI confirmation may authorize a browser Worker run. The model never supplies PCA scores/loadings.
- Browser result exports use the common protocol and retain the source hash, parameter set and result version.

## Steps

- [x] Audit Pages base, route, build asset URL, import/export limits and current public release; record evidence and unresolved online/browser checks.
- [x] Write protocol tests for Browser conversion, shape/finite validation, source provenance and JSON export compatibility; verify they fail before implementation.
- [x] Implement `frontend/src/analysis/pcaResult.mjs` and update Browser PCA JSON export to the common envelope.
- [x] Write adapter tests for inspection, plan validation, user-confirmation gate, Worker cancellation, result lookup and bounded explanation; verify failures before implementation.
- [x] Implement `frontend/src/analysis/browserAnalysisAdapter.mjs` without adding direct model/secret or server access to the Worker.
- [x] Document Hosted adapter boundary, Gateway plan contract and IndexedDB/export/optional Supabase persistence design.
- [x] Verify local production build under Pages subpath, full affected frontend suite, browser E2E, lint, build, dependency audit, `git diff --check`, and source-preservation hashes. Record unavailable remote/multi-browser tests accurately.

## Review focus

- A plan for one dataset cannot be run against another or after a replacement.
- User confirmation cannot be supplied by a model tool argument.
- Unsupported/NaN/Infinity result shapes must not be exported as trustworthy JSON.
- A failed or cancelled Worker must leave no success result.
- Unknown units or source hashes must be marked unknown, not invented.

## Rollback

Revert the phase-2 commit on this branch; no database or deployed state is touched.
