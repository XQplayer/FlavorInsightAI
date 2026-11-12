# Optional Browser PCA cloud save design — not deployed

The first implemented tier is explicit IndexedDB save. No Browser PCA request uploads raw workbooks or selected numeric matrices. This document is a migration and permission proposal only; it has not been applied to Staging or production.

## Proposed metadata/result table

Use `public.browser_pca_runs` with `id uuid primary key`, `user_id uuid not null references auth.users(id)`, `dataset_id text not null`, `result_schema text not null`, `engine text not null`, `engine_version text not null`, `source_sha256 text`, `result_json jsonb not null`, `settings_json jsonb not null`, `archive_sha256 text`, and `created_at/updated_at timestamptz`. The first cloud tier stores only the validated result and chart settings, **not** the source matrix or workbook. No browser-provided `user_id` is trusted; client writes must use `auth.uid()` and server checks. Mark the result as client-calculated, not server-recomputed.

Migration SQL to review separately before Staging execution:

```sql
create table public.browser_pca_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dataset_id text not null,
  result_schema text not null check (result_schema = 'flavor-pca-result/1'),
  engine text not null check (engine in ('browser-pca', 'hosted-pca')),
  engine_version text not null,
  source_sha256 text,
  result_json jsonb not null,
  settings_json jsonb not null,
  archive_sha256 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint browser_pca_result_size check (octet_length(result_json::text) <= 2097152)
);
create index browser_pca_runs_owner_created on public.browser_pca_runs(user_id, created_at desc);
alter table public.browser_pca_runs enable row level security;
create policy browser_pca_select_owner on public.browser_pca_runs for select to authenticated
  using (user_id = auth.uid());
create policy browser_pca_insert_owner on public.browser_pca_runs for insert to authenticated
  with check (user_id = auth.uid());
create policy browser_pca_update_owner on public.browser_pca_runs for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy browser_pca_delete_owner on public.browser_pca_runs for delete to authenticated
  using (user_id = auth.uid());
```

There is no admin bypass in this proposal. If an administrator needs research results, define a separately audited role and purpose. User/project scoping beyond `user_id` requires a project membership table and RLS membership checks before project sharing can be offered. A separate private Storage bucket would be needed for optional numeric matrix archives; use owner/project-prefixed object paths, verified membership policies, size/content restrictions, explicit upload consent and retention rules. Do not use `service_role` in the browser.

## Required Staging gate before any migration

Review exact SQL against the live Staging schema and backup, then apply only to a verified nonproduction project. With two ordinary real JWTs, prove owner CRUD, cross-user denial for all verbs, anonymous denial, forged `user_id` rejection, and no accidental admin read. Verify the JSON envelope and checksum at application boundaries; RLS cannot prove that a client-calculated PCA is scientifically correct. Test delete/recovery and storage quota/retention. A production migration and cloud upload toggle require separate authorization.
