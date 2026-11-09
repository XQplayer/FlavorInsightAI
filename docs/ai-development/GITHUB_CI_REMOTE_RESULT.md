# Phase 4 GitHub CI remote result — 2026-11-09

**State: NOT ACCEPTED.** There is no remote run for the phase 4 head. No push or PR was authorized or performed. A local green check is not a GitHub Actions result.

## Repository and workflow evidence

Run from `E:\codex\Projects\FlavorThresholdDB\.worktrees\ai-development`:

```powershell
git branch -vv
git worktree list --porcelain
git ls-remote --heads origin main codex/ai-development codex/ai-development-phase4
gh pr list --head codex/ai-development-phase4 --json number,url,headRefOid,state
gh run list --branch codex/ai-development-phase4 --json databaseId,url,headSha,status,conclusion --limit 10
```

Observed: `origin/main=5e2056ef7d534fec315cffbe508c88ca308eb1ee`; neither AI-development branch has a remote head; both PR and run queries returned `[]`. The phase 4 branch started at `9f1cb61`, three commits ahead of `origin/main` before the phase 4 commit. The original checkout at the project root has unrelated uncommitted work and was not edited. After the local phase 4 commit, record its exact SHA in the acceptance report; **Run ID, run URL, remote head SHA and job conclusions remain unavailable**.

The reviewed `.github/workflows/pr-quality-checks.yml` triggers on PRs targeting `main` and manual dispatch. It has `contents: read`, concurrency cancellation, a Python API job and a Node 22/pnpm 11 job. The lockfile cache points to `frontend/pnpm-lock.yaml`; the install uses `pnpm install --frozen-lockfile`. Build variables use GitHub `vars` and `secrets`, with no hard-coded local path or private research fixture. R and browser E2E are not in this public-runner workflow. Phase 4 adds the analysis tests and makes `pnpm audit --prod` blocking. Existing action references are `actions/checkout@v7`, `pnpm/action-setup@v6`, `actions/setup-node@v7`; their actual remote execution is unverified.

## Local preflight, distinct from remote acceptance

```powershell
cd frontend
pnpm install --frozen-lockfile --ignore-scripts
pnpm run test:search-workbench
pnpm run test:book-search
pnpm run test:static-routes
pnpm run test:platform
pnpm run test:shimadzu
pnpm run test:shimadzu-browser
pnpm run test:analysis
pnpm run lint
pnpm run build
pnpm audit --prod
cd ..
python -m unittest scripts.tests.test_shimadzu_analysis_service scripts.tests.test_shimadzu_proxy -v
```

Observed locally: seven frontend suites **359/359**, Python **15/15**, lint/build exit 0, audit exit 0 with no known advisories. The frozen install succeeded. Local Node is **26.13.0**, pnpm **11.25.0**, Python **3.13**; CI Node is 22 and Python is the current `ubuntu-latest` default, so exact environment parity and Action versions still need a real run. The separate complete browser E2E failed at `verify_release_candidate.mjs:311` with `desktop: fixed bottom element overlaps main content`; see `QUALITY_GATES_V3.md`. The raw local log is ignored by Git; the failure assertion is retained here.

## Required authorized operation and follow-through

After reviewing the local phase 4 commit, the owner can explicitly authorize: (1) `git push -u origin codex/ai-development-phase4`; (2) `gh pr create --base main --head codex/ai-development-phase4 --draft --title "Phase 4 security and scientific validation" --body-file <reviewed-body-file>`. The PR is the only automatic trigger for this head; `workflow_dispatch` on a different ref would not qualify. Then capture `gh run list --branch codex/ai-development-phase4`, `gh run view <id> --json headSha,status,conclusion,jobs,url`, and failing job logs with `gh run view <id> --log-failed`. Match `headSha` to the pushed phase 4 SHA and require both jobs successful; repair and rerun if needed. Do not mark this gate passed before that evidence exists.

Risk: remote dependency download, Action versions, Node 22 behavior and GitHub variables have not been exercised. No production deployment workflow was changed.
