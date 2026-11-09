# GitHub Actions validation — 2026-11-09

**Status: not passed remotely for this branch.** The user has not authorized a push or PR, so no remote run exists for the phase 3 commit. Local success is recorded separately.

## Repository and workflow

- Worktree: `E:\codex\Projects\FlavorThresholdDB\.worktrees\ai-development`, branch `codex/ai-development`; base commits `a1aa947`, `650688c`. The root checkout has separate uncommitted changes and was not edited.
- Remote: `https://github.com/XQplayer/FlavorInsightAI.git`. `git ls-remote --heads origin codex/ai-development main` showed only `main` (`5e2056e`); the development branch is not on the remote.
- `.github/workflows/pr-quality-checks.yml` triggers on PRs targeting `main` and manual dispatch. Permissions are `contents: read`; concurrent runs cancel older runs on the same PR/ref. There is no production deployment step.
- `python-api`: Ubuntu, `python3` from runner image (unversioned), 5 minute timeout, 15 stdlib API tests. `verify`: Ubuntu, pnpm 11, Node 22, pnpm lockfile cache, frozen install, six Node test scripts, lint, build, and `pnpm audit --prod` with `continue-on-error: true`. R and browser E2E are not remote jobs. CI has no Windows path; build reads repository variables `FEMA_API_URL`, `SUPABASE_URL` and a Supabase anon key secret, not model API keys or private data.
- Local versions differed: Node 26.13.0, pnpm 11.25.0, Python 3.13.15, R 4.6.0. Node 22 and runner Python have not been verified on a matching remote run.

## Commands and observed evidence

| Command | Result |
| --- | --- |
| `gh pr list -R XQplayer/FlavorInsightAI --head codex/ai-development --state all --json number,url,headRefOid` | `[]` |
| `gh run list -R XQplayer/FlavorInsightAI --workflow pr-quality-checks.yml --branch codex/ai-development --limit 10 --json databaseId,headSha,conclusion,url` | `[]` |
| `gh run list -R XQplayer/FlavorInsightAI --workflow pr-quality-checks.yml --limit 20` and `gh run view 31237889303` | Historical successful run [31237889303](https://github.com/XQplayer/FlavorInsightAI/actions/runs/31237889303), SHA `56c073f`, 2026-08-08. Its old single-job steps do not match the current two-job workflow. Historical context only. |
| `cd frontend; pnpm install --frozen-lockfile` | Exit 0, lockfile current. |
| Six `pnpm run test:*` scripts listed in the workflow | Exit 0; 74 + 23 + 3 + 31 + 6 + 118 = **255/255** tests. The 118 browser-workflow unit cases include three new GC-MS reference tests. |
| `python -m unittest scripts.tests.test_shimadzu_analysis_service scripts.tests.test_shimadzu_proxy -q` | Exit 0, **15/15**. |
| `cd frontend; pnpm run lint; pnpm run build` | Both exit 0. Build warned about third-party 3dmol direct `eval` and chunks over 500 kB; these remain follow-up performance/security review items, not failed build gates. |
| `cd frontend; pnpm audit --prod` | Exit 1, two remaining high `xlsx` findings; CI currently reports this without blocking. |

The frontend lockfile and package version were changed only for a tested patch update (`vite` 8.1.5 → 8.1.6, transitive `nanoid` 3.3.16 → 3.3.20, `source-map-js` 1.2.1 → 1.2.2). No workflow file or deployment pipeline was changed. The browser E2E suite was not rerun in phase 3, so this report does not infer E2E success from Node tests.

## Remote acceptance record

| Item | Current value |
| --- | --- |
| Phase 3 workflow run ID/link | None |
| Phase 3 remote commit SHA | No remote SHA; local phase 3 commit is not pushed |
| `python-api` job | Not run remotely |
| `verify` job | Not run remotely |
| Failure/re-run result | No matching run; cannot diagnose or claim a successful re-run |

After authorization: push `codex/ai-development` to `origin`, open a test PR targeting `main` (draft is sufficient), capture run ID, commit SHA and both job conclusions, fix any failure and rerun. Do not promote to release until this record is updated with that exact run. No push or PR was performed in phase 3.
