# 数据处理 UI/UX 精修记录

日期：2026-11-10。基线提交：`3b7c43c`。工作树：`codex/processing-workspaces`。仅涉及数据处理页面展示、样式和浏览器测试；未修改 Worker、科研计算、文件输出、科研默认参数、数据库迁移或生产部署。

## 现状与处理

- 四个子页面及二级导航保持不变。现有 React 页面继续持有 Worker、文件、任务和云端历史状态；结果页只依据真实任务和结果包可用性显示操作。
- 上传卡片新增固定文件类别标题与基础状态，内部细虚线拖放区，悬浮、拖入和键盘聚焦时轻度高亮。文件为空/超过 50 MB 与扩展名不符分别提示；基础检查通过不等同于 Worker 深度结构检查。
- 缩短常驻文件说明；任务名称与固定配置使用一致的字段层级。高级参数仍默认折叠，保留 CAS/阈值开启、参考 OAV/CV 关闭的默认值。删除重复参数清单，折叠摘要只列已启用选项；OAV 公式与局限改为按需展开。
- 预检明确标注可选代理“按需检查”。主按钮始终显示“开始分析”；禁用原因在按钮旁显示；提交中保留按钮名称并显示忙碌状态。原有 `canStart` 门禁与重复提交保护未改。
- 监控步骤仍使用单一 00–07 导航与真实 Worker 状态；详情区域减少内层边框。结果状态细分为未生成、生成中、失败、已生成/可用；结果下载与进入分析的操作样式统一。任务列表显示实际进度值，筛选和操作按钮统一高度与焦点样式。
- 深浅主题沿用现有变量；桌面、平板和手机均无横向溢出。测试同时覆盖 reduced-motion。

## 前后截图

成对截图存于 [processing-ui-polish](screenshots/processing-ui-polish/)：四个页面各有桌面深色/浅色的 before/after；新建分析有手机深色/浅色的 before/after，监控有手机深色、结果有手机浅色的 before/after。例如：[新建分析改前](screenshots/processing-ui-polish/before-desktop-dark-new.png) / [改后](screenshots/processing-ui-polish/after-desktop-dark-new.png)，[手机浅色改前](screenshots/processing-ui-polish/before-mobile-light-new.png) / [改后](screenshots/processing-ui-polish/after-mobile-light-new.png)。真实样例 Worker 生成的[结果页](screenshots/processing-ui-polish/after-runtime-results.png)与[任务页](screenshots/processing-ui-polish/after-runtime-tasks.png)另存。截图测试使用仓库公开示例工作簿，未触及真实科研数据。

## 命令与结果

| 命令 | 结果 |
| --- | --- |
| `node scripts/e2e/verify_processing_ui_polish.mjs` | 1920×1080、1440×900、1280×800、390×844 × 深浅主题 × 四页面，共 32 个页面检查通过；无页面错误、无横向溢出。另验证上传错误、按钮禁用、参数展开与 reduced-motion。需要设置 `CODEX_E2E_PLAYWRIGHT`，系统 Chrome 可通过 `CODEX_E2E_CHROME` 指定。 |
| `cd frontend; node --test` | 434 项：433 通过，1 跳过，0 失败。 |
| `cd frontend; pnpm run lint` | 通过。 |
| `cd frontend; pnpm run build` | 通过；现有依赖包体积警告仍在。 |
| `cd frontend; pnpm run test:e2e:processing-feedback` | 通过：真实公开样例任务完成、ZIP 入口、任务切换，以及异常工作簿失败反馈。 |
| `$env:PYTHONPATH='scripts'; python -m unittest discover -s scripts/tests -p 'test_shimadzu_*.py' -q` | 15/15 通过。 |
| `git diff --check` | 通过。 |

## 剩余限制

- 本地模式已完成任务的 Blob 结果包刷新后仍不能重建；本次没有改变任务存储策略。
- 管理员真实账号的端到端权限隔离需要有授权的测试账号；现有服务端 RLS 仍是权限边界。
- 完整平台 E2E 在此前的独立数据分析页面有本地代理连接失败；本次只复跑了数据处理专项流程，未声称完整平台 E2E 通过。

回滚：`git revert <本次提交 SHA>`。本地预览：`http://127.0.0.1:5196/FlavorInsightAI/data-processing/`，前提是该工作树的 Vite 服务保持运行。
