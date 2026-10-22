import { useEffect, useRef, useState } from 'react';
import { readImportFile, previewTable, IMPORT_LIMITS } from '../../analysis/imports.mjs';
import { importProject } from '../../analysis/exports.mjs';
import { importArchiveSnapshot } from '../../analysis/archiveImport.mjs';
import { restoreSettings } from '../../analysis/workbench.mjs';
import { Field, Select, NumberField, TextField, Check, DataTable } from './Controls.jsx';
export default function ImportPanel({
  onReplace,
  onError,
  t
}) {
  const [busy, setBusy] = useState(false),
    [columnSearch, setColumnSearch] = useState('');
  const mounted = useRef(true),
    busyRef = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [book, setBook] = useState(null),
    [sheet, setSheet] = useState(0),
    [paste, setPaste] = useState(''),
    [delimiter, setDelimiter] = useState(','),
    [encoding, setEncoding] = useState('utf-8'),
    [selection, setSelection] = useState(''),
    [candidate, setCandidate] = useState(null),
    [confirmed, setConfirmed] = useState(false);
  const [config, setConfig] = useState({
    headerRow: 0,
    orientation: 'features-rows',
    name: 'Imported dataset',
    sampleColumns: [],
    featureColumns: []
  });
  const update = (k, v) => {
    setConfig(c => ({
      ...c,
      [k]: v
    }));
    setCandidate(null);
    setConfirmed(false);
  };
  const run = async fn => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      if (mounted.current) {
        setCandidate(null);
        onError(e);
      }
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  async function read(file) {
    setCandidate(null);
    setConfirmed(false);
    if (file.size > IMPORT_LIMITS.maxBytes) throw new Error('FILE_TOO_LARGE');
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'zip') {
      setCandidate({
        dataset: await importArchiveSnapshot(await file.arrayBuffer(), {
          selection
        })
      });
      return;
    }
    if (ext === 'json') {
      const project = importProject(await file.text());
      setCandidate({
        ...project,
        settings: restoreSettings(project.settings)
      });
      return;
    }
    setBook(await readImportFile(file, {
      delimiter,
      encoding
    }));
    setSheet(0);
  }
  const rows = book?.sheets[sheet]?.rows || [],
    header = rows[config.headerRow] || [],
    options = [{
      value: '',
      label: t('Not mapped', '未映射')
    }, ...header.map((h, i) => ({
      value: String(i),
      label: `${i + 1}: ${h ?? ''}`
    }))];
  const shownColumns = options.slice(1).filter(o => o.label.toLowerCase().includes(columnSearch.toLowerCase())).slice(0, 200);
  const mappingLabels = {
    nameColumn: t('Feature name column', '特征名称列'),
    casColumn: t('CAS column', 'CAS 列'),
    unitColumn: t('Unit column', '单位列'),
    sampleNameColumn: t('Sample name column', '样品名称列'),
    groupColumn: t('Group column', '分组列'),
    biologicalUnitColumn: t('Biological unit ID column', '生物学单位 ID 列'),
    subjectColumn: t('Subject ID column', '配对主体 ID 列'),
    batchColumn: t('Batch column', '批次列')
  };
  return <fieldset disabled={busy}>
  <section className="analysis-section">
    <h2>
      {t('Import data', '导入数据')}
    </h2>
    <p>
      {t('Files stay on this device. Preview and explicitly confirm replacement; generic values initially have unknown lineage. Each ZIP import creates a new snapshot and keeps previously saved history. Project JSON explicitly restores its saved context. Maximum file/project size: 32 MiB.', '文件保留在本机。预览后明确确认替换；通用数据初始来源为未知。每次 ZIP 导入建立新快照，保留之前已保存的历史；项目 JSON 则明确恢复其保存的上下文。文件/项目上限 32 MiB。')}
    </p>
    <div className="analysis-grid">
      <Select label={t('Delimiter', '分隔符')} value={delimiter} onChange={setDelimiter} options={[{
          value: ',',
          label: 'Comma (,)'
        }, {
          value: '\t',
          label: 'Tab'
        }, {
          value: ';',
          label: 'Semicolon (;)'
        }, {
          value: '|',
          label: 'Pipe (|)'
        }]} />
      <Select label={t('Encoding', '编码')} value={encoding} onChange={setEncoding} options={['utf-8', 'utf-16le', 'utf-16be', 'gb18030', 'gbk', 'windows-1252']} />
      <Select label={t('Shimadzu ZIP matrix (required)', '岛津 ZIP 矩阵（必选）')} value={selection} onChange={setSelection} options={[{
          value: '',
          label: t('Choose explicitly', '明确选择')
        }, 'before-cv', 'after-cv']} />
      <Field label={t('XLSX / CSV / TSV / ZIP / project JSON', 'XLSX / CSV / TSV / ZIP / 项目 JSON')}>
        <input type="file" accept=".xlsx,.csv,.tsv,.txt,.zip,.json" onChange={e => {
            const f = e.target.files[0];
            if (f) run(() => read(f));
            e.target.value = '';
          }} />
      </Field>
    </div>
    <Field label={t('Paste a delimited table', '粘贴分隔表格')}>
      <textarea rows={4} value={paste} onChange={e => setPaste(e.target.value)} />
    </Field>
    <button onClick={() => run(() => read(new File([paste], 'pasted.csv')))} disabled={!paste}>
      {t('Read pasted table', '读取粘贴表格')}
    </button>
 {book && <>
      <div className="analysis-grid">
        <Select label={t('Sheet', '工作表')} value={String(sheet)} onChange={v => {
            setSheet(Number(v));
            setCandidate(null);
          }} options={book.sheets.map((s, i) => ({
            value: String(i),
            label: s.name
          }))} />
        <NumberField label={t('Header row (1-based)', '标题行（从 1 起）')} value={config.headerRow + 1} min={1} integer onChange={v => update('headerRow', v - 1)} />
        <Select label={t('Orientation', '方向')} value={config.orientation} onChange={v => {
            update('orientation', v);
            update('sampleColumns', []);
            update('featureColumns', []);
          }} options={['features-rows', 'samples-rows']} />
        <TextField label={t('Project name', '项目名称')} value={config.name} onChange={v => update('name', v)} />
        <TextField label={t('Default unit', '默认单位')} value={config.unit || ''} onChange={v => update('unit', v)} />
        {(config.orientation === 'features-rows' ? ['nameColumn', 'casColumn', 'unitColumn'] : ['sampleNameColumn', 'groupColumn', 'biologicalUnitColumn', 'subjectColumn', 'batchColumn']).map(key => <Select key={key} label={mappingLabels[key]} value={config[key] === undefined ? '' : String(config[key])} onChange={v => update(key, v === '' ? undefined : Number(v))} options={options} />)}
      </div>
      <TextField label={t('Search measurement column names (up to 200 shown)', '搜索测量列名称（最多显示 200 列）')} value={columnSearch} onChange={setColumnSearch} />
      <Field label={t('Measurement columns — select explicitly (Ctrl / Command for multiple)', '测量列——明确选择（Ctrl / Command 多选）')}>
        <select multiple size={Math.min(8, header.length || 1)} value={(config.orientation === 'features-rows' ? config.sampleColumns : config.featureColumns).map(String)} onChange={e => update(config.orientation === 'features-rows' ? 'sampleColumns' : 'featureColumns', [...(config.orientation === 'features-rows' ? config.sampleColumns : config.featureColumns).filter(i => !shownColumns.some(o => Number(o.value) === i)), ...[...e.target.selectedOptions].map(o => Number(o.value))])}>
          {shownColumns.map(o => <option key={o.value} value={o.value}>
            {o.label}
          </option>)}
        </select>
      </Field>
      <DataTable rows={rows.slice(0, 8).map(r => Object.fromEntries(r.map((v, i) => [String(i + 1), v])))} caption={t('First 8 source rows', '前 8 行原表')} t={t} />
      <p>
        {book.warnings.map(w => `${w.code} ${w.address}`).join('; ')}
      </p>
      <button onClick={() => run(() => {
          const preview = previewTable(rows, config);
          setCandidate(preview);
          setConfirmed(false);
        })}>
        {t('Preview mapped data', '预览映射数据')}
      </button>
    </>}
 {candidate && <div className="analysis-notice">
      <p>
        {candidate.dataset.name}: {candidate.dataset.samples.length} {t('samples', '样品')} × {candidate.dataset.features.length} {t('features', '特征')}; {t('invalid numeric cells (kept missing)', '无效数值（保留缺失）')}: {candidate.invalidCells?.length || 0}
      </p>
      {candidate.invalidCells?.length > 0 && <DataTable rows={candidate.invalidCells} caption={t('Invalid cells', '无效单元格')} t={t} />}
      <Check label={t('I reviewed the preview and confirm replacing the current project context.', '我已审阅预览，并确认替换当前项目上下文。')} value={confirmed} onChange={setConfirmed} />
      <button disabled={!confirmed} onClick={() => {
          onReplace(candidate.dataset, candidate.settings);
          setCandidate(null);
          setConfirmed(false);
        }}>
        {t('Confirm import', '确认导入')}
      </button>
    </div>}
 </section>
</fieldset>;
}
