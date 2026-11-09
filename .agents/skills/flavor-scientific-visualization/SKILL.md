---
name: flavor-scientific-visualization
description: Use for FlavorInsight research plots and exports where units, sample lineage, uncertainty, missingness, and evidence labels must remain traceable.
---

# Scientific visualization contract

Trigger for scientific charts in `frontend/src/analysis/`, export code or publication figures. General `scientific-visualization` can guide plotting and accessibility; this skill checks FlavorInsight data meaning.

**Inputs:** exact result table/IDs, aggregation rule, units, sample counts, missing/flagged values, uncertainty definition, comparison statistics and target export format. **Outputs:** editable plot specification/source mapping, rendered figure, caption, units, legend, missingness/uncertainty explanation and export metadata.

Every mark must trace to source sample IDs or an explicit aggregate. Do not join values across incompatible units, imply zero for missing observations, show SEM without a valid independent `n`, or use an axis truncation that disguises the pattern. Distinguish observed measurements, predictions and external database evidence visually and in captions. Check desktop/mobile readability for in-app figures, and grayscale/color-vision legibility for publication output.

If provenance, units or uncertainty definition is unknown, hold the affected panel with an explanatory label. Never fill a chart with random data to make it look complete.

**Minimum test case:** a labeled synthetic table with two groups, one missing value and known source IDs. Assert plotted point/aggregate counts, displayed unit, missing-value treatment and exported caption match the table; inspect both narrow and wide viewports or output sizes.
