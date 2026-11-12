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

2026-11-11 read-only Staging preflight confirmed the expected project name, ref, organization slug, active status and zero existing chat tables. The user initially deferred this Staging migration. On 2026-11-12 the user explicitly approved this exact SQL hash for **Staging only**. Management API independently rechecked `FlavorInsightAI-Staging`, ref `zwbzyrshzegwlgcaxudo`, organization slug, active status, absence of all three tables and absence of a matching migration before applying `ai_staging_20261111120000_ai_conversations` (HTTP 200). Read-back confirmed three tables with RLS enabled, three owner-only SELECT policies, no anon SELECT grant and no authenticated INSERT grant. The real-JWT chat probe `node --env-file=<ignored staging file> scripts/e2e/verify_ai_chat_rls.mjs` passed 14 checks (two ordinary users, three tables, own/cross-user/anonymous reads and direct write denial); all four synthetic users/conversations were cleaned up. The existing GC-MS/Agent probe passed 21 real-JWT checks with all six generated fixtures cleaned up; its optional paid model tool calls were not run. Evidence is in ignored `_local/verification/ai-chat-rls-real.json` and `ai-supabase-rls-real.json`. **Production SQL was not executed.**

- Verify the exact production project ref/organization, current schema (no name collision), migration history, backup and point-in-time recovery. Confirm the proposed SQL hash and deployment identity.
- Obtain **separate approval for this exact production SQL**. Previous approvals for PCA or staging migrations do not authorize this chat migration.
- Apply only to the verified target through the project's normal migration mechanism. Read back table columns, grants, RLS flags and policies. Test two genuine ordinary-user JWTs: own select succeeds; cross-user and anonymous select fail; direct client writes fail. Test Gateway create, rename, delete, stream interruption, refresh/relogin recovery and analysis-link ownership.
- Only after those tests, configure the server-only `FLAVOR_AI_SUPABASE_SERVICE_ROLE_KEY` and `FLAVOR_AI_REQUIRE_PERSISTENCE=true` on a separately reviewed AI Gateway deployment. A public browser must never receive the service credential.

## Failure and rollback

If migration preflight or RLS probes fail, stop before enabling the online assistant. Restore from the verified backup if a partial database change cannot be repaired safely. Do not automatically drop conversation tables or erase user chats as a rollback. Disable the AI route/Gateway while retaining stored records. A destructive reverse migration requires its own review and authorization.

## Limits

The SQL has been applied only to the verified Staging project. Real Staging JWT tests prove the listed PostgREST grants and RLS behavior but do not prove production configuration or real online model behavior. The stored PCA summary is structurally checked at the Gateway but remains client-provided; the server does not rerun the browser algorithm. Per-user request/day accounting is currently process-memory and needs durable/distributed enforcement before a multi-instance paid release.

## Production read-only preflight — 2026-11-12

Using the existing Git-ignored production **read-only** PAT, Management API `GET /v1/projects/nwcoyhavzbygyqeadcnw` identified `XQplayer's Project`, ref `nwcoyhavzbygyqeadcnw`, expected organization slug and `ACTIVE_HEALTHY`. A `POST /database/query` with `read_only:true` returned HTTP 201 and **zero** existing `ai_conversations`, `ai_messages` or `ai_analysis_links` tables. A separate `GET /database/backups` returned HTTP **403**, so backup existence and recovery point remain **unverified**. No SQL write, user creation or production data read was performed. Current migration file SHA-256 is still `295bc256569a3373b512c6dcfbe3960725527e7c38a4d0978c7281f9ae318f01`.

Production execution remains blocked until backup visibility and a separate explicit approval of this exact migration. The existing read-only PAT should receive only the additional backup-read scope needed for verification; do not substitute a production service-role key in the browser or commit credentials. The Staging approval does not apply to production.

## 2026-11-12 production authorization update

The user explicitly deferred the cloud backup and separately approved **only** this production chat migration, SHA-256 `295bc256569a3373b512c6dcfbe3960725527e7c38a4d0978c7281f9ae318f01`, accepting the lack of a database restore point. This supersedes the backup and approval gates above for this one SQL file; it does not authorize other migrations, destructive rollback, or production model enablement.

Fresh read-only Management API checks identified `XQplayer's Project`, ref `nwcoyhavzbygyqeadcnw`, expected organization slug, `ACTIVE_HEALTHY`, zero existing chat tables and zero matching local migration records. The SQL hash matched. A Management API migration-history read returned HTTP 403 under the existing scoped PAT. An attempt to execute the approved SQL through `/database/query` returned HTTP 400; a harmless temporary-table probe identified the cause as `cannot execute CREATE TABLE in a read-only transaction`. A subsequent read-only query confirmed **zero** chat tables. Therefore no production migration was applied. The user was asked to configure a short-lived, project-scoped `Migrations (Read-write)` token in a Git-ignored local file; execution will resume only after the target and hash are rechecked. No production Secret or JWT was printed.
