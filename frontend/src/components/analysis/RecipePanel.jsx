import { useState } from 'react';
import { Check, Select, NumberField } from './Controls.jsx';
export default function RecipePanel({
  dataset,
  recipe,
  onChange,
  onPreview,
  disabled,
  t
}) {
  const [featurePage, setFeaturePage] = useState(0);
  const set = (section, key, value) => onChange({
      ...recipe,
      [section]: {
        ...recipe[section],
        [key]: value
      }
    }),
    r = recipe;
  const select = (section, key, label, options) => <Select label={label} value={r[section][key]} onChange={v => set(section, key, v)} options={options} />;
  return <section className="analysis-section">
  <h2>
    {t('Preprocessing recipe', '预处理配方')}
  </h2>
  <p>
    {t('Fixed order: filter → fill → sample normalize → transform → scale. Source values and source quality remain unchanged. Defaults perform no fill, normalization, transform or scaling.', '固定顺序：过滤 → 补值 → 样品归一化 → 变换 → 缩放。源值和来源质量不变。默认不补值、不归一化、不变换、不缩放。')}
  </p>
  <fieldset>
    <legend>1 · {t('Filter', '过滤')}
    </legend>
    <div className="analysis-grid">
      <NumberField label={t('Maximum missing fraction (blank = no filter)', '最大缺失比例（空白 = 不过滤）')} value={r.filter.maxMissing} nullable min={0} max={1} onChange={v => set('filter', 'maxMissing', v)} />
      {select('filter', 'missingScope', t('Missingness scope', '缺失比例范围'), ['global', 'group'])}
      {select('filter', 'allMissing', t('All-missing features', '全缺失特征'), ['error', 'drop'])}
      {select('filter', 'zeroVariance', t('Zero variance', '零方差'), ['keep', 'drop'])}
    </div>
    {[
      ['includeInternalStandards', t('Include internal standards', '包含内标')],
      ['allowMixedUnits', t('Explicitly allow mixed feature units', '明确允许混合特征单位')],
      ['allowMixedMatrixTypes', t('Explicitly allow mixed sample matrix types in exploration', '探索中明确允许混合样品基质类型')]
    ].map(([key,label]) => <Check key={key} label={label} value={r.filter[key]} onChange={v => set('filter', key, v)} />)}
    <details>
      <summary>
        {t('Explicit feature scope (stable IDs)', '明确特征范围（稳定 ID）')}
      </summary>
      <Check label={t('Select a feature subset', '选择特征子集')} value={Array.isArray(r.filter.featureIds)} onChange={v => {
          const filter = {
            ...r.filter
          };
          if (v) filter.featureIds = [];else delete filter.featureIds;
          onChange({
            ...r,
            filter
          });
        }} />
      {r.filter.featureIds && <>
        <div className="analysis-toolbar">
          <button disabled={!featurePage} onClick={() => setFeaturePage(featurePage - 1)}>
            {t('Previous', '上一页')}
          </button>
          <button disabled={(featurePage + 1) * 30 >= dataset.features.length} onClick={() => setFeaturePage(featurePage + 1)}>
            {t('Next', '下一页')}
          </button>
        </div>
        {dataset.features.slice(featurePage * 30, featurePage * 30 + 30).map(f => <Check key={f.id} label={`${f.id}: ${f.name}`} value={r.filter.featureIds.includes(f.id)} onChange={v => set('filter', 'featureIds', v ? [...r.filter.featureIds, f.id] : r.filter.featureIds.filter(id => id !== f.id))} />)}
      </>}
    </details>
  </fieldset>
  <fieldset>
    <legend>2 · {t('Exploratory fill', '探索性补值')}
    </legend>
    <div className="analysis-grid">
      {select('impute', 'method', t('Fill method', '补值方法'), ['none', 'constant', 'median', 'half-minimum', 'knn'])}
      {r.impute.method === 'constant' && <NumberField label={t('Constant value', '常数')} value={r.impute.value} onChange={v => set('impute', 'value', v)} />}
      {r.impute.method === 'knn' && <NumberField label="K" value={r.impute.k} integer min={1} onChange={v => set('impute', 'k', v)} />}
    </div>
    <p>
      {t('QC-filtered values cannot be revived. Half-minimum assumes missing values may lie below detection; this is an explicit exploratory assumption, not observed evidence. Training-only references are fitted in every validation fold.', 'QC 排除值不可恢复。最小正值一半补值假设缺失可能低于检出限，是明确探索假设而非实测证据。每个验证折仅拟合训练集参考值。')}
    </p>
  </fieldset>
  <fieldset>
    <legend>3 · {t('Sample normalization', '样品归一化')}
    </legend>
    <div className="analysis-grid">
      {select('normalize', 'method', t('Normalization', '归一化'), ['none', 'sum', 'median', 'pqn', 'internal-standard'])}
      <NumberField label={t('Positive target', '正目标值')} value={r.normalize.target} min={0.000000001} onChange={v => set('normalize', 'target', v)} />
      {r.normalize.method === 'internal-standard' && <Select label={t('Reference feature ID', '参考特征 ID')} value={r.normalize.featureId} onChange={v => set('normalize', 'featureId', v || null)} options={[{
          value: '',
          label: t('Choose', '选择')
        }, ...dataset.features.map(f => ({
          value: f.id,
          label: `${f.id}: ${f.name}`
        }))]} />}
    </div>
    <Check label={t('I acknowledge additional normalization of already semiquantified data.', '我知悉对已半定量数据再次归一化的影响。')} value={r.normalize.acknowledgeDoubleNormalization} onChange={v => set('normalize', 'acknowledgeDoubleNormalization', v)} />
  </fieldset>
  <fieldset>
    <legend>4 · {t('Transform', '变换')}
    </legend>
    <div className="analysis-grid">
      {select('transform', 'method', t('Transform', '变换'), ['none', 'log2', 'log10', 'ln', 'sqrt'])}
      <NumberField label={t('Explicit pseudocount (no automatic +1)', '明确伪计数（不自动 +1）')} value={r.transform.pseudocount} min={0} onChange={v => set('transform', 'pseudocount', v)} />
    </div>
  </fieldset>
  <fieldset>
    <legend>5 · {t('Scale', '缩放')}
    </legend>
    <div className="analysis-grid">
      {select('scale', 'method', t('Scaling', '缩放'), ['none', 'center', 'uv', 'pareto', 'minmax', 'robust'])}
      {select('scale', 'axis', t('Scaling axis', '缩放轴'), ['feature', 'sample'])}
    </div>
    <p>
      {t('UV = (x − mean) / sample SD; Pareto = (x − mean) / √sample SD; robust = (x − median) / IQR. Undefined denominators fail explicitly.', 'UV = (x − 均值) / 样本标准差；Pareto = (x − 均值) / √样本标准差；robust = (x − 中位数) / IQR。分母无定义时明确报错。')}
    </p>
  </fieldset>
  <button disabled={disabled} onClick={onPreview}>
    {t('Run real preprocessing preview', '运行真实预处理预览')}
  </button>
</section>;
}
