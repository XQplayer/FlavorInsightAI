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

## Route and level selection

`SKILL_ROUTING.md` selects the six domain routes and L1–L4 impact. Roles are optional assignments **after** that decision: route 1 may need frontend/test; route 2 scientific/test; route 3 backend/security; route 4 model QA/statistician/test; route 5 the owner of the diagnosed component plus test; route 6 CI/security. L1 generally uses no subagent, L2 uses a focused reviewer only when useful, L3 seeks actual independent review of the highest-risk question, and L4 requires a documented qualified review and authorization boundary. Do not spawn every role for every request. The current tool may expose agent roles even though the named `agency-agents` package is unavailable; record the actual dispatched agent name, task, files, returned findings and limitations. A static role mapping or Skill read is not evidence that an agent executed.
