# Production change review — preview only, no execution

**Verified target:** `XQplayer's Project`, ref `nwcoyhavzbygyqeadcnw`, organization slug `wkbburugozvjmhjgwjsz`, `ACTIVE_HEALTHY` on 2026-11-10. The separate `FlavorInsightAI-Staging` ref is `zwbzyrshzegwlgcaxudo`. The read-only [metadata diff](AI_SCHEMA_RLS_DIFF.md) confirms `public.profiles` exists with `approval_status`, `public.ai_pca_jobs` is absent, common Shimadzu table columns and RLS policy expressions match Staging, and both Storage buckets are private. No production user/task row was read or written.

## Proposed database changes requiring separate approval

1. **PCA task schema:** apply only [20261110090000_ai_pca_jobs.sql](../../supabase/migrations/20261110090000_ai_pca_jobs.sql), SHA-256 `36873E47D15FB0BB5179FFF22A9732AA9F1C19A91F8F34889269081004D22174`, through a project-pinned migration operation. It creates one table, two indexes and one approved-owner SELECT policy; authenticated users get SELECT only, anon gets no table access, and `service_role` gets bounded task writes. No existing row or Storage object changes. Staging version `20261110014237` passed real two-user JWT/RLS and synthetic R-job probes. Production ordinary-JWT behavior must be tested after approval and application, before enabling the feature.
2. **Existing raw-input/cleanup permission hardening:** apply only the following exact SQL to the verified production ref, in a separately named transaction/migration. It drops two production-only policies that still permit direct raw-workbook upload/update and removes public/anonymous/authenticated EXECUTE on a no-argument SECURITY DEFINER cleanup function. The scheduled Edge Function uses server-side table/Storage operations directly and does not call this SQL function in the reviewed source. The SQL deletes **no** table row or Storage object.

```sql
begin;
drop policy if exists shimadzu_inputs_insert_owner on storage.objects;
drop policy if exists shimadzu_inputs_update_owner on storage.objects;
revoke execute on function public.cleanup_expired_shimadzu_data() from public, anon, authenticated;
commit;
```

The first two policy removals reproduce the existing [raw-input-disable migration](../../supabase/migrations/20260921090000_disable_shimadzu_raw_input_uploads.sql), SHA-256 `044746A5831B2F1582F1DD4278E399E0F266E4A65BA386E8CBF775FA8D991075`, which is already applied on Staging. The cleanup function's production and Staging bodies match; the observed difference is effective EXECUTE privilege. The repository's scheduled Edge Function performs service-role Storage/table operations directly, but its live deployment and schedule must be checked before the privilege change is applied.

**Risks and rollback:** The PCA table would store submitted matrices and results. A server secret leak would bypass RLS; keep the key only in the new service. The permission hardening will stop any legacy client that still directly uploads raw workbooks; the current browser-local workflow should be checked immediately after migration. If the PCA service fails, turn off its server and Pages flags and preserve all table rows for review; do not auto-drop the table. If historical raw upload or cleanup breaks, investigate and use a separately reviewed targeted fix; do not silently re-open PUBLIC EXECUTE or raw-upload policies. A destructive reverse migration needs its own data inventory, backup and approval.

## Proposed service/configuration changes requiring separate approval

- Create **one** Docker web service from `Dockerfile.pca`, tied to the reviewed commit, with auto-deploy **off** and one instance. The current implementation requires single-instance mode and fails closed without a nonempty server-side allowlist of approved test-user UUIDs. Candidate paid plan: `1c-2g` (1 CPU, 2 GB RAM); Render's current [compute-plan reference](https://render.com/docs/compute-plans) and [pricing page](https://render.com/pricing) list its resources and price. The user must approve the paid plan and actual service ownership before creation. No service has been created.
- Server-only values to configure after approval: `FLAVOR_AI_PCA_ENABLED=true`, `FLAVOR_AI_PCA_SINGLE_INSTANCE=true`, `FLAVOR_AI_PCA_ALLOWED_USER_IDS=<approved synthetic tester UUIDs>`, `FLAVOR_AI_PCA_PROJECT_REF=nwcoyhavzbygyqeadcnw`, `FLAVOR_AI_SUPABASE_URL=<verified production URL>`, `FLAVOR_AI_SUPABASE_ANON_KEY=<publishable key>`, `FLAVOR_AI_PCA_SUPABASE_SECRET_KEY=<production server-only key>`, `FLAVOR_AI_ALLOWED_ORIGINS=<official Pages origin>`, `ANALYSIS_RSCRIPT=/usr/bin/Rscript`. No secret value is requested in chat or committed.
- Keep the public Pages `AI_PCA_ENABLED=false` and `ANALYSIS_API_URL` unset until the new service, real JWT canary and rollback check pass. Then enable only the tested public URL. AI Gateway's separate `OPENAI_API_KEY`/model configuration needs its own server-side review and approval; the new PCA service does not require the OpenAI key.
- First online canary uses only a synthetic approved test account/dataset and cleans its task afterward. **Real research data intake remains blocked** until an automatic, approved retention mechanism for expired matrices is implemented and tested; `expires_at` alone does not purge rows.

**Required before any production write or deploy:** user approval of the exact database operations above, explicit approval of service creation/paid plan and server-side secret changes, current production backup/restore confirmation, matching remote CI, and a controlled canary plan. The prior broad publication request is not treated as approval for these specific operations.
