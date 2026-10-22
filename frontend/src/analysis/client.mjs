const BASE = 'http://127.0.0.1:8890';
const codeError = code => Object.assign(new Error(code), {
  code, analysisClientError: true
});
export function createAnalysisClient({
  fetch: fetcher = globalThis.fetch,
  timeout = 15000
} = {}) {
  let token = null;
  async function request(path, method = 'GET', body, signal, authenticated = true) {
    if (signal?.aborted) throw codeError('ABORTED');
    if (authenticated && !token) {
      const session = await request('/session', 'POST', {}, signal, false);
      if (typeof session.token !== 'string') throw codeError('INVALID_RESPONSE');
      token = session.token;
    }
    if (signal?.aborted) throw codeError('ABORTED');
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, {
      once: true
    });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeout);
    try {
      const response = await fetcher(BASE + path, {
        method,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(authenticated ? {
            Authorization: `Bearer ${token}`
          } : {})
        },
        ...(body === undefined ? {} : {
          body: JSON.stringify(body)
        })
      });
      let data;
      try {
        data = await response.json();
      } catch {
        throw codeError(method === 'POST' && path === '/jobs' ? 'SUBMISSION_UNCERTAIN' : 'INVALID_RESPONSE');
      }
      if (!response.ok) {
        if (response.status === 401) token = null;
        throw codeError(/^[A-Z][A-Z0-9_]{0,95}$/.test(data?.error?.code) ? data.error.code : `HTTP_${response.status}`);
      }
      if (path.startsWith('/jobs') && (!data || typeof data.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(data.id) || !['queued', 'running', 'completed', 'failed', 'cancelled'].includes(data.status))) throw codeError(method === 'POST' ? 'SUBMISSION_UNCERTAIN' : 'INVALID_RESPONSE');
      if (path === '/health' && (!data?.capabilities || typeof data.capabilities.runtimeReady !== 'boolean' || !Array.isArray(data.capabilities.methods))) throw codeError('INVALID_RESPONSE');
      return data;
    } catch (error) {
      if (error.analysisClientError === true) throw error;
      if (method === 'POST' && path === '/jobs') throw codeError('SUBMISSION_UNCERTAIN');
      throw codeError(timedOut ? 'TIMEOUT' : signal?.aborted ? 'ABORTED' : 'SERVICE_OFFLINE');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
  const jobPath = id => {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw codeError('INVALID_JOB_ID');
    return `/jobs/${id}`;
  };
  return {
    health: signal => request('/health', 'GET', undefined, signal, false),
    submit: (body, signal) => request('/jobs', 'POST', body, signal),
    poll: (id, signal) => request(jobPath(id), 'GET', undefined, signal),
    cancel: (id, signal) => request(jobPath(id), 'DELETE', undefined, signal)
  };
}
export function serviceError(error, language = 'en') {
  const candidate = String(error?.code || error?.message || '').split(':',1)[0];
  const code = /^[A-Z][A-Z0-9_]{0,95}$/.test(candidate) ? candidate : 'OPERATION_FAILED';
  const messages = {
    SUBMISSION_UNCERTAIN: ['Submission response was lost. A job may exist; do not blindly retry. Check the local service before explicitly submitting another run.', '提交响应丢失，任务可能已存在。请检查本地服务后再明确重试，避免重复任务。'],
    SERVICE_OFFLINE: ['Local service unavailable. Start the Python analysis service on 127.0.0.1:8890 and retry connection. Imports, editing and exports remain available.', '本地服务不可用。启动 127.0.0.1:8890 的 Python 分析服务后重连；导入、编辑和导出仍可使用。'],
    TIMEOUT: ['Request timed out. Check the local service and reconnect.', '请求超时，请检查本地服务并重连。'],
    ABORTED: ['Request interrupted.', '请求已中断。']
  };
  const guidance = {
    INDEPENDENCE_REQUIRED: ['Review biological units in Data & groups, explicitly confirm independence, then Apply metadata.', '在数据与分组中核对生物学单位，明确确认独立性并应用元数据。'],
    GROUP_AND_BIOLOGICAL_UNIT_REQUIRED: ['Assign a group and biological unit ID to every included sample; technical replicates share a unit ID.', '为每个纳入样品填写分组及生物学单位 ID；技术平行应共享单位 ID。'],
    GROUP_REQUIRED: ['Fill group labels or choose global missingness filtering.', '填写分组标签，或改选全局缺失过滤。'],
    COMPLETE: ['Select an explicit exploratory fill/filter recipe or revise sample/feature scope. QC-filtered values cannot be imputed.', '明确选择探索性补值/过滤配方或调整样品/特征范围。QC 排除值不可补回。'],
    ALL_MISSING_FEATURE: ['Inspect source quality and scope. Explicitly choose Drop all-missing features if scientifically appropriate.', '核对来源质量及范围；科学上合理时明确选择剔除全缺失特征。'],
    TRANSFORM_DOMAIN: ['Inspect nonpositive values. Choose a valid transform or an explicitly justified nonnegative pseudocount; no automatic +1 is added.', '核对非正值，选择适用变换或有科学理由的非负伪计数，不会自动 +1。'],
    SCALE_ZERO_OR_UNDEFINED: ['Inspect constant or insufficient data along the selected axis; change scaling or explicitly filter zero-variance features.', '核对所选轴的常量/不足数据，改变缩放方式或明确过滤零方差特征。'],
    NORMALIZATION_DENOMINATOR: ['Inspect sample totals, medians or internal-standard values. Denominators must be finite and positive.', '核对样品总量、中位数或内标值；归一化分母必须有限且为正。'],
    FOLDS: ['Requested folds are infeasible for independent units per class. Explicitly revise folds/design; the application will not lower them automatically.', '所请求折数不适用于每类独立单位数量。请明确调整折数/设计，系统不会自动减少。'],
    INSUFFICIENT_INDEPENDENT_UNITS: ['Supervised analysis requires more than two independent units per class. Add independent observations, not technical duplicates.', '监督分析要求每类超过两个独立单位；需增加独立观测而非技术重复。'],
    EXPLORATORY_ACKNOWLEDGEMENT_REQUIRED: ['Three/four units per class require explicit small-N acknowledgement and feasible fold settings.', '每类三/四个单位需要明确小样本探索确认，并设置可行折数。'],
    OPLS_REQUIRES_TWO_CLASSES: ['Select exactly two groups for OPLS-DA. PLS-DA is a separate explicit method for multiclass analysis.', 'OPLS-DA 必须选择恰好两组；多分类可明确另选 PLS-DA。'],
    CLASS_ORDER: ['List each selected group exactly once in class order.', '类别顺序中每个选中组必须且只能出现一次。'],
    NO_VALID_CANDIDATE: ['No component candidate succeeded in every inner fold. Inspect rank, missingness and sample size; explicitly revise the grid or recipe.', '没有成分候选在全部内层折成功。核对秩、缺失及样本量，并明确修改候选或配方。'],
    BUDGET: ['Requested nested fits exceed the advertised budget. Explicitly reduce scope, candidate grids, folds/repeats or permutations; nothing is silently reduced.', '请求的嵌套拟合超出预算。请明确减少范围、候选、折数/重复或置换数；不会静默降低参数。'],
    PROJECT_EXCEEDS_32_MIB_EXPORT_RUNS_SEPARATELY: ['The portable project exceeds 32 MiB. Export individual run requests/results separately, then use a smaller snapshot for portable import.', '便携项目超过 32 MiB。请分别导出运行请求/结果，再用较小快照进行便携导入。'],
    PAIRED_SUPERVISED_UNSUPPORTED: ['The same unit/subject appears in multiple selected conditions. Paired supervised designs are unsupported; do not rename technical repeats as independent units.', '同一单位/主体出现在多个选中条件中。暂不支持配对监督设计，不能通过重命名伪造独立单位。']
  };
  const group = code.includes('REQUIRES_COMPLETE_FINITE_MATRIX') ? 'COMPLETE' : code.includes('FOLDS_INFEASIBLE') ? 'FOLDS' : code.includes('FIT_BUDGET') ? 'BUDGET' : code;
  return `${code}: ${(messages[code] || guidance[group])?.[language === 'zh' ? 1 : 0] || (language === 'zh' ? '操作未完成。请核对输入、科学门禁与本地服务状态后重试。' : 'Operation did not complete. Check inputs, scientific gates and local service status before retrying.')}`;
}
