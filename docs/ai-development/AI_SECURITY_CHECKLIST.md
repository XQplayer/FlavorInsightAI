# AI security gate — 2026-11-10

| Check | Result |
| --- | --- |
| OpenAI key stays in server-only ignored `.env.local` | Local code/config inspection pass; no key copied to this worktree |
| High-privilege Supabase credentials in browser | No new browser secret; staging credential remains ignored in prior worktree |
| Explicit PCA user confirmation and dataset hash | Local browser test pass; stale-hash unit test pass |
| Raw matrix transfer to GPT | PCA explanation sends bounded derived excerpt only after separate Send click |
| Input, queue, timeout, cancellation bounds | Existing loopback R broker contract tests pass; production service absent |
| Per-user PCA authorization/persistence | Not implemented for online service; release blocker |
| Production task RLS and Storage | Not inspected; release blocker for private data |
| API quotas and audit | Gateway has process-local controls; distributed persistence and production config unverified |
| Feature isolation | `VITE_AI_PCA_ENABLED` defaults false; disabled build keeps existing analysis behavior |
| Dependency scan | `pnpm audit --prod`: no known vulnerabilities (local lockfile) |

This checklist does not certify the production deployment. No production secret, schema, RLS, Storage or user data was read or changed.
