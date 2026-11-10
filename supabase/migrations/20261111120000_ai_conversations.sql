-- Proposed Phase 5 migration. Review and separately authorize before production use.
begin;

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation' check (char_length(title) between 1 and 120),
  title_source text not null default 'auto' check (title_source in ('auto', 'manual')),
  context_summary text not null default '' check (char_length(context_summary) <= 4000),
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.ai_messages (
  message_id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null,
  position bigint generated always as identity unique,
  role text not null check (role in ('user', 'assistant', 'tool')),
  content text not null check (char_length(content) <= 20000),
  message_type text not null default 'text' check (message_type in ('text', 'tool_call', 'tool_result', 'analysis_reference')),
  created_at timestamptz not null default now(),
  status text not null check (status in ('pending', 'streaming', 'completed', 'interrupted', 'failed')),
  model text check (model is null or char_length(model) <= 128),
  token_usage jsonb not null default '{}'::jsonb check (jsonb_typeof(token_usage) = 'object'),
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array'),
  tool_events jsonb not null default '[]'::jsonb check (jsonb_typeof(tool_events) = 'array'),
  foreign key (session_id, user_id) references public.ai_conversations(id, user_id) on delete cascade
);

create table public.ai_analysis_links (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null,
  analysis_id text not null check (analysis_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  result_id text not null check (result_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  result_schema text not null check (result_schema = 'flavor-pca-result/1'),
  summary jsonb not null check (jsonb_typeof(summary) = 'object' and pg_column_size(summary) <= 4096),
  provenance text not null check (provenance in ('client-validated-browser-pca-summary')),
  created_at timestamptz not null default now(),
  unique (session_id, result_id),
  foreign key (session_id, user_id) references public.ai_conversations(id, user_id) on delete cascade
);

create index ai_conversations_owner_activity_idx on public.ai_conversations(user_id, last_activity_at desc);
create index ai_messages_session_position_idx on public.ai_messages(session_id, position);
create index ai_analysis_links_session_idx on public.ai_analysis_links(session_id, created_at desc);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_analysis_links enable row level security;

-- Authenticated clients may read only their own records. Writes are server-only
-- through a separately configured service credential after verified JWT auth.
create policy ai_conversations_select_own on public.ai_conversations
  for select to authenticated using (user_id = auth.uid());
create policy ai_messages_select_own on public.ai_messages
  for select to authenticated using (user_id = auth.uid());
create policy ai_analysis_links_select_own on public.ai_analysis_links
  for select to authenticated using (user_id = auth.uid());

revoke all on public.ai_conversations, public.ai_messages, public.ai_analysis_links from anon, authenticated;
grant select on public.ai_conversations, public.ai_messages, public.ai_analysis_links to authenticated;
grant select, insert, update, delete on public.ai_conversations, public.ai_messages, public.ai_analysis_links to service_role;
grant usage, select on sequence public.ai_messages_position_seq to service_role;

commit;
