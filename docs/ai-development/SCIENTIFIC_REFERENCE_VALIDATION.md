# Independent scientific reference validation — 2026-11-09

**Scope:** public synthetic data only. The new tests compare implementation output to values calculated from stated arithmetic, not to output copied from the implementation. No original scientific files, formulas, seven-stage Worker logic, or production database were changed. Passing these small references does **not** validate every scientific method in the application.

## Implemented module inventory

| Area | Actual code and current evidence | Reference status |
| --- | --- | --- |
| GC-MS peak/replicate processing and internal-standard semiquantitation | `frontend/src/shimadzu-core/` including `semiquant.mjs`, `v2-semiquant-stage.mjs`, and `frontend/src/workers/shimadzuPipeline.js` | New independent mass-balance fixture below; full workbook, recovery, calibration and solid-sample unit validation pending. The implemented formula uses RRF=1 and is **semiquantitative**, not a calibration curve. |
| Missingness, normalization, scaling | `services/analysis/preprocess.R` and `frontend/src/shimadzu-core/semiquant.mjs` | Existing behavior tests; broader external/reference fixtures pending. |
| PCA, differential tests, BH/Holm adjustment, correlation | `services/analysis/statistics.R` | New simple PCA/BH hand references below; existing `test_engine.R` and local method/regression tests. Correlation and inferential assumptions need fuller independent values. |
| PLS-DA / OPLS-DA, cross-validation, permutations | `services/analysis/supervised.R`, `supervised_validation.R` | Implemented, but phase 3 local supervised suite could not start because `ropls` is absent. Independent benchmark and overfit review **pending**. |
| Trainable/persisted predictive models in AI Models UI | `frontend/src/pages/AIModelsPage.jsx` describes training/persistence/prediction as unavailable | Not implemented as a deployable model; no predictive performance claim. |
| Solid/liquid concentration conversion and dilution | No verified µg/mL→µg/g conversion function found in searched Shimadzu core/analysis modules | Treat as pending contract, not as validated functionality. Sample mass, final extract volume, dilution/recovery and matrix basis must be explicit before such conversion. |

## Frozen independent references

| Test / file | Input, unit, method and independent result | Tolerance, boundary and result |
| --- | --- | --- |
| `frontend/src/shimadzu-core/semiquant.reference.test.mjs` | Synthetic internal standard stock 100 µg/mL, 10 µL spike, 5 mL pre-spike extract, analyte/IS peak areas 200/100. Mass balance with declared `ignore` added volume: `100 × 0.010 / 5 = 0.2 µg/mL` IS; area ratio × IS = **0.4 µg/mL extract**. | Absolute 1e-12; pass 3/3. With `include` added volume: `100 × 0.010 / 5.010 = 1/5.01 = 0.1996007984 µg/mL`; analyte would be 0.3992015968 µg/mL. Invalid zero IS area returns FAIL; unknown volume basis throws. No µg/g claim. |
| `services/analysis/tests/test_reference_values.R` | Synthetic one-variable centered vector −3,−1,1,3: sum of squares 20; sample variance/eigenvalue **20/3**, explained fraction **1**, absolute PCA scores 3,1,1,3. For three p-values `.01,.04,.03`, hand BH sorted adjustment `.03,.04,.04` restored to input order. | Absolute 1e-12; pass. Score sign is arbitrary. Repeated subject in unpaired comparison must error. |
| Small-sample skill probe | Synthetic independent A=[1,2], B=[3,4]; choose 2 of 4 labels yields six assignments, two at least as extreme in a two-sided mean-difference test, exact **p=2/6=1/3**. | This is a discrete-test interpretation check, **not yet an automated repository test** and not the OPLS-DA random-permutation algorithm. Do not report p<0.05 from this design. |

The arithmetic references above follow dimensional mass balance, sample-variance definition, PCA's centered one-dimensional covariance, and the Benjamini–Hochberg step-up formula. These are mathematical derivations for test fixtures, not empirical method validation or certified reference materials. All fixture values are invented and labeled synthetic. GC-MS response factor 1 is the existing algorithm's explicit assumption, not a measured analyte response factor. The 5 mL volume basis materially changes the answer and must be confirmed for real samples.

## Commands, environment and outcomes

| Command | Observed result |
| --- | --- |
| `cd frontend; node --test src/shimadzu-core/semiquant.reference.test.mjs` | 3/3 pass. Included in `pnpm run test:shimadzu-browser` (118/118). |
| `D:\R-4.6.0\bin\Rscript.exe services/analysis/tests/test_reference_values.R` | Exit 0; independent PCA/BH/boundary checks pass. The script sources `test_engine.R`, which also ran its existing behavior checks. |
| `Rscript services/analysis/tests/test_methods.R` before isolated dependency install | Exit 1: `there is no package called 'jsonlite'`. |
| `R_LIBS_USER=%TEMP%\flavor-phase3-r-lib`; `install.packages('jsonlite', lib=Sys.getenv('R_LIBS_USER'), repos='https://cloud.r-project.org')` | Exit 0; `jsonlite` 2.0.0 in isolated temp library, no system R modification. |
| `Rscript services/analysis/tests/test_methods.R` with that library | Exit 0, `METHOD TESTS PASSED`. Five further R tests (`test_preprocess_edges`, `test_qc_mask_priority`, `test_quality_regressions`, `test_comparison_labels`, `test_review_regressions`) each exited 0. R 4.6.0, stats 4.6.0; package warns jsonlite binary was built under R 4.6.1. |
| `Rscript services/analysis/tests/test_supervised.R` | Exit 1 before scientific assertions: missing `ropls`. **Not validated in phase 3.** |

No random seed is used by the deterministic new reference tests; fixture version is the phase 3 Git commit containing these files. For future OPLS-DA/ML references, freeze split IDs, seeds, package versions, nested validation policy, held-out outcomes and permutation denominator before claiming reproducibility. Any new scientific computation must supply an independent fixture with units, tolerance, boundary/error inputs and review record. Remaining priorities: calibrated GC-MS reference materials and recovery, solid/liquid dimensional conversion, correlation and inference reference values, and isolated `ropls` installation plus supervised validation.
