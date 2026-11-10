# Browser PCA Phase 3 test and release report

Date: 2026-11-10. Source branch `codex/browser-pca`, implementation commit `1ad5d1d1cfeda7f5794d0e6e618b8baf0b64871c`, parent `51032343bf0eead259e4819f936ab0676fa15857`. The original repository branch was **not pushed**; no formal Pages, Render, database, PR #24 or PR #25 change was made. The separate public preview repository is `XQplayer/FlavorInsightAI-BrowserPCA-Preview` and its static artifact commit is `3a2c41f601934544346666ec153e673aaa6106a2`.

## Scope and trust boundaries

- The existing Browser PCA SVD, GC-MS Worker, local R workbench, original files and scientific formulas were not modified. The result validator now checks score energy against eigenvalues and loading norm/orthogonality, without imposing component signs.
- The Browser Analysis Adapter is wired to the page. A model returns a bounded `flavor-pca-plan/1` proposal; only the user's click starts the Worker. A separate user click allows one-time sharing of run ID, dimensions, parameters, explained fractions and warnings. Neither the plan nor the explanation request contains the matrix or scores.
- The local IndexedDB archive stores a versioned selected numeric matrix, core result, validated `flavor-pca-result/1` envelope, settings, plot state and SHA-256. Saving and export are explicit. It detects accidental tampering, not a malicious user with access to the same browser origin. Restored results retain original run ID; recomputation creates another.
- The static preview has no deployed AI Gateway. Its AI controls are disabled; the Browser PCA engine remains available. The real OpenAI flow was tested only with a local loopback Gateway and an existing ignored private key. No key value was printed or bundled.

## Commands and observed results

| Check | Command | Result |
| --- | --- | --- |
| Git ancestry | `git fetch origin main; git rev-list --left-right --count origin/main...HEAD` before implementation | `0 13`; the three Browser PCA commits depend on preceding Agents SAI history. |
| Red-green archive contract | `node --test src/analysis/browserPcaArchive.test.mjs` | First failed with `ERR_MODULE_NOT_FOUND`; after implementation 2/2 passed. |
| Red-green Gateway contract | `python -m unittest scripts.tests.test_ai_pca_gateway -v` | First failed because `analysis_plan` and `analysis_explain` were absent; after implementation 4/4 passed. |
| Red-green numeric consistency | `node --test src/analysis/pcaResult.test.mjs` | Forged score test first failed; after score energy/loading checks it passed. |
| Full frontend | `cd frontend; node --test` | 458 passed, 1 pre-existing skip, 0 failed. |
| Analysis | `cd frontend; pnpm run test:analysis` | 124 passed, 0 failed. Includes static independent R `prcomp` fixture comparison. |
| GC-MS Worker regression | `cd frontend; pnpm run test:shimadzu-browser` | 95 passed, 0 failed. |
| Python API | `python -m unittest discover -s scripts/tests` | 181 passed, 0 failed. Includes authenticated HTTP plan request and malicious extra-matrix denial. |
| JSON Schema | `node scripts/references/emit_browser_pca_result.mjs` then isolated `schema-venv` Python `scripts/references/validate_browser_pca_schema.py` | PASS: Draft 2020-12 schema; synthetic result; invalid engine/version rejected. |
| Lint and standard build | `cd frontend; pnpm run lint; pnpm run build` | Both exit 0. Existing RDKit browser externalization, 3Dmol `eval`, and large-chunk warnings remain. |
| Production dependency scan | `cd frontend; pnpm audit --prod --json` | 0 info/low/moderate/high/critical advisories in the current lockfile. |
| Local preview-path E2E | `BROWSER_PCA_BASE_URL=http://127.0.0.1:5210/FlavorInsightAI-BrowserPCA-Preview/data-analysis/ node scripts/e2e/verify_browser_pca.mjs` | Chrome 1440/820/390 passed; Worker loaded under preview prefix, 4 plots, CSV/XLSX, SVG/PNG/CSV/JSON, save→refresh→restore, chart setting restore, new run ID on recompute, delete, 0 computation API calls, 0 horizontal overflow. |
| Local Agent Mock E2E | `BROWSER_PCA_AI_BASE_URL=http://127.0.0.1:5220 node scripts/e2e/verify_browser_pca_agent.mjs` | Passed with intercepted Mock HTTP: 3 plan attempts, 1 explanation, 1 Worker run; plan alone did not run Worker, invalid dataset ID and network failure started no additional Worker. This is a simulated Gateway response, not a GPT result. |
| Local real GPT E2E | `node scripts/e2e/verify_browser_pca_agent_live.mjs` against loopback Gateway using ignored private env | Passed: 2 real Responses API requests (`/ai/analysis/plan`, `/ai/analysis/explain`), synthetic R reference only. Usage: plan 303 input/71 output tokens, estimated $0.001316; explanation 276 input/106 output tokens, estimated $0.001612. The screenshot was inspected: reported UV PC1 82.85%, PC2 16.53%, sum 99.38%, consistent with checked-in R reference 82.8464%, 16.5339%, 99.3803% after rounding; it states exploratory limits and no significance/OAV. |
| Source whitespace/secret checks | `git diff --check`; `rg -l 'sk-proj-|service_role|OPENAI_API_KEY|127.0.0.1:5220' frontend/dist` for the public preview build | Source diff check exited 0; no matching bundled secret or local live API URL. The generated preview artifact itself has one third-party minified chunk with a whitespace warning from `git diff --cached --check`; this is not source whitespace. |

