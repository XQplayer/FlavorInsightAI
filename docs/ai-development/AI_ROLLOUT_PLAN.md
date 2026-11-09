# Controlled release plan and approval boundary

1. Merge only after remote PR checks pass and code review resolves findings. Keep `AI_PCA_ENABLED=false` in Pages while the hosted executor is absent. `render.yaml` has `autoDeploy: true` on main, so any main merge may publish backend code; verify linked Render service and release controls first.
2. **Separately review and approve** a production R service deployment (runtime image, pinned R packages, CPU/memory/time limits, private ingress, authenticated task API), production dataset/result persistence schema and RLS/Storage SQL, and server-only OpenAI/model/connection secrets. Supply exact SQL, service spec, environment-variable names, blast radius, backups and rollback before changing them. This is a proposed change, not approved or executed.
3. Before enabling the feature, run a staging canary with two ordinary JWTs, a synthetic dataset, rejection of cross-user task IDs, timeout/cancel and immutable result hashes. Then perform production read-only policy comparison and controlled admin test. No production raw research data is needed.
4. After approval and successful checks, enable AI chat for named admins, then PCA for named testers, then widen only after telemetry and cost review. Feature flag and service rollback must be rehearsed. Roll back frontend by disabling `AI_PCA_ENABLED`; back out code with `git revert` of the release commit. Any DB rollback requires separately reviewed SQL and preservation of data.

Do not infer approval for item 2 from the general goal of online publication.

No production SQL or Secret change has been proposed for execution yet: the hosted task schema, policies, R service endpoint contract and rollback migration are not finished. A later approval request must attach those exact artifacts and identify the production project ref before any write. The current Draft PR is a local pilot and CI candidate only.
