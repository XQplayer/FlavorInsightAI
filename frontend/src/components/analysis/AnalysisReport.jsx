import { useMemo, useState } from 'react';
import { composeReport, createReportBundle, REPORT_LIMITS } from '../../analysis/report.mjs';
import { downloadFile } from '../../analysis/download.mjs';
import { DataTable } from './Controls.jsx';
export default function AnalysisReport({run,t}) {
  const [open,setOpen]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const report=useMemo(()=>open ? composeReport(run) : null,[open,run]);
  async function exportReport(){
    setBusy(true);setError('');
    try { const zip=await createReportBundle(run);downloadFile(`analysis-report-${run.id}.zip`,await zip.generateAsync({type:'blob'}),'application/zip'); }
    catch {setError(t('Report export failed; use raw result & audit JSON.','报告导出失败，请导出原始结果及审计 JSON。'));}
    finally {setBusy(false);}
  }
  return <section className="analysis-section">
    <h3>{t('Local evidence report','本地证据报告')}</h3>
    <p>{t('HTML / Markdown preview + complete JSON and CSV attachments; no PDF claim.','HTML / Markdown 预览及完整 JSON、CSV 附件；不宣称 PDF 报告。')}</p>
    <div className="analysis-toolbar"><button aria-expanded={open} onClick={()=>setOpen(!open)}>{t('Preview report','预览报告')}</button><button disabled={busy} onClick={exportReport}>{t('Export report ZIP','导出报告 ZIP')}</button></div>
    {error&&<p role="alert">{error}</p>}
    {open&&<><p>{report.warning}</p><p>{REPORT_LIMITS}</p><p>{report.notice}</p>{report.overview&&<DataTable rows={[report.overview]} caption={t('Factual overview','事实概况')} t={t}/>}<p>{report.citations}</p>{report.sections.map(([title,value])=><DataTable key={title} rows={[{value}]} caption={title} t={t}/>)}</>}
  </section>;
}
