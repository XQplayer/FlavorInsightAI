# Phase 5 AI Gateway deployment gate

Recorded 2026-11-11 (Asia/Singapore). Source `421c770`; no Render deployment. Local checks: `python -m unittest discover -s scripts/tests -q` (190 passed), `node --test <all frontend test files>` (458 passed, one existing skip), `node scripts/e2e/verify_ai_assistant.mjs` (Mock desktop/tablet/mobile passed). Draft PR [#26](https://github.com/XQplayer/FlavorInsightAI/pull/26) carries the UI, Gateway and proposed chat migration.

The intended server-only variable **names** are `FLAVOR_AI_MODE=openai`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `FLAVOR_AI_SUPABASE_URL`, `FLAVOR_AI_SUPABASE_ANON_KEY`, `FLAVOR_AI_SUPABASE_SERVICE_ROLE_KEY`, `FLAVOR_AI_REQUIRE_PERSISTENCE=true`, `FLAVOR_AI_ALLOWED_ORIGINS`, and limits/cost rates. Keep `FLAVOR_AI_PRIVATE_TASK_TOOLS_ENABLED=false` until separate task-permission validation. No Secret value belongs in Git, frontend, logs or this report.

The SQL/RLS proposal is [PHASE5_AI_CHAT_SCHEMA_REVIEW.md](PHASE5_AI_CHAT_SCHEMA_REVIEW.md). It has **not** been executed on staging or production. Production execution requires separate approval for the exact SQL after project identity, backup, schema collision and RLS review. Two ordinary-user JWTs must prove own/cross-user/anonymous access and Gateway service-role scoping before public chat. Process-memory per-day counters remain a multi-instance cost-control gap.

Online deployment sequence: review Render ownership/config and rollback → staging migration/JWT probes → separate production SQL approval and verification → configure secrets in Render only → deploy an isolated reviewed AI Gateway → validate health/routes/CORS/stream/stop/limits/10 real turns → enable UI. Status: **BLOCKED; no online GPT call claimed**.
