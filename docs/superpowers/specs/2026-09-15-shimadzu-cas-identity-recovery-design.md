# Shimadzu CAS Identity Recovery Design

## Goal

Prevent Excel date conversion and missing library CAS values from silently removing valid Shimadzu Hit #1 compounds before CAS-based screening and semi-quantification, while preserving a complete audit trail and never inventing an uncertain CAS.

## Scope

The change applies only to the browser-local Shimadzu import pipeline. It does not alter source workbooks, global compound-search behavior, or any historical export.

## Import rules

1. Continue normalizing whitespace around existing CAS separators, for example `75 - 07 - 0` becomes `75-07-0`.
2. Inspect only cells under the MS similarity-search `CAS #` header that are stored as Excel dates.
3. Build two CAS candidates from a date cell: `full-year-MM-day` and `last-two-year-digits-MM-day`. Month is two digits and day is one digit.
4. Accept a recovered CAS only when exactly one candidate has the standard CAS checksum. Store the original date display/value and the recovered CAS.
5. Do not rewrite a date cell with zero or multiple checksum-valid candidates. Preserve it for review.

Examples validated against `JX-ZS-C15.xlsx`:

- `1960/12/8` resolves to `60-12-8`.
- `1979/9/4` resolves to `79-09-4`.
- `2050/9/1` resolves to `2050-09-1`, not `50-09-1`.

## Missing CAS rules

For a blank or normalized `0-00-0` CAS, resolve the library Name through the local PubChem proxy before Stage 2 screening.

1. Require a PubChem exact-name result whose molecular formula exactly equals `Mol.Form` and whose molecular weight differs by no more than 1 Da from the integer library value.
2. Retrieve CAS-shaped PubChem synonyms for that CID and retain only checksum-valid CAS values.
3. Auto-fill only when exactly one valid CAS remains. Mark the result as `PubChem exact-name recovery` and retain CID, returned title, formula, molecular weight, source workbook, and source row.
4. If PubChem returns a unique CID but no uniquely valid CAS, retain the compound with its CID and mark it `CAS pending review`; do not use CID as a CAS or merge it into CAS-keyed rows.
5. If PubChem has no matching CID, retain the source row as `CAS unresolved`; do not drop it solely because CAS is absent.

## Pipeline placement and output

CAS recovery runs immediately after Hit #1 extraction and before the existing invalid-CAS screen. The recovery result carries these audit fields internally and into the exception/review export:

- `CAS 原始值`
- `CAS 来源` (`岛津原始值`, `Excel 日期恢复`, `PubChem 精确名称补全`, `待人工确认`)
- `PubChem CID`
- `CAS 补全状态`
- source workbook sheet and row lineage

The main CAS-based analysis uses only original, date-recovered, or uniquely PubChem-recovered CAS values. Pending and unresolved records are delivered in a separate review table rather than silently discarded.

## Test boundaries

- Date recovery: `60-12-8`, `79-09-4`, and `2050-09-1` resolve from date cells.
- A date with no unique checksum-valid candidate remains unresolved.
- Whitespace-delimited CAS is normalized but not treated as missing.
- A unique PubChem name/formula/mass/CAS match is accepted.
- A PubChem CID with no unique CAS and a PubChem miss both remain in the review table.
- Existing Stage 2 filtering, Stage 4 enrichment, and Stage 5/6 outputs continue to pass their core parity tests.
