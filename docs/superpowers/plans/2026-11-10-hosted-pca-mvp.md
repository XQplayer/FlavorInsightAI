# Hosted PCA minimum release plan

Scope confirmed by the user: retain a basic PCA score plot and numerical tables; postpone a dedicated loading plot and PNG/SVG export. Keep the actual PCA scores, loadings, eigenvalues, explained variance, JSON/CSV method record and independent R reference tests.

1. Add a *new* server-owned PCA API with real Supabase JWT validation, approved-user check, bounded JSON request, idempotency key, real R broker execution, user-scoped job status/result and cancel. No arbitrary R/Python code. Keep local analysis broker behavior intact.
2. Persist requests, status, logs and results in the new `ai_pca_jobs` table. Browser clients have owner-only SELECT under RLS, no direct writes. The server's secret credential is only used after successful JWT authorization; model tools never receive it. Initial limits: PCA only; request JSON <=1 MiB, result <=2 MiB, existing broker timeout <=180 seconds, one active worker and a bounded queue.
3. Use separate Render Docker service with pinned Python/R/jsonlite; do not change the existing production Python service runtime. Hosted API is disabled by default. Frontend selects it only when a specific deployment variable is set and user is signed in; local loopback remains the default for local development.
4. Develop portable contract tests and local real-R tests. Apply migration only to the verified Staging ref **after** the user approves the exact SQL in `supabase/migrations/20261110090000_ai_pca_jobs.sql`. Use two ordinary Staging JWTs for owner/foreign probes, real R synthetic data and result download. No production migration until a second, production-specific approval and read-only schema diff.
5. After Staging passes, request review of the exact production SQL, Render service/config/secrets, backup and rollback. PR CI must pass at the final SHA. Deploy behind flags to named testers, verify online real JWT/RLS/R job and basic chart, then expand only with cost/error telemetry.

Current state: this is a plan and SQL preview; the hosted API and Docker service have not been implemented or deployed. Staging and production remain unchanged.
