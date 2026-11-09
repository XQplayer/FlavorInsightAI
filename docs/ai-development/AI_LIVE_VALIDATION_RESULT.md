# Agents SAI 本地真实 OpenAI 验收记录

## 运行边界与配置

日期：2026-11-10。独立 worktree `.worktrees/ai-research-assistant`，开发起点 `9920c43`。本次没有推送、合并或部署，没有修改七步 Worker、科研原始数据或计算规则。

用户自行建立了被 `.gitignore` 排除的 `.env.local`。仅核查 Key/模型存在状态，没有输出密钥；所选模型 ID 为 `gpt-6.1-sol`。本机代理 `127.0.0.1:18887` 已从 Mock 切换为 Live，前端仍为 `127.0.0.1:5195`。`/ai/session` 返回 `mode=openai, key_configured=true, model_configured=true`。项目未安装 OpenAI Python SDK，现有 Gateway 使用服务端 HTTPS Responses API。该模型的[官方模型页](https://developers.openai.com/api/docs/models/gpt-6.1-sol)列出 Responses、Streaming 和 Function Calling 支持；本次实际请求进一步验证了这三项能力。

## 真实请求结果

| 验证项 | 执行方式与证据 | 结果 |
| --- | --- | --- |
| 基础中文科研对话 | 本地 `/ai/chat`；SSE `start`、多条 `delta`、`usage`、`done` | 通过。回答区分内标半定量与校准曲线绝对定量；示例请求 343 输入/83 输出 tokens |
| 多轮上下文 | `python scripts/e2e/verify_ai_live.py` 同一会话先提定量问题，再问“上一问讨论的两种方式” | 通过，回答保留半定量与绝对定量上下文 |
| 流式输出 | 同脚本与浏览器 E2E | 通过。脚本观察到 63 个真实文本增量，基础请求 350 输入/67 输出 tokens |
| 公开 CAS 工具 | 同脚本，CAS 141-78-6 | 通过。模型实际请求 `search_compound`，返回 1 个数据库来源；工具轮次合计 1196 输入/148 输出 tokens |
| 无记录 CAS | 同脚本，合成 CAS 9999999-99-9 | 通过。实际调用 `search_compound`，来源数 0，回答“没有平台证据”，未编造阈值或 DOI |
| 浏览器 Live | 设置 `CODEX_E2E_PLAYWRIGHT` 与 `AI_E2E_CHROME` 后，`node scripts/e2e/verify_ai_live_browser.mjs`，Chrome 1440×900 | 最终连续两次通过。页面显示 OpenAI 模式、工具状态、来源、用量；无横向溢出、无浏览器直接请求 OpenAI、无浏览器 `sk-` Bearer 请求。过程曾有一次模型未展示工具事件，见下文修复记录 |
| 本地会话隔离 | 同脚本，用第二个独立 CookieJar 访问第一个会话 | 通过，HTTP 404；这是两个本地会话，不等同于两个真实 Supabase 用户 |
| Key 安全 | `.env.local` 忽略规则、`/ai/session` 字段、浏览器请求检查、提交前密钥模式扫描 | 本次检查通过；不输出或提交真实密钥 |
| Token 与费用 | Live usage 事件；模型标准计价配置 | 通过实际 token 记录。配置按[官方模型页](https://developers.openai.com/api/docs/models/gpt-6.1-sol)当日标准文本价格：输入 $2、缓存输入 $0.10、输出 $10/百万 tokens。重启后请求记录 335 输入、0 缓存输入、40 输出，估算 $0.00107；此为估算，不是账单 |
| 工具参数校验、限流/上游 429 | 本地单元测试，结构错误与模拟 429 | 模拟通过；未人为触发真实上游 429，不能写为真实故障通过 |
| 私有 GC-MS 任务、跨真实用户越权 | 无两个普通测试账号与本人已保存的测试任务 | **未验证**；未用管理员身份替代 |
| 真实取消、真实网络超时 | 实现与模拟单测已覆盖 | 真实外部网络故障/取消行为未单独制造，保留待验证 |

`_local/verification/ai-live-result.json` 保存公开/合成提示的原始测试摘要，已被 Git 忽略；提交内仅保留不含密钥的[Live 桌面截图](screenshots/ai-assistant/desktop-live.png)。

## 科研事实复核

对照 `frontend/public/aroma_data_merged.json` 的公开记录，真实回答中 CAS 141-78-6 对应乙酸乙酯，风味描述“菠萝”，分类“木质/烟熏、果香”，与工具返回字段一致。回答标明其为平台数据库记录，未称为本次实验结果；未给出浓度、阈值、OAV、DOI 或统计结论。无记录 CAS 的回答没有虚构性质。此复核只覆盖这两个公开案例，不代表所有科研回答正确。

## 费用与配置修复记录

首次 Live 测试前，私有配置无费率，`usage.estimated_cost_usd` 为 `null`。核对官方标准价格后，向用户本地 `.env.local` 添加三项费率而不触碰 Key。该文件原末尾缺少换行，首次追加时 Origin 与输入费率拼接，导致一次本地请求得到 `ORIGIN_DENIED` 403；只修复了两个配置项之间的换行并重启代理，随后 Live 请求与费用记录通过。私有配置文件没有加入 Git。成本估算按当前标准文本费率，若账号采用特殊服务档位、额外工具计价或价格变动，应以 OpenAI 账单为准。

一次浏览器复测等待 `search_compound` 工具事件超时，随后原代码重试通过。原请求使用 `tool_choice: auto`，无法保证每次 CAS 查询都实际检索。现对用户本轮文本中明确出现的 CAS 格式号在首轮强制 `search_compound`；后续生成轮次仍为 `auto`。此选项符合 [OpenAI Function Calling 官方说明](https://developers.openai.com/api/docs/guides/function-calling)，单测检查两轮请求体，真实浏览器重启代理后连续两次观察到工具事件与来源。当前仅针对明确 CAS 格式号，化合物名称查询仍由模型自主选择工具。浏览器断开连接时服务端出现一次 `ConnectionAbortedError` 堆栈；已在流式响应写入处接住该断开并保证关闭生成器，避免将正常断开写成内部错误。

## 本地检查与剩余限制

最终检查命令与结果：

- `python -m unittest discover -s scripts/tests -p 'test_*.py' -q`：163/163 通过，含模拟上游 429、工具请求体和费用计算；`python -m py_compile services/ai_gateway.py scripts/e2e/verify_ai_live.py fema_proxy_server.py` 通过。
- `cd frontend; pnpm exec node --test`：460 通过，1 跳过，0 失败。首次执行为 459 通过、1 失败、1 跳过；失败源于旧路由测试仍假设 4 个懒加载页面，已更新为包含 AI 助手的 5 个错误边界并重跑通过。
- `cd frontend; pnpm run lint; pnpm run build`：通过，保留既有 3Dmol/RDKit 构建警告。
- `cd frontend; pnpm audit --prod`：`No known vulnerabilities found`；这是包管理器已知漏洞扫描结果，不等于全面安全认证。
- `python scripts/e2e/verify_ai_live.py`：真实中文对话、多轮、流式、CAS 工具、无记录 CAS、本地会话隔离通过。重跑示例：50 个文本增量，350 输入/54 输出 tokens；CAS 工具轮次 1170 输入/163 输出 tokens。
- `node scripts/e2e/verify_ai_live_browser.mjs`：重启代理后连续两次通过；浏览器截图在 `screenshots/ai-assistant/desktop-live.png`。
- `git diff --check` 与提交前暂存文件密钥模式扫描：见提交验收记录。

私有任务权限仅有模拟测试证据；真实普通用户访问、跨账号拒绝及管理员费用视图尚待测试账号和 Supabase 配置。当前会话、限额与审计记录只在本机 Python 进程内，进程重启会清空；此版本仍是本地验收，不应视为生产发布完成。
