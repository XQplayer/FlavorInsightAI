# 数据处理四工作区重构验收记录

日期：2026-11-10。隔离工作树：`.worktrees/processing-workspaces`；分支：`codex/processing-workspaces`；基线：`0e0e9293c6f4ef8667951221baf9411af3969fd3`。本次未推送、合并或部署。

## 功能映射与边界

| 工作区 | 现有能力与新位置 |
| --- | --- |
| 新建分析 | 两个本地 Excel 输入、模板、任务名称、原有科研选项和启动按钮；三组预检状态。文件结构、字段和样品对应关系仍由 Worker 阶段 0 在启动后验证，启动前显示“待检查”。 |
| 运行监控 | 任务状态、QC、真实阶段记录、运行日志、异常证据、取消、复核继续、重试与新任务。 |
| 结果与报告 | 已生成的定性、半定量、QC 与矩阵状态，以及真实 ZIP/云端私有下载；未生成时无下载入口。 |
| 任务管理 | 当前浏览器任务、已授权云端历史、搜索、状态筛选、排序和分页；管理员标签仅在管理员资料为真时显示，云端任务读取仍受 Supabase RLS 约束。 |

页面路由为 `/data-processing/`、`monitor/`、`results/`、`tasks/`，并保留合法 `task_id` 查询参数。二级导航在同一 React 处理页实例内切换，Worker 不因子页面切换而卸载。静态构建为各深链接生成回退页面。原始数据、Worker 计算、七步顺序、QC 规则及 ZIP 结构均未修改。

**计数定义：** 展示 00 为运行前预检与 Worker 输入配置（Worker 0），不计入七步。01–06 对应 Worker 1–6，07 对应真实结果包封装。只有实际结果包生成后才显示 7/7；输入结构未由 Worker 验证前，00 不宣称通过。估算参考 OAV 仅为导出项，不升级为正式 QC 阻断条件。

## 浏览器证据

- 重构前：[单页深色桌面截图](screenshots/processing-workspaces/before-desktop.png)，1440×1935。
- 重构后：[新建分析桌面](screenshots/processing-workspaces/after-desktop-new.png)，1440×1201；首个默认页面高度约减少 38%。[运行监控](screenshots/processing-workspaces/after-desktop-monitor.png)、[结果与报告](screenshots/processing-workspaces/after-desktop-results.png)、[任务管理](screenshots/processing-workspaces/after-desktop-tasks.png)。预检底部运行按钮已放大并居中，重复的缺失文件句子已移除。
- 响应式：[平板新建分析](screenshots/processing-workspaces/after-tablet-new.png)、[手机新建分析](screenshots/processing-workspaces/after-mobile-new.png)、[手机运行监控](screenshots/processing-workspaces/after-mobile-monitor.png)。
- 真实 Worker 演练：[完成状态](screenshots/processing-workspaces/after-runtime-complete.png)、[异常状态](screenshots/processing-workspaces/after-runtime-failed.png)。样例使用仓库内模板；没有使用真实科研数据。

Playwright 对 1440、768、390 px 的四个子页面截图，12 次均未出现页面脚本错误或横向溢出。处理流程 E2E 实际运行了仓库样例工作簿，确认上传、子页切换不终止任务、7/7 完成、结果页真实 ZIP 下载入口、任务列表与详情、`task_id` 保留；异常工作簿确认错误提示和自动展开日志。刷新后 URL 中的本地 `task_id` 仍在，但已完成的本地 ZIP 不会被伪造为可下载；云端历史仅在已登录且授权时可恢复。

## 执行命令与结果

| 命令 | 结果 |
| --- | --- |
| `cd frontend; node --test` | 434 项，433 通过、1 跳过、0 失败。 |
| `cd frontend; pnpm run lint` | 通过。 |
| `cd frontend; pnpm run build` | 通过；保留现有 RDKit/3Dmol 与大包体积警告。 |
| `$env:PYTHONPATH='scripts'; python -m unittest discover -s scripts/tests -p 'test_shimadzu_*.py' -v` | 15/15 通过。系统 Python 未安装 pytest，因此使用项目现有 unittest。 |
| `cd frontend; pnpm run test:e2e:processing-feedback` | 通过，桌面成功及手机失败场景。 |
| `CODEX_E2E_SCOPE=routes; CODEX_E2E_ROUTE=processing; pnpm run test:e2e:platform` | 通过，处理页在多视口由生产构建静态服务提供。 |
| `cd frontend; pnpm run test:e2e:platform` | **未通过**。测试走到 `mobile/analysis` 时，其他分析模块请求本地代理得到 `net::ERR_CONNECTION_REFUSED`。这是完整平台回归的剩余失败，不能据此称全平台 E2E 通过。 |
| `git diff --check` | 通过。 |

## 审查与剩余问题

代码审查核对了路由、任务生命周期、结果可用性、异常态与原算法边界。未进行独立多 Agent 审查。未修改 `frontend/src/workers`、`frontend/src/shimadzu-core`、原始工作簿或 Supabase 迁移。

1. 本地模式原有任务持久化只覆盖活动任务；任务完成后当前浏览器可以下载 ZIP，但刷新后 Blob URL 无法重建。已明确显示不可用状态。若产品要求离线历史包恢复，需另行设计本地结果存储与容量策略。
2. 实际管理员账号与普通账号的端到端权限隔离未在本次本地环境验证；现有云端 RLS 是服务侧权限边界，需在有授权的测试环境补测。
3. 完整平台 E2E 的 `mobile/analysis` 本地代理连接失败待单独诊断。处理页专项 E2E 和处理路由 E2E 已通过。
4. Worker 阶段 0 的工作簿结构校验发生在启动后；预检页面保持“待检查”，没有将未执行检查显示为通过。

回滚：在此隔离分支使用 `git revert <本次提交 SHA>`。原工作树及其未提交修改保持原状。