The R executable was not available in PATH or inspected `C:\Program Files\R` locations during this run. We did not regenerate the independent R fixture; the checked-in fixture and numerical comparison tests passed. Firefox, WebKit/iOS, shared-device storage isolation and public online AI were not verified.

## Online Pages evidence

Preview URL: `https://xqplayer.github.io/FlavorInsightAI-BrowserPCA-Preview/data-analysis/`. The final static artifact is `3a2c41f601934544346666ec153e673aaa6106a2`. [Pages build 1357504074](https://api.github.com/repos/XQplayer/FlavorInsightAI-BrowserPCA-Preview/pages/builds/1357504074) reached `built`, and [Actions run 42838846884](https://github.com/XQplayer/FlavorInsightAI-BrowserPCA-Preview/actions/runs/42838846884) completed with `build`, `report-build-status` and `deploy` all `success`. Live `/preview-source.json` returned HTTP 200 with source commit `1ad5d1d1cfeda7f5794d0e6e618b8baf0b64871c`; live `/FlavorInsightAI-BrowserPCA-Preview/assets/browserPca.worker-lmsVXb75.js` returned HTTP 200 (56,312 bytes).

The final live Pages URL passed `BROWSER_PCA_BASE_URL=https://xqplayer.github.io/FlavorInsightAI-BrowserPCA-Preview/data-analysis/ node scripts/e2e/verify_browser_pca.mjs` in Chrome at 1440, 820 and 390 px. All three viewports loaded the module Worker under the preview prefix, generated all four PCA figures, had zero horizontal overflow and made zero local compute API calls. The script also exercised synthetic CSV/XLSX import, precheck, SVG/PNG/CSV/JSON exports, optional IndexedDB save, refresh/restore, plot settings, rerun with a new ID and deletion. This is a real remote Pages browser run, not a local HTTP result. The AI Gateway was intentionally absent from this static preview; its live model flow was validated only against a local authenticated Gateway as recorded above.

## Screenshots and rollback

Selected synthetic screenshots are committed in `docs/ai-development/screenshots/browser-pca-phase3/`: online desktop and mobile PCA, plus the local real-GPT demonstration. The complete ignored test output is under `_local/browser-pca-online-final/` and `_local/browser-pca-qa/`. Source rollback: revert `1ad5d1d` and this report commit in the Browser PCA branch; the earlier PCA engine/protocol commits remain. Preview rollback: disable Pages in the **separate preview repository** or revert its `3a2c41f` artifact commit. No formal site or database rollback is required.

## Remaining limits

The preview repository has a separate release path but shares the `xqplayer.github.io` browser origin with the formal site. IndexedDB isolation by path is impossible; the preview uses a distinct DB name and visibly warns users to use synthetic data only. Public AI remains disabled until a separately deployed authenticated Gateway is approved and its CORS, auth and secret handling are tested. Supabase cloud save is design only; no migration or RLS probe occurred in this phase. A formal code release needs a reviewed release candidate from the full commit ancestry, not a cherry-pick of the latest documentation commit.
