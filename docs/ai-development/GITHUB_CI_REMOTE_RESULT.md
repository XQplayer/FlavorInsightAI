# Phase 4 GitHub CI remote result — 2026-11-10

**State: PASS for the specifically requested code commit `17298ae6af5f5e400c16b0d1ca59925aa187d804`.** Draft [PR #22](https://github.com/XQplayer/FlavorInsightAI/pull/22) triggered [PR Quality Checks Run 42656604520](https://github.com/XQplayer/FlavorInsightAI/actions/runs/42656604520), attempt 1, `pull_request` event. The run's `head_sha` exactly matches the requested commit and both required jobs completed successfully. This is remote CI acceptance for that commit, not production release authorization or an independent scientific-method certification.

## Repository and workflow evidence

Run from `E:\codex\Projects\FlavorThresholdDB\.worktrees\ai-development`:

```powershell
git branch -vv
git worktree list --porcelain
git ls-remote --heads origin main codex/ai-development codex/ai-development-phase4
gh pr list --head codex/ai-development-phase4 --json number,url,headRefOid,state
gh run list --branch codex/ai-development-phase4 --json databaseId,url,headSha,status,conclusion --limit 10
```

Before the authorized operation, `origin/main=5e2056ef7d534fec315cffbe508c88ca308eb1ee`, the AI-development phase 4 branch had no remote head, and PR/run queries returned `[]`. The local worktree was clean at exactly `17298ae6af5f5e400c16b0d1ca59925aa187d804`; the original root checkout's unrelated uncommitted work was not edited. `gh repo view XQplayer/FlavorInsightAI` confirmed the GitHub remote belonged to the authenticated `XQplayer` account (`viewerPermission=ADMIN`). `git push -u origin codex/ai-development-phase4` was a normal, non-forced push; `git ls-remote --heads origin codex/ai-development-phase4` then returned the exact requested SHA. GitHub connector PR creation returned `403 Resource not accessible by integration`; the already authenticated `gh` CLI created the authorized Draft PR successfully.

The reviewed `.github/workflows/pr-quality-checks.yml` triggers on PRs targeting `main` and manual dispatch. It has `contents: read`, concurrency cancellation, a Python API job and a Node 22/pnpm 11 job. The lockfile cache points to `frontend/pnpm-lock.yaml`; the install uses `pnpm install --frozen-lockfile`. Build variables use GitHub `vars` and `secrets`, with no hard-coded local path or private research fixture. R and full browser E2E are not in this public-runner workflow. Phase 4 added analysis, overlap geometry and routing-contract tests and made `pnpm audit --prod` blocking. The actual remote run successfully executed `actions/checkout@v7`, `pnpm/action-setup@v6` and `actions/setup-node@v7`.

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

Observed locally at the initial phase 4 commit: seven frontend suites **359/359**, Python **15/15**, lint/build exit 0, audit exit 0 with no known advisories. The frozen install succeeded. Local Node was **26.13.0**, pnpm **11.25.0**, Python **3.13**; the successful remote run now supplies the missing Node 22/Ubuntu evidence. The original full browser E2E failure was a vertical-only overlap false positive; after a two-axis geometry check, full desktop/tablet/mobile E2E passed locally. The full browser and R checks remain local only. See `PHASE4_ACCEPTANCE.md` for those gates.

## Actual remote execution and job results

```powershell
git push -u origin codex/ai-development-phase4
gh pr create --repo XQplayer/FlavorInsightAI --base main --head codex/ai-development-phase4 --draft --title 'Phase 4: security validation and unified Skill routing' --body-file _local/phase4-pr-body.md
gh run watch 42656604520 --repo XQplayer/FlavorInsightAI --interval 10 --exit-status
gh api repos/XQplayer/FlavorInsightAI/actions/runs/42656604520 --jq '{id,html_url,head_sha,event,status,conclusion,run_attempt,created_at,updated_at,workflow_id}'
gh api repos/XQplayer/FlavorInsightAI/actions/runs/42656604520/jobs --jq '.jobs[] | {id,name,status,conclusion,steps:[.steps[]|{name,status,conclusion}]}'
```

Observed run metadata: ID **42656604520**, workflow ID **326246438**, URL above, event `pull_request`, attempt **1**, `status=completed`, `conclusion=success`, `head_sha=17298ae6af5f5e400c16b0d1ca59925aa187d804`, started `2026-11-09T16:37:09Z` and updated `16:37:56Z` (2026-11-10 Singapore time). PR #22 remained `OPEN`, `isDraft=true`, base `main`, and unmerged.

| Required job | Job ID / URL | Actual result |
| --- | --- | --- |
| Python API and service contracts | [129296631524](https://github.com/XQplayer/FlavorInsightAI/actions/runs/42656604520/job/129296631524) | `completed/success`; service and HTTP integration **15/15** in the job log. |
| Tests, lint, and build | [129296631936](https://github.com/XQplayer/FlavorInsightAI/actions/runs/42656604520/job/129296631936) | `completed/success`; frozen install, seven frontend suites **359/359**, overlap geometry **4/4**, routing contract **2/2**, lint, production build and blocking `pnpm audit --prod` all have successful step conclusions. Audit log: `No known vulnerabilities found`. |

The verify log contains a non-fatal `WebSocket server error: Port 24678 is already in use` during analysis tests; that suite still reports **104/104**, and the job concludes `success`. Build retains the previously tracked RDKit externalization, 3dmol direct-`eval` and large-chunk warnings. No CI failure required a fix or rerun. Read-only checks of the remote default branch and the local diff showed that Pages deploy triggers only on a `main` push/manual dispatch, Render's GitHub workflow only on manual dispatch, and neither deploy workflow nor `render.yaml` was changed; no deploy or migration action was invoked. The repository `render.yaml` has `autoDeploy: true`, so a later push to its configured production-linked branch requires separate review. The Draft PR was neither merged nor deployed.

**Evidence boundary:** This report records the successful run for the named code commit. A later documentation-only report commit would have a different SHA and must receive its own matching Actions run before calling that new head green. Full browser E2E, R references and the CDN-tarball advisory-index limitation remain separate from this remote PR gate.
