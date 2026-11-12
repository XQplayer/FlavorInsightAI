# Test coverage baseline, 2026-11-09

This is a **test inventory and observed run**, not a percentage of source lines or a claim of full scientific validation.

| Layer | Observed command/result | Remaining gap |
| --- | --- | --- |
| Frontend unit/contract | Six selected `pnpm run test:*` scripts: 252/252 passed, including 115 Shimadzu browser/core tests | Some modules are outside these scripts; no coverage instrumentation or branch percentage |
| Browser E2E | `pnpm run test:e2e:processing-feedback` passed desktop success and mobile failure using synthetic public templates | Waiting/review/cloud states and manual screen-reader behavior untested; existing release E2E not rerun here |
| API integration | Isolated venv: `python -m unittest scripts.tests.test_shimadzu_analysis_service scripts.tests.test_shimadzu_proxy -q`, 15/15 twice after cache isolation | Other API endpoints have their own tests but were not fully rerun; public Runner execution awaits PR CI |
| Python research calculations | Existing Stage service test checks stage flow and failure handling; no scientific formula was changed | Need independent approved reference workbook/value sets before changing formulas |
| R statistics | `D:\R-4.6.0\bin\Rscript.exe services/analysis/tests/test_methods.R` with project `R_LIBS_USER` passed engine, regression and method assertions | Local R/jsonlite/ropls setup is not on public CI; not a full dataset validation |
| Static/build | `pnpm run lint`, `pnpm run build` passed | Build warnings from existing third-party code and large chunks remain |
| Dependency security | `pnpm audit --prod` exited 1: 9 advisories (5 high, 3 moderate, 1 low), including existing `xlsx` and current Vite lock resolution | Audit is advisory in CI until triage and a tested remediation plan; passing build is not a security clearance |

The two E2E workbooks are explicitly synthetic examples. The invalid `.xlsx` is intentional test data. No private workbook, production database or real research result was used. API tests initially passed, then failed on a repeat run because a cache persisted between runs; `test_shimadzu_proxy.py` now isolates the handler cache and mocks persistence for that test, with two consecutive 15/15 runs.
