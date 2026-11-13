# Public pages and on-demand authentication

Baseline: `origin/main` at `6be8484`. Scope: frontend routing and authentication UI only. No database migration, Worker algorithm, or research data change.

## Operation matrix

| Page | Anonymous | Requires authenticated, authorized user |
| --- | --- | --- |
| Data processing / new | Open, configure, select local files, run available local checks, download public templates | Create a cloud-backed analysis task, start/retry/cancel its run, retain cloud result |
| Data processing / monitor | Open and read process/empty state | Read or control a private run |
| Data processing / results | Open and read feature/empty state | Read/download a private result |
| Data processing / tasks | Open and read empty state | List/edit/delete private tasks; admin review requires server-side admin check |
| Data analysis | Browser PCA local import, compute, plots, IndexedDB save/export, existing loopback R workbench | AI planning/explanation and any future cloud save or hosted compute |
| AI models | Read capability descriptions | Future hosted prediction, currently unavailable |
| AI assistant | Read welcome and example prompts | Create/read private conversations, send GPT messages, call tools |

## Contract and failure behavior

- Pages remain routable and refreshable without a session. The single login page uses the existing Supabase client and session.
- Protected actions call an authentication check. If no valid session, store only an allowlisted internal return path, an action identifier, and bounded nonsecret form parameters in session storage. Never store passwords, JWTs, file bytes or `File` objects in the intent.
- Login success restores the internal route and safe parameters, then waits for a fresh click. Files must be selected again after navigation. Invalid or stale intents fall back to the homepage.
- An authenticated but unapproved account sees its status and cannot execute a protected operation. Authorization stays in existing Supabase RLS and AI Gateway JWT checks.
- A missing Supabase configuration keeps explicitly supported browser-local work available; server-backed operations explain that the service is unavailable.

## Implementation sequence

1. Add a bounded, same-origin auth-intent contract and tests.
2. Turn `PlatformLoginPage` into the one Supabase sign-in, registration and sign-out UI; share session state with the platform shell.
3. Route GC-MS start and AI conversation/analysis actions through the shared gate; restore safe draft parameters without automatic submission. Replace embedded login forms with links to the same page.
4. Add anonymous empty states for monitor, results and tasks; leave Browser PCA computation and existing local R execution local.
5. Run focused tests, frontend suite, lint, build and relevant browser checks. Review no JWT/secret/raw data in stored intents and no changed Worker code.

Acceptance: all seven requested destinations open and refresh anonymously; protected clicks enter the one login flow; successful login returns to the requesting route with safe parameters; no action auto-submits; private records remain gated server-side; desktop and mobile navigation work.
