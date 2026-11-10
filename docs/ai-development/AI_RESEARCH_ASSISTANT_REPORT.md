# AI 科研助手本地开发与验收记录

## 范围与实现

在独立 worktree `.worktrees/ai-research-assistant`、分支 `codex/ai-research-assistant` 上开发；基线 `0e0e929`。原工作区及其他 worktree 未修改。本任务按跨前端/API/安全的 Full 工作流执行：先审计 React/Vite、Python 代理、Supabase 认证与云任务表，再写实施计划和接口/权限测试，最后接入页面和浏览器验证。实际读取并应用了本地 `brainstorming`、`writing-plans`、`using-git-worktrees`、`verification-before-completion`、`api-and-interface-design`、`frontend-ui-engineering`、`security-and-hardening`、`test-driven-development` 与 `requesting-code-review` Skill 文件。项目路由由主代理判断，未验证平台级自动派发；科研专项 Skills 本任务不涉及科研算法修改，未调用。

新增 AI Gateway、四个只读工具、科研系统提示词、限流/并发/用量审计、SSE 对话、双语聊天页、公开化合物与已保存任务的上下文入口。未改动 GC-MS Worker、科研计算规则、原始数据或生产配置。Responses API 协议以模拟上游流测试，**无真实 OpenAI API 调用**。服务端无密钥时明确返回 `OPENAI_NOT_CONFIGURED`；Mock 回答标记为非 GPT。

## 修改文件

| 范围 | 文件 |
| --- | --- |
| 服务端 | `services/ai_gateway.py`、`services/ai_tools.py`、`fema_proxy_server.py` |
| 前端 | `frontend/src/pages/AIResearchAssistantPage.{jsx,css}`、`frontend/src/lib/aiChatClient.js`、`aiStream.js`、平台路由/侧栏、化合物工作台与数据处理任务入口 |
| 依赖与配置 | `frontend/package.json`、`frontend/pnpm-lock.yaml`、`.env.example`、`.gitignore`、静态路由生成器 |
| 测试 | `scripts/tests/test_ai_gateway.py`、`test_ai_tools.py`、`frontend/src/lib/aiChatClient.test.mjs`、`scripts/e2e/verify_ai_assistant.mjs`、路由测试与 2026-08 日期过期的缓存测试夹具 |
| 记录 | 本配置说明、验收报告、实施计划及四张本地 Mock 截图 |

## 实际执行与结果

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| AI Gateway/工具单测 | `python -m unittest scripts.tests.test_ai_gateway scripts.tests.test_ai_tools -q` | 16/16 通过 |
| Python 全量回归 | `python -m unittest discover -s scripts/tests -p 'test_*.py' -q` | 旧基线先有 4 项日期过期失败；仅修复 7 处旧测试中固定的 2026-08 时间夹具后，最终 161/161 通过；缓存实现未修改 |
| 前端综合单测 | `pnpm exec node --test …`（完整命令见下） | 245/245 通过，含流截断测试 |
| 前端平台 | `pnpm run test:platform` | 33/33 通过 |
| 七步 Worker 回归 | `pnpm run test:shimadzu-browser` | 129/129 通过 |
| 静态路由 | `pnpm run test:static-routes` | 3/3 通过 |
| Lint | `pnpm run lint` | 通过 |
| Build | `pnpm run build` | 通过；既有 RDKit 浏览器外部化及 3Dmol `eval`/大包提示仍存在 |
| 生产依赖扫描 | `pnpm audit --prod` | `No known vulnerabilities found`，属于执行时 npm registry 数据结果 |
| 浏览器 E2E | `CODEX_E2E_PLAYWRIGHT=… AI_E2E_CHROME=… node scripts/e2e/verify_ai_assistant.mjs` | Chrome 桌面 1440、平板 768、手机 390 均通过；Mock 真实公开 CAS、来源、刷新后历史、无横向溢出；额外拦截恶意 Markdown 验证脚本/远程图片不渲染 |

浏览器 E2E 使用本机 5195 前端与 18887 Mock 代理。第一次运行因本机 Playwright 自带浏览器未安装而失败，改用本机 Chrome 后通过；一次 XSS 用例因断言等待被故意禁用的图片替代文本而超时，改为等待可见的安全链接文本后通过。上述是实际调试记录，非首次即全通过。

前端综合测试完整命令：

```powershell
pnpm exec node --test src/lib/aiChatClient.test.mjs src/platformRoutes.test.mjs src/platformUiContract.test.mjs src/platformHomeV2.test.mjs src/bookSearch.test.mjs src/resultViewPreference.test.mjs src/searchSourceState.test.mjs src/searchWorkbenchModel.test.mjs src/scientificChapterPreload.test.mjs src/staticRoutes.test.mjs src/shimadzuApi.test.mjs src/analysis/*.test.mjs src/releaseHardening.test.mjs
```

浏览器测试依赖已有 Playwright 模块和本机 Chrome；环境变量 `CODEX_E2E_PLAYWRIGHT`、`AI_E2E_CHROME` 仅用于指定本机工具位置，脚本不提交本机绝对路径。启动本地 Mock 代理时设置 `PUBLIC_SPECTRUM_INDEX_AUTO_INSTALL=false`，避免无关的公开谱图索引安装阻塞启动。

截图：[桌面浅色](screenshots/ai-assistant/desktop-mock.png)、[桌面深色](screenshots/ai-assistant/desktop-dark-mock.png)、[平板](screenshots/ai-assistant/tablet-mock.png)、[手机](screenshots/ai-assistant/mobile-mock.png)。截图是本地 Mock，不证明真实模型连通。

## 代码审查结论与边界

- 权限：公开化合物表可在本地 Mock 使用；私有任务必须有经 Supabase Auth 验证的用户令牌，并在 REST 查询与返回结果两次核对 `user_id`。仅测试了模拟 Supabase 返回与拒绝路径，尚未用真实登录账号验证。
- 密钥：仅 Python 进程读取 `OPENAI_API_KEY`；前端网络只见 `/ai/*` SSE 和受过滤的工具结果。`.env` 已加入 Git 忽略；没有真实密钥写入仓库。未对真实 OpenAI 账号模型权限作检查。
- 科研：公开数据中的描述标注为数据库字段，不当作实验定量或确定性 OAV。私有任务摘要只含阶段计数、QC 基础状态和结果哈希；完整结果 ZIP 和原始工作簿不传模型。当前持久化任务记录不包含可安全直接发送的完整化合物/风味类别汇总，因此该工具明确只提供已有摘要，不虚构结果。
- 安全：严格的工具名/参数集合、允许的浏览器 Origin、只读模型工具、文本上限、超时、请求/并发限额、管理员用量后端校验、Markdown 无原始 HTML/远程图片。工具审计在当前进程内，生产使用需持久化与运营审计。
- 限制：会话、额度和审计只在单个 Python 进程内；多实例/重启后不保留。无真实 OpenAI 调用、真实 Supabase 私有任务或生产部署证据。知识库未连接并明确不可用。生产发布应先补真实鉴权、持久化、费率与模型权限验证。

独立代码审查由实际子 Agent 在本地差异上进行。它指出 SSE 截断可能被视为成功、模型单轮超过四个工具调用时会留下未配对输出、Supabase 响应形状未完整验证、计数字段投影偏宽。已针对这些发现增加失败检测、工具上限、结构校验、数值过滤与定向测试。修复后 Python 161/161、前端综合 245/245、Worker 129/129、Lint、Build、浏览器 E2E 均通过。

本地回滚：在该独立分支对本阶段提交执行 `git revert <本阶段 SHA>`；不会触及原工作区未提交修改。未推送、合并或部署。
