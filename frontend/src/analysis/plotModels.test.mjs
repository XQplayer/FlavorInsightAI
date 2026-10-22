import test from 'node:test';
import assert from 'node:assert/strict';
const m = await import('./plotModels.mjs').catch(() => ({}));
test('hclust validates counts and topology before allocating drawable segments', () => {
  const oversized = { merge: Array.from({length:100000}, () => [-1,-2]), height: Array(100000).fill(1) };
  assert.throws(() => m.treeSegments(oversized, [0,1]), /hclust/);
  const malformed = [
    [{merge:[[-1,-2]],height:[]}, [0,1]],
    [{merge:[[-1,-2,-3]],height:[1]}, [0,1]],
    [{merge:[[-1,-2],[-1,-3]],height:[1,2]}, [0,1,2]],
    [{merge:[[-1,-2],[-3,-4],[1,1]],height:[1,2,3]}, [0,1,2,3]],
    [{merge:[[1,-1],[-2,-3]],height:[1,2]}, [0,1,2]],
    [{merge:[[-1,-2],[-3,-4],[-1,-2]],height:[1,2,3]}, [0,1,2,3]],
    [{merge:[[0,-1]],height:[1]}, [0,1]],
    [{merge:[[-1,-1.5]],height:[1]}, [0,1]],
    [{merge:[[-1,-3]],height:[1]}, [0,1]],
    [{merge:[[-1,-2]],height:[1]}, [0,0]],
    [{merge:[[-1,-2]],height:[1]}, [0,2]],
    [{merge:[[-1,-2]],height:[-1]}, [0,1]],
    [{merge:[[-1,-2]],height:[Infinity]}, [0,1]],
    [{merge:[[-1,-2],[1,-3]],height:[2,1]}, [0,1,2]],
  ];
  for (const [tree, order] of malformed) assert.throws(() => m.treeSegments(tree, order), /hclust/);
  const valid = m.treeSegments({merge:[[-1,-2],[-3,-4],[1,2]],height:[2,3,7]}, [3,2,0,1]);
  assert.equal(valid.length,9);
  assert.equal(Math.max(...valid.flatMap(s => [s.y1,s.y2])),7);
});
test('scree displays numerical rank, retains raw spectrum, and is not limited to stored scores', () => {
  assert.equal(typeof m.screeModel, 'function');
  const rankOne = { rank: 1, scores: [[1], [2]], explained: [1, 0], cumulative: [1, 1], eigenvalues: [2, 0] };
  const before = JSON.stringify(rankOne);
  const result = m.screeModel(rankOne);
  assert.deepEqual(result.points.map(point => point.id), ['PC1']);
  assert.equal(result.totalSpectrum, 2);
  assert.equal(JSON.stringify(rankOne), before);
  const rankTwo = { ...rankOne, rank: 2, explained: [.8, .2], cumulative: [.8, 1], eigenvalues: [2, .5] };
  assert.equal(m.screeModel(rankTwo).points.length, 2);
  assert.throws(() => m.screeModel({ ...rankOne, rank: 3 }), /rank/i);
});
test('R orders convert once and hclust preserves actual merge heights', () => {
  assert.equal(typeof m.orderedMatrix, 'function');
  const data = {
    matrix: [[0, null], [2, 3]],
    analysisMatrix: [[99, 99], [99, 99]],
    sampleIds: ['s1', 's2'],
    featureIds: ['f1', 'f2'],
    rowOrder: [2, 1],
    columnOrder: [2, 1],
    displayScale: 'feature-z'
  };
  const out = m.orderedMatrix(data);
  assert.deepEqual(out.values, [[3, 2], [null, 0]]);
  assert.deepEqual(out.rows, ['s2', 's1']);
  assert.equal(out.scale, 'feature-z');
  const tree = m.treeSegments({
    merge: [[-1, -2], [1, -3]],
    height: [2, 5],
    order: [3, 1, 2]
  }, [2, 0, 1]);
  assert.equal(tree.length, 6);
  assert.equal(Math.max(...tree.flatMap(s => [s.y1, s.y2])), 5);
  assert.throws(() => m.orderedMatrix({
    ...data,
    rowOrder: [0, 1]
  }), /order/i);
});
test('PCA axes respect stored dimensions and numerical rank; one-dimensional is explicit', () => {
  assert.equal(typeof m.componentAxes, 'function');
  assert.deepEqual(m.componentAxes({
    rank: 1,
    scores: [[3]],
    loadings: [[1]]
  }, 'pca').map(a => a.label), ['PC1']);
  assert.equal(m.componentAxes({
    rank: 2,
    scores: [[3]],
    loadings: [[1]]
  }, 'pca').length, 1);
  assert.deepEqual(m.componentAxes({
    components: {
      predictive: 1,
      orthogonal: 1
    },
    scores: [[1]],
    orthogonalScores: [[2]]
  }, 'oplsda').map(a => a.label), ['Predictive 1', 'Orthogonal 1']);
});
test('volcano preserves full family, nulls and raw p=0; caps display only', () => {
  assert.equal(typeof m.volcanoModel, 'function');
  const rows = [{
    featureId: 'a',
    comparison: 'B vs A',
    log2FoldChange: 2,
    p: 0,
    padj: 0
  }, {
    featureId: 'b',
    comparison: 'B vs A',
    log2FoldChange: null,
    p: null,
    padj: null
  }, {
    featureId: 'c',
    comparison: 'C vs A',
    log2FoldChange: 1,
    p: 0.2,
    padj: 0.6
  }];
  const before = JSON.stringify(rows),
    out = m.volcanoModel(rows, 'B vs A', 'padj', 1, .05);
  assert.equal(JSON.stringify(rows), before);
  assert.equal(out.total, 2);
  assert.equal(out.missing, 1);
  assert.equal(out.points[0].y, 300);
  assert.equal(out.points[0].raw.padj, 0);
  assert.equal(out.familySize, 3);
});
test('Type 7 box estimates and KDE fallback are descriptive only', () => {
  assert.equal(typeof m.boxSummary, 'function');
  assert.deepEqual(m.boxSummary([1, 2, 3, 4, null]).quartiles, [1.75, 2.5, 3.25]);
  assert.equal(m.boxSummary([1, 2, 3, 4, null]).missing, 1);
  assert.equal(m.densityModel([3, 3, 3]).reason, 'CONSTANT');
  assert.equal(m.densityModel([1, 2]).reason, 'SMALL_N');
  assert.equal(m.densityModel([1, 2, 3, 4, 6]).points.length, 64);
});
test('matrix caps are explicit and correlation never fabricates diagonal', () => {
  assert.equal(typeof m.correlationModel, 'function');
  const out = m.correlationModel([{
    featureId: 'a',
    otherFeatureId: 'b',
    r: 0,
    n: 3,
    p: null,
    padj: null
  }], 1);
  assert.equal(out.total, 2);
  assert.equal(out.rows.length, 1);
  assert.equal(out.values[0][0], null);
  assert.equal(m.correlationModel([{
    featureId: 'a',
    otherFeatureId: 'b',
    r: 0
  }]).values[1][0], 0);
  const b = m.boundedPoints(Array.from({
    length: 1001
  }, (_, i) => ({
    x: i,
    y: i
  })));
  assert.equal(b.points.length, 500);
  assert.equal(b.total, 1001);
});
test('identities use bound request and duplicate names retain IDs', () => {
  assert.equal(typeof m.identity, 'function');
  const run = {
    request: {
      dataset: {
        features: [{
          id: 'a',
          name: 'same',
          cas: '64-17-5'
        }, {
          id: 'b',
          name: 'same'
        }],
        samples: [{
          id: 's',
          name: 'original',
          group: 'A'
        }]
      }
    },
    result: {
      data: {
        samples: [{
          id: 'unit:s',
          sourceSampleIds: ['s'],
          group: 'A'
        }]
      }
    }
  };
  assert.equal(m.identity(run, 'a', 'feature').label, 'a · same');
  assert.equal(m.identity(run, 'b', 'feature').label, 'b · same');
  assert.match(m.identity(run, 'unit:s', 'sample').label, /original/);
});
test('permutation keeps negative observed values and does not infer p', () => {
  assert.equal(typeof m.permutationModel, 'function');
  assert.equal(m.permutationModel({
    observed: -.3,
    requested: 0,
    completed: 0,
    p: null,
    pNaReason: 'NOT_REQUESTED',
    distribution: []
  }).p, null);
  const out = m.permutationModel({
    observed: -.3,
    requested: 3,
    completed: 2,
    failed: 1,
    p: null,
    distribution: [.1, .2, null]
  });
  assert.equal(out.observed, -.3);
  assert.equal(out.missing, 1);
  assert.equal(out.p, null);
  assert.equal(m.permutationModel({
    requested: 0,
    completed: 0,
    p: .01
  }).p, null);
  assert.equal(m.permutationModel({
    requested: 5,
    completed: 4,
    failed: 1,
    p: .01
  }).p, null);
});
test('component rank validation rejects malformed imported axes', () => {
  assert.throws(() => m.componentAxes({
    rank: -1,
    scores: [[1]]
  }, 'pca'), /rank/);
});
test('full matrix limits do not overflow the argument stack for large accepted inputs', () => {
  assert.equal(typeof m.valueLimits, 'function');
  assert.deepEqual(m.valueLimits(Array.from({
    length: 200000
  }, (_, i) => i === 3 ? null : i)), [0, 199999]);
});
test('heatmap labels separate display z scores, processed values and unchanged units', () => {
  assert.equal(typeof m.matrixScaleLabel, 'function');
  const run = {
    request: {
      dataset: {
        features: [{
          id: 'f',
          unit: 'mg/L'
        }]
      },
      recipe: {}
    },
    result: {
      data: {
        featureIds: ['f'],
        displayScale: 'none'
      }
    }
  };
  assert.match(m.matrixScaleLabel(run).en, /mg\/L/);
  run.request.recipe.scale = {
    method: 'uv'
  };
  assert.match(m.matrixScaleLabel(run).en, /Processed/);
  assert.doesNotMatch(m.matrixScaleLabel(run).en, /mg\/L/);
  run.result.data.displayScale = 'feature-z';
  assert.match(m.matrixScaleLabel(run).en, /z-score/);
});
test('first twelve group encodings are distinct in color and grayscale', () => {
  assert.equal(typeof m.markerEncoding, 'function');
  for (const mode of ['color', 'mono']) {
    const keys = Array.from({
      length: 12
    }, (_, i) => JSON.stringify(m.markerEncoding(i, mode)));
    assert.equal(new Set(keys).size, 12);
    assert.notEqual(keys[0], keys[5]);
  }
});
test('chart binding records actual recipe, source, result provenance and bound identities', () => {
  const run = {
    id: 'r',
    request: {
      dataset: {
        id: 'd',
        name: 'SYNTHETIC',
        provenance: {
          source: 'table'
        }
      },
      recipe: {
        transform: {
          method: 'log2'
        }
      },
      analysis: {
        method: 'pca'
      }
    },
    result: {
      data: {},
      provenance: {
        rVersion: '4.6.0'
      }
    }
  };
  assert.equal(m.plotBinding(run).recipe, run.request.recipe);
  assert.equal(m.plotBinding(run).provenance, run.result.provenance);
  assert.equal(m.plotBinding(run).datasetId, 'd');
});
