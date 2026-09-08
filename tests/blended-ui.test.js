const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root=path.resolve(__dirname,'..');
function element(id='') {
  const listeners=new Map(),classes=new Set();
  return {id,hidden:false,innerHTML:'',textContent:'',value:'',checked:false,dataset:{},
    classList:{toggle(name,on){on?classes.add(name):classes.delete(name)},contains:name=>classes.has(name)},
    addEventListener(type,fn){listeners.set(type,fn)},fire(type,event={}){listeners.get(type)?.({currentTarget:this,target:this,...event})},
  };
}

test('Meta Blended switches targets and changes an unavailable target to available without reinitialising',async()=>{
  const ids=Object.fromEntries(['currentGroupingToggle','currentMetaSearch','currentWindow','blendTargetControl','blendTargetSelect','blendMethod','blendMethodBody','currentMetaStats','currentMetaList','currentMetaMore'].map(id=>[id,element(id)]));
  const buttons=['online','irl','blend'].map(source=>{const item=element();item.dataset.currentSource=source;if(source==='online')item.classList.toggle('active',true);return item});
  const listeners=new Map();
  let available=false,selected='NEW';
  const makePrediction=format=>({version:'blended-v2.1',format,available:format==='OLD'||available,status:format==='OLD'?'Frozen':'Unavailable',reason:format==='OLD'||available?null:'Waiting for evidence',rule:'synthetic',rows:format==='OLD'||available?[{name:'A',share:1}]:[],weights:format==='OLD'?{irl:.5,online:.5}:available?{irl:.25,online:.75}:{irl:0,online:0},evidence:{online:{source:'online',format,eventCount:1,events:[]},irl:null}});
  const context={
    window:null,document:{getElementById:id=>ids[id]||null,querySelectorAll:selector=>selector==='[data-current-source]'?buttons:[],querySelector:()=>null},
    CustomEvent:class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}},
    setTimeout,clearTimeout,Promise,Date,Math,Number,String,Array,Object,Set,Map,console,
  };
  context.window=context;
  context.MetaBlendedField={predictions:()=>['NEW','OLD'].map(makePrediction),selected:()=>makePrediction(selected),select:value=>(selected=value,true),ensure:()=>Promise.resolve()};
  context.MetaData={data:()=>({decks:[]}),context:()=>({})};
  context.MetaRouter={get:()=>({view:'current'})};
  context.DeckSprites={html:()=>''};
  context.addEventListener=(type,fn)=>{const rows=listeners.get(type)||[];rows.push(fn);listeners.set(type,rows)};
  context.dispatchEvent=event=>{for(const fn of listeners.get(event.type)||[])fn(event)};
  vm.runInContext(fs.readFileSync(path.join(root,'v2-preview/apps/meta/meta-home.js'),'utf8'),vm.createContext(context));
  buttons[2].fire('click');
  assert.equal(ids.blendTargetControl.hidden,false);
  assert.match(ids.currentMetaStats.innerHTML,/NEW · unavailable/);
  assert.match(ids.currentMetaList.innerHTML,/No data is available/);
  assert.match(ids.blendMethodBody.innerHTML,/Waiting for evidence/);
  available=true;context.dispatchEvent(new context.CustomEvent('meta:data-changed'));
  assert.match(ids.currentMetaStats.innerHTML,/25%/);assert.match(ids.currentMetaList.innerHTML,/Blended current-field share/);
  ids.blendTargetSelect.value='OLD';ids.blendTargetSelect.fire('change');
  assert.match(ids.currentMetaStats.innerHTML,/OLD · Frozen/);assert.equal(ids.blendTargetSelect.value,'OLD');
});
