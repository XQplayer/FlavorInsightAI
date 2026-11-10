# Staging PCA schema change preview — approved and applied

Target **only** `FlavorInsightAI-Staging`, project ref `zwbzyrshzegwlgcaxudo`, organization slug `wkbburugozvjmhjgwjsz`. The pre-change read-only Management API check on 2026-11-10 returned `ACTIVE_HEALTHY`; `public.ai_pca_jobs` did not exist. After explicit user approval, this exact-hash migration was applied to Staging as version `20261110014237`. See [actual read-back and real-JWT validation](AI_PCA_STAGING_VALIDATION.md). Production remains untouched.

Exact 43-line SQL: [20261110090000_ai_pca_jobs.sql](../../supabase/migrations/20261110090000_ai_pca_jobs.sql). SHA-256: `36873E47D15FB0BB5179FFF22A9732AA9F1C19A91F8F34889269081004D22174`. Review the whole linked SQL before approval; no hidden or generated SQL is planned.

| Change | Scope |
| --- | --- |
| Create table `public.ai_pca_jobs` | New PCA request/result JSON, owner UUID, hashes, status, bounded logs, timestamps, expiry; no change to existing tables or data |
| Create indexes | `(user_id, created_at desc)` and `expires_at` |
| Enable RLS | New table only |
| Add SELECT policy | Approved authenticated owner reads own row; no anonymous access or authenticated INSERT/UPDATE/DELETE policy |
| Grants | `authenticated` SELECT only; `service_role` write access for the *separately configured server*; anon/public revoked |
| Storage/functions/triggers | None |

Risks: the table holds uploaded research matrices in `request_json`, so a bad RLS policy or leaked server secret could expose data; this is why real two-user JWT probes are mandatory. `request_json` is capped at 1 MiB and `result_json` at 2 MiB. The SQL records a 30-day expiry but does not yet delete rows automatically; retention cleanup must be designed and approved before production use. The service key bypasses RLS and must remain server-only, as described in the [Supabase RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security).

Rollback for Staging before any test inserts: verify the table contains no rows, then a separately reviewed transaction may `drop table public.ai_pca_jobs`; this would also remove its new indexes and policy. After data exists, disable the PCA feature, preserve/export rows as required and review a non-destructive reverse migration. This preview does **not** authorize an automatic drop.

After explicit Staging approval: recheck exact project identity and SQL SHA, apply only this file, read back table/grants/RLS metadata, create labeled synthetic users/tasks, prove owner/foreign/anonymous behavior with real JWTs, then clean up only test fixtures. Production migration requires a separate production-specific diff and approval.
