# AI 科研助手：本地配置与接口

## 架构与数据边界

前端 `/FlavorInsightAI/ai-assistant/` 调用现有 Python `fema_proxy_server.py` 的 `/ai/*` 路由。OpenAI Key 和模型 ID 仅在 Python 服务端读取。服务端通过 [Responses API 流式事件](https://developers.openai.com/api/docs/guides/streaming-responses) 和 [function calling](https://developers.openai.com/api/docs/guides/function-calling) 执行只读工具；未采用已停用的 Assistants API。官方 [Agents SDK](https://developers.openai.com/api/docs/guides/agents/sdk) 适用于更复杂的 agent 编排，本版单智能体复用现有 Python 服务并显式审计每次工具调用。

工具 `search_compound` 和 `get_compound_detail` 检索 `frontend/public/aroma_data_merged.json` 的真实公开平台记录，返回经筛选的身份、风味描述和来源，不传完整阈值记录。前者支持 CAS/名称与可选介质，返回内部标识 `cas:<CAS>`；后者接受该标识或 CAS。该公开表没有分子式等分子属性，详情明确返回未知，不猜测。`get_analysis_task` 与 `get_analysis_summary` 仅接受已验证 Supabase 用户令牌，按 `user_id` 查询 `shimadzu_jobs`，再次校验返回记录所属用户。浏览器本地运行、未保存至云端的任务不可由服务端读取。知识检索接口 `search_research_knowledge` 当前明确返回 `KNOWLEDGE_UNAVAILABLE`，未提供给模型调用。

## 本地启动

`.env.example` 是说明文件，Python 不自动加载它。请在**服务端进程的私有环境变量**中设置真实值；不要把真实密钥写入 `.env.example`、`VITE_*`、前端源码或 Git。PowerShell 示例：

```powershell
$env:FLAVOR_AI_MODE='mock'
$env:FLAVOR_AI_ALLOWED_ORIGINS='http://127.0.0.1:5174'
$env:PUBLIC_SPECTRUM_INDEX_AUTO_INSTALL='false'
python fema_proxy_server.py
```

前端使用现有 `VITE_FEMA_API_URL` 指向该代理。独立工作树验证时使用 5195/18887 端口，原工作区 5174/8787 不受影响。Mock 仅在本机回环地址和许可 Origin 下发放独立 HttpOnly 会话，并明显标为非 GPT 回答。

真实 API 验证需要服务端设置 `FLAVOR_AI_MODE=openai`、`OPENAI_API_KEY` 和该账号已确认可用的 `OPENAI_MODEL`。正式模式默认要求 Supabase 登录，且需设置 `FLAVOR_AI_SUPABASE_URL`、`FLAVOR_AI_SUPABASE_ANON_KEY`。仅本机手动验证可显式设置 `FLAVOR_AI_ALLOW_LOCAL_REAL=true`；该模式的本地会话仍无权读取私有任务，公共服务不得启用。当前尚无密钥与模型权限证据，因此真实 OpenAI 请求未执行。

### 私有配置文件与 Live 切换

在当前独立工作树根目录新建 `.env.local`（完整路径：`E:\codex\Projects\FlavorThresholdDB\.worktrees\ai-research-assistant\.env.local`）。该文件已被 `.gitignore` 排除；不要把内容粘贴进聊天、工单或截图。用文本编辑器填写，`=` 后不加引号：

```dotenv
FLAVOR_AI_MODE=openai
FLAVOR_AI_ALLOW_LOCAL_REAL=true
OPENAI_API_KEY=在本机填写真实密钥
OPENAI_MODEL=在本机填写账号可用的模型ID
FLAVOR_AI_ALLOWED_ORIGINS=http://127.0.0.1:5195
```

停止占用 `18887` 端口的旧 Mock 代理后，在**当前独立工作树**的 PowerShell 中运行 `& .\scripts\start_ai_local.ps1`。启动脚本仅将白名单变量装入当前启动会话和 Python 子进程环境，服务退出后清除启动会话中的 Key；不在命令行参数、日志或 HTTP 响应中输出密钥。`-Check` 只显示配置项是否存在。前端继续用 `5195` 端口访问该代理。切回 Mock 时先停止 Live 服务，再按上面的 Mock 启动命令启动；不要在公共服务上启用本地真实模式。模型清单可用官方 [`GET /v1/models`](https://developers.openai.com/api/reference/resources/models/methods/list) 在本机验证，但清单出现并不等于该模型支持当前 Responses + Function Calling 请求，仍须实际调用验证。

## API 契约

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/ai/session` | 模式、可用限制与身份；不返回 Key |
| GET/POST | `/ai/conversations` | 当前用户会话列表/新建 |
| GET/DELETE | `/ai/conversations/{id}` | 只读历史/删除自身会话 |
| POST | `/ai/chat` | JSON `{conversation_id, message}`；返回 SSE `start/tool/delta/usage/done/error` |
| GET | `/ai/usage` | 经后端复核管理员身份后的当日用量与工具审计 |

会话和用量在当前 Python 进程内保存，服务重启会清空；这是本地 MVP 的限制，不适合多实例或生产留存。上传原始 Excel、完整日志和数据库任意查询均不在工具范围内。HTML 不作为 Markdown 执行，外部图片不加载。用户文本和工具输出都按不可信内容处理。

## 限额与费用

默认每次输入最多 4000 字符、输出最多 800 tokens、超时 35 秒、每人每分钟 8 次、每天 40 次、同一用户最多 2 个并发流；均由服务端环境变量调整。仅对连接建立前的瞬时 429/5xx/网络错误重试一次；流已开始后不重放，以免重复回答或重复工具调用。真实模型响应的 token 用量累加至当前进程的管理员视图；只有配置经核实的每百万 token 价格时才显示估算美元成本。Mock 的 0 token 不作为真实计费证据。

## 验证入口

配置后打开 `/FlavorInsightAI/ai-assistant/`，输入“查询 CAS 141-78-6，并介绍它的风味特征。”。Mock 会通过真实公开表得到乙酸乙酯与记录的风味描述，并明确标注非 GPT；真实模式须检查工具状态、来源、OpenAI 用量和后端审计。私有任务验证还需已登录且已保存的本人任务；本地浏览器任务不能作为云端可检索任务的证据。
