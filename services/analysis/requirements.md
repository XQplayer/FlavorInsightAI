# Local analysis engine 1.0.0

No pip dependencies. Verified local runtime: Python **3.13.15** (PSF license),
R **4.6.0** (GPL-2/GPL-3), stats **4.6.0** (part of R), jsonlite **2.0.0**
(MIT + its LICENSE file). The supervised engine uses ropls **1.44.0** (CeCILL).
PLS-DA/OPLS-DA are advertised and accepted only when the startup runtime probe
can load ropls and jsonlite from the selected local R library.
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

The command explicitly selects Python `D:/Apps/Python313/python.exe` and the
project-local R library `E:/codex/Projects/FlavorThresholdDB/_local/analysis-r-library`.
CLI defaults are Rscript `D:/R-4.6.0/bin/Rscript.exe` (or ANALYSIS_RSCRIPT) and
port 8890; when --rlibs is omitted the service uses R_LIBS_USER/the R default
library search path, which may not contain jsonlite or ropls on this host.
Override the direct server options with `--rscript`, `--rlibs`, `--port`,
`--timeout`. The foreground server can be stopped with Ctrl+C. It never changes
ports 5174 or 8787. Jobs and tokens are **memory-only**;
restart loses all history and does not claim old jobs are still running. A process
forcibly terminated outside the broker cannot clean up its temporary files;
normal cancellation/shutdown removes each job's isolated temporary directory.

**Historical launcher incident (2026-10-23):** the initially intended
`scripts/start_analysis_service.ps1` was written and its presence/hidden-launch
contract passed a Python read test, but a subsequent PowerShell parser check
reported access denied and the file then disappeared. The user subsequently
confirmed antivirus deletion, with detection `HEUR:TrojanDownloader/PS.NetLoader.ae`.
The recovered original patch used local paths, a loopback health request and a
hidden local Python launch; the detected file bytes/hash were unavailable, so
this is **not** a guarantee that the detection was a false positive. No security
controls were disabled and no exception/allowlist was added. The dedicated PS1
launcher is **not delivered** and must not be recreated to bypass protection.
The user explicitly chose to retain the existing Python CLI, with unchanged HTTP security
checks. The obsolete PS1 presence check is replaced by a real CLI subprocess
test covering `--help`, ephemeral-port startup, `/health`, and termination of
that test-owned process. This is verification of the shipped startup path, not
a claim that the historical PS1 issue was resolved. After the user's explicit
choice to retain Python startup, a hidden local Python CLI process was started
on port 8890 for the isolated workbench preview, with `--timeout 1200` to allow
longer supervised validation jobs. Its health response confirmed all eight
methods and the selected R/package versions. This process is not an autostart
installation; it must be started again after a restart.

## HTTP contract

Bind **127.0.0.1 only**. Every request must have exactly one Host of
`127.0.0.1:<actual-port>` or `localhost:<actual-port>`. Origin is exact, not suffix
matched: `http://127.0.0.1:5180`, `:5174`, `:5175`, and localhost equivalents.
No wildcard, remote deployment origin, HTTPS downgrade or `null` origin is accepted.

1. `GET /health`: public, no token, optional Origin still validated if supplied.
   Returns serviceVersion, capabilities.methods, capabilities.runtimeReady,
   capabilities.supervised, capabilities.packages.jsonlite/ropls when available,
   limits and persistence. No token,
   paths or original data. A cached startup subprocess uses fixed trusted R code
   (`requireNamespace`, `packageVersion`), never client expressions, with a 20 s
   probe timeout. Missing R/jsonlite sets runtimeReady=false, methods=[] and all
   submissions fail ENGINE_NOT_AVAILABLE. If the basic runtime works but ropls
   is absent, supervised=false, only basic methods are advertised, and supervised
   submissions fail SUPERVISED_NOT_AVAILABLE. Restart the
   service after changing a runtime/library. The probe may add several seconds
   to startup; a health reply itself never launches a new R process.
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
Timestamps are UTC ISO 8601. error is `{code}` or null. logs contains only bounded
service codes (normally empty; TEMP_CLEANUP_FAILED if three temporary-directory
cleanup attempts fail). Raw R stdout/stderr and exception strings are discarded
to avoid exposing data, paths or secrets.
Each completed result provenance includes engineVersion, datasetId,
recipeSchemaVersion, recipeApplied, rVersion and packages.stats. The enclosing
job requestHash binds the exact dataset/recipe/analysis request. recipeApplied is
false for observed-only inference/distributions, which do not use exploration.

