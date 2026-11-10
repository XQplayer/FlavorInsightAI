# Browser PCA phase 2 test report

Date: 2026-11-10. Branch: `codex/browser-pca`. This report is for **local** implementation and review. A real GitHub Pages Worker run, live Agents SAI plan generation and refresh recovery remain outside the implemented scope of this phase.

## Executed checks

| Check and command | Observed result |
| --- | --- |
| `cd frontend; node --test src/analysis/browserAnalysisAdapter.test.mjs src/analysis/pcaResult.test.mjs` | 7 passed, 0 failed. Tests were first run against deliberate `NOT_IMPLEMENTED` stubs and failed; then passed after implementation. Separate malformed nested numeric and variance-consistency cases failed before validator fixes, then passed. |
| `cd frontend; node --test` | Final run: 456 passed, 1 pre-existing skip, 0 failed (457 total), after the variance-consistency hardening. |
| `cd frontend; pnpm run lint` | Passed after the protocol/adapter implementation. |
| `cd frontend; pnpm run build` | Passed. Existing dependency warnings about 3Dmol `eval`, Node builtins and large chunks remain; they were not introduced by this change. |
| `cd frontend; pnpm audit --prod` | `No known vulnerabilities found` from pnpm. This registry advisory result does not certify the separate provenance of the existing CDN SheetJS tarball. |
| `python -m unittest scripts.tests.test_ai_gateway scripts.tests.test_ai_tools -q` | 31 passed. AI Gateway code was not changed. |
| `git diff --check` | Passed. |
| `git rev-parse HEAD:frontend/src/pages/LocalAnalysisWorkbench.jsx` compared with `git hash-object frontend/src/pages/LocalAnalysisWorkbench.jsx` | Equal: existing local R workbench source unchanged. |
| Local Pages-style production build: `pnpm exec vite preview --host 127.0.0.1 --port 5199 --strictPort` and `BROWSER_PCA_BASE_URL=http://127.0.0.1:5199/FlavorInsightAI/data-analysis/ node scripts/e2e/verify_browser_pca.mjs` | PASS in installed Chrome and Edge, each at desktop 1440, tablet 820 and mobile 390 px. Actual Worker paths recorded under `/FlavorInsightAI/assets/browserPca.worker-*.js`; 0 local compute API calls; 0 body overflow; four views; CSV/XLSX import, repeated calculation, missing-value failure/recovery and SVG/PNG/CSV/v1 JSON export verified. Browser screenshots and machine-readable output are in ignored `_local/browser-pca-phase2-chrome/` and `_local/browser-pca-phase2-edge/`. |

The E2E runner uses the checked-in synthetic fixture only and blocks the local compute API. Its repeated runs exercise a fresh synthetic calculation, CSV import, XLSX import and explicit missing-value recovery. Adapter unit tests separately exercise the structured plan, refusal before confirmation, confirmed Worker-compatible execution, bounded explanation facts, cancellation and stale plan rejection.

## Unverified or deferred

- **Real GitHub Pages Worker:** not run; current public analysis chunk does not include Browser PCA. A later authorized deployment is required before reporting an online pass or a deployment run ID.
- **Firefox, Safari/iOS, real mobile hardware:** not run. Chrome and Edge are Chromium-based; their success does not establish cross-engine compatibility.
- **Page refresh restore and persistent history:** design complete, implementation absent. Current result JSON is result-only and cannot recreate the source matrix for recomputation.
- **Live Agent/model flow:** the browser adapter interface and its local synthetic test passed, but no Gateway endpoint, chat-page orchestration, model call, user confirmation UI or actual model-to-browser handoff was added. No GPT response or tool dispatch success is claimed.
- **Hosted PCA:** only the common result validation boundary is defined. No hosted adapter or hosted numerical comparison was executed.

## Preservation and rollback

No GC-MS Worker, R workbench, scientific PCA core, production database, Render configuration, PR #24 or PR #25 was modified. The original local R workbench file remains intact. Revert the phase-2 branch commit to return to the first Browser PCA implementation; no remote or database rollback is needed for this local change.
