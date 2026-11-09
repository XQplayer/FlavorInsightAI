# Unified routing entry point

Give Codex a natural-language development request. `AGENTS.md` directs it to the **canonical** decision rules in `SKILL_ROUTING.md`; this page is a quick index, not another set of rules. Codex must check the actual repository state and available `SKILL.md` before taking action.

| Main changed behavior | Primary route | Typical complexity |
| --- | --- | --- |
| Layout, interaction, responsive UI or animation | 1. Frontend / UI / GSAP | L1–L3; GSAP only for animation |
| GC-MS, statistics, scientific computation or figure meaning | 2. Scientific data processing | L3; L4 for approved core-rule replacement |
| Database, API, file import/storage or authorization | 3. Database / API | L2–L4 |
| Training, validation, prediction or model explanation | 4. AI model development | L3–L4 |
| A failure whose cause is not yet known | 5. Software fault diagnosis | L2–L4; re-route specialist after diagnosis |
| CI, dependency, build, release or deployment | 6. Deployment / CI | L2–L4 |

Choose one primary route and add a specialist only for a real cross-cutting concern. Rate impact separately: **L1** small reversible, **L2** bounded feature/bug, **L3** cross-module or scientific/model work, **L4** production, migration, core scientific replacement or sensitive permissions. Superpowers remains the sole primary workflow. `SKILL_REGISTRY.md` gives exact installed names and availability; `QUALITY_GATES.md` gives required checks. The working assistant may infer the route from the request, but no platform-wide automatic Skill-dispatch hook has been verified. Actual reads and outcomes must be recorded for each task.

Example: “修复数据处理页面移动端进度提示遮挡” → route 5 while diagnosing, route 1 for the UI fix, likely L2, then focused responsive E2E, affected frontend tests, lint and build. No research or GSAP Skill is activated unless the actual change triggers one.
