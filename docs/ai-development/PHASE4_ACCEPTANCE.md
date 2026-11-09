# Phase 4 acceptance — 2026-11-09

**Overall: PARTIAL, not release-ready.** Local workbook security remediation, selected scientific references and Skill behavior probes were completed; remote GitHub Actions acceptance and full browser E2E remain open. No remote push, PR, production deployment, original research file edit or global Codex configuration change occurred.

## Baseline, branch and commits

Work was performed only in the existing linked worktree `E:\codex\Projects\FlavorThresholdDB\.worktrees\ai-development`, on new local branch `codex/ai-development-phase4`. Starting HEAD was `9f1cb61`; commits `a1aa947`, `650688c` and `9f1cb61` remain ancestors. The original root checkout had unrelated uncommitted files and was left untouched. The implementation/evidence commit is **`88ae94f7aec912940ae4eeafa944c91ed96922ec`** (`fix: patch workbook parser and verify scientific references`). This acceptance report is a follow-up documentation commit; inspect `git log -2 --oneline` for its SHA.

## Work packages and actual evidence

| Work package | Result | Evidence and limit |
| --- | --- | --- |
| P0 remote CI | **NOT ACCEPTED** | `git ls-remote --heads origin main codex/ai-development codex/ai-development-phase4` returned only `main=5e2056e`; `gh pr list --head codex/ai-development-phase4 ...` and `gh run list --branch codex/ai-development-phase4 ...` returned `[]`. No Run ID, job result or remote head SHA exists for this phase. See `GITHUB_CI_REMOTE_RESULT.md`. |
| P0 XLSX | **LOCAL REMEDIATION PASS; release pending** | Replaced npm `xlsx@0.18.5` with official 0.20.3 CDN tarball pinned by lockfile integrity. Test-first import cases passed 8/8 before change; after one CAS-format compatibility correction focused tests passed 34/34, analysis 104/104, Worker browser 118/118. `pnpm audit --prod` exit 0, no known advisories; scanner coverage of CDN tarball is a residual limit. See `XLSX_SECURITY_REMEDIATION.md`. |
| P1 OPLS-DA | **PARTIAL SCIENTIFIC PASS** | Isolated R library contains Bioconductor `ropls` 1.44.0. Public sacurine PCA/PLS-DA/OPLS-DA summary values matched published precision; five local R test scripts exit 0. Project-specific nested Q² is a different metric and lacks an independent predictive oracle. See `OPLSDA_REFERENCE_VALIDATION.md`. |
| P1 Skills | **TASK-BEHAVIOR PASS; auto-dispatch unverified** | Three fresh-context agent probes actually read all five project SKILL.md files across combined scenarios and executed Node/Python/R checks. Negative, boundary and unavailable-Skill fallback decisions are recorded in three JSON files. See `SCIENTIFIC_SKILLS_BEHAVIOR.md`. |
| Local engineering | **PASS** | Frozen pnpm install exit 0; seven frontend scripts **359/359**; Python API **15/15**; lint/build exit 0. PR workflow adds analysis tests and blocking production audit. |
| Browser/release | **PARTIAL** | Focused processing feedback E2E passed desktop completion and mobile failure. Full `pnpm run test:e2e` failed at `scripts/e2e/verify_release_candidate.mjs:311`: `desktop: fixed bottom element overlaps main content`; exit 1. This was not called a pass. |

Local commands and outputs are listed in the named reports and `QUALITY_GATES_V3.md`. The audit machine output is `dependency-audit-phase4-2026-11-09.json`. Browser logs were local ignored files; the failing assertion and exit state are retained in reports. Local Node **26.13.0** differs from CI Node **22**, another reason remote CI is mandatory.

## Changed files and scientific boundary

The implementation commit changed `.github/workflows/pr-quality-checks.yml`, `frontend/package.json`, `frontend/pnpm-lock.yaml`, `frontend/src/analysis/imports.test.mjs`, `frontend/src/releaseHardening.test.mjs`, `frontend/src/workers/shimadzuWorkbook.js`, `services/analysis/tests/test_supervised.R`; it added `services/analysis/tests/test_ropls_published_reference.R`, reports, three probe JSON records, a raw audit JSON and a plan. `docs/ai-development/QUALITY_GATES.md` now points to v3. The only runtime code edit sets the Excel number format of a **recovered CAS text cell** to `@` after recovery; it does not alter Stage 0–6 formulas. `git diff 9f1cb61 --name-only -- frontend/src/shimadzu-core frontend/src/workers/shimadzuPipeline.js` returned no paths. No tracked original research file changed; external/untracked research files were not individually rehashed.

## Remaining risk and next authorized actions

1. **Owner authorization required for remote evidence:** approve pushing `codex/ai-development-phase4` and creating a draft PR to `main`; capture matching head SHA, run ID, both job statuses and logs, fix CI findings and rerun. No authorization was inferred from this task.
2. Diagnose/fix the full browser fixed-bottom overlap assertion, then rerun full desktop/mobile release E2E. The focused E2E alone is insufficient for release.
3. Build an independent small controlled oracle for project-specific OPLS-DA nested predictions/Q² and validate its scaling, centering, component and permutation behavior before a scientific model claim. Keep current R tests local until a clean-room public CI setup is demonstrated.
4. Continue monitoring SheetJS advisories and test malicious workbook limits. The `archiveImport` chunk remains 594.93 kB, and the build retains 3dmol direct-`eval` and chunk warnings.

**Rollback:** `git revert 88ae94f` on a new review branch, followed by frozen install and the same gates, restores the prior code. That also restores vulnerable `xlsx@0.18.5`; do **not** use a straight revert as a security remediation or deploy it. For a safe release rollback, first preserve the 0.20.3 parser or migrate to a reviewed alternative, then revert only the unrelated behavior/docs as needed. This local branch has not been pushed, so the original worktree and remote remain untouched.
