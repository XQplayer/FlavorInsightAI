# FlavorInsight AI project rules

These rules apply to this repository. Read this file, the relevant README/docs, and the affected code before each task. Follow any more specific `AGENTS.md` in a subdirectory if one is added later.

## Route every natural-language development request

- Apply the single canonical decision policy in `docs/ai-development/SKILL_ROUTING.md` without asking the user to restate it: classify the task into the six domain routes, assign L1–L4 by impact, identify affected code and tests, then load only matching Skills. `docs/ai-development/UNIFIED_SKILL_ROUTING.md` is its short entry point, not a second policy.
- L1: one small reversible text/style/local interaction change; inspect, edit, focused check. L2: bounded feature or bug; state inputs, outputs, dependencies and acceptance criteria, then plan, implement, test and review. L3: cross-module or scientific/model work; written plan, isolated worktree when needed, specialist checks and integration tests. L4: production, migration, sensitive permissions, or core scientific rule replacement; impact/backup/rollback review and separate authorization before the risky operation.
- Superpowers is the sole primary development workflow. Engineering, scientific, GSAP and security Skills supply task-specific checks; never start competing global process workflows together. A missing Skill or agent is reported as unavailable with a safe documented fallback, never simulated as an independent review.

## Scientific integrity

- Do not change raw research data, statistical definitions, formulas, sample names or units without explicit authorization and recorded rationale.
- Before changing a scientific algorithm, fix a read-only reference fixture and expected values from an approved source; preserve current behavior as a separate baseline where reference truth is not established.
- Never present fabricated, random or synthetic values as observed research results. Label fixtures and demonstrations clearly.
- Preserve input provenance, file hashes where appropriate, transformations, exclusions, versions and warnings in scientific outputs.

## Engineering and delivery

- New functionality needs explicit input, output, dependencies, failure behavior and acceptance criteria.
- Diagnose a defect before editing; do not remove functionality to hide an error. Reuse existing modules before adding another implementation.
- Verify affected existing behavior after any functional change. Frontend changes must work at desktop and mobile widths, including keyboard use where relevant.
- At completion report changed files, commands and results, remaining issues, and a practical rollback path. Distinguish checks run from checks planned or unavailable.
- Do not deploy production, delete data, or change sensitive configuration without explicit authorization.

The operational workflow and gate matrix are in `docs/ai-development/DEVELOPMENT_WORKFLOW.md` and `QUALITY_GATES.md`. There is no automatic production deployment or remote push/PR permission implied by task routing.
