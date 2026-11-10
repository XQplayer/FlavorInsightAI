# Browser PCA: local scientific computing

## Scope and reuse

The **Data analysis** route now opens Browser PCA by default. `?engine=local` opens the existing R-backed workbench; its calculation modules and saved snapshots remain in place. The browser path uses the existing XLSX/CSV importer (`analysis/imports.mjs`), immutable dataset model (`analysis/dataset.mjs`), figure frame, SVG/PNG exporter and download helper. It does not call the local Python/R compute service or the Render API. Input files stay in the browser and are not uploaded by this feature.

The browser engine contract is `run({ dataset, options }, { signal })`. A future hosted adapter can implement that contract with a distinct execution and permission boundary. The current adapter runs a dedicated module Worker and terminates it on completion, failure or cancellation. The UI reports running/completed states only from Worker messages, with no simulated progress.

## Scientific contract

- Rows are samples; columns are numeric variables. The user explicitly maps the sample, group and variable columns. Source bytes are SHA-256 hashed; the selected sheet and dataset snapshot are recorded. A common unit can be entered for the selected variables. Mixed or unspecified units trigger an interpretation warning.
- Default missing and constant-variable policies **fail**. Mean/median imputation, sample/feature exclusion and constant-variable exclusion are explicit choices. QC-filtered cells always fail. The source matrix is never changed; imputed values and exclusions are recorded in `preprocessing`.
- Centering subtracts each variable mean. UV divides by sample SD (`n-1`); Pareto divides by the square root of sample SD. An uncentered, unscaled path is also supported. SVD yields scores, unit-vector loadings, eigenvalues `s²/(n-1)`, explained variance and cumulative variance. Components above numerical rank fail.
- Results include algorithm version `browser-pca@1.0.0`, preprocessing parameters, source provenance, run ID and completion time. The four figures use the same completed result. Biplot arrows have a documented **display-only** multiplier; hover values and CSV retain unscaled loadings. Scores/loadings/variance CSV and result JSON are downloadable. CSV text is escaped for spreadsheet formula injection.
- Browser bounds: at most 2,000 samples, 256 variables and 200,000 cells. Figures abbreviate labels/legends where needed, while complete numerical values remain in tables and exports. PCA is exploratory; group separation is not a significance test.

## Independent reference and validation

`scripts/references/browser_pca_prcomp.R` creates the checked-in **synthetic** 6 × 3 fixture with base R `prcomp` (R 4.6.0). The browser unit test compares centering, UV, Pareto and uncentered paths against the saved R values at absolute tolerance `1e-8`; loading and score signs are aligned per component before comparison. The fixture is independent of the browser implementation and does not represent observed research data.

Local checks on 2026-11-10:

| Check | Command | Result |
| --- | --- | --- |
| Browser PCA unit/reference tests | `cd frontend; node --test src/analysis/browserPca*.test.mjs` | 11 passed, including cancellation during Worker creation |
| R fixture regeneration | `D:\R-4.6.0\bin\Rscript.exe scripts/references/browser_pca_prcomp.R` then compare parsed JSON | matched checked-in reference; local R emitted locale and jsonlite build-version warnings |
| Full frontend regression | `cd frontend; node --test` | 449 passed, 1 existing skip, 0 failed |
| AI Gateway API regression | `python -m unittest scripts.tests.test_ai_gateway scripts.tests.test_ai_tools -q` | 31 passed |
| Lint | `cd frontend; pnpm run lint` | passed |
| Build | `cd frontend; pnpm run build` | passed; existing Vite/RDKit/3Dmol warnings remain |
| Production dependency audit | `cd frontend; pnpm audit --prod` | no known vulnerabilities reported |
| Chrome E2E | `node scripts/e2e/verify_browser_pca.mjs` with `BROWSER_PCA_PLAYWRIGHT` and `BROWSER_PCA_CHROME` | desktop 1440, tablet 820, mobile 390 passed; four figures, CSV/XLSX mapping, missing-value failure/recovery, SVG/PNG/CSV/JSON downloads, no horizontal body overflow or local API call |
| Chrome Worker benchmark | `node scripts/e2e/benchmark_browser_pca.mjs` with the same browser variables | 24×8: 139 ms; 200×40: 78 ms; 500×100: 208 ms; 1000×100: 248 ms; main thread remained responsive; cancellation released Worker |

The E2E test intercepts the local compute API and asserts zero calls and zero POST requests during imports/calculations. This validates runtime independence in the tested path; R and Python remain installed on the development machine for other project functions and independent reference generation. WASM was evaluated against the bounded Chrome timings above and is deferred: a second numerical runtime would add bundle and validation cost without a demonstrated need for the current limits.

Screenshots and machine-readable E2E/benchmark output are generated under ignored `_local/browser-pca-qa/`. No screenshot or synthetic fixture should be treated as real experiment evidence.

## Known limits and rollback

This version does not persist browser PCA runs, perform statistical inference, handle matrices beyond the bounds above, or provide an R/Python-free implementation of the old workbench. It uses the existing in-browser SVG figure framework rather than adding Plotly. PNG export uses the existing fixed-size rasterization path; it does not claim a publication DPI. The dependency audit reports no known issues for packages it covers; the pre-existing CDN-hosted SheetJS package still has a separate supply-chain provenance boundary.

To roll back, revert the Browser PCA commit on `codex/browser-pca`. The prior local R workbench source was retained in `LocalAnalysisWorkbench.jsx`, and no research data, GC-MS Worker algorithm, server configuration or deployment was changed.
