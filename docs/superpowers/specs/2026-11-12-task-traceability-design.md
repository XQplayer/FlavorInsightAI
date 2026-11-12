# Unified task traceability

Approved by the user on 2026-11-12 after reviewing the five-rule design in chat.

## Contract

Input: task name and creation timestamp; optional parent task identity on explicit rerun. Output: a stable public task number, display label and safe archive filename, consistently persisted and propagated from processing to downstream analysis. Existing UUID remains the database/storage primary key. No scientific calculations, source data, approval rules, retention rules, production schema or version changes.

Public number: `FI-YYYYMMDD-HHmmss-XXXXXX`, fixed Asia/Shanghai (UTC+08:00) creation time and six uppercase cryptographically random hexadecimal characters. Example only: `FI-20261112-153045-A7C92E`. Never regenerate on render, language/theme change, refresh, pause or resume. Generate a fresh UUID and public number on explicit rerun, preserving parent UUID and public number. Freeze the actual task name on creation; sanitize only the filename. Never silently downgrade to noncryptographic randomness.

Archives: `<number>_<safe task name>_分析结果.zip`, `<number>_<safe task name>_失败证据与部分结果.zip`, or `<number>_<safe task name>_取消审计与部分结果.zip`. Retain original task name in metadata. Bound the filename segment and remove platform-invalid/control characters and trailing dots/spaces. Historical records without numbers keep their UUID/original identity; do not invent historical numbering or overwrite old records.

## Approaches

1. Replace UUID with a timestamp ID: rejected; breaks database UUID contracts, storage ownership and old links.
2. Only rename ZIPs: rejected; does not connect task history, audit metadata or downstream analysis.
3. Add public identity alongside UUID: approved. A shared identity helper serves creation, rendering and exports. Use existing JSON metadata fields for cloud persistence, avoiding a production migration.

## Data flow and failure behavior

Create once in UI; persist in browser task metadata and cloud `source_names` JSON; pass through worker client/start message into pipeline parameters. Include the same identity in stage manifests, run/completeness documents, failure/cancellation evidence and their hash-covered JSON. Keep existing schema markers and compatibility. Include a readable task information document in every generated ZIP. Preserve cloud storage UUID paths; signed URL downloads explicitly specify the matching filename.

Console, task list, historical detail and results expose number plus frozen name and parent reference when present. Logs and audit artifacts refer to the same identity. The verified completed ZIP remains the authoritative handoff source; propagate its identity into the imported analysis dataset provenance and exported analysis metadata. Historical archives remain importable with identity absent. Every affected JSON hash must be regenerated after metadata additions; do not change hash verification semantics.

Preparation or persistence failure must not launch an untracked task. Explicit rerun must create the new cloud record and save recoverable inputs before launching; preserve failed parent history, clear old terminal artifacts and restart from stage 0. Automatic recovery retains the same identity.

## Acceptance and scope

Unit tests cover UTC+8 boundary dates, same-second uniqueness, unsafe/long names, parent linkage, legacy records and all archive states. Integration tests verify equality across UI/browser/cloud/worker/ZIP/handoff plus existing integrity checks. Run affected tests, full lint/build and desktop/mobile keyboard/browser checks. Do not deploy or push without a new explicit authorisation. Serial self-review is acceptable and must not be described as independent review.