Limits: 32 MiB JSON, 2,000,000 cells, 8 queued jobs, one running job, 180 seconds
per job by default (`--timeout` 1–3600 s), 32 retained jobs, 64 live session tokens. Old terminal jobs are evicted
before history fills. A job owned by a worker is not evicted, including one whose
cancelled status is already visible; ownership ends only after process and
temporary-file cleanup. Startup/cleanup exceptions cannot stop subsequent jobs
or leave an unhandled running status. Payload/cell excess returns 413; queue/history full 429;
bad JSON/schema/method 400; Origin/Host 403; missing token 401; unknown run 404.
No arbitrary code, script names, shell snippets or file paths are interpreted.
No private fixture or result is committed; execution uses temporary JSON files.

Additional pre-allocation limits are advertised under health.limits:
`correlationMaxPairs=250000` (nFeatures choose 2 after internal-standard exclusion),
`clusterMaxDistancePairsPerAxis=1000000` (nRows choose 2 for each enabled,
post-preprocessing clustering axis). These guards run before `combn`, `cor`, or
`dist`; errors are CORRELATION_PAIR_LIMIT and CLUSTER_DISTANCE_LIMIT. They do not
truncate or subsample data, and disabled heatmap clustering does not allocate
that axis's distance matrix. Supervised fit and cell-fit budgets are below.

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
distribution, plsda, oplsda. The two supervised methods additionally require a
loadable ropls runtime and are advertised only when that capability is available.
Unknown names fail. Common result:
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

`prepare_independent(dataset, require_confirmation=TRUE,
allow_mixed_matrix_types=FALSE, groups=NULL)` returns
`{matrix,samples,featureIds,features,audit}`. Existing callers using its first two
arguments remain compatible. groups is an optional explicit group-label vector;
requested groups must have included samples, and filtering happens before unit,
subject, matrix-stratum or transform validation. Values are only cells whose final lineage
is observed; original imputation, QC, missing and unknown excluded. Technical
repeats are averaged by biologicalUnitId + condition; output samples retain
sourceSampleIds. Aggregated samples also retain a sourceConfiguration of common
metadata, all contributing sourceConfigurations, and sourceMatrixTypes. A
homogeneous sampleForm is preserved; explicitly acknowledged heterogeneous
technical-unit sources use sampleForm/matrixType='mixed', with their actual
types and contributing sample IDs retained in audit.mixedTechnicalUnits. This
metadata remains available to downstream fold preprocessing rather than silently
discarding the original matrix stratum. Inference requires explicit independenceConfirmed=true and
nonblank groups/units. Repeated units/subjects across conditions are rejected for
unpaired tests and correlations. Paired methods require exactly matched nonblank
subjectId sets with one biological-unit-condition row per subject after technical
aggregation. Missing pairs are removed per feature, never independently shuffled.

All observed-only methods (compare, correlation, distribution) reject differing
nonblank matrix types by default, using sourceConfiguration.matrixType then the
existing Shimadzu sampleForm fallback. To deliberately cross these strata, set
`analysis.allowMixedMatrixTypes=true`; optionally record the scientific purpose
in `analysis.mixedMatrixTypesReason`. The result emits
`data.warnings=['MIXED_MATRIX_TYPES_ACKNOWLEDGED', ...]` and mirrors the full
audit under data.matrixStrata and provenance.matrixStrata: matrixTypes (always a
JSON array), mixed, acknowledged, sourceSampleIds, mixedTechnicalUnits, warnings,
and reason. This acknowledgement is separate from exploratory recipe filtering.
Differing feature units alone do not prohibit per-feature comparisons or
correlations; they still prohibit an unqualified composition sum.

