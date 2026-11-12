# Phase 3 acceptance — 2026-11-09

**Overall: partial completion, release gate not passed.** Authorized local work is complete; remote PR CI cannot be demonstrated without a push and PR, which were expressly withheld. No production release, original research data edit, algorithm edit, global Codex config edit, or database migration occurred.

## Answers to the five acceptance questions

1. **Did GitHub Actions actually succeed for this branch? No evidence.** `gh run list --branch codex/ai-development` and matching PR list returned empty. Old successful run 31237889303 belongs to SHA `56c073f` and an older workflow. Current branch is local only; no current run ID, per-job status or rerun exists.
2. **Are dependency risks understood and controlled? Partly.** The 9 findings were inventoried; safe patch updates removed 7 and local regression/build checks passed. Two high direct `xlsx` advisories remain reachable through browser workbook parsing. Existing file limits and local processing are partial mitigations, not a fix; security gate remains open.
3. **Do key scientific calculations have independent references? Partly.** New public synthetic hand-reference tests cover GC-MS internal-standard semiquantitation, PCA sample variance, BH adjustment and repeated-subject rejection. Real calibration/recovery, solid-liquid conversion, correlation, OPLS-DA and general ML claims remain pending. No broad scientific validation claim is made.
4. **Did Skills influence Codex behavior? In sampled tasks, yes.** Fresh subagents actually read all five project Skill files and applied constraints to synthetic positive, negative and boundary cases; a missing-skill fallback was exercised. Platform-wide automatic dispatch has no observable log and remains unverified.
5. **Ready for the next complex feature? Conditionally for isolated development; not for release or new unreferenced scientific algorithms.** Require a matching PR CI run, a decision on `xlsx`, reference fixtures for changed calculations, and `ropls`/supervised validation where those modules are affected.

## Completed changes and evidence

| Area | Files / exact commands | Result |
| --- | --- | --- |
| Scoped dependency patch | `frontend/package.json`, `frontend/pnpm-lock.yaml`; `pnpm update vite@8.1.6`; `pnpm update nanoid source-map-js`; `pnpm install --frozen-lockfile` | Vite 8.1.6, nanoid 3.3.20, source-map-js 1.2.2; frozen install pass; audit 9 → 2, exit 1. |
| New independent tests | `frontend/src/shimadzu-core/semiquant.reference.test.mjs`; `services/analysis/tests/test_reference_values.R` | `node --test` 3/3 pass; R hand-reference script exit 0. No production algorithm files changed. |
| Existing engineering regression | Six frontend test scripts in `.github/workflows/pr-quality-checks.yml`; Python `-m unittest ... -q`; `pnpm run lint`; `pnpm run build` | 255/255 frontend, 15/15 Python, lint and build pass locally. Build warnings documented. |
| Existing R regression | `R_LIBS_USER=%TEMP%\flavor-phase3-r-lib`; install `jsonlite`; `Rscript test_methods.R` and five regression scripts | All six scripts exit 0; `test_supervised.R` exits 1 before assertions due missing `ropls`. |
| Skill probes | Actual `Get-Content` of five project Skill files by fresh read-only subagents; synthetic Node/Python/PowerShell calculations; missing-skill `Test-Path` | Sampled domain routing and constraint-following observed. No global activation telemetry. |
| Independent read-only review | `/root/phase3_review` inspected current diff, reference arithmetic, lockfile version changes, final audit JSON and evidence boundaries; independently reran Node 3/3 and R reference script | No concrete P1/P2 issue found. Reviewer did not rerun the full frontend/Python suites, browser E2E or remote CI; raw Skill probe traces are not archived as repository artifacts. |
| Reports and gate updates | Six new phase 3 reports; `SKILL_REGISTRY.md`, `SKILL_ROUTING.md`, `QUALITY_GATES.md`, `DEVELOPMENT_WORKFLOW.md` updated | Evidence, risk and rollback recorded. Three audit JSON snapshots preserve reproducible advisory details. |

The two preceding baseline commits remain `a1aa947` and `650688c`. This report is included in the new phase 3 commit; retrieve its SHA with `git log -1 --format=%H -- docs/ai-development/PHASE3_ACCEPTANCE.md` after checkout. The separate root checkout's pre-existing uncommitted changes were left intact. The current worktree branch is `codex/ai-development`.

## Open items and required authorization

- **Remote CI:** authorize `git push origin codex/ai-development` and creation of a draft PR against `main` if you want the exact phase 3 Actions run. Only then can this report record run ID, SHA, both job outcomes, failures and a rerun. No push/PR has been performed.
- **Security:** choose and parity-test a supported workbook parser or patched vendor build for `xlsx`; keep both high findings open until verified. Audit is currently nonblocking in CI and not a passing security gate.
- **Scientific:** obtain independently reviewed GC-MS material/reference results and conversion rules; set up `ropls` in an isolated R environment for supervised tests; expand reference values for correlation/OPLS-DA and any new model work.
- **CI parity:** run current workflow on Node 22/Ubuntu and verify Python runner behavior. Browser E2E was not rerun this phase and must run for UI changes.

## Rollback

Use a new branch from the phase 3 parent and `git revert <phase3-commit>` to reverse the package/lockfile, tests and docs together; do not rewrite the preserved phase 1/2 history. Verify `pnpm install --frozen-lockfile`, relevant tests and audit afterwards. Reverting the patch intentionally returns the seven advisories, so retain the fixed lockfile until a replacement is ready. The isolated `%TEMP%\flavor-phase3-r-lib` does not affect system R; it can be removed independently after local verification. No database or raw-data rollback is necessary.

**Phase 3 commit:** the commit containing this report; its immutable SHA is also stated in the final handoff.
