# Skill routing

Choose the smallest workflow that covers the actual failure cost. Start with `AGENTS.md`, the relevant code and the task contract. Load a specialist skill only if its trigger matches.

| Task | Process | Specialist | Verification |
| --- | --- | --- | --- |
| Small text/UI adjustment with no scientific behavior | Light: inspect, edit, focused check | Frontend skill only when layout or accessibility decisions are material; GSAP only for animation | Targeted test/lint or visual viewport check |
| Bounded feature or bug | Standard: requirements, plan, diagnosis if bug, implementation, review | One or two addyosmani/mattpocock domain skills as needed | Affected unit/API/browser checks plus build if bundle changes |
| Cross-module or high-impact change | Full: written spec and plan, worktree, staged implementation, reviewer when available | Relevant engineering and scientific skills | Full affected suite, integration/browser, reference values, rollback rehearsal |
| GC-MS identity, internal-standard quantitation, units, QC | Full scientific | `flavor-gcms-processing` and `flavor-data-integrity`; `analytical-method-validation` only for formal validation claim | Frozen reference workbook, lineage, parity and regression |
| PCA, OPLS-DA, differential analysis | Full scientific | `flavor-statistical-analysis` and `flavor-data-integrity` | Assumption checks, permutation/cross-validation where appropriate, fixed reference values |
| Model training or interpretation | Full scientific | `flavor-ml-validation` and `flavor-data-integrity` | Group-aware split, leakage audit, held-out evaluation, reproducible seed |
| Scientific figure/export | Standard or full by impact | `flavor-scientific-visualization`; general `scientific-visualization` if plotting implementation needs it | Label/unit/source/uncertainty checks and visual review |
| Source file import, migration, retention | Full | `flavor-data-integrity`; security skill if access controls change | Hashes, round-trip, permission tests; approval before data mutation |

For a full task, an actual independent reviewer is preferred. If no subagent is dispatched, the primary agent performs a second, explicitly serial review and records that limitation. Never report a role or test as executed solely because its skill or file exists. SAG is optional and currently unverified; route to it only after connection and authorization are confirmed.

Phase 3 task probes confirmed real agent reads and use of all five project scientific skills on synthetic cases. These prove task-level selection and constraint-following in those sessions; they do not prove a platform-wide automatic dispatch hook. See `SCIENTIFIC_SKILL_ACTIVATION.md`. New scientific calculations require an independently computed reference before implementation or claims; an unavailable skill falls back to `AGENTS.md`, the domain contract, a documented manual review and the same quality gates.

## Routing examples

- Change a navigation label: light; no scientific or GSAP skill.
- Correct concentration conversion in Stage 4: full; GC-MS + integrity; lock reference values before editing.
- Add a chart transition: standard; GSAP React plus visual/viewport checks.
- Write a literature-backed explanation: verify citations through authorized source retrieval; generated prose is not evidence.
