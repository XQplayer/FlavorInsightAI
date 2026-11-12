# Phase 2 skill validation report

Date: 2026-11-09, branch `codex/ai-development`, baseline `a1aa947`. The five original project skills and phase-one documents were retained.

## Boundary and installation

`E:\codex\Projects\FlavorThresholdDB` is the Git root of the **whole FlavorInsight AI application**, despite its directory name. This single repository tracks `frontend/src/app/PlatformApp.jsx`, `frontend/src/App.jsx` (database), `frontend/src/components/shimadzu/` (processing), `services/analysis/`, the Python API, Supabase migrations and GitHub Pages workflow. `origin` is `https://github.com/XQplayer/FlavorInsightAI.git`; Vite base is `/FlavorInsightAI/`. The root `AGENTS.md` applies to all these directories. The five `.agents/skills/flavor-*/` skills are repository-shared, with task-specific triggers. There is no separate FlavorInsight AI main-app repository to synchronize. No other repository's `AGENTS.md` was copied.

Superpowers skills, selective addyosmani skills, mattpocock skills and GSAP skills remain at the paths recorded in `SKILL_REGISTRY.md`. All five project skills have `SKILL.md` at the documented paths. A fresh-context Codex subagent reported all five exact names in its **Available skills** catalog and read each file. This proves discoverability in that session, not automatic selection for every future prompt.

## Official format validation

An isolated virtual environment was created with `python -m venv E:\codex\tmp\flavorinsight-skill-validation-20261109`; only that environment received `PyYAML 6.0.3` via `...\Scripts\python.exe -m pip install --disable-pip-version-check PyYAML`. Official validator: `E:\codex\codex-personal-skills\.system\skill-creator\scripts\quick_validate.py`.

Initial validation without UTF-8 mode passed four skills and raised `UnicodeDecodeError` on the Chinese text in `flavor-gcms-processing` under the host's GBK default. With `PYTHONUTF8=1`, running the validator for each `.agents/skills/flavor-*/` directory returned **`Skill is valid!` five times**. No system Python package or global Codex setting was changed.

## Activation and routing probes

| Probe | Observed decision | Nature of evidence |
| --- | --- | --- |
| Positive: change Stage 4 internal-standard concentration formula | Select `flavor-gcms-processing` and `flavor-data-integrity`; require approved formula and reference fixture | Fresh-context agent read all five files and applied routing to a hypothetical request; no formula changed |
| Negative: change navigation label | Select none of the five scientific skills | Fresh-context routing decision |
| Competition: imported-data PCA plot | Select `flavor-statistical-analysis`, `flavor-data-integrity`, `flavor-scientific-visualization`; exclude GC-MS and ML validation | Fresh-context routing decision; no analysis executed |
| Unavailable SAG request | No `mcp__sag` tool namespace found; report unavailable, use authorized cited source retrieval for a real request | Tool-catalog check; no SAG retrieval simulated |
| Real pilot: processing task feedback | Read and used Superpowers `brainstorming`, `using-git-worktrees`, `writing-plans`, `test-driven-development`, `verification-before-completion`, `requesting-code-review`; used addyosmani `frontend-ui-engineering` for UI/accessibility. Five scientific skills were intentionally not applied to a UI-only change. | Actual skill-file reads, plan, red/green test runs, code changes and independent reviewer response in this session |

These probes distinguish **static routing** from **actual Codex execution**. A fresh agent catalog check and skill-file reads establish availability. The pilot establishes actual use of process/UI skills and an independent review. The four hypothetical routing cases do not prove automatic activation of the scientific skills for real business work; that remains a next-phase evaluation with safe task-specific fixtures.
