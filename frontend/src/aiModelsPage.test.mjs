import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('./pages/AIModelsPage.jsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('./pages/AIModelsPage.css', import.meta.url), 'utf8');
const app = await readFile(new URL('./app/PlatformApp.jsx', import.meta.url), 'utf8');
const home = await readFile(new URL('./pages/PlatformHomeV2.jsx', import.meta.url), 'utf8');

test('Model Studio reads existing local snapshots and real compute health without a new storage silo', () => {
  assert.match(source, /createDatasetStore/);
  assert.match(source, /store\.list\(\)/);
  assert.match(source, /store\.load\(selectedId\)/);
  assert.match(source, /client\.health\(\)/);
  assert.doesNotMatch(source, /localStorage\.setItem|fetch\(['"]https?:/);
  assert.match(source, /分析运行不等于已验证模型/);
  assert.match(source, /Analysis runs are not validated model experiments/);
});

test('Model Studio exposes five accessible sections but blocks unavailable training and prediction', () => {
  for (const id of ['overview', 'training', 'evaluation', 'prediction', 'experiments']) {
    assert.match(source, new RegExp(`\\['${id}',`));
  }
  assert.match(source, /role="tablist"/);
  assert.match(source, /role="tabpanel"/);
  assert.match(source, /ArrowRight|ArrowLeft/);
  assert.match(source, /开始训练/);
  assert.match(source, /导入新样本/);
  assert.match(source, /<button type="button" disabled/);
  assert.match(source, /独立生物学单位/);
  assert.match(source, /预处理和特征选择仅在训练折内拟合/);
  assert.match(source, /调参与性能评价使用分离的验证层/);
  assert.doesNotMatch(source, /Math\.random\(|mockMetric|fakeScore/);
});

test('Model Studio is a lazy platform route and the homepage links to it as Beta', () => {
  assert.match(app, /AIModelsPage = lazy/);
  assert.match(app, /route === 'models'/);
  assert.match(home, /id: 'models', route: 'models', status: 'beta'/);
  assert.match(home, /Open Model Studio/);
  assert.match(home, /进入模型工作台/);
  assert.match(styles, /@container \(max-width: 680px\)/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /var\(--platform-canvas\)/);
  assert.doesNotMatch(styles, /transform:\s*scale\(/);
});
