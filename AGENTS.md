# FlavorInsight AI project rules

These rules apply to this repository. Read this file, the relevant README/docs, and the affected code before each task. Follow any more specific `AGENTS.md` in a subdirectory if one is added later.

## Route work by size

- Light: one small, reversible change; inspect, edit, run focused checks.
- Standard: bounded feature or bug; state inputs, outputs, dependencies and acceptance criteria; plan, implement, test and review.
- Full: cross-module, scientific, security or deployment work; use a separate worktree, a written spec and plan, specialist review where available, and integration checks. See `docs/ai-development/SKILL_ROUTING.md`.
- Load only skills relevant to the task. Superpowers is the process workflow; specialist skills add domain checks. An unavailable skill or agent must be reported as unavailable, never simulated as an independent review.

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

The operational workflow and gate matrix are in `docs/ai-development/DEVELOPMENT_WORKFLOW.md` and `QUALITY_GATES.md`.
