import { Field, Select, NumberField, Check, TextField } from './Controls.jsx';
import { defaultAnalysis, METHODS } from '../../analysis/workbench.mjs';
export default function AnalysisPanel({
  dataset,
  analysis: a,
  onChange,
  available,
  onRun,
  disabled,
  t
}) {
  const set = (key, value) => onChange({
      ...a,
      [key]: value
    }),
    groups = [...new Set(dataset.samples.filter(s => s.include).map(s => s.group).filter(Boolean))];
  const supervised = ['plsda', 'oplsda'].includes(a.method),
    observed = ['compare', 'correlation', 'distribution'].includes(a.method),
    multi = ['anova', 'welch-anova', 'kruskal'].includes(a.test);
  const groupSelect = <fieldset>
  <legend>
    {t('Explicit group scope', '明确分组范围')}
  </legend>
  {groups.map(g => <Check key={g} label={g} value={a.groups?.includes(g)} onChange={v => {
      const selected = v ? [...(a.groups || []), g] : (a.groups || []).filter(x => x !== g);
      onChange({
        ...a,
        groups: selected,
        ...(supervised ? {
          classOrder: selected
        } : {})
      });
    }} />)}
</fieldset>;
  return <section className="analysis-section">
  <h2>
    {t('Analysis settings', '分析设置')}
  </h2>
  <Select label={t('Analysis method', '分析方法')} value={a.method} onChange={v => onChange(defaultAnalysis(v))} options={METHODS.filter(m => m !== 'preprocess').map(m => ({
      value: m,
      label: `${m.toUpperCase()}${available.includes(m) ? '' : t(' — service unavailable', ' — 服务不可用')}`
    }))} />
 {a.method === 'pca' && <>
    <Select label={t('PCA centering', 'PCA 中心化')} value={a.center === undefined ? 'auto' : String(a.center)} onChange={v => {
        const next = {
          ...a
        };
        if (v === 'auto') delete next.center;else next.center = v === 'true';
        onChange(next);
      }} options={[{
        value: 'auto',
        label: t('Automatic (respect recipe centering)', '自动（尊重配方中心化）')
      }, {
        value: 'true',
        label: t('Explicitly center', '明确中心化')
      }, {
        value: 'false',
        label: t('Do not center', '不中心化')
      }]} />
    <NumberField label={t('Components (blank = numerical rank)', '主成分数（空白 = 数值秩）')} nullable min={1} integer value={a.components ?? null} onChange={v => {
        const next = {
          ...a
        };
        if (v === null) delete next.components;else next.components = v;
        onChange(next);
      }} />
    <p>
      {t('SVD PCA with no automatic scaling. The engine centers only when the feature recipe has not already centered the matrix.', 'SVD PCA 不自动缩放；引擎仅在特征配方尚未中心化时默认中心化。')}
    </p>
  </>}
 {a.method === 'heatmap' && <>
    <Select label={t('Display-only scaling', '仅展示缩放')} value={a.displayScale} onChange={v => set('displayScale', v)} options={['none', 'feature-z', 'sample-z']} />
    {['Rows', 'Columns'].map(axis => <fieldset key={axis}>
      <legend>
        {axis === 'Rows' ? t('Samples', '样品') : t('Features', '特征')}
      </legend>
      <Check label={t('Enable clustering', '启用聚类')} value={a[`cluster${axis}`]} onChange={v => set(`cluster${axis}`, v)} />
      <div className="analysis-grid">
        <Select label={t('Distance', '距离')} value={a[axis === 'Rows' ? 'rowDistance' : 'columnDistance']} onChange={v => set(axis === 'Rows' ? 'rowDistance' : 'columnDistance', v)} options={['euclidean', 'manhattan', 'pearson', 'spearman']} />
        <Select label={t('Linkage', '连接方式')} value={a[axis === 'Rows' ? 'rowLinkage' : 'columnLinkage']} onChange={v => set(axis === 'Rows' ? 'rowLinkage' : 'columnLinkage', v)} options={['average', 'complete', 'single', 'ward.D2']} />
      </div>
    </fieldset>)}
    <p>
      {t('Ward requires Euclidean distance. Display Z scores do not overwrite the analysis matrix.', 'Ward 要求欧氏距离。展示 Z 分数不覆盖分析矩阵。')}
    </p>
  </>}
 {a.method === 'compare' && <>
    <div className="analysis-grid">
      <Select label={t('Test', '检验')} value={a.test} onChange={v => set('test', v)} options={['welch', 'student', 'paired-t', 'wilcoxon', 'paired-wilcoxon', 'anova', 'welch-anova', 'kruskal']} />
      <Select label={t('Alternative (treatment relative to control)', '备择（处理相对对照）')} value={a.alternative} onChange={v => set('alternative', v)} options={['two.sided', 'less', 'greater']} />
      <Select label={t('Multiplicity scope', '多重校正范围')} value={a.adjustScope} onChange={v => set('adjustScope', v)} options={['comparison', 'all']} />
    </div>
    {multi ? groupSelect : <fieldset>
      <legend>
        {t('Explicit comparisons', '明确比较列表')}
      </legend>
      {a.comparisons.map((c, i) => <div className="analysis-grid" key={i}>
        {['control', 'treatment'].map(key => <Select key={key} label={`${i + 1} ${key === 'control' ? t('Control', '对照') : t('Treatment', '处理')}`} value={c[key]} onChange={v => set('comparisons', a.comparisons.map((item, j) => i === j ? {
            ...item,
            [key]: v
          } : item))} options={[{
            value: '',
            label: t('Choose', '选择')
          }, ...groups]} />)}
        <button onClick={() => set('comparisons', a.comparisons.filter((_, j) => j !== i))}>
          {t('Remove comparison', '移除比较')}
        </button>
      </div>)}
      <button onClick={() => set('comparisons', [...a.comparisons, {
          control: '',
          treatment: ''
        }])}>
        {t('Add comparison', '添加比较')}
      </button>
    </fieldset>}
    <fieldset>
      <legend>
        {t('Observed-only inference transform (separate from exploration)', '仅实测推断变换（独立于探索）')}
      </legend>
      <Select label={t('Inference transform', '推断变换')} value={a.transform.method} onChange={v => set('transform', {
          ...a.transform,
          method: v
        })} options={['none', 'log2', 'log10', 'ln', 'sqrt']} />
      <NumberField label={t('Inference pseudocount', '推断伪计数')} min={0} value={a.transform.pseudocount} onChange={v => set('transform', {
          ...a.transform,
          pseudocount: v
        })} />
    </fieldset>
  </>}
 {a.method === 'correlation' && <Select label={t('Correlation', '相关方法')} value={a.correlation} onChange={v => set('correlation', v)} options={['pearson', 'spearman']} />}
 {['compare', 'correlation'].includes(a.method) && <Select label={t('P-value adjustment', 'P 值校正')} value={a.adjust} onChange={v => set('adjust', v)} options={['BH', 'holm', 'bonferroni', 'none']} />}
 {observed && <>
    <Check label={t('Include internal standards in observed-only results', '实测分析中包含内标')} value={a.includeInternalStandards} onChange={v => set('includeInternalStandards', v)} />
    <p>
      {t('This branch uses observed values only, not exploratory fills, scales or feature filters. Declared technical repeats are aggregated. Inference requires confirmed independent units; distribution is descriptive.', '此分支仅用实测值，不使用探索性补值、缩放或特征过滤。声明的技术平行将聚合。推断要求确认独立单位；分布仅为描述。')}
    </p>
  </>}
 {supervised && <>
    {groupSelect}
    <Field label={t('Class order (one selected group per line; first = binary 0)', '类别顺序（每行一个选中组；首组 = 二元 0）')}>
      <textarea value={a.classOrder.join('\n')} onChange={e => set('classOrder', e.target.value.split('\n'))} />
    </Field>
    <div className="analysis-grid">
      {[['outerFolds', t('Outer folds', '外层折数'), 2, 10], ['innerFolds', t('Inner folds', '内层折数'), 2, 10], ['repeats', t('Repeats', '重复次数'), 1, 10], ['seed', t('Seed', '随机种子'), 0, 2147000000], ['permutations', t('Permutations (200 default; 1000 supported)', '置换数（默认 200；支持 1000）'), 0, 1000]].map(([key, label, min, max]) => <NumberField key={key} label={label} min={min} max={max} integer value={a[key]} onChange={v => set(key, v)} />)}
      {['predictiveComponents', 'orthogonalComponents'].map(key => <TextField key={key} label={key === 'predictiveComponents' ? t('Predictive candidate grid (comma-separated)', '预测成分候选（逗号分隔）') : t('Orthogonal candidate grid (comma-separated)', '正交成分候选（逗号分隔）')} value={a[key].join(',')} onChange={v => set(key, v.split(',').map(n => n.trim() === '' ? '' : Number(n)))} />)}
    </div>
    {a.permutations < 200 && <p role="status">
      {a.permutations === 0 ? t('Permutation test NOT PERFORMED; p unavailable.', '未进行置换检验；p 不可用。') : t('LOW_PERMUTATION_COUNT: exploratory only.', 'LOW_PERMUTATION_COUNT：仅低次数探索。')}
    </p>}
    <Check label={t('I acknowledge the small-N exploratory design (3–4 units/class). No folds or components will be silently reduced.', '我知悉小样本探索设计（每组 3–4 单位）；不会静默减少折数或成分数。')} value={a.acknowledgeExploratory} onChange={v => set('acknowledgeExploratory', v)} />
    <p>
      {t('Nested validation uses training-only preprocessing and selection. Full-fit scores/loadings/VIP are descriptive, distinct from held-out validation. VIP is not a p value or causal evidence; model responses are not probabilities.', '嵌套验证仅使用训练集预处理与选择。全数据拟合得分/载荷/VIP 属于描述，与留出验证区分。VIP 不是 p 值或因果证据，模型响应不是概率。')}
    </p>
  </>}
 {(observed || supervised) && <>
    <Check label={t('Explicitly allow mixed sample matrix types', '明确允许混合样品基质类型')} value={a.allowMixedMatrixTypes} onChange={v => set('allowMixedMatrixTypes', v)} />
    <TextField label={t('Scientific reason for mixed matrix types', '混合基质科学理由')} value={a.mixedMatrixTypesReason} onChange={v => set('mixedMatrixTypesReason', v)} />
  </>}
 <button disabled={disabled || !available.includes(a.method)} onClick={onRun}>
    {t('Run analysis', '运行分析')}
  </button>
</section>;
}
