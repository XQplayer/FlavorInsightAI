# Local analysis engine 1.0.0

No pip dependencies. Verified local runtime: Python **3.13.15** (PSF license),
R **4.6.0** (GPL-2/GPL-3), stats **4.6.0** (part of R), jsonlite **2.0.0**
(MIT + its LICENSE file). Optional next-stage supervised engine uses ropls
**1.44.0** (CeCILL), not advertised or accepted by this service yet.
Package license texts ship with the installed distributions (`R.home('doc')`,
`system.file('LICENSE', package='jsonlite')`, `packageDescription('ropls')`).
The existing jsonlite binary reports it was built under R 4.6.1; actual numerical
and JSON round-trip tests below run under R 4.6.0. No additional installation or
network access is needed. Do not upgrade packages silently.

## Start / stop

Shipped startup entry point, from the repository root in PowerShell:

```powershell
& 'D:/Apps/Python313/python.exe' services/analysis/server.py --port 8890 --rscript 'D:/R-4.6.0/bin/Rscript.exe' --rlibs 'E:/codex/Projects/FlavorThresholdDB/_local/analysis-r-library'
```

Defaults: Python `D:/Apps/Python313/python.exe`, Rscript
`D:/R-4.6.0/bin/Rscript.exe`, project-local R library
`E:/codex/Projects/FlavorThresholdDB/_local/analysis-r-library`, port 8890.
Override the direct server options with `--rscript`, `--rlibs`, `--port`,
`--timeout`. The foreground server can be stopped with Ctrl+C. It never changes
ports 5174 or 8787. Jobs and tokens are **memory-only**;
restart loses all history and does not claim old jobs are still running. A process
forcibly terminated outside the broker cannot clean up its temporary files;
normal cancellation/shutdown removes each job's isolated temporary directory.

**Historical launcher incident (2026-10-23):** the initially intended
`scripts/start_analysis_service.ps1` was written and its presence/hidden-launch
contract passed a Python read test, but a subsequent PowerShell parser check
reported access denied and the file then disappeared. No matching recent
Defender detection or operational event was returned by read-only checks. Cause
is unconfirmed; no security controls were disabled and the file was not
recreated to bypass them. The dedicated PS1 launcher is **not delivered**; the
chosen delivery is the existing Python CLI above, with unchanged HTTP security
checks. The obsolete PS1 presence check is replaced by a real CLI subprocess
test covering `--help`, ephemeral-port startup, `/health`, and termination of
that test-owned process. This is verification of the shipped startup path, not
a claim that the historical PS1 issue was resolved. No persistent 8890 service
was started during implementation.

## HTTP contract

Bind **127.0.0.1 only**. Every request must have exactly one Host of
`127.0.0.1:<actual-port>` or `localhost:<actual-port>`. Origin is exact, not suffix
matched: `http://127.0.0.1:5180`, `:5174`, `:5175`, and localhost equivalents.
No wildcard, remote deployment origin, HTTPS downgrade or `null` origin is accepted.

1. `GET /health`: public, no token, optional Origin still validated if supplied.
   Returns serviceVersion, capabilities.methods, capabilities.supervised=false,
   limits and persistence. No token, paths or original data.
2. `POST /session` with JSON `{}` and valid Origin: `{token,expiresIn:28800}`.
   Token is random, origin-bound, memory-only; keep it out of URLs/logs/storage.
3. `POST /jobs` with `Authorization: Bearer <token>`, valid Origin and
   `Content-Type: application/json`: `{dataset,recipe,analysis}`. Returns 202 job.
4. `GET /jobs/{id}` polls a job; `DELETE /jobs/{id}` cancels queued/running work.
   Both require token and Origin. Cancelled status is terminal; owned R process
   tree is terminated. Finished jobs remain finished if cancellation is requested.

Job: `{id,status,createdAt,startedAt,finishedAt,requestHash,result,error,logs}`.
Statuses: queued/running/completed/failed/cancelled. requestHash is SHA-256 of
canonical UTF-8 JSON (sorted keys, compact separators), not an original-file hash.
Timestamps are UTC ISO 8601. error is `{code}` or null. logs is reserved, currently
empty: raw R stdout/stderr is discarded to avoid exposing data, paths or secrets.
Each completed result provenance includes engineVersion, datasetId,
recipeSchemaVersion, recipeApplied, rVersion and packages.stats. The enclosing
job requestHash binds the exact dataset/recipe/analysis request. recipeApplied is
false for observed-only inference/distributions, which do not use exploration.

Limits: 32 MiB JSON, 2,000,000 cells, 8 queued jobs, one running job, 180 seconds
per job, 32 retained jobs, 64 live session tokens. Old terminal jobs are evicted
before history fills. Payload/cell excess returns 413; queue/history full 429;
bad JSON/schema/method 400; Origin/Host 403; missing token 401; unknown run 404.
No arbitrary code, script names, shell snippets or file paths are interpreted.
No private fixture or result is committed; execution uses temporary JSON files.

