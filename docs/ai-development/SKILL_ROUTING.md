# Canonical Skill routing policy

This file is the **only project decision policy** for natural-language development requests. `AGENTS.md` requires its use; `UNIFIED_SKILL_ROUTING.md` is a compact entry point and `DAILY_DEVELOPMENT_GUIDE.md` explains day-to-day use. A route is an instruction for the current Codex task, not proof of a platform-level automatic dispatcher. Read the affected source and actual `SKILL.md` before claiming a Skill was used.

## Decide once at intake

1. Read project and nested `AGENTS.md`, the relevant README/design/code/tests, branch/status and the user's task. Preserve uncommitted work. Identify actual inputs, outputs, dependencies, errors and acceptance criteria.
2. Choose **one primary route** by the main changed behavior in the table below. Add only a cross-cutting specialist when its trigger really matches, e.g. `flavor-data-integrity` for research files or security for untrusted upload. A UI error in a data import is primarily **software fault diagnosis** until the cause is known; then apply the relevant import or scientific specialist. Route and risk level are independent dimensions.
3. Assign L1–L4 by the highest actual impact, not by task length. Use Superpowers as the sole primary process. Select its steps for the level; do not also activate addyosmani planning/TDD or another competing global workflow. Open exact specialist `SKILL.md` files as needed, record the reads and the constraint they changed.
4. Select the gate set from `QUALITY_GATES.md`; record executed commands and failures. If a Skill, agent, dependency or test environment is unavailable, mark it unavailable, follow project rules and a documented manual domain checklist, retain equivalent quality requirements, and do not claim that it ran.
5. Approval is required for remote push/PR, production deployment, raw research data mutation, destructive migration or sensitive configuration. Routing never grants that permission.

## Six primary routes

Names here are exact installed Skill names as checked in `SKILL_REGISTRY.md`; all listed additions are conditional, not a bundle to run on every request.

| Route and trigger | Superpowers process, selected by level | Optional specialists, load only for matching work | Minimum affected gates and exclusions |
| --- | --- | --- | --- |
| **1. Frontend / UI / GSAP:** home, layout, interaction, responsiveness, visualization interface or actual animation | `brainstorming` for uncertain interaction, `systematic-debugging` for defects, `verification-before-completion` for completion; plan/TDD for L2+ | `agent-skills:frontend-ui-engineering` for layout/accessibility; `agent-skills:browser-testing-with-devtools` for browser diagnosis; `gsap-react`, `gsap-core` or other exact GSAP Skills only when implementing animation; `flavor-scientific-visualization` when a plot encodes scientific data | Desktop/tablet/mobile, keyboard/accessibility, `prefers-reduced-motion`, visual consistency, affected browser tests, lint/build. Progress reflects real task state. No GSAP for ordinary copy or business logic. |
| **2. Scientific data processing:** GC-MS, cleaning, semiquantitation/units, statistical analysis, scientific plots | `writing-plans`, `test-driven-development`, `verification-before-completion` for algorithm work; focused path for a harmless label | `flavor-gcms-processing` for GC-MS; `flavor-statistical-analysis` for statistical inference; `flavor-data-integrity` for raw data/lineage; `flavor-scientific-visualization` for scientific figures | Independent reference fixture with units/formula/tolerance/source, invalid cases, sample independence, reproducibility, related R/Node tests, source protection. Do not silently change accepted rules or turn synthetic output into observed findings. |
| **3. Database / API:** database queries, API, imports, files, persistence, auth | `writing-plans`/`test-driven-development` for material changes; `systematic-debugging` first for faults | `agent-skills:api-and-interface-design` for contract; `agent-skills:incremental-implementation` for staged changes; `agent-skills:security-and-hardening` for untrusted input, permissions or secrets; `flavor-data-integrity` for research file lineage | Contract and failure tests, API integration, access control, validation, file limits, consistency and compatibility. Data migration or permission architecture moves to L4. |
| **4. AI model development:** training, tuning, group cross-validation, prediction, interpretation | `brainstorming` if requirements uncertain, `writing-plans`, `test-driven-development`, `verification-before-completion` | `flavor-ml-validation`; `flavor-data-integrity` for dataset lineage; `mattpocock-skills:code-review` for focused code review rubric if needed | Split by independent unit before learned transforms, leakage audit, nested/group CV, holdout or external evaluation, seed/version, overfit and metric checks. Full-fit/training metrics cannot stand in for prediction. |
| **5. Software fault diagnosis:** runtime fault, import failure, calculation error, configuration/performance defect | `systematic-debugging` first, then `test-driven-development` and `verification-before-completion` for a code fix | The domain Skill identified by the root cause; `agent-skills:performance-optimization` only for measured performance faults | Reproduce, collect boundary evidence, identify root cause, failing regression test before fix, smallest fix, adjacent regression and rollback. Do not remove the failing check or hide functionality. |
| **6. Deployment / CI:** build, dependency updates, Actions, releases, production | `writing-plans` at L3+, `systematic-debugging` for failed runs, `verification-before-completion` | `agent-skills:ci-cd-and-automation`, `agent-skills:security-and-hardening`, `agent-skills:performance-optimization` when measured or bundle-sensitive | Frozen install, tests, lint/build, advisory and secret checks, exact remote run SHA/jobs, rollback. Local pass never equals remote CI pass. Remote high-risk operations require separate authorization. |

