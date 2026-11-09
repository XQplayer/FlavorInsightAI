# Phase 4 PCA / PLS-DA / OPLS-DA reference validation

**Result: partial scientific validation.** A public, independently published `ropls` reference was reproduced with the same package version. Project-specific nested prediction and OPLS-DA generalization are not independently certified by that match.

## Environment and provenance

On 2026-11-09, R **4.6.0** was used with `R_LIBS_USER=$env:TEMP\flavor-phase4-r-lib`. No global R library or config was edited. [Bioconductor's ropls release page](https://bioconductor.org/packages/release/bioc/html/ropls.html) lists **ropls 1.44.0** for this R/Bioconductor release; the installed `ropls`, `BiocManager` and `jsonlite` versions were **1.44.0**, **1.30.27**, and **2.0.0**. The local source is the Bioconductor package, not an arbitrary archive.

```powershell
$lib=Join-Path $env:TEMP 'flavor-phase4-r-lib'
New-Item -ItemType Directory -Force -Path $lib | Out-Null
$env:R_LIBS_USER=$lib
& 'D:\R-4.6.0\bin\Rscript.exe' -e "options(repos=c(CRAN='https://cloud.r-project.org'), pkgType='binary'); lib<-Sys.getenv('R_LIBS_USER'); .libPaths(c(lib,.libPaths())); install.packages('BiocManager',lib=lib,quiet=TRUE); BiocManager::install('ropls',lib=lib,ask=FALSE,update=FALSE,quiet=TRUE)"
& 'D:\R-4.6.0\bin\Rscript.exe' services/analysis/tests/test_ropls_published_reference.R
```

Installation exited 0. The reference test exited 0 with ten named checks and `ROPLS PUBLISHED REFERENCES PASSED`; startup printed locale `C.UTF-8` warnings. The test loads `sacurine` public package data, **183 samples × 109 variables**, and compares `ropls`' summary to the [published ropls vignette, sections 4.2–4.4](https://bioconductor.org/packages/release/bioc/vignettes/ropls/inst/doc/ropls-vignette.html). No company or unpublished research data is included.

| Model, published fixture | R²X cumulative | R²Y cumulative | Q² cumulative | Components | Result |
| --- | ---: | ---: | ---: | --- | --- |
| PCA | 0.501 | not applicable | not asserted | 8 predictive, 0 orthogonal | matched to 3 decimals |
| PLS-DA | 0.275 | 0.73 | 0.584 | 3 predictive, 0 orthogonal | matched to printed precision |
| OPLS-DA | 0.275 | 0.73 | 0.602 | 1 predictive, 2 orthogonal | matched to printed precision |

The test checks summary values and selected component counts, not elementwise scores or loadings: component signs can flip, and equivalent subspaces can rotate. Tolerances are **0.0005** for three-decimal values and **0.005** for two-decimal R²Y, matching publication rounding. PLS-DA/OPLS-DA use `set.seed(1)` and `permI=0` to compare the core fits. This reference does **not** validate a permutation p-value. PCA uses package defaults. The fixture is a public benchmark, not a small controlled experimental design; a reliable small external OPLS-DA numerical oracle remains pending. An attempted direct, degenerate 8×2 synthetic `ropls` fit failed internally and was not used to adjust expected values or claimed as a reference.

## Actual project implementation and separate Q² meaning

`services/analysis/supervised.R` calls `ropls::opls` with explicit predictive/orthogonal counts, `scaleC='none'`, `permI=0`, `crossvalI=min(7,nrow(x))`; project preprocessing occurs within `supervised_partition` on training IDs. The full-fit **R²X/R²Y** fields come from `model@summaryDF`. The project-reported `Q2_trainingPrevalence` is instead `1 - PRESS / PRESS_null` over nested outer out-of-fold predictions in `supervised_validation.R`, against training-prevalence null predictions. It is **not** the vignette's internal `ropls` `Q2(cum)`. Do not compare the two numerically or market the full-fit R² as independent prediction accuracy.

Existing `test_supervised.R` checks nested out-of-fold balanced accuracy, reconstruction of the project Q², held-out preprocessing invariance, ties in the plus-one permutation formula, deterministic permutations and sample-unit boundaries. Phase 4 added explicit assertions that two permutations cannot produce p below **1/3** and that a 3+3 independent-unit case retains the small-n and low-permutation warnings. A deliberately small 3+3 OPLS-DA fixture returned `NO_VALID_CANDIDATE`; this is a recorded model-fit limit, not a passed OPLS-DA prediction reference. The test suite with larger synthetic data passed using real `ropls`.

```powershell
$env:R_LIBS_USER=Join-Path $env:TEMP 'flavor-phase4-r-lib'
foreach($t in 'test_methods.R','test_reference_values.R','test_supervised.R','test_supervised_resource_limits.R','test_ropls_published_reference.R') {
  & 'D:\R-4.6.0\bin\Rscript.exe' (Join-Path 'services\analysis\tests' $t)
  if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
}
```

All five scripts exited 0; supervised printed `ALL SUPERVISED TESTS PASSED`, resource limits `RESOURCE LIMIT TESTS PASSED`, and the public reference printed its marker above. This is local evidence only. The new reference test is not in public PR CI because R/ropls is not provisioned there. Remaining work: a truly independent reference for the project's nested Q² and OPLS-DA prediction behavior, declared scaling/centering comparisons for a controlled small fixture, permutation calibration with realistic independent n, and clean-room R setup before any CI promotion. Do not use this report alone to approve a new scientific model claim.