## Stable dataset / recipe contract

Dataset schemaVersion 1 is the existing immutable samples-by-features contract
in `frontend/src/analysis/dataset.mjs`. Only finite numbers and null are accepted.
Samples are selected by `include !== false`, not by names. Internal standards
are excluded by default. Quality masks override a cell state conservatively:
original-imputed, then unknown-source, then QC-filtered. QC-filtered and missing
states are treated as missing even if a numeric payload is supplied. Never revive
QC-filtered cells with any imputation.

All recipe sections are optional; these are the defaults and accepted options:

```json
{
  "schemaVersion": 1,
  "filter": {
    "includeInternalStandards": false,
    "maxMissing": null,
    "missingScope": "global",
    "allMissing": "error",
    "zeroVariance": "keep",
    "allowMixedUnits": false,
    "allowMixedMatrixTypes": false
  },
  "impute": {"method": "none", "value": 0, "k": 3},
  "normalize": {"method": "none", "target": 1, "featureId": null,
                "acknowledgeDoubleNormalization": false},
  "transform": {"method": "none", "pseudocount": 0},
  "scale": {"method": "none", "axis": "feature"}
}
```

Fixed order: filter → fill → sample normalize → transform → scale.

- filter.featureIds optionally selects stable IDs. maxMissing is [0,1], drops
  features exceeding the threshold; missingScope `global` or `group` (worst group).
  allMissing `error`/`drop`; zeroVariance `keep`/`drop`. All drops are audited.
  Differing nonblank units or sample sourceConfiguration.matrixType require
  explicit acknowledgement. If matrixType is blank/missing, the existing
  Shimadzu sourceConfiguration.sampleForm (liquid/solid) is used. Blank metadata
  is not invented or grouped by names.
- impute.method `none`, `constant`, `median`, `half-minimum`, `knn`.
  Median and minimum positive/2 use only fitted training columns. KNN uses mean
  of up to k nearest fitted training rows measured by RMS Euclidean distance over
  shared finite other features; deterministic row-order ties. No neighbors is an
  explicit error. KNN is on the pre-normalization/pre-scale feature values, so
  heterogeneous scales should be considered in the scientific recipe.
- normalize.method `none`, `sum`, `median`, `pqn`, `internal-standard`.
  Divide by per-sample denominator and multiply by target (positive, default 1).
  PQN's reference is fitted column medians; denominator is median positive finite
  sample/reference quotient. IS requires featureId; reference is read before
  default feature exclusion. provenance.semiQuantitative=true or
  provenance.matrixType='semiquantitative' or the existing verified archive
  provenance.source='shimadzu-verified-archive' requires explicit
  double-normalization acknowledgement. Nonpositive/undefined denominators fail.
- transform.method `none`, `log2`, `log10`, `ln`, `sqrt`. Explicit nonnegative
  pseudocount only; default zero, never implicit +1. Domain errors fail.
- scale.method `none`, `center`, `uv`, `pareto`, `minmax`, `robust`.
  Axis `feature` or `sample`. UV uses sample SD; Pareto divides centered values by
  sqrt(sample SD); minmax uses min/range; robust median/IQR (R type 7). Undefined
  or zero denominators fail. Sample-axis parameters are sample-local, not learned
  across held-out samples.

R API: `fit_recipe(dataset, recipe=list(), training_ids=NULL)`; training_ids are
stable sample **IDs**, never integer positions. Returns
`{matrix,cellStates,sampleIds,featureIds,audit,state}`. New exploratory fills have
state `analysis-imputed`, without rewriting source lineage. `state` contains
recipe, selected feature IDs, trainingSampleIds, imputation training references,
PQN reference and feature scaling parameters. `apply_recipe(dataset,state)` uses
those fitted parameters and never refits from held-out values. Features missing
from the new snapshot are an error. Both functions are side-effect-free R objects;
source snapshots are unchanged.

## Analysis options and results

Canonical method names only: preprocess, pca, heatmap, compare, correlation,
distribution. Unknown names fail. Common result:
`{schemaVersion:1,method,data,preprocessing,provenance}`. preprocessing is the
fit_recipe result for exploratory methods, null for observed-only methods.
All matrices are samples × features, all exported orders are **one-based** R
indices; nonfinite output estimates serialize as null with reasons where relevant.

### PCA and heatmap

PCA `analysis:{method:'pca',components?,center?}`. prcomp SVD, no automatic scaling.
Center defaults true unless feature center/UV/Pareto already centered the recipe.
Requires complete finite matrix, positive finite variance and nonzero numerical
rank relative to the largest singular value (not an absolute intensity cutoff).
Components default
to rank; requesting more fails. data: scores, loadings, eigenvalues, explained,
cumulative, rank, center, sampleIds, featureIds. Explained variance is a fraction.

