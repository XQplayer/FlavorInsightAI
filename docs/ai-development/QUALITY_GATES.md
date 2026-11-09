# Quality gates

Run gates affected by a change; full scientific or release work broadens coverage. Record command, exit status, fixture/source, and any skipped gate. This document records available checks, not a blanket passing result.

| Gate | Current command or evidence | Required when | Current gap |
| --- | --- | --- | --- |
| Static check | `cd frontend; pnpm run lint` | Frontend JS/JSX changes | No repo-wide Python/R linter configured |
| Unit tests | `pnpm run test:platform`, `test:search-workbench`, `test:shimadzu`, `test:shimadzu-browser`; `python -m unittest discover -s scripts/tests -p 'test_*.py'` | Affected module | Select exact tests for a small task; document broader failures |
| API integration | Python handler tests in `scripts/tests/`, particularly `test_shimadzu_proxy.py`; local `/health` and affected endpoint checks | API changes | No complete contract suite for every endpoint |
| Browser E2E | `cd frontend; pnpm run test:e2e` and focused `test:e2e:shimadzu-enrichment`; scripts under `scripts/e2e/` | Route, workflow or browser-worker change | Browser/runtime and local service prerequisites must be confirmed |
| Scientific reference | Existing Shimadzu core tests and `services/analysis/tests/`; add independently sourced fixed fixtures for changed formulas | Any scientific algorithm change | Current behavior tests alone do not establish scientific truth |
| Security/dependencies | `cd frontend; pnpm audit --prod`; focused auth/RLS review | Dependency/auth change or release | Audit is not in PR CI; review Python/R dependencies separately |
| Build | `cd frontend; pnpm run build` | Frontend or deploy artifact change | Build does not prove live service health |
| Regression | Affected tests plus adjacent route/data flow and source parity | Every functional change | State any manual check explicitly |
| Version/rollback | Diff, base commit, hashes/migrations and `ROLLBACK_PLAN.md` | Every delivered change | No production rollback is automatic |

The PR workflow currently covers selected frontend Node tests, lint and build. Python/R, browser E2E, security audit and scientific reference checks must be run locally or added to CI in a separately reviewed change. For legacy modules, freeze a behavior baseline before edits and keep independently verified reference values separate; never alter results merely to make tests pass.
