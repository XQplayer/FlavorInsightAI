import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
test('CAS query initialization remains safe when search renders without window', async () => {
  assert.equal(typeof globalThis.window, 'undefined');
  const server = await createServer({server:{middlewareMode:true},appType:'custom'});
  try {
    const {default:App} = await server.ssrLoadModule('/src/App.jsx');
    const markup = renderToStaticMarkup(React.createElement(App,{initialView:'search',language:'en'}));
    assert.match(markup,/id="compound-search"/);
    assert.match(markup,/value=""/);
  } finally {await server.close();}
});
test('truncated matrix axes never read omitted untrusted tree heights', async () => {
  const server = await createServer({server:{middlewareMode:true},appType:'custom'});
  try {
    const {default:MatrixPlot} = await server.ssrLoadModule('/src/components/analysis/MatrixPlot.jsx');
    const omittedTree = {get height(){throw new Error('Omitted tree height was accessed');}};
    const run = {id:'r',request:{dataset:{id:'d',name:'SYNTHETIC',features:[{id:'f1'},{id:'f2'}],samples:[{id:'s1'},{id:'s2'}]},recipe:{}},result:{data:{matrix:[[1,2],[3,4]],featureIds:['f1','f2'],displayScale:'none'}}};
    const model = {rows:['s1'],columns:['f1'],values:[[1]],totalRows:2,totalColumns:2,rowIndices:[0,1],columnIndices:[0,1],scale:'none'};
    const markup = renderToStaticMarkup(React.createElement(MatrixPlot,{run,model,rowTree:omittedTree,columnTree:omittedTree,title:'matrix',t:en=>en,onSelect:()=>{}}));
    assert.match(markup,/<svg/);
    assert.doesNotMatch(markup,/row h:|column h:/);
  } finally {await server.close();}
});
test('actual SVG rendering preserves synthetic watermark and rank-one absence of PC2 without warnings', async () => {
  const server = await createServer({
    server: {
      middlewareMode: true
    },
    appType: 'custom'
  });
  try {
    const {
      default: View
    } = await server.ssrLoadModule('/src/components/analysis/ResultVisualizations.jsx');
    const dataset = {
      id: 'synthetic',
      name: 'SYNTHETIC illustration',
      features: [{
        id: 'f1',
        name: 'Duplicated',
        cas: '64-17-5'
      }, {
        id: 'f2',
        name: 'Duplicated'
      }],
      samples: [{
        id: 's1',
        name: 'Sample1',
        group: 'A'
      }, {
        id: 's2',
        name: 'Sample2',
        group: 'B'
      }]
    };
    const run = {
      id: 'synthetic-run',
      status: 'completed',
      request: {
        dataset,
        analysis: {
          method: 'pca'
        }
      },
      result: {
        data: {
          rank: 1,
          scores: [[1], [2]],
          loadings: [[.2], [.3]],
          sampleIds: ['s1', 's2'],
          featureIds: ['f1', 'f2'],
          explained: [1],
          cumulative: [1],
          eigenvalues: [1]
        }
      }
    };
    const markup = renderToStaticMarkup(React.createElement(View, {
      run,
      t: en => en
    }));
    const svg = markup.slice(markup.indexOf('<svg'), markup.indexOf('</svg>'));
    assert.match(svg, /SYNTHETIC — not experimental evidence/);
    assert.match(svg, /1D/);
    assert.doesNotMatch(svg, /PC2/);
    assert.match(markup, /aroma-threshold\/\?cas=64-17-5/);
  } finally {
    await server.close();
  }
});