Compare options: test `welch` (default), `student`, `paired-t`, `wilcoxon`,
`paired-wilcoxon`, `anova`, `welch-anova`, `kruskal`; explicit control/treatment
or comparisons array of `{control,treatment}`. Multi-group requires at least
three groups, supplied by groups or all explicit labels. alternative defaults
`two.sided`, also `less`/`greater` (treatment relative to control). Wilcoxon uses
asymptotic tests (exact=false), ties supported. Optional analysis.transform uses
the explicit transform schema above. **Exploratory recipe fills/scales/filters
are never used for inference**; display filtering occurs after multiplicity.
Internal standards are excluded unless analysis.includeInternalStandards=true.
Only groups participating in the explicit contrast list (its union) or explicit
multi-group selection are aggregated, checked and transformed. Unused samples
remain unchanged in the source dataset and cannot trigger transform-domain or
unit/subject errors. Independence is conservatively checked over the whole union
of selected unpaired contrasts, including repeated units across distinct
contrasts. All eligible features still enter each contrast's multiplicity family.

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

## Supervised PLS-DA / OPLS-DA contract

Use the same `{dataset,recipe,analysis}` job endpoint and common
`{schemaVersion:1,method,data,preprocessing,provenance}` result envelope. This is
an actual ropls numerical engine, not a chart-only placeholder. No frontend,
original Shimadzu processing algorithm, public deployment, or source file is
changed by this service. A future UI must present full-fit exploration separately
from independent-unit outer validation; never show a reliable-classifier badge
because of score separation, R2, or VIP > 1.

### Request options and feasibility

Example (all omitted values have the defaults shown except optional groups):

```json
{
  "method": "plsda",
  "groups": ["control", "treatment"],
  "classOrder": ["control", "treatment"],
  "outerFolds": 5,
  "innerFolds": 3,
  "repeats": 1,
  "seed": 20261023,
  "predictiveComponents": [1, 2],
  "orthogonalComponents": [0],
  "permutations": 200,
  "acknowledgeExploratory": false,
  "allowMixedMatrixTypes": false,
  "mixedMatrixTypesReason": null
}
```

Only these analysis keys are accepted (SUPERVISED_OPTIONS for unknown keys).
`groups` is an optional unique string array selecting included groups **before**
independence/matrix validation. Default is all included groups. `classOrder` must
contain each selected class exactly once; default is groups order or first
appearance of included groups. PLS requires >= 2 classes; OPLS requires exactly
2. OPLS defaults to predictiveComponents=[1], orthogonalComponents=[1]; every
OPLS candidate must have exactly one predictive and >= 1 orthogonal component.
No fallback to zero orthogonal components is allowed. PLS orthogonalComponents
must equal [0]. Each component grid has 1–5 unique integers, predictive 1–5 and
orthogonal 0–5. Scalar component values are accepted by R as singleton grids;
the UI should send arrays. Ties in inner accuracy choose fewer total components,
then fewer predictive components deterministically.

outerFolds/innerFolds: integers 2–10; repeats: 1–10; seed: 0–2147000000;
permutations: integer 0–1000. Default 200, with 1000 available explicitly. Small
positive counts are accepted for regression/quick exploration and clearly
labelled LOW_PERMUTATION_COUNT. Zero means **not performed**, p=null,
pNaReason=PERMUTATION_NOT_REQUESTED; this is not a validated permutation result.
No requested folds, repeats, or permutation count is silently lowered.

