# 版本体系整理验证记录

## 范围与授权

用户批准方案A：当前完整平台定义为1.1.0，旧更新汇总为1.0.0；仓库和显示统一整理；先备份再将旧软件Release转草稿，保留旧标签/提交及GNPS数据资源。基线fc0f678，隔离分支codex/release-version-rebaseline。没有改科学公式、原始研究数据、数据库模式、密钥或访问权限。

采用writing-plans/executing-plans、TDD、verification-before-completion、flavor-data-integrity；systematic-debugging用于基线测试诊断。设计builder检查已完成。计划与设计见docs/superpowers目录中的2026-11-12-version-rebaseline文件。

## 归档1.0.0

冻结提交：`bd01723910a8b8aa87f940a96b3df7228ae346d7`。VERSION、前端包、代理健康构建标签及Render默认值为1.0.0；该快照不替换旧标签的历史源码。

本地归档验证：Node462/462、Python150/150、静态路由、lint与生产构建通过。完整备份包括旧Release JSON（原文/ID/时间/标志/资产）、标签对象和提交映射、原README/CHANGELOG。备份文档的Git文本对象与原fc0f678完全相同：README为`e8fd6e87373cb381e8a5cc55905df06cf01ae48e`，CHANGELOG为`3886593ce43178940fe425785dba445037660c1e`。

## 当前1.1.0本地验证

- Node全量：463/463，无失败/跳过（包含Edge实际浏览器路由测试）。
- Python全量：150/150；新增发布规划测试拒绝未验证替代发布、变动的旧Release/标签/数据资产和非白名单目标，支持幂等重试。
- 首页中英文、1440px/390px：当前1.1.0和历史1.0.0链接可见、目标正确，无横向溢出；已检查当前链接的程序化聚焦，未将其等同于完整Tab遍历测试。
- 构建版本契约测试：VERSION、package、Render Blueprint和部署工作流一致；代理健康读取实际源码版本，旧环境标签不能虚报旧构建。
- 完整lint、生产构建通过；第三方大包、浏览器外置fs/crypto、3Dmol eval构建提示属于既有情况。
- 原GNPS清单、数据集版本/校验值和旧Git对象未改动。旧发布尚未因本地测试而变更可见性。

## 诊断与明确决定

基线71f059e全量Python测试也有四项PubChem缓存测试失败：模拟响应的retrieved_at固定为2026-08-02，到本次执行时已超过真实30天TTL。仅将模拟响应的时间改为测试执行时间，保留显式超期/解析器版本测试；没有改任何生产缓存或科学规则。

新编号使用flavorinsight-v*命名空间，旧v1.1.0绝不挪用。根VERSION作为交付源码标识优先于旧API_VERSION环境标签；api_version字段名不变，此次不是接口协议改版。历史文档的旧号保留原义，不作全局替换。统计界面已集成但运行仍需本机Python/R；模型推理不宣称已经完成。

## 远端发布门禁与凭据边界

本文件提交时记录的是本地验证，不把未来步骤写成已通过。只有匹配PR CI、Pages和Render构建版本/提交验证、新Release/备份附件检查均通过后，才将五个白名单旧软件Release转为草稿。GNPS独立发布只明确标题，不删/移附件。

真实远端执行结果、工作流ID、软件标签SHA、备份附件哈希与最终发布列表将在完成后作为当前1.1.0 Release的`rebaseline-publication-receipt.json`附件记录。不得将历史报告的测试数字当作本次线上账号/科研计算的完整验证。

## 回退

保留所有原Git标签和提交；可按原始JSON恢复旧Release的draft/name/body及Latest标记。GitHub重新公开可能改变发布时间，原时间仍在备份中。代码回退撤销本次合并并重新部署；不需要删除原始数据或回滚数据库。旧工作区的用户改动保持不动。

原Latest的独立API快照见`docs/history/releases/2026-11-12-original-latest.json`。独立复核提出的两项重要问题已补强：归档规划器必须核对两项替代发布均公开且标签指向预期SHA；原Latest标记已显式备份。新增回归先失败、修复后7项发布/部署测试通过。两项轻微测试增强暂留：完整键盘Tab遍历，以及未来超过1.1版本时扩展本次专用版本范围断言。
