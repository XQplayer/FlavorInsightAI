export function taskFeedback(job, language = 'zh') {
  const en = language === 'en'
  if (!job) return en ? 'Select both workbooks to prepare a task.' : '选择两个工作簿以准备任务。'
  switch (job.status) {
    case 'created':
    case 'queued':
      return en ? 'Task is waiting to run. Processing has not started.' : '任务等待运行，处理尚未开始。'
    case 'running':
      return en
        ? 'Processing is underway. Follow the live stage and log below.'
        : '任务正在处理。可在下方查看实时步骤和日志。'
    case 'saving':
      return en ? 'Processing finished. Saving the result; download will be available when saving finishes.' : '处理已结束，正在保存结果；保存完成后可下载。'
    case 'waiting_review':
      return en ? 'This stage needs review. Check the findings, then continue the task.' : '当前步骤需要复核。检查问题后继续任务。'
    case 'complete':
      return en ? 'All seven stages finished. Download the result package now.' : '七个步骤已完成，请立即下载结果包。'
    case 'failed':
      return en ? 'The task stopped with an error. Check the details below; rerun transient failures or choose New task to replace invalid files.' : '任务因错误停止。请检查下方详情；暂时性故障可重新运行，文件无效时请选择“新任务”更换文件。'
    case 'cancelled':
      return en ? 'The task was cancelled. Download the available audit, or rerun.' : '任务已取消。可下载现有审计记录，或重新运行。'
    case 'interrupted':
      return en ? 'The browser task was interrupted. Review the saved state and rerun.' : '浏览器任务已中断。请检查保存状态并重新运行。'
    default:
      return en ? 'Task state is unavailable. Check the stage log before taking action.' : '暂无法确认任务状态。请先检查步骤日志。'
  }
}