Require provenance.independenceConfirmed=true, explicit group and biologicalUnitId
for every included sample. Aggregate technical repeats by unit+group using only
finite cells with original state observed. Source sample IDs, shared and per-source
configuration, source matrix types, original provenance and per-source cell states
remain auditable. Values labelled original-imputed/unknown do not become observed.
If no observed value exists but any source repeat is QC-filtered, the aggregate
cell remains QC-filtered and cannot be filled. Otherwise a missing aggregate may
be filled from training-only parameters. The original Shimadzu semiquantitative
provenance is retained, so internal-standard double-normalization protection still
applies. Samples use stable `unit:<biologicalUnitId>` IDs in lexical unit order;
technical duplication does not create extra units or change fold assignments.

The same unit/subject in multiple selected conditions is rejected with
PAIRED_SUPERVISED_UNSUPPORTED. Mixed matrix types are blocked by default; explicit
allowMixedMatrixTypes=true is carried through each preprocessing partition and
reported in data/provenance.matrixStrata. Differing measurement units still obey
recipe.filter.allowMixedUnits. No acknowledgement overrides independence or QC.

Any class with <= 2 independent units is blocked (INSUFFICIENT_INDEPENDENT_UNITS).
3–4 units/class require acknowledgeExploratory=true and feasible explicit folds;
with 3/class, default outerFolds=5 is infeasible. 3/class, outer=3, inner=2,
PLS predictive=[1] is tested using real ropls. The same OPLS design fails inner
rank and is rejected, not replaced with PLS. Every inner/outer training partition
must contain every class. Infeasible requested folds produce OUTER_FOLDS_INFEASIBLE
or INNER_FOLDS_INFEASIBLE. The UI should explain these errors without automatic
downgrades.

Each processed training matrix must be entirely finite; component sum cannot
exceed min(qr(X)$rank, nTrain-1). fit_recipe independently fits feature filtering,
missingness thresholds, imputation, PQN reference and scaling on training IDs;
apply_recipe only transforms the held-out subset with those fitted parameters.
All inner candidates must succeed on **every** inner fold to be eligible.
Failures are audited per candidate/fold. With no valid candidate the job fails
NO_VALID_CANDIDATE; HTTP exposes the sanitized code, not raw R diagnostic text.
Explicit feature selection in the recipe is treated as a user-specified analysis
scope; do not feed it feature IDs learned from full-data labels.

### Selection, continuous responses and validation

Nested CV stratifies at biological-unit level using deterministic seeds. Each
outer training set runs its own inner pooled-OOF balanced-accuracy selection,
then refits the winning component count on that outer training set. A **separate**
inner selection on all independent units chooses the final full-fit model; its
components need not equal any outer-fold selection.

ropls calls explicitly set predI, orthoI, permI=0, scaleC='none', log10L=FALSE,
fig.pdfC='none', info.txtC='none', crossvalI=min(7,nTrain). The latter is an explicit
package-internal fitting parameter, not the wrapper's reported validation. No
ropls auto-component choice or internal Q2 is used as the validation statistic.
Recipe centering/scaling is not repeated by ropls X scaling. The actual model's
Y centering/scaling is undone for predictions.

Continuous responses reproduce the installed predict(opls) finite-X formula:
remove near-zero columns only under its dimension rule; scale by model xMean/xSd;
subtract each actual orthogonal score times loading; multiply coefficientMN;
undo ySd/yMean. Binary encoding uses first class=0, second=1 and **strictly** >.5
for second class (tie chooses first). Multiclass uses fixed-order one-hot Y and
first argmax. Responses may be negative or >1; they are not probabilities and
must never be clipped. Q2 is computed from these responses, never decoded labels.

Known upstream limitation verified with ropls 1.44.0 under R 4.6.0: its direct
single-row OPLS predict method errors on a matrix/vector tcrossprod shape. The
wrapper explicitly makes the loading a column matrix, preserving the same formula.
Single-row wrapper predictions are tested against the first row of official
predict on a duplicated held-out row, and against the wrapper multirow formula.
Do not describe the upstream single-row call as passing. Installed packages are
not patched, and no substitute PLS/OPLS algorithm is implemented.

`data.validation` contains:

