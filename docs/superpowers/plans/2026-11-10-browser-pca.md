# Browser PCA implementation plan

**Goal:** Add a browser-only PCA path to Data analysis, preserving the existing local R workbench.

**Architecture:** Parse an explicitly mapped local XLSX/CSV with existing safe import code, fit a bounded samples × features PCA in a dedicated Worker using JavaScript SVD, and render/export bound results with the existing SVG/download primitives. The browser path makes no compute API request.

**Tech stack:** React 19, Vite, Web Worker, `ml-matrix` SVD, existing SheetJS import and SVG export.

**Spec:** User's Browser-based Scientific Computing Engine request, 2026-11-10.

## Reuse inventory

| Existing module | Reuse | Boundary |
| --- | --- | --- |
| `analysis/imports.mjs` | XLSX/CSV decoding, ZIP and cell limits, explicit mapping | Add source SHA-256 in the new browser flow; no automatic source mutation. |
| `analysis/dataset.mjs` | Immutable samples × features snapshot | Keep source IDs, units and quality states. |
| `analysis/svgExport.mjs`, `analysis/download.mjs` | SVG/PNG serialization and downloads | Plot marks must bind to the completed browser result. |
| `components/analysis/PlotPrimitives.jsx` | Figure frame, markers, bounded plot conventions | Extend only if a needed control cannot be expressed locally. |
| `pages/DataAnalysisPage.jsx` | Existing data-analysis route | Preserve the R-backed workspace as an explicit alternate mode. |
| `services/analysis/statistics.R` | Independent `prcomp` reference generation | Browser runtime never imports/calls it. |

## Contracts and steps

- [x] Fix a clearly synthetic R `prcomp` fixture with source script, saved expected eigenvalues/explained variance/scores/loadings and sign-aligned assertions.
- [x] Write failing tests for import validation, missing/constant policies, scaling, rank, immutability, cancellation contract and reference results.
- [x] Implement versioned browser PCA `run({dataset,options})` and a cancellable Worker client with an explicit matrix bound.
- [x] Add a browser PCA workspace to Data analysis with explicit import mapping, preprocessing settings, real state, result tables and four bound plots.
- [x] Reuse SVG/PNG export and add CSV/JSON exports; verify plot controls and responsive layout.
- [x] Run focused and full front-end checks, no-local-R/Python browser scenario, Chrome desktop/mobile and bounded benchmarks. Record skipped gates honestly in `docs/analysis-browser-pca.md`.

## Scientific decisions

Default missing policy is error; mean/median fill and row/feature exclusion require user selection. QC-filtered cells never become numeric values. Constant features default to error; explicit exclusion is recorded. UV and Pareto divisors use sample SD (`n-1`); PCA always uses samples as rows. Rank uses a relative singular-value tolerance. PCA is exploratory and sign indeterminacy is respected.

## Rollback

Revert this branch's commits; the pre-existing local R analysis route and scientific algorithms are unchanged.
