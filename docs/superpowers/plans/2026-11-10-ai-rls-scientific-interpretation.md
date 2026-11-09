# Agents SAI RLS and scientific interpretation implementation plan

**Goal:** Verify the real nonproduction Supabase boundary when credentials are available, and extend private GC-MS interpretation using only stored, hashed Stage 4 and Stage 5 results.

**Architecture:** Keep the Responses API gateway and four read-only tools. Authenticate through the existing Supabase JWT path, rely on RLS plus server-side owner/admin checks, and project small derived result excerpts from the authenticated result ZIP. A separate nonproduction integration harness obtains real JWTs and exercises PostgREST, Storage and the Agent gateway. Analysis and literature capabilities remain design-only until their authorization and provenance contracts are implemented.

**Tech stack:** Python gateway and unittest, Supabase Auth/PostgREST/Storage, browser Worker ZIP, React, Node tests and Playwright.

**Inputs:** a nonproduction Supabase project and test-only credentials; synthetic GC-MS task IDs/result ZIP; existing Stage 4/5 JSON and manifests. **Outputs:** pass/fail integration evidence, bounded result summary and source hashes. **Failure behavior:** absent or foreign task uses the same denial; missing/invalid derived evidence is explicit; no fallback to fabricated numbers. **Acceptance:** real JWT/RLS checks if test project is configured; otherwise `NOT_RUN`, never production-ready. Python, frontend, Worker, browser, lint/build and secret checks pass locally.

## Tasks

- [x] Audit existing migration policies, API credential handling, task/Storage paths, and current nonproduction availability. Preserve production and raw data.
- [x] Add failing tests for Stage 5 Mean/SD/CV, replicate values, missing/CV-filtered states, hash failure and QC status. Implement the smallest read-only projection and scientifically bounded prompt.
- [ ] Add a real Supabase integration harness that refuses to run without explicit nonproduction configuration, creates only synthetic test identities/tasks, checks owner/foreign/absent/admin/Storage/session/tool boundaries, and writes redacted evidence. Harness and safe preflight are complete; **real run blocked by absent nonproduction credentials**.
- [x] Audit Python/R analysis endpoints and local knowledge sources; document future read-only query contracts and confirmation boundary for new computation. Keep SAG unconnected unless a real service is verified.
- [x] Run full affected Python/frontend/Worker/browser checks, lint/build/audit/secret/diff checks, review the diff, document blocked gates and commit locally. The real Supabase gate remains separately unchecked above.

## Review focus

- Stored `qc_summary` is Stage 5 counts; do not call it an overall PASS without a sourced stage severity.
- Stage 5 `groupStatistics` is descriptive across three configured technical parallels; never invent p-values, OAV or biological independence.
- A result ZIP hash proves archive integrity, not analytical correctness. Verify each projected Stage 5 JSON against its manifest.
- Model-provided task IDs, names and source text are untrusted. Enforce owner/admin in the server and field allowlists on every tool call.
- The real RLS suite must use ordinary user JWTs and an isolated nonproduction project. A fake REST store or service-role read cannot satisfy the gate.