- `balancedAccuracy`: mean of repeat-specific pooled outer-OOF balanced accuracy.
- `confusion`: rows=true, columns=predicted, both in classOrder; sums counts across
  repeats. These repeated counts are **not** independent N. `byRepeat` contains
  repetition, confusion and balancedAccuracy separately.
- `PRESS`, `PRESS_null`, `Q2_trainingPrevalence = 1 - PRESS/PRESS_null`. For each
  held-out unit the null response is its outer **training** class prevalence.
  Both sums include all response dimensions/repeats; negative Q2 is retained.
  Zero null PRESS gives Q2=null, Q2NaReason=ZERO_NULL_PRESS.
- `predictions`: one row per unit per repeat with sampleId, biologicalUnitId,
  repetition (1-based), fold (1-based), trueClass, trueResponse, response,
  trainingPrevalence and predictedClass. Binary response vectors remain arrays
  of length one. These rows reconstruct PRESS, Q2, confusion and balanced accuracy.
- `folds`: repetition/fold/outerSeed/innerSeed, trainingSampleIds/testSampleIds,
  selection (selected components, inner criterion/seed, every candidate's valid
  flag/accuracy/failures/inner-fold audits), preprocessing and fit audit.
  Preprocessing audit includes training IDs, retained feature IDs, dropped
  features/reasons, missing ratios, fitted recipe, imputation references/values,
  PQN reference and scaling parameters. Fit audit records actual components,
  rank, roplsCrossvalI and captured package warnings.

`data.fullFit` contains its separate selection, components and fitAudit;
sampleIds, actual model featureIds, preprocessedFeatureIds; R2X/R2Y;
predictive scores/loadings; orthogonalScores/orthogonalLoadings; VIP rows
`{featureId,value}`; and full-fit preprocessing. The model may exclude near-zero
columns beyond recipe filtering, so actual model featureIds key the loading/VIP
rows. Fold feature sets can differ and are explicitly audited. Full-fit R2 and
scores/loadings/VIP are descriptive, not held-out validation.

`data.classOrder`, responseClassOrder, responseEncoding, independentN,
classCounts, exploratory, samples, sourceCellLineage, matrixStrata, options and
warnings complete the result. `preprocessing` at the envelope level mirrors
fullFit.preprocessing; it is **not** the preprocessing used for all CV folds.
provenance records datasetId, engineVersion, rVersion, stats/ropls versions and
the wrapper-validation definition. ID vectors, class-order vectors, predictions'
numeric response vectors, permutation arrays and 1-component score/loading rows
remain JSON arrays even when length one.

### Permutations, budgets and interpretation

Each permutation independently shuffles labels of aggregated biological units,
regenerates stratified outer/inner folds from the permuted labels and reruns the
entire nested feature-filter/preprocess/component-selection pipeline. The tested
statistic is explicitly `mean repeated pooled outer OOF balanced accuracy`.
Final all-data model fitting is unnecessary for this statistic and is not rerun
inside permutations. p=(1+exceedances)/(requested+1), with >= ties counted.

`data.permutation` records statistic, observed, requested/completed/failed,
distribution (null at failed positions), one deterministic seed per requested
permutation, failures with permutation/seed/code/candidate audit, exceedances,
denominator, tiesCountAsExceedances, p and pNaReason. Fold seeds are reproducible
from permutation seed using `(seed + offset*104729) mod 2147483646`: outer offset
= repetition, inner offset = 100*repetition+fold. Permutation seed uses original
seed with offset=100000+permutation. Any required permutation failure makes p
null, pNaReason=REQUIRED_PERMUTATION_FAILED. Failed permutations are never replaced
or excluded by using a completed-only denominator.

Warnings always state that discriminant exploration is not causal, VIP is not a
p value/causal evidence, and responses are not probabilities. Small-N
acknowledgement and low permutation counts remain visible. Statistical
significance, predictive generalization and causal explanation are distinct.

