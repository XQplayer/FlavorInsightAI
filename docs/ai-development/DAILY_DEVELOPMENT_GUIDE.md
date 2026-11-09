# Daily development with natural-language requests

Describe the desired behavior and, if known, the page, error, sample type or acceptance expectation. You do **not** need to paste the six-route workflow or Skill list each time. The repository `AGENTS.md` and canonical `SKILL_ROUTING.md` supply that policy.

For each task Codex should:

1. Inspect Git status, relevant project rules and code. State the primary route, L1–L4 level, input/output/failure contract and any boundary that needs user information.
2. Open only the applicable installed Skill files, then use Superpowers for planning/debugging/TDD/verification at the required depth. If an optional Skill is missing, use the documented fallback and report it.
3. Establish a failing regression test for a bug or an independent reference fixture before scientific algorithm changes. Keep raw research data and accepted formulas intact unless explicitly authorized.
4. Implement the smallest suitable change, run affected tests and quality gates, inspect the diff and record whether review was independent or serial.
5. Report changed files, commands/results, remaining gaps, commit/rollback. Local checks, remote CI, scientific validity and release authorization are different decisions.

Examples of sufficient requests: “让处理失败时显示真实错误状态，手机上也能看清”；“给 GC-MS 半定量增加固体样品单位换算，但先核对参考方法和公式”；“修复工作簿导入报错并保留原文件”；“给 PR 增加可靠的 Python 测试”。 For research rule ambiguity, Codex must ask for the authoritative method rather than guessing. For deployment, remote push/PR, destructive migration and sensitive permission changes, it must finish all safe local work and request separate authorization before the risky operation.

Current limits: named `agency-agents` and SAG are not available as verified integrations; actual Codex subagents may be used for bounded review when supported. The five project scientific Skills have task-level behavior evidence; platform automatic dispatch has not been proven. `QUALITY_GATES_V3.md` is the phase 4 snapshot, while `QUALITY_GATES.md` is the current rule; consult the most recent acceptance report for results at a particular commit.
