---
name: flavor-gcms-processing
description: Use for FlavorInsight GC-MS identity, internal-standard semiquantitation, unit conversion, replicate aggregation, and Stage 0-6 quality gates.
---

# GC-MS processing contract

Trigger when changing `frontend/src/shimadzu-core/`, browser worker processing, GC-MS imports/exports, or related API calculations. Read the actual Stage 0–6 code, `source-manifest.json`, relevant tests and input workbook schema first. General `analytical-method-validation` may supplement a formal method-validation task; it does not replace the project pipeline contract.

**Inputs:** immutable raw workbook, sample/internal-standard workbook, sample naming and grouping rules, internal-standard identity/concentration, source units, method version and approval of any changed formula. **Outputs:** result workbook/ZIP, per-stage provenance, unit labels, excluded/flagged records, warnings and reproducible parameters.

Before an algorithm edit, pin a reference fixture with independently checked expected values and a separate current-behavior baseline. Check identity matching (CAS/name ambiguity), blank/zero internal-standard area, replicate semantics, dimensionally valid conversion and rounding policy. Reuse the existing Stage 0–6 implementation and browser parity tests. Preserve raw rows and never silently turn an unresolved compound or failed online lookup into a validated concentration.

On invalid input or missing reference values, stop the affected calculation or emit a structured `REVIEW`/`FAIL` with the exact row and reason; keep recoverable partial output if the current contract supports it. Do not infer a concentration, change a sample name, or substitute synthetic values.

**Minimum test case:** a labeled synthetic two-sample fixture with one known internal standard and one analyte, plus a zero-area standard row. Manually derive the expected ratio/concentration with units before running code. Assert exact output for the valid rows, a flag for zero area, source-row lineage, and unchanged original-file hash. Add a real approved reference workbook only when its provenance and redistribution are authorized.
