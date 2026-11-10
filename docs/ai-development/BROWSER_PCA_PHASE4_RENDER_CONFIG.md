# Render Gateway configuration review checklist

Target named in repository `README.md` and `render.yaml`: `flavorthresholddb-api` at `https://flavorthresholddb-api.onrender.com`. This is a **proposed checklist**, not a claim that the live service is configured. Its Dashboard owner, linked branch/deploy SHA and environment settings could not be independently read; public `/health` and `/ai/session` timed out (HTTP 000). No Secret values were accessed.

| Server-side variable | Required purpose / release check |
| --- | --- |
| `FLAVOR_AI_MODE` | `openai` only for a deliberately enabled, authenticated release; otherwise `disabled`. |
| `OPENAI_API_KEY` | Server-only secret. Never place in `VITE_` variables, GitHub Pages, logs or reports. |
| `OPENAI_MODEL` | Model ID confirmed available to this account; do not infer from source defaults. |
| `FLAVOR_AI_SUPABASE_URL`, `FLAVOR_AI_SUPABASE_ANON_KEY` | Production Auth verification for bearer JWTs; inspect values only in private Dashboard. No service-role key is required for account verification. |
| `FLAVOR_AI_ALLOWED_ORIGINS` | Exact trusted browser origins. `https://xqplayer.github.io` admits **both** formal and current preview paths; it cannot isolate them. Do not add a preview origin until a separate staging Gateway and domain are ready. |
| `FLAVOR_AI_PRIVATE_TASK_TOOLS_ENABLED` | Keep `false`; private task reads are a separate permission release. |
| `FLAVOR_AI_ALLOW_LOCAL_REAL` | Keep `false` on public Render; loopback guest mode is for local testing only. |
| `FLAVOR_AI_MAX_INPUT_CHARS`, `FLAVOR_AI_MAX_OUTPUT_TOKENS`, `FLAVOR_AI_TIMEOUT_SECONDS` | Review bounded request/response and timeout values against usage policy. |
| `FLAVOR_AI_REQUESTS_PER_MINUTE`, `FLAVOR_AI_REQUESTS_PER_DAY`, `FLAVOR_AI_CONCURRENT_PER_USER` | Review user limits; current counters are process-local, not durable across restarts/replicas. |
| `FLAVOR_AI_INPUT_USD_PER_MILLION`, `FLAVOR_AI_CACHED_INPUT_USD_PER_MILLION`, `FLAVOR_AI_OUTPUT_USD_PER_MILLION` | Set only after confirming the deployed model's current pricing; unset/zero means cost estimate is unavailable, not free usage. |

Before any authorized production config change, capture privately the current deploy ID, linked repo/branch, auto-deploy mode, variable **names**, health status, and rollback deploy. Review the exact requested variable-name changes and an expected failure test (`/ai/session` without JWT must not create a public real-model guest). Use Render's **Save only** option if preparing values without immediate deployment; its [official environment-variable guide](https://render.com/docs/configure-environment-variables) distinguishes save-only from deploying options. This document does not authorize applying values.

After a separately approved deployment, verify `/health`, unauthenticated `/ai/session` rejection, authenticated `/ai/session` safe booleans, `/ai/chat` streaming, `/ai/analysis/plan` and `/ai/analysis/explain`, production Origin allow/deny, JWT isolation, private tools still false, redacted logs and actual usage entries. Only synthetic accounts and data should be used. [Render's deploy guide](https://render.com/docs/deploys) describes automatic deployments from linked branches; the repository also declares `autoDeploy: true`, but the live setting must be read in Dashboard.
