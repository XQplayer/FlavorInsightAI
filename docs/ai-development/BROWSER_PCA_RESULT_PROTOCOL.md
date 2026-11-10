# PCA result protocol v1

The executable contract is `frontend/src/analysis/pcaResult.mjs` (`toUnifiedPcaResult`, `validateUnifiedPcaResult`). Browser JSON export uses this protocol. A future Hosted PCA adapter must emit and validate the **same envelope** without claiming it used the browser algorithm.

## Top-level fields

| Field | Type and rule |
| --- | --- |
| `schema_version` | Required literal `flavor-pca-result/1`. Reject unknown major versions. |
| `engine` | `browser-pca` or `hosted-pca`. `algorithm` is currently `pca-svd`; `engine_version` is a nonempty engine-specific string. Algorithm equality does not imply identical sign orientation or numerical implementation. |
| `dataset_metadata` | `id`, `name`, aligned unique `sample_ids`, `feature_ids`, aligned `groups` and `feature_units`, `synthetic` boolean, and `source_sha256` (64 hex characters or `null`). No raw workbook or data matrix. Empty unit string means unknown, not dimensionless. |
| `parameters` | `missing`: `error`/`mean`/`median`/`drop-samples`/`drop-features`; `constant`: `error`/`drop`; `center` boolean; `scale`: `none`/`uv`/`pareto`; `components`: positive integer or `null` for numerical rank; `include_internal_standards` boolean. |
| `preprocessing` | Arrays `means`, `sample_sd`, `divisors` aligned to retained `feature_ids`; `imputed` records; `dropped_samples`, `dropped_features`, `excluded_samples`, `excluded_internal_standards`, and `input_cell_states`. Imputation values must be finite. This records transformations without editing source bytes. |
| `scores` | `components` (`PC1`…`PCk`), `values` finite `n × k`, `coordinate_unit: "preprocessed-coordinate"`. Rows align to `sample_ids`; do not label scores with a physical concentration unit. |
| `loadings` | Same `components`; finite `p × k` SVD rotation. Rows align to `feature_ids`. A whole component may reverse sign across equivalent PCA implementations. |
| `eigenvalues` | Finite, nonnegative values of length `min(n,p)`, in squared preprocessed-coordinate units. |
| `explained_variance`, `cumulative_variance` | Finite **fractions**, not percentages, length `min(n,p)`; cumulative last element is 1 within numerical tolerance. Display code multiplies by 100. |
| `diagnostics` | `numerical_rank`, `warning_codes` and `exploratory_only`. Warning codes include unknown/mixed units, uncertain source lineage, imputation and dropped inputs. No inference, p-value or QC conclusion is fabricated. |
| `provenance` | `dataset_id`, `run_id`, ISO `completed_at`, `execution_environment` (`web-worker` or `remote-service`), source file/sheet (nullable), `matrix_orientation: "samples x features"`, numeric library. Browser and Hosted retain their distinct execution identities. |

## Absence, integrity and compatibility

- Required structural fields cannot be omitted. No `NaN`, infinity or `undefined` is allowed in numerical arrays or imputation records; malformed results fail before export. Unknown source file/sheet/hash is `null`; unknown feature unit is `""` with a warning. Missing cells are handled **before** PCA by the declared policy, so scores and loadings never contain nulls.
- The result is bound to the dataset ID and selected sample/feature IDs. A source SHA-256 is the hash of the original file bytes when imported; it is not a hash of the parsed matrix. A synthetic fixture has no file hash.
- The protocol excludes the raw matrix. A future portable *analysis archive* for recomputation needs a separate, explicitly opted-in dataset snapshot; do not imply the result JSON alone can reproduce the source matrix.
- A Hosted adapter must set `engine: "hosted-pca"`, its own `engine_version` and `execution_environment: "remote-service"`. It must identify its preprocessing and random/numerical environment. Compare output after sign alignment and with documented tolerance; never copy Browser PCA values into a Hosted response.
- A v2 format requires a new `schema_version` and explicit reader/migration. Imported v1 archives must be validated, never silently coerced.

## Code and test evidence

`node --test frontend/src/analysis/pcaResult.test.mjs` checks conversion, browser/hosted identity, source hash rules, raw-matrix exclusion and malformed values. The Browser PCA E2E checks that exported JSON has the v1 envelope and remains tied to the completed synthetic result. This validates the current browser producer; no Hosted implementation is claimed.
