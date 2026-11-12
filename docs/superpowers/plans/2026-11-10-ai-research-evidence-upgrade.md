# Agents SAI evidence and authorization upgrade

## Contract and boundaries

- Input: authenticated Supabase user JWT, a task UUID or public CAS/name, and an existing conversation. All model tool arguments remain untrusted.
- Output: bounded source-attributed public compound fields or a private task projection. A completed task may include a small derived-result excerpt from its existing result ZIP after ownership/RLS, path, size and SHA-256 checks. Raw workbooks and full logs never enter model context.
- Dependencies: existing Python Responses gateway, Supabase `auth/v1/user`, `profiles`, `shimadzu_jobs`, `shimadzu-results` RLS and existing browser ZIP format. No schema migration or Worker calculation change.
- Errors: absent/foreign task share `TASK_NOT_FOUND`; unavailable store, expired result, invalid ZIP or mismatched hashes fail closed or return explicit unavailable evidence. Limits and cancellation retain existing behavior.
- Acceptance: two synthetic JWT identities and tasks prove owner, foreign, absent, admin and model-argument boundaries; public detail reports available and missing fields with source; completed-task entry opens a scoped AI prompt; regression suites, browser E2E, lint/build and secret scan pass. Real Supabase-account acceptance remains pending until two ordinary test accounts and isolated test tasks exist.

## Sequence

1. Add failing server tests for owner/admin/foreign task and result-archive validation. Add compound fixture assertions for threshold text and explicit missing property states.
2. Implement a bounded private ZIP evidence projection, reuse current RLS and verify the owner/admin case on the server. Do not change stored result structure.
3. Make the completed-result AI entry discoverable, show evidence limitations, and test route/context behavior.
4. Recheck model tool selection, cancellation, retry, quota and estimates; run limited live public CAS verification without private data.
5. Run Python, frontend, browser, lint/build, dependency and diff checks; record exact results and remaining production gates. Commit locally only.
