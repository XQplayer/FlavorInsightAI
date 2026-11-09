# Environment audit

Observed 2026-11-09 (Asia/Singapore) at commit `5e2056e`, branch `codex/fix-shimadzu-online-enrichment`. This is a local snapshot, not a certification of deployed services.

## Repository and application

| Area | Observed evidence |
| --- | --- |
| Product | `README.md`: FlavorInsight AI v1.5.0 public release; local analysis workbench is unreleased. Do not equate code on all worktrees with deployed features. |
| UI | `frontend/package.json`: React 19, Vite 8, Tailwind 4, GSAP 3, Supabase JS, RDKit, SheetJS; pnpm lockfile. `frontend/src/app/platformRoutes.js`: home, database, aroma-threshold, data-processing, data-analysis, ai-models, resources, login; legacy shimadzu-analysis maps to processing. |
| API | `fema_proxy_server.py`: Python HTTP handler with GET/POST routes for external evidence and Shimadzu support; `shimadzu_analysis_service.py` is a local processing service. `render.yaml` declares the Render API. No API framework or generated OpenAPI contract was found. |
| Data | `supabase/migrations/` contains search analytics and Shimadzu authorization, retention and raw-upload policy migrations. `data/`, caches, and browser-local workbook flow exist. No database mutation was performed for this audit. |
| Research computation | `frontend/src/shimadzu-core/` Stage 0–6 and browser worker tests; `services/analysis/` Python/R statistical service and tests; `frontend/src/analysis/` local analysis and visualization modules. These require source and reference-value review before scientific edits. |
| Deployment | `.github/workflows/deploy-pages.yml` deploys on push to `main`; `deploy-render-api.yml` is manual, protected by production environment and hook secret; `render.yaml` has `autoDeploy: true` for its Render service. Check Render linkage before any branch merge. |

## Git and quality state

- The starting worktree had a modified `fema_flavor_cache.json` plus untracked design, handoff, output and script files. Those files were left untouched. Existing worktrees include `codex/analysis-workbench` and other active feature branches. This documentation was drafted in `codex/ai-development` at `.worktrees/ai-development`.
- `frontend/package.json` provides lint, build, Node tests, and browser E2E scripts. `scripts/tests/` contains Python `unittest`; `services/analysis/tests/` contains Python and R tests. Browser scripts use Playwright through a host runtime path and may need local service or browser availability.
- `.github/workflows/pr-quality-checks.yml` runs selected frontend tests, lint and build. It does not currently run Python/R tests, browser E2E, `pnpm audit`, scientific reference-value gates, or a complete API integration suite. These are documented as gaps, not passing gates.
- Local `node`, `pnpm`, and Python commands resolve; version and dependency readiness should be checked per task. A test script's existence is not evidence that it passed in this audit.

## Agent environment

- No project or ancestor `AGENTS.md` existed in the inspected repository path. `C:\Users\hanxq\.codex\AGENTS.md` exists but is empty (0 bytes). The project-level file added by this work is additive.
- Superpowers skills are present at `E:\codex\codex-personal-skills\` including `using-superpowers`, `brainstorming`, `writing-plans`, `using-git-worktrees`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`, and `requesting-code-review`. Some are also visible via `C:\Users\hanxq\.codex\skills`. Their instructions can be more rigid than this repository's size-based routing; direct user instructions and project scope govern selection.
- addyosmani `agent-skills` are present at `E:\codex\codex-owned-skills\plugins-cache\agent-skills\agent-skills\0.6.15\skills\`; mattpocock skills at `E:\codex\codex-owned-skills\plugins-cache\mattpocock\mattpocock-skills\1.3.2\skills\`. Their versions are path observations only. Use the selective registry; avoid duplicate process workflows.
- GSAP skills (`gsap-core`, `gsap-react`, `gsap-scrolltrigger`, `gsap-timeline`, `gsap-performance`, `gsap-plugins`, `gsap-frameworks`, `gsap-utils`) exist under the personal-skills root. `gsap` and `@gsap/react` are UI dependencies, but skills activate only for animation work.
- `C:\Users\hanxq\.codex\agents\` contains custom role TOMLs, including `software-architect`, `frontend-developer`, `backend-architect`, `test-automation-engineer`, and security roles. No standalone `agency-agents` installation was found in searched roots. The current session exposes a subagent mechanism, but no independent agent review was run in this audit.
- Exposed MCP tool namespaces include `artifact_session`, `codex_apps`, `data`, `effectcraft_flavorinsight`, `node_repl`, `rea`, and `windows_mcp`. `codex_apps` includes connected app tool families such as GitHub, Google Drive, Pages, and Security Cloud. Availability is session-specific; no `SAG` namespace was exposed and no SAG authorization/deployment was verified. Tool presence does not imply permission to publish or modify external services.
- User `config.toml` headings also list `cua_repl`, `node_repl`, `windows-mcp`, `effectcraft-flavorinsight`, and `rea` MCP servers, and versioned plugin entries for agent-skills, mattpocock-skills, browser and Office runtimes. Configuration headings were inspected without printing credentials; an entry does not prove a server is healthy in this session.

## Decisions and limits

No software was installed; no global configuration, business code, database, raw data or production environment was changed. Project-scoped skills in `.agents/skills/` add scientific rules without replacing existing skills. A future CI change should be a separate reviewed task because it changes execution and dependency assumptions.

## Validation of this audit deliverable

The focused route contract (`node --test frontend/src/platformRoutes.test.mjs`) passed 7/7 in both the original worktree and the isolated worktree. `git diff --check` reported no whitespace errors. The skill-creator bundled `quick_validate.py` could not run because the active Python lacks `PyYAML` (`ModuleNotFoundError: yaml`); project skill structure was checked separately with a standard-library-only check. No full application build, live endpoint probe or browser E2E was performed for this documentation-only change.
