import { AlertCircle, Download } from 'lucide-react'
import { describeShimadzuFailure } from '../../lib/shimadzuIssues.js'

export default function ShimadzuFailureDetails({ error, language = 'zh', cancelled = false, downloadUrl, downloadName }) {
  const text = (zh, en) => language === 'en' ? en : zh
  const report = describeShimadzuFailure(error, language)
  const counts = report.counts
  return <div className="shimadzu-inline-error shimadzu-failure-report" role="alert">
    <AlertCircle aria-hidden="true" />
    <div>
      <p className="shimadzu-failure-heading"><strong>{cancelled ? text('分析已取消', 'Analysis cancelled') : text('任务未通过的原因', 'Why the task failed')}</strong></p>
      {report.stage !== null && <small>{cancelled ? text('取消于步骤', 'Cancelled before stage') : text('失败步骤', 'Failed stage')}: {report.stage + 1} / 7</small>}
      {!cancelled && report.issueCount > 0 && <p className="shimadzu-failure-totals">{text(`阻断错误 ${report.blockingCount} 条，警告 ${report.warningCount} 条，待复核 ${report.reviewCount} 条。`, `${report.blockingCount} blocking errors, ${report.warningCount} warnings, ${report.reviewCount} items for review.`)}</p>}
      {counts && <p className="shimadzu-failure-counts">{[
        Number.isFinite(counts.samples) && text(`样品 ${counts.samples} 个`, `${counts.samples} samples`),
        Number.isFinite(counts.input) && text(`输入 ${counts.input} 条`, `${counts.input} input records`),
        Number.isFinite(counts.retained) && text(`保留 ${counts.retained} 条`, `${counts.retained} retained records`),
      ].filter(Boolean).join(' · ')}</p>}
      <div className="shimadzu-failure-causes">
        {report.causes.map(({ issue, reason, suggestion, evidence, missingHeaders }, index) => <section key={`${issue.code}-${index}`} className="shimadzu-failure-cause">
          <p><strong>{reason}</strong></p>
          <dl>
            {issue.sourceWorkbook && <><dt>{text('原始文件', 'Source workbook')}</dt><dd>{issue.sourceWorkbook}</dd></>}
            {issue.sampleName && <><dt>{text('样品', 'Sample')}</dt><dd>{issue.sampleName}</dd></>}
            {issue.sampleGroup && <><dt>{text('分组', 'Group')}</dt><dd>{issue.sampleGroup}</dd></>}
            {issue.sourceSheet && <><dt>{text('工作表', 'Worksheet')}</dt><dd>{issue.sourceSheet}</dd></>}
            {issue.cas && <><dt>CAS</dt><dd>{issue.cas}</dd></>}
            {evidence && <><dt>{text('定位证据', 'Location evidence')}</dt><dd>{evidence}</dd></>}
            {missingHeaders && <><dt>{text('缺少字段', 'Missing fields')}</dt><dd>{missingHeaders}</dd></>}
          </dl>
          {!cancelled && <p className="shimadzu-failure-remedy"><b>{text('建议处理：', 'Suggested action: ')}</b>{suggestion}</p>}
        </section>)}
      </div>
      {report.blockingCount > 0 && report.warningCount > 0 && <p>{text('警告与阻断错误分开统计；本次停止由上面的阻断错误触发。', 'Warnings are counted separately. The blocking errors above stopped this run.')}</p>}
      {report.notices.length > 0 && <section className="shimadzu-failure-notices"><p><b>{text('另外需要核实', 'Also verify')}</b></p>{report.notices.map((notice, index) => <p key={index}>{notice.sourceWorkbook} · {notice.sourceSheet} · {text(`${notice.count} 行配置含示例或虚构数据标记。正式半定量前请核实内标浓度、添加量与体系体积；此提醒不是本次失败原因。`, `${notice.count} configuration rows contain example-data markers. Verify internal-standard concentration, spike amount and system volume before quantitation. This reminder did not cause the failure.`)}</p>)}</section>}
      <details className="shimadzu-failure-technical"><summary>{text('查看技术明细', 'Technical details')}{report.issueCount > 0 && ` (${Math.min(50, report.issueCount)} / ${report.issueCount})`}</summary><p><code>{error?.code}</code> {error?.message}</p><ul>{report.technicalIssues.map((issue, index) => <li key={index}><code>{issue.code}</code>{issue.sampleName ? ` · ${issue.sampleName}` : ''}{issue.sourceSheet ? ` · ${issue.sourceSheet}` : ''}{Number.isInteger(issue.sourceRow) ? ` · ${text('行', 'row')} ${issue.sourceRow}` : ''}<span>{issue.message}</span></li>)}</ul>{report.issueCount > 50 && <p>{text('完整明细请下载下方错误证据。', 'Download the error evidence below for the complete list.')}</p>}</details>
      {downloadUrl && <a href={downloadUrl} download={downloadName}><Download aria-hidden="true" />{cancelled ? text('下载取消审计与部分结果', 'Download cancellation audit and partial results') : text('下载已完成步骤与错误证据', 'Download completed stages and error evidence')}</a>}
    </div>
  </div>
}
