# AI Staging baseline — 2026-11-10

The scoped Management API returned HTTP 200 for project `zwbzyrshzegwlgcaxudo`: name `FlavorInsightAI-Staging`, organization slug `wkbburugozvjmhjgwjsz`, status `ACTIVE_HEALTHY`. `GET /v1/projects/{ref}/database/migrations` returned HTTP 200 and the five versions below, in order. No migration was applied in this work.

| Applied version | Local source file | SHA-256 |
| --- | --- | --- |
| 20261109211519 | `20260803070000_shimadzu_browser_analysis.sql` | `7CC7BEF63308D0B41CE736C4681AC0C1769CB8368CE9E78DCF5EA7569E6DDC9F` |
| 20261109211520 | `20260803080000_shimadzu_admin_bootstrap.sql` | `70B4D77900C30371A83C5F722307167938A11646B7EA4C87209ED2DD1FA59E27` |
| 20261109211522 | `20260803083000_rotate_shimadzu_admin_bootstrap.sql` | `96BE3F9745DAC1CAB4AA562247EC55EBBC4B9F88C71F834213682019C2D873AE` |
| 20261109211524 | `20260807090000_shimadzu_partial_results_admin_retention.sql` | `9DC3224E660C22CFE8C12C94ADFD072EC24D55449E0A5BD6A5139EF611A44FCF` |
| 20261109211526 | `20260921090000_disable_shimadzu_raw_input_uploads.sql` | `044746A5831B2F1582F1DD4278E399E0F266E4A65BA386E8CBF775FA8D991075` |

Prior real-JWT evidence and six synthetic cleanup checks are in [AI_RLS_REAL_VALIDATION.md](AI_RLS_REAL_VALIDATION.md): 26/26 checks passed on 2026-11-09. This turn confirmed identity and migration history, but did not rerun that destructive fixture probe. PAT scope/expiry cannot be independently read from the returned project metadata; the token remains in an ignored private file.

**Permanent migration rule:** produce full SQL diff, affected objects, risk and rollback before *any* future remote migration, then obtain explicit approval. Prior Staging migration execution preceded the requested SQL-list review; this process deviation remains recorded in the earlier report.
