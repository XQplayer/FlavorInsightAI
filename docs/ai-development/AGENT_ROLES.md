# Professional roles and evidence

The current Codex environment exposes subagents and custom TOML roles in `C:\Users\hanxq\.codex\agents\`; standalone `agency-agents` was not found. These are optional task assignments, not agents automatically executing on every change.

| Role | Owned question | Typical output |
| --- | --- | --- |
| Architect (`software-architect`) | Does the change fit existing boundaries, contracts and rollback? | Architecture decision and affected paths |
| Frontend (`frontend-developer`) | Does UI behavior work across routes, viewport sizes and keyboard input? | Implementation or review evidence |
| Backend (`backend-architect`) | Are API contracts, failure modes and storage behavior sound? | Contract and integration review |
| Test (`test-automation-engineer`) | Do tests prove behavior and reproduce the defect? | Commands, outcomes and gaps |
| Security (`application-security-engineer` or `security-architect`) | Are auth, data exposure and trust boundaries controlled? | Findings with affected locations |
| Scientific reviewer (`statistician`/`model-qa-specialist`) | Are sample identity, units, assumptions and reference values valid? | Scientific boundary and fixture review |

The coordinator gives each dispatched agent a bounded question, exact files or ownership, and a required evidence format. Implementation agents must know others share the codebase and must not revert their changes. Reviewer findings need file/line and consequence. A role-based checklist performed by the coordinator is recorded as **serial self-review**. Independent review can be claimed only when a separate agent actually returns findings. Production deployment and sensitive configuration still require explicit user authorization regardless of role advice.
