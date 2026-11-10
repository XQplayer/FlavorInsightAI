# Phase 5 AI chat schema review — production migration pending

Prepared 2026-11-11 (Asia/Singapore) in `codex/phase5-release`; no remote SQL was executed. Review the exact proposed file [`20261111120000_ai_conversations.sql`](../../supabase/migrations/20261111120000_ai_conversations.sql) before any production migration. SHA-256: `295bc256569a3373b512c6dcfbe3960725527e7c38a4d0978c7281f9ae318f01` at preparation. The hash must be checked again immediately before execution.

## SQL change list

1. Create `public.ai_conversations` with owner UUID referencing `auth.users`, title and source, bounded context digest, creation and last-activity timestamps; unique `(id,user_id)`.
2. Create `public.ai_messages` with message UUID, conversation/owner composite foreign key, ordered position, user/assistant/tool role, text/type, status, model, token usage, sources and tool-event metadata. Deleting a conversation cascades to its messages.
3. Create `public.ai_analysis_links` with owner/conversation composite foreign key, `analysis_id` (dataset), `result_id` (browser run), bounded client-validated PCA summary, protocol version and provenance. It stores no raw workbook or sample-by-feature matrix.
4. Create one owner/activity index, one session/message-order index and one session/analysis-link index.
5. Enable RLS on all three tables. Authenticated users can SELECT only rows where `user_id = auth.uid()`. `anon` has no table grants. Authenticated clients have no INSERT, UPDATE or DELETE grants; writes are available only to the server's `service_role` credential after Gateway JWT verification and explicit owner-scoped queries. No admin cross-user policy is introduced.
6. Grant the new identity sequence to `service_role`. No existing table, policy, bucket, function or production data is altered. No data is copied from production.

## Preconditions and execution gate

- Verify the exact production project ref/organization, current schema (no name collision), migration history, backup and point-in-time recovery. Confirm the proposed SQL hash and deployment identity.
- Obtain **separate approval for this exact production SQL**. Previous approvals for PCA or staging migrations do not authorize this chat migration.
- Apply only to the verified target through the project's normal migration mechanism. Read back table columns, grants, RLS flags and policies. Test two genuine ordinary-user JWTs: own select succeeds; cross-user and anonymous select fail; direct client writes fail. Test Gateway create, rename, delete, stream interruption, refresh/relogin recovery and analysis-link ownership.
- Only after those tests, configure the server-only `FLAVOR_AI_SUPABASE_SERVICE_ROLE_KEY` and `FLAVOR_AI_REQUIRE_PERSISTENCE=true` on a separately reviewed AI Gateway deployment. A public browser must never receive the service credential.

## Failure and rollback

If migration preflight or RLS probes fail, stop before enabling the online assistant. Restore from the verified backup if a partial database change cannot be repaired safely. Do not automatically drop conversation tables or erase user chats as a rollback. Disable the AI route/Gateway while retaining stored records. A destructive reverse migration requires its own review and authorization.

## Limits

The SQL has not been applied to staging or production in this phase. Application tests use synthetic in-memory store doubles, so they do not prove PostgREST grants or RLS. The stored PCA summary is structurally checked at the Gateway but remains client-provided; the server does not rerun the browser algorithm. Per-user request/day accounting is currently process-memory and needs durable/distributed enforcement before a multi-instance paid release.
