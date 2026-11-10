# Browser PCA GitHub Pages deployment audit

Date: 2026-11-10. Audited branch `codex/browser-pca`, base commit `ebdfcf0e26b6e4951914adeffea3556d8c7984cd`. No push or deployment was performed.

## Findings

| Boundary | Evidence | Status |
| --- | --- | --- |
| Repository and deployment | `git remote -v` points to `XQplayer/FlavorInsightAI`; `.github/workflows/deploy-pages.yml` deploys on `main` push or manual dispatch, with `pages: write` and `id-token: write`. Current Browser PCA commit is not contained by a local remote-tracking branch (`git branch -r --contains ebdfcf0`). | Deployment requires a later reviewed merge or authorized release operation. |
| Vite base and direct route | `frontend/vite.config.js` sets `base: '/FlavorInsightAI/'`; `frontend/scripts/create-static-routes.mjs` copies `dist/index.html` to `dist/data-analysis/index.html`. | Correct for the repository's Pages subpath. |
| Worker and dynamic import | `frontend/src/analysis/browserPcaEngine.mjs` constructs a module Worker with `new URL('../workers/browserPca.worker.mjs', import.meta.url)`. The built analysis chunk resolves it to `/FlavorInsightAI/assets/browserPca.worker-lmsVXb75.js` in this build; the lazy route is emitted as `DataAnalysisPage-*.js`. | Production build contains the required Worker chunk and base-relative URL. Hashes change each build. |
| Local production-build exercise | `pnpm run build`, then `pnpm exec vite preview --host 127.0.0.1 --port 5199 --strictPort`; `BROWSER_PCA_BASE_URL=http://127.0.0.1:5199/FlavorInsightAI/data-analysis/ node scripts/e2e/verify_browser_pca.mjs`. | PASS at 1440/820/390 px. All four figures calculated, local compute API calls 0, import and SVG/PNG/CSV/JSON export exercised. This is a local **production build** test, not a real Pages test. |
| Current public site | `Invoke-WebRequest https://xqplayer.github.io/FlavorInsightAI/data-analysis/` returned HTTP 200. The live entry references `DataAnalysisPage-Bj1ffxVG.js`; that live analysis chunk contains no Browser PCA marker. Requesting this local build's Worker filename on the public site returned HTTP 404. | Browser PCA **not deployed** at audit time. Actual online Worker execution is unverified. |
| Excel and file limits | Existing `analysis/imports.mjs` reads files in the browser, validates ZIP entries/expanded sizes and refuses unsupported types. Limits: 32 MiB compressed/input, 256 MiB expanded, 2,000 entries, 2,000,000 import cells; PCA additionally caps 2,000 samples, 256 features and 200,000 selected cells. | Limits are enforced in code; not a guarantee against every browser memory-pressure case. |
| Exports | Existing `PlotFrame` and `svgExport.mjs` serialize an SVG and rasterize a bounded PNG using Canvas; the PCA page exports result JSON and CSV. Local production-build E2E checked SVG content, PNG signature, CSV and JSON. | PASS in tested Chrome; online MIME/download policy remains unverified. |
| Browser support | The local production-build E2E used headless Chrome 157 and installed Microsoft Edge on Windows. Both are Chromium-based. Module Workers, Web Crypto SHA-256, IndexedDB (for a future save layer), SVG and Canvas need target-browser checks. | Firefox, Safari/iOS and real mobile devices not yet tested. |

## Release gate for a later authorized deployment

1. Review the exact commit to release and frozen lockfile; run the PR checks. The existing `main` workflow will deploy automatically if a change is merged, so a merge is a production operation.
2. On the actual Pages URL, run `BROWSER_PCA_BASE_URL=https://xqplayer.github.io/FlavorInsightAI/data-analysis/ node scripts/e2e/verify_browser_pca.mjs` with a Playwright browser configured. Record deployment run ID, commit SHA, the actual Worker URL/status, import and export results, and browser console errors. Use only the checked-in synthetic fixture.
3. Test at least Chrome desktop and a real or emulated mobile viewport; add Firefox/WebKit when the browsers are available. Do not infer their compatibility from Chrome.
4. If the Worker or route fails, roll back the Pages release to the prior commit through the approved release procedure. No database migration is involved in Browser PCA.

**Current gate:** local production-build compatibility PASS in Chrome and Edge, including recorded Worker request paths under `/FlavorInsightAI/assets/`; real GitHub Pages Worker **NOT VERIFIED**. No push, PR change, deployment or production database write in this task.