Health advertises `supervisedMaxFits=200000` and
`supervisedMaxCellFits=2000000000`. Conservative estimatedFits is
`(B+1)*repeats*outerFolds*(innerFolds*candidates+1) + innerFolds*candidates+1`;
cell-fits = estimatedFits * independentN * original feature count. Exceeding a
budget returns SUPERVISED_FIT_BUDGET or SUPERVISED_CELL_FIT_BUDGET, without reducing
requested work. These are safety bounds, not a promise that any accepted run
finishes before the configured timeout. For 1000 permutations or larger inputs,
explicitly start Python with a sufficient bounded `--timeout` (maximum 3600).
Cancelling kills the owned R process tree and cleans transient JSON files.

Verified default-200 end-to-end benchmark on the public 24-unit, 3-class,
8-feature fixture, feature UV recipe, default 5 outer / 3 inner folds and [1,2]
predictive candidates: **65.308 s** including cold package load and JSON output,
7042 estimated fits, 200/200 permutations completed, 216738 output bytes;
balanced accuracy=.625, Q2_trainingPrevalence=.27276675989577726,
p=1/201. Timing is machine/load-specific (concurrent R regression was running),
not a universal latency guarantee. This benchmark used no private study data.
An additional ephemeral authenticated HTTP run (including startup capability
probe, job submission and polling) completed all 200 in **64.855 s**, with the
same BA, Q2 and p. Both temporary broker and its worker were shut down afterward.

## Reproducible tests

From repository root (all committed fixtures are labelled public synthetic):

```powershell
$env:LC_ALL='C'
$env:R_LIBS_USER='E:/codex/Projects/FlavorThresholdDB/_local/analysis-r-library'
& 'D:/R-4.6.0/bin/Rscript.exe' services/analysis/tests/test_preprocess_edges.R
& 'D:/R-4.6.0/bin/Rscript.exe' services/analysis/tests/test_methods.R
& 'D:/R-4.6.0/bin/Rscript.exe' services/analysis/tests/test_review_regressions.R
& 'D:/R-4.6.0/bin/Rscript.exe' services/analysis/tests/test_quality_regressions.R
& 'D:/R-4.6.0/bin/Rscript.exe' services/analysis/tests/test_supervised.R
& 'D:/R-4.6.0/bin/Rscript.exe' services/analysis/tests/test_supervised_resource_limits.R
& 'D:/Apps/Python313/python.exe' -m unittest discover -s services/analysis/tests -p 'test_*.py' -v
& 'D:/Apps/Python313/python.exe' services/analysis/tests/benchmark_supervised.py
& 'D:/Apps/Python313/python.exe' services/analysis/tests/benchmark_supervised.py --http
```

R tests include base reference PCA eigenvalues/reconstruction (sign-invariant),
Welch/BH, Pareto SD, fit/apply leakage sentinel, technical-repeat effective n,
paired checks, QC protection and method-family smoke checks. Python tests use
real ephemeral loopback HTTP and R subprocesses, security checks, queue/running
cancellation and timeout. No persistent service or private HD file is needed.
Deterministic concurrency regressions pause a real job before temporary-directory
creation, cancel it, force history eviction, then verify cleanup and a subsequent
real R job. Injected startup and transient cleanup failures also verify worker
survival, terminal status, sanitized errors and removal of temporary data.
Supervised tests include real ropls binary/multiclass/OPLS response equivalence,
rank/independence/QC/matrix guards, stable technical duplicates, held-out sentinel
training-state/selection invariance, PQN/median fitting, reconstructible metrics,
repeated-CV accounting, actual deterministic permutation failures and plus-one p,
and explicit no-reliability warnings. HTTP tests verify honest unavailable ropls
health/acceptance, missing R/jsonlite readiness, cached capabilities, singleton JSON arrays, real PLS jobs and
owned-process cancellation. The separate benchmark runs all default 200
permutations through the engine JSON entry point. Resource-boundary tests use
only small inputs and never allocate a large distance/correlation matrix.
One capability-only subprocess-output double covers the basic-ready/ropls-absent
branch without uninstalling packages; all mathematical models, prediction,
permutation, JSON engine and job cancellation tests execute real R.
