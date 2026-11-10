# Browser PCA Phase 4 online acceptance record

Date: 2026-11-11 (Asia/Singapore). Only labeled synthetic data was used. The public **preview** is `https://xqplayer.github.io/FlavorInsightAI-BrowserPCA-Preview/data-analysis/`, not the formal site. Preview source marker returned HTTP 200 with `source_commit=7ff1bdd844080104f93584f3ab5da06f03083b00`, `phase=4`, `synthetic_data_only=true`, `api_gateway=not-deployed`. Static artifact commit: `4518968513c3ef16a76a7502537e00b9e2a2db43`. [Pages build 1357819464](https://api.github.com/repos/XQplayer/FlavorInsightAI-BrowserPCA-Preview/pages/builds/1357819464) was `built`; [Actions run 42862952460](https://github.com/XQplayer/FlavorInsightAI-BrowserPCA-Preview/actions/runs/42862952460) finished with `build`, `report-build-status` and `deploy` all `success`. The deployed module Worker returned HTTP 200 (56,312 bytes).

| Step / failure case | Actual evidence | Status |
| --- | --- | --- |
| Synthetic CSV/XLSX import, precheck, browser PCA | Real Pages Chrome and Edge E2E, 1440/820/390 px, Worker path under `/FlavorInsightAI-BrowserPCA-Preview/assets/`, zero local compute API calls | PASS |
| Four scientific figures, SVG/PNG/CSV/JSON exports | Same remote E2E; graph generation and exported payload assertions | PASS |
| Save, refresh, restore, figure settings, rerun, delete | Same remote E2E in desktop path, new run ID after rerun | PASS |
| User turns AI off without losing result | Local Mock browser E2E: disabled request button, plot retained; late plan response did not reappear after switch-off | PASS locally |
| Goal → bounded inspection → proposed PCA plan → user confirms → Worker | Local intercepted Mock Gateway E2E: 4 plan attempts, 1 explanation, only 1 Worker run; plan alone and invalid plan started no Worker | PASS locally with Mock; **not an online GPT proof** |
| Schema/numeric consistency and invalid result | `frontend/src/analysis/pcaResult.test.mjs`, archive/adapter tests in full frontend suite; forged numeric result rejected | PASS locally |
| Network failure after completed PCA | Local intercepted network-failure case retained Worker result/plot and started no new Worker | PASS locally |
| Real GPT plan and explanation | Phase 3 performed two real local-loopback Responses API calls on earlier code. Phase 4 read no key and made no real model call. | Historical local evidence only |
| Online Gateway and authenticated Agent→PCA→GPT chain | Public Render `/health` and `/ai/session` returned HTTP 000 transport timeouts; static preview deliberately has AI disabled. | **NOT VERIFIED / release blocker** |
| Private-user Auth, CORS, model, cost, logs on Render | Live service config and deployed SHA were inaccessible. Source and prior local tests are not equivalent. | **NOT VERIFIED** |

Local regression was run on the Phase 4 source commit (output logs under ignored `_local/browser-pca-phase4/`):

| Command | Observed result |
| --- | --- |
| `cd frontend; node --test` | 458 passed, 1 existing skip, 0 failed |
| `cd frontend; pnpm run test:analysis` | 124 passed, 0 failed; includes checked-in independent R `prcomp` reference comparison |
| `cd frontend; pnpm run test:shimadzu-browser` | 95 passed, 0 failed; no GC-MS Worker change |
| `python -m unittest discover -s scripts/tests` | 181 passed, 0 failed |
| `cd frontend; pnpm run lint` and `pnpm run build` | Both exit 0; pre-existing RDKit/3Dmol/chunk-size build warnings remain |
| `cd frontend; pnpm audit --prod --json` | Exit 0, zero advisories at all severity levels in the current lockfile |
| `git diff --check` | Exit 0 before source commit; generated third-party preview assets were not treated as source code |

R was not installed in the inspected Phase 3 environment; this phase compared the checked-in independent fixture through the Node tests and did not regenerate an R result. Cancellation, matrix-size and non-finite-value rejection have focused adapter/engine tests; the online browser E2E did not drive an oversized upload or live model cancellation. Those cases remain part of the formal release checklist.

Reproduction commands (PowerShell environment variables are per process; no Secret is used):

```powershell
$env:BROWSER_PCA_BASE_URL='https://xqplayer.github.io/FlavorInsightAI-BrowserPCA-Preview/data-analysis/'
$env:BROWSER_PCA_PLAYWRIGHT='E:\codex\tmp\browser-pca-playwright\node_modules\playwright\index.mjs'
$env:BROWSER_PCA_CHROME='C:\Program Files\Google\Chrome\Application\chrome.exe'
node scripts/e2e/verify_browser_pca.mjs
$env:BROWSER_PCA_CHROME='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
node scripts/e2e/verify_browser_pca.mjs
node scripts/e2e/verify_browser_pca_preview_boundary.mjs
curl.exe -L -sS --max-time 12 -o NUL -w '%{http_code}' https://flavorthresholddb-api.onrender.com/ai/session
```

The online E2E commands each returned `status=PASS` in all three viewport sizes with four figures and `overflow=0`; the last Render command returned `000`. The updated preview reused its existing separate Pages repository; a policy review rejected recursive removal of its old hashed build files, so the update used non-destructive file overlay. Old unreferenced hashes remain until an authorized cleanup. The source bundle marker scan found no `sk-proj-`, `service_role`, `OPENAI_API_KEY`, loopback AI URL or Supabase project URL in the new static build.

Screenshots: [Chrome desktop](screenshots/browser-pca-phase4/chrome-online-desktop.png), [Chrome mobile viewport](screenshots/browser-pca-phase4/chrome-online-mobile.png), [Edge desktop](screenshots/browser-pca-phase4/edge-online-desktop.png). These show synthetic results; mobile viewport is not an iOS Safari/WebKit test.

**Acceptance conclusion:** browser-local PCA is online in an isolated *release repository* and passed the listed checks. The full online Agent + PCA workflow has **not** passed and must not be included in a formal release claim until a reachable authenticated Gateway, independent preview origin and remaining browser checks are verified.
