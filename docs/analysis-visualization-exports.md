# Analysis visualizations and exports

Task 3B adds local presentation of completed, immutable run results. It does not
implement statistics or modify analysis recipes. All identities come from the
run's request, including source sample lineage for aggregated supervised units.

## Scientific boundaries

- PCA axes are limited to stored components and numerical rank. Rank one is
  explicitly one-dimensional. PLS and OPLS predictive/orthogonal axes are not PC axes.
- Heatmaps use the returned display matrix and one-based R orders exactly once.
  Dendrograms use original hclust merges and heights, and are omitted on truncated axes.
- Volcano cutoffs are display-only. p=0 is capped at -log10(p)=300; raw zeros,
  missing values, failed features, effects, CIs, adjustment and scope remain available.
- Distribution plots use observed biological-unit-condition means. Boxes use
  Type 7 quantiles and Tukey 1.5-IQR whiskers. Optional Gaussian KDE uses Scott's
  normal-reference bandwidth, 64 grid points and the observed range; n<3 and
  constant data fall back to boxes and points. No significance is derived.
- Correlation diagonals remain missing unless returned. Full-fit VIP is not a
  p value or causal evidence. Held-out validation and actual permutations have
  separate sections; negative Q2 remains unchanged.

## Presentation and size limits

Scatter plots display the first 500 finite points in result order; point labels
are limited to 40. Matrices display at most 24 ordered rows and 24 columns.
Distribution plots show up to 12 groups and 500 points. Every subset and missing
count is disclosed; full tables remain paged and downloadable. Twelve distinct
marker shapes supplement color, with an explicit repeat warning for larger
group counts. SVGs have a white background, dark text, accessible descriptions,
keyboard selection where applicable, and data alternatives. Synthetic datasets
are labelled in the plot image, not just surrounding page text.

## Local exports

SVG exports serialize the actual rendered chart with explicit styles and metadata.
PNG exports rasterize that SVG offline and include a metadata JSON sidecar.
Pixel dimensions are recorded; no automatic 300-DPI or PDF-report claim is made.

CSV ZIP and XLSX exports contain complete results, feature/sample annotations,
ordered display matrices and clustering trees. Nested fields are also available
as complete JSON-Pointer scalar rows. CSV archive filenames are sanitized and
mapped to original paths in table-manifest.json. Formula-like strings are escaped;
SheetJS receives scalar cells only. Excel format limits fail with instructions
to use complete CSV/JSON, never silently truncate.

The reproduction ZIP contains exact request, recipe, raw result, methods/runtime
provenance, table files, current plot metadata and a fixed trusted R runner.
Run `Rscript --vanilla reproduce.R request.json TRUSTED_ENGINE_DIRECTORY output.json`.
The reviewed engine and matching packages must be installed separately. The
runner passes filenames as arguments, never evaluates JSON strings, uses
`--vanilla`, requires an existing output directory and refuses an existing output.

## Public references

Resources lists exactly seven public references from the checked 2026-10-23
catalog, separate from repository resources. No private bookmark inventory is
included. Links use a new tab, noopener/noreferrer and no-referrer; nothing is
uploaded, embedded or probed automatically. Official-page reading is not
algorithm validation; historical documentation, account/fee uncertainty and
application-specific licensing are stated explicitly.
