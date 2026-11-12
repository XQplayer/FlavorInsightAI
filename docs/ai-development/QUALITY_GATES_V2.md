# Quality gates v2 — phase 3 evidence and promotion policy

Gate states are per commit and environment. `PASS` below means the listed local command ran on the phase 3 worktree; it does not substitute for a matching remote run or a full scientific validation.

| Gate | Required check | Phase 3 state and evidence |
| --- | --- | --- |
| Basic engineering | Frozen install; six frontend Node scripts; Python API tests; lint; build | **Local PASS:** `pnpm install --frozen-lockfile`; frontend **255/255**; Python **15/15**; lint and build exit 0. Build has 3dmol `eval`/large-chunk warnings. CI versions Node 22 vs local Node 26 need remote confirmation. |
| Browser behavior | Focused E2E for changed UI/Worker routes; desktop/mobile evidence | **Not run in phase 3.** Phase 2 had partial browser E2E; no phase 3 browser claim. Required before a new UI release. |
| Security | `pnpm audit --prod`; threat/reachability review; auth/permission and input validation checks for affected paths | **Open:** 9 → 2 advisories; two direct `xlsx` high remain. Audit exits 1 and CI step is nonblocking. Existing `.xlsx`/50 MB input checks were inspected, but no full exploit or permission audit was executed. |
| Scientific references | Independent fixture, unit/volume basis, errors/boundaries, method assumptions | **Partial PASS:** GC-MS semi-quant arithmetic 3/3; R PCA and BH hand values plus repeated-subject rejection passed. These cover only small synthetic cases. Real matrix conversion, calibration, correlation, OPLS-DA and ML claim validation pending. |
| Statistical reproducibility | Sample independence, missingness, transforms, multiplicity, split IDs/seeds, environment | R `test_methods.R` and five regression suites passed after isolated `jsonlite` 2.0.0 install. `test_supervised.R` blocked by missing `ropls`; no OPLS-DA claim. Deterministic reference fixtures need no seed. |
| Deployment | Matching GitHub Actions run, risk review, authorized release, rollback readiness | **BLOCKED by remote evidence and unresolved security review.** No phase 3 branch PR/run; no push/deploy authorized. Rollback: revert phase 3 commit in a new branch after verifying diff, then frozen install and same checks. |

## Rule for new scientific features

Before changing an algorithm, freeze a public synthetic or authorized deidentified reference with input units, formula and independent expected values, tolerance, missing/invalid cases, source and reviewer. Fail the change if those checks or related regression tests fail. A behavior snapshot of the old code is useful but cannot certify scientific correctness. For PCA/OPLS-DA record matrix orientation, centering/scaling, group mapping and validation; for ML split by independent unit before any learned transform and retain an untouched evaluation set.

## CI promotion path

Current PR workflow is a local design only until a matching GitHub run succeeds. It includes Node/Python/lint/build and nonblocking audit; new GC-MS reference tests are included by the existing `src/shimadzu-core/*.test.mjs` pattern. Keep private data and model keys out of public runners. The R reference tests can run locally with base R; method tests need isolated `jsonlite` and supervised tests need `ropls`. Add R to public CI only after a pinned, clean-room setup succeeds and all fixtures are public synthetic. Audit can become blocking for new fixable advisories first, then all fixable high/critical findings once `xlsx` is replaced/patched or a reviewed, time-bounded exception is accepted. The `continue-on-error` audit is monitoring, not a green gate.

Release requires all affected local gates, a matching remote run ID/SHA with every required job successful, an explicit decision on residual `xlsx` risk, and authorization to deploy. Record skipped checks with reasons instead of marking them passed.
