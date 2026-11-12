<p align="center">
  <a href="https://xqplayer.github.io/FlavorInsightAI/">
    <img src="docs/brand/flavorinsight-ai-wordmark.png" width="880" alt="FlavorInsight AI — 智能风味科学研究平台" />
  </a>
</p>

# FlavorInsight AI

食品风味信息学研究平台 / Food-flavor informatics research platform

[平台首页](https://xqplayer.github.io/FlavorInsightAI/) · [FlavorThresholdDB 检索](https://xqplayer.github.io/FlavorInsightAI/aroma-threshold/) · [数据处理](https://xqplayer.github.io/FlavorInsightAI/data-processing/) · [数据分析](https://xqplayer.github.io/FlavorInsightAI/data-analysis/) · [项目历程](PROJECT_HISTORY.md) · [品牌标识](docs/brand/README.md)

## 当前版本 1.0.0

FlavorInsight AI 将 FlavorThresholdDB 数据检索、岛津 GC–MS 数据处理和可追溯分析工作台整合为统一平台。界面默认英文，可切换中文；保留数据来源、质量门禁、警告和任务身份，不将缺失值当作真实观测。

| 能力 | 当前范围 |
| --- | --- |
| FlavorThresholdDB | CAS / 中英文名称检索，感觉阈值、风味描述、多源化合物信息与来源链接 |
| 岛津数据处理 | 浏览器内工作簿处理、CAS 日期恢复、筛查、平行样处理、半定量、统计/QC 与矩阵拆分 |
| 信息补充与导出 | 可选身份/分类、水中觉察阈值、估算参考 OAV、CV 筛查；保留来源、缺失原因和审核记录 |
| 任务溯源 | 日期时间编号＋任务名称，完整/失败/取消结果包，刷新恢复、父任务和本地历史证据 |
| 数据分析 | 分析界面与结果/证据导出已集成；实际统计计算需要本机 Python/R 服务（8890） |
| AI | 可追溯本地证据查询不等同于模型生成；模型推理、预测和自动未知物鉴定不宣称已实现 |

This repository provides a bilingual flavor-research interface, source-aware compound retrieval and browser-local instrument processing. Statistical execution requires the local analysis service; AI model inference is not a released capability.

## 版本与历史

- **1.0.0 历史归档**：汇总旧版 FlavorThresholdDB 软件发布，并冻结本次版本体系整理前的平台能力。
- 原有 v1.1.0、v1.2.0、v1.3.0、v1.3.1、v1.5.0 属于旧编号体系；保留原标签与提交，不改写历史。
- 新体系使用 `flavorinsight-v*` 标签，避免与旧 `v1.1.0` 冲突。这是产品版本重新建系，不是功能降级。
- [历史归档与原版本映射](docs/history/releases/README.md) · [更新记录](CHANGELOG.md) · [版本规则](docs/VERSIONING.md)

## 科研与数据边界

数据库检索页的 Excel 上传目前暂停；仍支持文本批量输入及 CSV 导出。仪器数据处理工作台的 Excel 导入属于独立流程，不受该暂停范围影响。

- 阈值保留原始数值、单位、介质、类型及来源；范围和不等号不强行压缩成单值。
- 结构/风味数据库信息是来源证据，不自动证明感官贡献、因果关系或最终化合物定性。
- “估算参考 OAV”有明确单位及适用边界；技术平行样不能直接视为独立生物重复。
- 原始工作簿在运行浏览器处理；云端账号、审批及结果保留按平台配置执行。结果包与质量记录应自行保存。
- 本地历史证据保留七天、元数据九十天，每个浏览器/账户最多100条；存储满时提示，不覆盖旧证据。
- 数据分析/导出边界见 [分析工作台说明](docs/analysis-workbench.md)。

## 数据来源与资源版本

资料包括 Van Gemert (2011)《Flavour Thresholds》、Fan & Xu (2020)《Wine Flavor Chemistry》、FEMA、PubChem、FlavorDB2、MassBank/GNPS、NIST、ChEBI/Rhea/UniProt 等。不同来源分别标注，不把数据库记录合并成未经核验的结论。

开放谱图下载和比较遵守逐条许可证审查。GNPS 索引属于独立的数据资源，不是软件版本；保留其 `spectra-index-2026.08.02` 发布、附件、校验值和下载链接，约121 MB压缩包不提交到 Git。FlavorDB2 衍生记录保留 CC BY-NC-SA 3.0 来源标注；书籍索引等材料在再分发前仍需核对权利边界。

## 本地运行

从包含当前源码的仓库根目录启动或复用后台服务：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\local_runtime.ps1 start
```

- 前端：`http://127.0.0.1:5174/FlavorInsightAI/`
- 外部数据代理：`http://127.0.0.1:8787/health`
- 统计计算：本地 Python/R 服务 `127.0.0.1:8890`，启动要求见分析工作台文档。
- 需要 Node.js 22+、pnpm 11；Python/R 依赖按相关服务文档配置。不要在浏览器前端配置服务端密钥。

```powershell
cd frontend
pnpm install --frozen-lockfile
pnpm run test:shimadzu
pnpm run test:shimadzu-browser
pnpm run test:analysis
pnpm run lint
pnpm run build
```

## 部署与项目文档

GitHub Pages 从 `main` 构建；外部数据代理使用 Render。统计计算服务不是 GitHub Pages 自动托管能力。应用构建版本以根目录 `VERSION` 为准，前端包、首页和代理健康信息保持一致；数据集/协议/模型版本独立管理。

[部署说明](docs/DEPLOYMENT.md) · [数据字典](docs/DATA_DICTIONARY.md) · [数据来源](docs/DATA_SOURCES.md) · [质量门禁](docs/ai-development/QUALITY_GATES.md) · [项目历史](PROJECT_HISTORY.md)
