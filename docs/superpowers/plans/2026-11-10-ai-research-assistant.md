# AI research assistant local implementation

Route: cross-module AI/API/security, full workflow. Isolated branch `codex/ai-research-assistant` starts from `0e0e929`, leaving the original checkout untouched.

## Contract

Input: a bounded user message and an optional server-owned conversation ID. Output: server-sent start, tool, text delta, usage, done or error events. The server owns session identity, OpenAI key/model selection, tool schemas and authorization. Public compound records are filtered from the existing FlavorThresholdDB public data. Cloud task tools require a verified Supabase token and owner-scoped row-level-security query. No raw workbooks or full logs go to OpenAI.

Failure: no key/model in real mode, unknown tool, invalid arguments, inaccessible task, quota, timeout and broken stream fail explicitly. Mock mode is labelled and restricted to local development. Knowledge search returns unavailable until a real index is connected. Model output is untrusted and rendered without raw HTML.

Acceptance: route and page, multilingual responsive chat, streaming/cancel/retry/conversations, four read-only tools, true public-data CAS 141-78-6 demonstration, private task denial, API-key containment, limits and audit, frontend/API/browser tests, no Worker/scientific algorithm changes.

## Sequence

1. Add failing gateway/tool tests, implement security and data projections.
2. Add API adapter to existing Python proxy; stream Responses API with server-side tool loop and local Mock.
3. Add lazy chat route/page/client and light/dark/mobile styling.
4. Run focused and regression suites, browser screenshots and review; document actual OpenAI verification status.
