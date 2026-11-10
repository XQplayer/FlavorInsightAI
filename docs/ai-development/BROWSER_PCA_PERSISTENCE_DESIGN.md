# Browser PCA save and recovery design

**Status:** design only. No IndexedDB schema, Supabase table/policy, cloud upload, restore UI or automatic saving was added in this phase. The current Browser PCA JSON export now contains a validated **result-only** `flavor-pca-result/1` envelope. It does not include the source matrix, so it cannot yet recompute a run by itself.

## Storage tiers

| Tier | Proposed behavior | Control and failure handling |
| --- | --- | --- |
| Temporary IndexedDB | Store user-approved dataset snapshot, settings, result envelope and expiration timestamp for a short session recovery window. A refresh can list recoverable runs. | Default remains memory only. No silent save of imported research files. On quota/blocked/private-mode failure, keep current session in memory and offer explicit archive export. |
| Persistent IndexedDB | An explicit “Save in this browser” action stores a versioned project and run history with owner namespace, timestamps, source hash, algorithm/engine versions and result hash. | Browser profiles are not a security boundary between people using one device. Show shared-device warning; provide explicit removal and avoid persisting secret tokens. Validate every restored envelope and dataset snapshot. |
| Portable JSON analysis archive | Separate from result-only JSON: `archive_version`, immutable dataset snapshot (including selected numeric matrix), source file byte hash if known, parameter set, result envelope, created time and integrity hash. Original Excel bytes are excluded. | Explicit export/import only. Reject unsupported schema, mismatched IDs/hash, malformed numbers and unexpected size. An archive containing the selected matrix is sensitive research data and must be treated accordingly. |
| Optional Supabase project save | Future authenticated, project-scoped metadata/results; store raw/matrix data only under a separately approved policy and Storage design. | Requires schema, RLS, storage policy, quota, user/project permissions, retention and real JWT staging tests before any production migration. No production database change now. |

## Recovery and rerun

1. On refresh, present saved runs for the signed-in owner or local browser namespace. Restore **only after** schema validation, source/dataset ID check, result hash check and an explicit choice of run. Unknown or corrupted entries remain quarantined; no silent fallback to a different dataset.
2. For “view result”, use the saved envelope and show original engine version, warnings, file hash and parameters. Never relabel an old result as a new computation.
3. For “recompute”, require the saved immutable numeric dataset snapshot or a re-imported file with matching SHA-256. Present the old parameters for approval, then invoke a **new** Worker run with a new run ID and timestamp. Preserve both old and new results; differences are reviewable and may stem from engine version or component sign.
4. Temporary entries expire by policy; persistent entries are deleted only by an explicit owner action. Export a portable archive before browser clearing or migration. IndexedDB eviction by the browser remains possible, so local storage is not the only backup.

## Tests required before implementation is called complete

- Save → refresh → restore in Chrome and mobile viewport, with browser storage enabled and disabled/quota failure.
- Two different local datasets and user identities cannot be silently conflated; logout/login and shared-profile behavior are explicit.
- Archive round trip preserves matrix, units, row lineage, source hash and settings; altered hash, NaN and unsupported version are rejected.
- Recompute uses saved parameters, generates a new run ID, compares to the independent R fixture and does not overwrite the original.
- Supabase tier requires separate staging RLS and cross-user denial evidence before release.