## L1–L4 complexity and workflow

| Level | Trigger, including override | Process and review | Gate selection |
| --- | --- | --- | --- |
| **L1 light** | One reversible text/style/local interaction edit with no research, auth or persistence semantics | Inspect exact code; edit minimally; serial self-check is adequate | Focused unit/lint or viewport test as affected. No compulsory written plan/worktree/agent. |
| **L2 standard** | Bounded feature, API endpoint, page state or reproducible noncritical bug | State contract; brief plan; test before behavior change; review diff | Affected unit/API/browser tests, lint/build when bundled. Domain Skill only if triggered. |
| **L3 complex** | Cross-module feature, research calculation/model, security-sensitive parser or broad migration design | Written plan; isolated worktree when needed; relevant specialists; actual independent agent review when available or label serial self-review | Full affected suites, integration/browser, independent references and security checks; capture rollback. |
| **L4 high risk** | Production deployment, destructive/irreversible migration, core scientific algorithm replacement, sensitive permission system/config | Impact and backup/restore analysis; written plan and strict review; stop at authorization boundary for the risky operation | All relevant L3 gates plus formal data/permission/release review, real CI and recovery proof before authorized execution. |

The highest-risk touched component wins. A one-line change to a concentration formula is L3 or L4, not L1. A small production setting change is L4. A user-facing chart may be route 1 plus `flavor-scientific-visualization`; a model API may be route 4 plus API/security review. Name the primary route and additions in the task record so reviewers can reconstruct the decision.

## Conflict and fallback rules

- Superpowers owns intake, planning, worktree, diagnosis, TDD, review and verification. `agent-skills:*` and `mattpocock-skills:*` provide **specialist** checklists; avoid their duplicate planning/TDD workflows. A second review rubric is optional, not a second process.
- `gsap-*` is animation-only. The data-visualization Skill checks scientific meaning; UI/GSAP Skills check presentation, with scientific values and units taking precedence.
- `agent-skills:browser-testing-with-devtools` has an installed SKILL.md but requires Chrome DevTools MCP, which was not exposed in the inspected session. Follow its browser-verification intent with the repository's Playwright E2E or an available browser tool and name the tool actually used; do not claim a DevTools MCP run.
- `flavor-statistical-analysis` and `flavor-ml-validation` may both apply to supervised statistical models. Use both for inference plus prediction, recording which check owns each claim. `flavor-data-integrity` applies when source lineage or research files are affected.
- `agency-agents` and SAG remain unavailable/unverified in this environment. Available Codex subagents can be **actually dispatched** for bounded specialist review. If none runs, report serial self-review; never call it independent.
- A missing Skill does not remove its acceptance gate. Read `AGENTS.md`, actual code/tests, the relevant project contract and `QUALITY_GATES.md`; use an available domain Skill only if its scope fits, and record the unavailable name and manual fallback. No silent substitute.

## Decision examples

- Rename a navigation label: route 1, L1; no GSAP or research Skill; focused UI test.
- Repair a desktop fixed-bottom overlap found by E2E: route 5 + frontend specialist, L2; reproduce and inspect actual DOM, then failing regression, fix, desktop/tablet/mobile browser checks.
- Change GC-MS concentration conversion: route 2, L3 or L4 if replacing an accepted core formula; independent unit reference, GC-MS plus integrity Skill, scientific review and full affected tests.
- Add authenticated workbook upload API: route 3, L3; API contract, file/security and data-integrity checks.
- Train OPLS-DA/ML classifier: route 4, L3; statistical and ML Skills when both inference and prediction are claimed, biological-unit splits and external reference/validation.
- Update PR workflow or dependencies: route 6, L2/L3; frozen install, audit, local checks; remote CI unverified until matching run. Production release is L4 with separate authorization.

Previous phase 3/4 probes show actual agent reads and use of the five project scientific Skills on synthetic tasks. That is task-level evidence, not platform dispatcher telemetry; see `SCIENTIFIC_SKILL_ACTIVATION.md` and `SCIENTIFIC_SKILLS_BEHAVIOR.md`.
