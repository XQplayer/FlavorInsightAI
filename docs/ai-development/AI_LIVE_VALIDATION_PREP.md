# 真实 OpenAI API 验证准备与当前状态

## 环境审计（2026-11-10）

- Worktree：`.worktrees/ai-research-assistant`；分支 `codex/ai-research-assistant`；审计起点 `948dd2a0af0bc7d73ff289219d8f1349f3d99715`；工作区在审计前干净。
- 当前 `18887` `/ai/session`：`mode=mock`、`key_configured=false`、`model_configured=false`、`identity=local_mock`。仅记录布尔值，未读取或输出密钥。
- 当前进程环境：`OPENAI_API_KEY`、`OPENAI_MODEL`、`FLAVOR_AI_MODE`、`FLAVOR_AI_ALLOW_LOCAL_REAL` 均未配置；worktree 中 `.env`、`.env.local` 均不存在。
- 未安装 Python `openai` SDK。Gateway 使用 Python 标准库 HTTPS 直接请求 Responses API；无需为了这轮验证安装 SDK。协议模拟测试已覆盖 `response.output_text.delta`、`response.completed`、`function_call` 和 `function_call_output`，真实模型兼容性仍待账户验证。
- Python 服务在导入 `fema_proxy_server.py` 时实例化 `AIGateway()`，启动时读取环境变量。更改配置需要停止旧 Mock 代理并重启 Python 服务。前端 `VITE_FEMA_API_URL` 只指向代理地址，不含密钥。

## 官方协议核对

当前实现处理的流事件与 [OpenAI Streaming Responses](https://developers.openai.com/api/docs/guides/streaming-responses) 一致；Function Calling 将工具返回值按 `call_id` 作为 `function_call_output` 送回模型，符合[官方流程](https://developers.openai.com/api/docs/guides/function-calling)。四个工具使用 strict schema、关闭额外属性，可选介质用可空字段表示，符合[官方 strict 规则](https://developers.openai.com/api/docs/guides/function-calling)。取消由浏览器 AbortController 中断 SSE，Python 关闭上游流；请求超时默认 35 秒，连接前瞬时失败只重试一次。上述是静态核对和模拟测试结果，**不是**真实模型兼容性证明。模型 ID 必须由用户在本地配置，并经账号实际请求确认。

## 本地私有配置

配置位置与操作步骤见 [AI_RESEARCH_ASSISTANT.md](AI_RESEARCH_ASSISTANT.md#私有配置文件与-live-切换)。新增 `scripts/start_ai_local.ps1` 读取被 Git 忽略的 `.env.local`；用不含真实密钥的占位配置运行 `-Check`，实际输出仅为 `mode=openai; key=present; model=present; local-only access=enabled`，未启动 API 请求。未创建、读取或提交任何真实密钥文件。

## 待真实配置后执行的验收

| 项目 | 当前状态 | 真实验证条件 |
| --- | --- | --- |
| 中文科研对话、多轮、流式 | 模拟协议通过；真实未执行 | 本地 Key 与可用模型 ID |
| CAS 141-78-6 工具调用、参数校验、无效 CAS | 公开表与模拟工具通过；真实模型选择未验证 | 模型支持 Responses Function Calling |
| API 错误、429、超时、取消 | 模拟/单测通过；真实 429 不主动制造 | 本地 Key；真实失败时记录安全错误码 |
| Token 与费用 | 模拟 token 记录通过；真实 usage 未执行，价格未配置 | 真实响应 usage 与经核实的单价 |
| 用户间会话隔离、密钥不出前端 | Mock/模拟权限测试通过；真实用户未验证 | 两个测试用户及浏览器网络检查 |
| 私有 GC-MS 任务与越权拒绝 | 模拟 Supabase 返回测试通过；真实未执行 | 两个**普通**测试账号、各自授权任务、Supabase 配置 |
| 科研回答事实、单位、来源、推断 | Mock 公开 CAS 事实核对通过；真实回答未审 | 完成真实对话后逐项人工/自动复核 |

真实配置前不得把此表写为 Live 通过。普通账号未准备好时，私有任务和跨真实用户访问保持未验证；不使用管理员账号代替。该脚本不会推送、部署或改动 Worker/科研数据。