Heatmap options: displayScale `none`/`feature-z`/`sample-z`, clusterRows and
clusterColumns booleans; rowDistance/columnDistance `euclidean`, `manhattan`,
`pearson`, `spearman` (latter two are 1-correlation); rowLinkage/columnLinkage
`average`, `complete`, `single`, `ward.D2`. Ward requires Euclidean. Display Z
scores never overwrite analysisMatrix. data: matrix (display), analysisMatrix,
rowOrder, columnOrder, rowTree, columnTree, sampleIds, featureIds, displayScale.
Tree fields are order, merge, height, labels; merge follows native hclust encoding.

### Observed independent-unit branch

`prepare_independent(dataset, require_confirmation=TRUE)` returns
`{matrix,samples,featureIds,features}`. Values are only cells whose final lineage
is observed; original imputation, QC, missing and unknown excluded. Technical
repeats are averaged by biologicalUnitId + condition; output samples retain
sourceSampleIds. Inference requires explicit independenceConfirmed=true and
nonblank groups/units. Repeated units/subjects across conditions are rejected for
unpaired tests and correlations. Paired methods require exactly matched nonblank
subjectId sets with one biological-unit-condition row per subject after technical
aggregation. Missing pairs are removed per feature, never independently shuffled.

Compare options: test `welch` (default), `student`, `paired-t`, `wilcoxon`,
`paired-wilcoxon`, `anova`, `welch-anova`, `kruskal`; explicit control/treatment
or comparisons array of `{control,treatment}`. Multi-group requires at least
three groups, supplied by groups or all explicit labels. alternative defaults
`two.sided`, also `less`/`greater` (treatment relative to control). Wilcoxon uses
asymptotic tests (exact=false), ties supported. Optional analysis.transform uses
the explicit transform schema above. **Exploratory recipe fills/scales/filters
are never used for inference**; display filtering occurs after multiplicity.
Internal standards are excluded unless analysis.includeInternalStandards=true.

data.results rows: featureId, comparison, control, treatment, method, alternative,
nControl/nTreatment, controlSummary/treatmentSummary (n/mean/sd/median/iqr),
effect (difference of transformed means), effectScale, rawMeanDifference,
ciLow/ciHigh (t-test effect CI only), foldChange/log2FoldChange (positive raw means,
never Z scores), fcNaReason, p, padj, naReason. Multi-group rows additionally have
groupSummaries; pairwise-only fields are null/not applicable.

adjust `BH` (default), `holm`, `bonferroni`, `none` (warning); adjustScope
`comparison` (all testable features in each contrast) or `all` (all contrasts and
features in that result family). Do not filter by p/FC before adjustment. Omnibus
posthoc rows are a separate family: ANOVA pooled-residual-variance t contrasts,
Welch ANOVA pairwise Welch contrasts, Kruskal pairwise rank-sum contrasts; each
has explicit method, comparison, featureId, p/padj. They are not mislabeled as
Tukey, Games-Howell or Dunn. Choose scope=all to control the combined pair-feature
posthoc family. Undefined/insufficient tests retain NA and a reason.

Correlation options: correlation `pearson`/`spearman`, adjust as above. data.results
contains featureId, otherFeatureId, n, r, p, padj, naReason. Pairwise observed
complete units only; at least 3, nonconstant values. Adjustment covers all pairs.

Distribution is descriptive and does not require independence confirmation;
still aggregates declared repeats, excludes unobserved cells and default IS.
data.points gives unit/group/raw values, summaries gives per-feature group
summaries for box/violin views. composition gives per-unit nonnegative proportions
only for complete, same-unit, positive-total profiles; otherwise null values and
an explicit reason. No missing abundance is silently converted to zero.

## Reproducible tests

From repository root (all committed fixtures are labelled public synthetic):

```powershell
$env:LC_ALL='C'
$env:R_LIBS_USER='E:/codex/Projects/FlavorThresholdDB/_local/analysis-r-library'
& 'D:/R-4.6.0/bin/Rscript.exe' services/analysis/tests/test_preprocess_edges.R
& 'D:/R-4.6.0/bin/Rscript.exe' services/analysis/tests/test_methods.R
& 'D:/R-4.6.0/bin/Rscript.exe' services/analysis/tests/test_review_regressions.R
& 'D:/Apps/Python313/python.exe' -m unittest discover -s services/analysis/tests -p 'test_service.py' -v
```

R tests include base reference PCA eigenvalues/reconstruction (sign-invariant),
Welch/BH, Pareto SD, fit/apply leakage sentinel, technical-repeat effective n,
paired checks, QC protection and method-family smoke checks. Python tests use
real ephemeral loopback HTTP and R subprocesses, security checks, queue/running
cancellation and timeout. No persistent service or private HD file is needed.
