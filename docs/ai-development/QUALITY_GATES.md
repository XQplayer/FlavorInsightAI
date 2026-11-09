# Quality gates

Run gates affected by a change; full scientific or release work broadens coverage. Record command, exit status, fixture/source, and any skipped gate. This document records available checks, not a blanket passing result.

| Gate | Current command or evidence | Required when | Current gap |
| --- | --- | --- | --- |
| Static check | `cd frontend; pnpm run lint` | Frontend JS/JSX changes | No repo-wide Python/R linter configured |
| Unit tests | `pnpm run test:platform`, `test:search-workbench`, `test:shimadzu`, `test:shimadzu-browser`, `test:analysis`; `python -m unittest discover -s scripts/tests -p 'test_*.py'` | Affected module | Select exact tests for a small task; document broader failures |
| API integration | Python handler tests in `scripts/tests/`, particularly `test_shimadzu_proxy.py`; local `/health` and affected endpoint checks | API changes | No complete contract suite for every endpoint |
| Browser E2E | `cd frontend; pnpm run test:e2e` and focused `test:e2e:shimadzu-enrichment`; `node --test scripts/e2e/overlapGeometry.test.mjs` from repo root | Route, workflow or browser-worker change | Browser/runtime and local service prerequisites must be confirmed; responsive layout changes need desktop/tablet/mobile evidence |
| Scientific reference | Existing Shimadzu core tests and `services/analysis/tests/`; add independently sourced fixed fixtures for changed formulas | Any scientific algorithm change | Current behavior tests alone do not establish scientific truth |
| Security/dependencies | `cd frontend; pnpm audit --prod`; focused auth/RLS review | Dependency/auth change or release | Phase 4 pins official patched `xlsx` 0.20.3 and makes the PR audit blocking; CDN-tarball advisory coverage and actual remote CI are not yet proven. Review Python/R dependencies separately. |
| Build | `cd frontend; pnpm run build` | Frontend or deploy artifact change | Build does not prove live service health |
| Regression | Affected tests plus adjacent route/data flow and source parity | Every functional change | State any manual check explicitly |
| Version/rollback | Diff, base commit, hashes/migrations and `ROLLBACK_PLAN.md` | Every delivered change | No production rollback is automatic |

The PR workflow currently covers selected frontend Node tests (including GC-MS and analysis import/export references), small browser-overlap geometry and routing-contract checks, Python API tests, lint, build and a blocking production dependency audit. Full browser E2E and R checks remain local. The current branch has no matching remote Actions run; local checks cannot mark the deployment gate passed. For legacy modules, freeze a behavior baseline before edits and keep independently verified reference values separate; never alter results merely to make tests pass. `QUALITY_GATES_V2.md` and `QUALITY_GATES_V3.md` are historical snapshots; see `PHASE4_ACCEPTANCE.md` for the latest observed local results.

## Match gates to the selected route and level

The canonical route/level decision is in `SKILL_ROUTING.md`. The table below selects **affected** gates; it does not assert they passed. For L1 run focused checks, L2 add adjacent regression and build when relevant, L3 run the full affected integration/reference/security set, and L4 add impact, backup/restore, qualified review, matching remote CI and authorization before the risky action.

| Primary route | Required affected evidence |
| --- | --- |
| 1. Frontend / UI / GSAP | Focused UI tests; desktop/tablet/mobile viewport and keyboard/accessibility evidence for layout changes; reduced-motion and real-state checks for animation/progress; lint/build; browser E2E for affected journeys. |
| 2. Scientific data processing | Independent reference inputs/outputs with units, source, tolerance and invalid cases; sample independence and provenance; focused Node/R scientific tests and related regression; no raw-data changes without authorization. |
| 3. Database / API | Request/response and error contract tests; Python/API integration; auth/permission, input and file limit checks; compatibility and persistence checks; migration backup/restore if L4. |
| 4. AI model development | Group-disjoint split and leakage tests, training-fold transforms/tuning, held-out or external evaluation, overfit checks, seed/version and reference provenance; independent model QA for material claims. |
| 5. Software fault diagnosis | Reproduction and root-cause evidence, failing regression before fix, smallest patch, affected integration/browser tests, adjacent regression and rollback. |
| 6. Deployment / CI | Frozen install, relevant tests, lint/build, dependency and secrets review, exact run SHA/jobs for remote acceptance, release authorization and rollback. Local test results alone never clear deployment. |

When routes overlap, take the union of **relevant** checks, not every repository check. A missing Skill/tool does not waive its gate: record unavailable status, use existing code/tests and a domain checklist, and mark any unrun test as a gap. `QUALITY_GATES_V3.md` is a dated observed snapshot and must not be read as a standing green result for later commits.
