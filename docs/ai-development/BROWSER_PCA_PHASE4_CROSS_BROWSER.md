# Browser PCA Phase 4 cross-browser test report

| Engine / build | Execution | Result |
| --- | --- | --- |
| Google Chrome desktop | Real Phase 4 Pages URL, Playwright 1440/820/390 px | PASS: Worker HTTP 200, four graphs, CSV/XLSX, exports, refresh restore, no overflow or local compute API |
| Microsoft Edge desktop | Same real Pages URL and widths, Chromium engine | PASS with the same assertions |
| Firefox / Gecko | Playwright 1.56.1 browser package attempted in isolated `E:\codex\tmp\browser-pca-playwright\browsers` and `C:\Users\hanxq\AppData\Local\Temp\flavor-pca-playwright-browsers` | **NOT RUN**: download reached 100% but extraction stalled with only partial files. Both installs were stopped; no executable was available. This is an environment failure, not evidence of an application incompatibility. |
| WebKit / Safari engine | Requested in both isolated Playwright installs | **NOT RUN**: installer did not finish Firefox, so WebKit was never installed. Mobile Chrome/Edge viewport is not a WebKit substitute. |

Commands: `node E:\codex\tmp\browser-pca-playwright\node_modules\playwright\cli.js install --dry-run firefox webkit`; with each isolated `PLAYWRIGHT_BROWSERS_PATH`, `node ...\playwright\cli.js install firefox webkit`; then the Chrome/Edge `node scripts/e2e/verify_browser_pca.mjs` commands in the online acceptance record. The two installation attempts changed no project dependencies or global Codex configuration. Unfinished temporary browser folders are left as non-project artifacts, not reported as installed browsers.

Before formal release, install compatible Firefox and WebKit test binaries in a working isolated environment or CI runner, execute the same synthetic E2E on the production-base build, and inspect SVG/PNG export plus IndexedDB restore in each engine. Re-run after any cross-browser fix. Browser compatibility gate is currently **incomplete**.
