const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const json=relative=>JSON.parse(read(relative));

function harness(files){
  const buttons=[];
  const host={
    value:'',
    set innerHTML(value){this.value=value;buttons.length=0;for(const match of value.matchAll(/data-accuracy-event="([^"]+)"/g)){const button={dataset:{accuracyEvent:match[1]},addEventListener(type,fn){this[type]=fn}};buttons.push(button)}},
    get innerHTML(){return this.value},querySelectorAll:selector=>selector==='[data-accuracy-event]'?buttons:[],
  };
  const ids={accuracyContent:host};
  const listeners=new Map();
  const fetch=async input=>{const key=new URL(String(input)).pathname.split('/prediction-accuracy/')[1];const value=files[key];return value===undefined?new Response('',{status:404}):new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}})};
  const window={addEventListener(type,fn){listeners.set(type,fn)},MetaRouter:{get:()=>({view:'accuracy'})}};
  const context=vm.createContext({window,document:{getElementById:id=>ids[id]||null},location:{href:'https://example.test/ptcg-tools/v2-preview/apps/meta/'},fetch,URL,Response,Date,Number,String,Array,Object,Math,Set,Map,Promise,encodeURIComponent,console});
  vm.runInContext(read('v2-preview/apps/meta/prediction-accuracy.js'),context);
  return {window,host,buttons,listeners};
}

test('current accuracy page explains the honest pre-snapshot Worlds gap',async()=>{
  const index=json('data/meta/prediction-accuracy/index.json'),event=index.events[0],actual=json(`data/meta/prediction-accuracy/actuals/${event.currentActualId}.json`);
  const h=harness({'index.json':index,[`actuals/${event.currentActualId}.json`]:actual});
  await h.window.MetaAccuracy.activate();
  assert.match(h.host.innerHTML,/Waiting for the first score/);
  assert.match(h.host.innerHTML,/World Championship San Francisco/);
  assert.match(h.host.innerHTML,/792/);assert.match(h.host.innerHTML,/797/);assert.match(h.host.innerHTML,/99\.4%/);
  assert.match(h.host.innerHTML,/strictly before Day 1/);
});

test('scored history renders latest score, trend, misses, full detail and event switching',async()=>{
  const actual=id=>({actualId:`a${id}`,classifiedEntries:96,totalPlayers:100,coverage:.96});
  const evaluation=(id,score)=>({evaluationId:`e${id}`,snapshotPublishedAt:`2030-0${id}-09T12:00:00Z`,metrics:{fieldAccuracy:score,mae:2.4},topOver:[{name:`Over ${id}`,variance:4}],topUnder:[{name:`Under ${id}`,variance:-3}],rows:[{name:`Deck ${id}`,predicted:12,actual:9,variance:3}]});
  const events=[2,1].map(id=>({eventKey:`event-${id}`,name:`Major ${id}`,type:'regional',dayOneDate:`2030-0${id}-10`,format:'FMT',status:'scored',currentActualId:`a${id}`,currentEvaluationId:`e${id}`}));
  const files={'index.json':{events}};for(const id of [1,2]){files[`actuals/a${id}.json`]=actual(id);files[`evaluations/e${id}.json`]=evaluation(id,id===2?82:76)}
  const h=harness(files);await h.window.MetaAccuracy.activate();
  assert.match(h.host.innerHTML,/LATEST SCORE/);assert.match(h.host.innerHTML,/82\.0%/);assert.match(h.host.innerHTML,/polyline/);assert.match(h.host.innerHTML,/Over 2/);assert.match(h.host.innerHTML,/full predicted vs actual field/);
  h.buttons.find(button=>button.dataset.accuracyEvent==='event-1').click();
  assert.match(h.host.innerHTML,/Over 1/);assert.match(h.host.innerHTML,/76\.0%/);
});

test('accuracy route, assets and refresh-safe failure state remain wired',()=>{
  const html=read('v2-preview/apps/meta/index.html'),router=read('v2-preview/apps/meta/meta-router.js'),controls=read('v2-preview/apps/meta/meta-controls.js');
  assert.match(html,/data-meta-route="accuracy"/);assert.match(html,/id="accuracy"[^>]*hidden[^>]*inert/);assert.match(html,/prediction-accuracy\.js\?v=1/);assert.match(html,/prediction-accuracy\.css\?v=1/);
  assert.match(router,/accuracy:\s*'accuracy'/);assert.match(router,/MetaAccuracy\?\.activate/);assert.match(controls,/Prediction accuracy · IRL majors/);
});
