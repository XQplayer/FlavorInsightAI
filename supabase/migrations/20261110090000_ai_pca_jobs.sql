-- PREVIEW ONLY. Do not apply to Staging or production without separate approval.
-- Stores bounded PCA requests and real R results for owner-scoped retrieval.
begin;

create table public.ai_pca_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  dataset_id text not null check (char_length(dataset_id) between 1 and 128),
  dataset_sha256 text not null check (dataset_sha256 ~ '^[0-9a-f]{64}$'),
  request_sha256 text not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  request_json jsonb not null check (octet_length(request_json::text) <= 1048576),
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'cancelled', 'interrupted')),
  result_json jsonb check (result_json is null or octet_length(result_json::text) <= 2097152),
  error_code text check (error_code is null or error_code ~ '^[A-Z][A-Z0-9_]{0,95}$'),
  engine_version text,
  r_version text,
  logs jsonb not null default '[]'::jsonb check (octet_length(logs::text) <= 65536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  unique (user_id, idempotency_key),
  check ((status = 'completed' and result_json is not null and error_code is null)
         or (status <> 'completed' and result_json is null))
);

create index ai_pca_jobs_user_created_idx on public.ai_pca_jobs(user_id, created_at desc);
create index ai_pca_jobs_expiry_idx on public.ai_pca_jobs(expires_at);

alter table public.ai_pca_jobs enable row level security;

-- No INSERT/UPDATE/DELETE policy exists for browser clients. A trusted server
-- validates a real JWT and uses its separately held secret key for writes.
create policy ai_pca_jobs_owner_select on public.ai_pca_jobs for select to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and approval_status = 'approved'
  )
);

revoke all on public.ai_pca_jobs from public, anon, authenticated;
grant select on public.ai_pca_jobs to authenticated;
grant select, insert, update, delete on public.ai_pca_jobs to service_role;

commit;
