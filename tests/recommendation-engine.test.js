const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ console, Date, Math, Map, Set });
context.window = context;
context.globalThis = context;
for (const file of ['v2-preview/apps/_shared/meta-field.js', 'v2-preview/apps/_shared/meta-blend.js', 'v2-preview/apps/_shared/recommendation-engine.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename:file });
}
const Field = context.PTCGMetaField;
const Recommend = context.PTCGRecommendation;

const row = (a,b,wins,losses,ties=0) => ({ a,b,wins,losses,ties });
const run = ({ field, candidates=['A','B'], online=[], irl=[], source='online' }) => Recommend.analyse({ fieldRows:field, candidates, evidence:{ online,irl }, matchupSource:source });

test('field shares merge duplicate exact identities and sum to one', () => {
  const rows=Field.normalizeRows([{name:'A',share:20},{name:'B',share:30},{name:'A',share:50},{name:'Other',share:10}]);
  assert.equal(rows.length,2);
  assert.ok(Math.abs(rows.reduce((sum,item)=>sum+item.share,0)-1)<1e-12);
  assert.equal(rows[0].name,'A');
  assert.equal(rows[0].share,0.7);
});

test('expected performance is the sum of covered-field contributions', () => {
  const model=run({field:[{name:'X',share:.75},{name:'Y',share:.25}],candidates:['A'],online:[row('A','X',14,6),row('A','Y',6,14)]});
  const result=model.all[0];
  assert.equal(result.expectedWR,56.25);
  assert.equal(result.helpers[0].contribution,9.375);
  assert.equal(result.hurts[0].contribution,-3.125);
});

test('missing matchups remain unknown and do not become a hidden neutral result', () => {
  const model=run({field:[{name:'X',share:.6},{name:'Y',share:.4}],candidates:['A'],online:[row('A','X',14,6)]});
  const result=model.all[0];
  assert.equal(result.coverage,.6);
  assert.equal(result.unknownShare,.4);
  assert.equal(result.expectedWR,62.5);
  assert.equal(result.evidenceLevel,'weak');
  assert.equal(model.ranked.length,0);
});

test('ranking orders decision-ready candidates and marks a sub-2pp result as a close call', () => {
  const evidence=[row('A','X',12,8),row('A','Y',11,9),row('B','X',11,9),row('B','Y',11,9)];
  const model=run({field:[{name:'X',share:.5},{name:'Y',share:.5}],online:evidence});
  assert.deepEqual(Array.from(model.ranked,row=>row.name),['A','B']);
  assert.equal(model.closeCall,true);
  assert.equal(model.state,'close');
});

test('a broad open field with no meaningful edge is presented as a close call', () => {
  const evidence=[
    row('A','X',12,8),row('A','Y',8,12),
    row('B','X',11,9),row('B','Y',9,11),
    row('C','X',10,10),row('C','Y',10,10),
  ];
  const model=run({field:[{name:'X',share:.5},{name:'Y',share:.5}],candidates:['A','B','C'],online:evidence});
  assert.equal(model.state,'close');
  assert.equal(model.ranked.length,3);
  assert.ok(model.gap < 2);
});

test('exact variants in one family retain independent matchup profiles', () => {
  const model=run({field:[{name:'X',share:1}],candidates:['Ogerpon Meganium Hydrapple','Ogerpon Meganium Arboliva'],online:[row('Ogerpon Meganium Hydrapple','X',16,4),row('Ogerpon Meganium Arboliva','X',4,16)]});
  assert.equal(model.ranked[0].name,'Ogerpon Meganium Hydrapple');
  assert.equal(model.ranked[1].name,'Ogerpon Meganium Arboliva');
  assert.notEqual(model.ranked[0].expectedWR,model.ranked[1].expectedWR);
});

test('a custom field override can reverse the recommended exact variant', () => {
  const evidence=[row('A','X',18,2),row('A','Y',2,18),row('B','X',6,14),row('B','Y',14,6)];
  const xHeavy=run({field:[{name:'X',share:.8},{name:'Y',share:.2}],online:evidence});
  const yHeavy=run({field:[{name:'X',share:.2},{name:'Y',share:.8}],online:evidence});
  assert.equal(xHeavy.top.name,'A');
  assert.equal(yHeavy.top.name,'B');
});

test('tiny samples can look promising but are not decision-ready', () => {
  const model=run({field:[{name:'X',share:1}],candidates:['A'],online:[row('A','X',2,0)]});
  assert.equal(model.ranked.length,0);
  assert.equal(model.lowerEvidence[0].evidenceLevel,'insufficient');
  assert.equal(model.lowerEvidence[0].evidenceQuality,.1);
  assert.equal(model.state,'insufficient');
});

test('polarised profiles expose both favourable and bad field share', () => {
  const model=run({field:[{name:'X',share:.5},{name:'Y',share:.5}],candidates:['A'],online:[row('A','X',18,2),row('A','Y',2,18)]});
  const result=model.top;
  assert.equal(result.polarised,true);
  assert.equal(result.favourableExposure,.5);
  assert.equal(result.badExposure,.5);
});

test('combined evidence retains material Online versus IRL disagreement', () => {
  const model=run({field:[{name:'X',share:1}],candidates:['A'],online:[row('A','X',16,4)],irl:[row('A','X',4,16)],source:'combined'});
  assert.equal(model.top.sourceDisagreement,true);
  assert.equal(model.top.sourceProfiles.online.estimate,68.75);
  assert.equal(model.top.sourceProfiles.irl.estimate,31.25);
  assert.equal(model.top.expectedWR,50);
});

test('current release produces a normalized exact-variant analysis', () => {
  const core=JSON.parse(fs.readFileSync(path.join(root,'v2-preview/data/meta/release/core.json'),'utf8'));
  const online=JSON.parse(fs.readFileSync(path.join(root,'v2-preview/data/meta/release/online-matchups.json'),'utf8'));
  const irl=JSON.parse(fs.readFileSync(path.join(root,'v2-preview/data/meta/release/irl-matchups.json'),'utf8'));
  const blended=context.PTCGMetaBlend.currentFromCore(core,{now:'2026-09-05'});
  const selected=Field.selectCoverage(blended.rows,.9).rows;
  const candidates=[...(core.online.scopes['30'].decks||[]),...(core.irl.events||[]).flatMap(event=>event.decks||[])];
  const model=Recommend.analyse({fieldRows:selected,candidates,evidence:{online:online.scopes['30'].matchups,irl:irl.matchups},matchupSource:'combined'});
  assert.ok(Math.abs(model.field.reduce((sum,item)=>sum+item.share,0)-1)<1e-12);
  assert.ok(model.all.some(item=>item.name==='Ogerpon Meganium Hydrapple'));
  assert.ok(model.all.some(item=>item.name==='Ogerpon Meganium Arboliva'));
  assert.ok(model.all.every(item=>Number.isFinite(item.expectedWR)));
});
