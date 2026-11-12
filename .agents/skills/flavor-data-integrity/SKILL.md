---
name: flavor-data-integrity
description: Use for FlavorInsight research file imports, transformations, migrations, exports, retention, and any task requiring raw-data hashes or lineage.
---

# Data integrity contract

Trigger whenever research data or its metadata may be imported, transformed, renamed, persisted, exported or deleted. This skill pairs with the domain skill for the computation itself.

**Inputs:** source paths/IDs, byte hashes, format/schema, access permission, sample identity and version. **Outputs:** immutable source reference, transformation/parameter log, output hashes, row/field mapping, warnings, version and rollback reference.

Read original files without writing to them. Stage outputs separately and validate paths, sizes, counts, checksums and schema before calling a migration complete. Track each derived row back to the source row(s); retain missing and rejected rows with reasons. Preserve blanks, formulas, comments, workbook metadata and formatting when the task requires workbook fidelity. Distinguish a checksum of the source file from a checksum of parsed content.

On hash mismatch, ambiguous sample identity, path collision, incomplete output or failed validation, stop promotion and keep both original and diagnostic artifacts. Never delete the source as a cleanup step. Production deletion or sensitive configuration changes require explicit authorization.

**Minimum test case:** a labeled synthetic source file with two valid rows, one blank/invalid row and a known SHA-256. Run a read-only transform to a separate path; assert source hash is unchanged, all three source row IDs appear in output or rejection log, output hash is recorded, and an altered source produces a mismatch failure.
