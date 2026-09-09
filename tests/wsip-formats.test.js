const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname,'..');
const read = file => fs.readFileSync(path.join(root,file),'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function element(id) {
  const listeners = new Map(), classes = new Set();
  return {id,value:'',innerHTML:'',hidden:false,textContent:'',dataset:{},disabled:false,
    classList:{contains:key=>classes.has(key),toggle:(key,on)=>on?classes.add(key):classes.delete(key)},
    addEventListener(type,fn) { listeners.set(type,[...(listeners.get(type)||[]),fn]); },
    fire(type) { for(const fn of listeners.get(type)||[])fn({target:this,currentTarget:this}); },
    querySelectorAll:()=>[],querySelector:()=>null, listeners,
  };
}
function harness({loadOverride,real=false}={}) {
  const ids=Object.fromEntries(['playFieldSource','playMatchupSource','playFieldFormat','playFieldFormatControl','prep','prepFieldOverview','prepResults','fieldEditor','fieldCoverage','advancedSettingsSummary'].map(id=>[id,element(id)]));
  ids.playFieldSource.value='blend';ids.playMatchupSource.value='combined';
  const listeners=new Map(),calls=[];
  const deck = (name,share) => ({name,share,entries:share,wins:20,losses:10,ties:0});
  const matchup = (a,b,wins=80,losses=20) => ({a,b,wins,losses,ties:0,games:wins+losses});
  // Deliberately synthetic names/formats: old/new favourable decks are opposites.
  const scopes = decks => Object.fromEntries(['14','30','all','since-major'].map(key=>[key,{decks:[...decks,deck('C',0),deck('D',0)],events:[{id:'online',players:60}],overview:{entries:100}}]));
  let core={release:'r1',format:'NEW',currentFormats:{online:{label:'NEW'},irl:{label:'OLD'}},online:{format:'NEW',scopes:scopes([deck('B',100)])},irl:{format:'OLD',events:[{id:'old-major',date:'2030-01-01',decks:[deck('A',100),deck('C',0),deck('D',0)]}]},archives:{online:{OLD:{format:'OLD',payloadPrefix:'archive:online:OLD:',scopes:scopes([deck('A',100)])}},irl:{}}};
  const matchups = rows => ({release:'r1',format:'NEW',scopes:Object.fromEntries(['14','30','all','since-major'].map(key=>[key,{matchups:rows}]))});
  let files={onlineMatchups:matchups([matchup('C','B'),matchup('D','B',20,80)]),irlMatchups:{release:'r1',format:'OLD',matchups:[matchup('C','A',20,80),matchup('D','A')]},'archive:online:OLD:Matchups':{...matchups([matchup('C','A',20,80),matchup('D','A')]),format:'OLD'}};
  if(real) {
    const manifest=JSON.parse(read('v2-preview/data/meta/release/manifest.json'));
    files=Object.fromEntries(Object.entries(manifest.files).map(([key,value])=>[key,JSON.parse(read('v2-preview/data/meta/release/'+value.path))]));
    core=files.core;
  }
  const context={document:{getElementById:id=>ids[id]||null,querySelectorAll:()=>[],querySelector:()=>null},console,Promise,Date,Set,Map,CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}}};
  context.window=context;
  context.addEventListener=(key,fn)=>listeners.set(key,[...(listeners.get(key)||[]),fn]);
  context.dispatchEvent=event=>{for(const fn of listeners.get(event.type)||[])fn(event)};
  context.MetaRelease={core:()=>core,ready:()=>Promise.resolve(core),load:async key=>{calls.push(key);return loadOverride?loadOverride(key,files[key]):files[key]}};
  context.SavedMetas={list:()=>[]};
  const sandbox=vm.createContext(context);
  for(const file of ['_shared/meta-field.js','_shared/recommendation-engine.js','meta/meta-core.js'])vm.runInContext(read('v2-preview/apps/'+file),sandbox);
  const predictions={NEW:{format:'NEW',available:true,rows:[{name:'B',share:1}],weights:{online:.75,irl:.25},evidence:{irl:{format:'OLD'}},revision:'synthetic-new'},OLD:{format:'OLD',available:true,rows:[{name:'A',share:1}],weights:{online:.3,irl:.7},revision:'synthetic-old'}};
  if(real)for(const file of ['_shared/meta-blend.js','meta/blended-field.js'])vm.runInContext(read('v2-preview/apps/'+file),sandbox);
  else context.MetaBlendedField={predictions:()=>Object.values(predictions),selected:()=>predictions.NEW,ensure:async()=>{}};
  for(const file of ['wsip-source.js','field-builder.js','prep.js'])vm.runInContext(read('v2-preview/apps/meta/'+file),sandbox);
  function choose(source,format) {
    ids.playFieldSource.value=source;ids.playFieldSource.fire('change');
    if(format){ids.playFieldFormat.value=format;ids.playFieldFormat.fire('change');}
  }
  return {context,ids,listeners,calls,predictions,files,choose,replace:value=>{core=value;context.dispatchEvent({type:'meta:release-core'})},get core(){return core}};
}

test('WSIP changes recommendations with the canonical target and excludes the old-format IRL prior from H2H',async()=>{
  const h=harness();await h.context.MetaPrep.activate();await tick();
  let model=h.context.MetaPrep.buildModel();
  assert.equal(h.context.PrepField.definition().format,'NEW');
  assert.equal(model.ranked[0].name,'C');
  assert.equal(h.context.MetaWSIPSource.inputs(h.context.PrepField.definition()).evidence.irl.length,0);
  assert.equal(h.calls.includes('irlMatchups'),false);
  h.choose('blend','OLD');await h.context.MetaPrep.activate();await tick();
  model=h.context.MetaPrep.buildModel();assert.equal(model.ranked[0].name,'D');
  assert.ok(h.calls.includes('archive:online:OLD:Matchups'));assert.ok(h.calls.includes('irlMatchups'));
  assert.equal(h.context.MetaData.sourceFormat('online'),'NEW');
  assert.equal(h.context.MetaData.sourceFormat('irl'),'OLD');
  assert.match(h.ids.prepFieldOverview.innerHTML,/OLD/);
});

test('WSIP Online and IRL field selectors preserve target-specific rows and H2H sources',async()=>{
  const h=harness();h.choose('online','OLD');await h.context.MetaPrep.activate();await tick();
  assert.equal(h.context.PrepField.getField()[0].name,'A');
  h.choose('online','NEW');await h.context.MetaPrep.activate();await tick();
  assert.equal(h.context.PrepField.getField()[0].name,'B');
  h.choose('irl','OLD');h.ids.playMatchupSource.value='irl';h.ids.playMatchupSource.fire('change');await h.context.MetaPrep.activate();await tick();
  assert.equal(h.context.PrepField.getField()[0].name,'A');
  const inputs=h.context.MetaWSIPSource.inputs(h.context.PrepField.definition(),'irl');
  assert.equal(inputs.evidence.online.length,0);assert.equal(inputs.evidence.irl.length,2);
});

test('unknown compatible matchups stay unknown and an unavailable prediction yields no recommendations',async()=>{
  const h=harness();h.predictions.NEW.rows=[{name:'B',share:.8},{name:'No evidence',share:.2}];
  await h.context.MetaPrep.activate();await tick();
  const model=h.context.MetaPrep.buildModel(),row=model.all.find(row=>row.name==='C');
  assert.equal(row.coverage,.8);assert.equal(row.matchups.find(row=>row.opponent==='No evidence').known,false);
  h.predictions.NEW.available=false;h.predictions.NEW.reason='Waiting for compatible tournaments';
  h.context.dispatchEvent({type:'meta:data-changed'});await tick();
  assert.equal(h.context.MetaPrep.buildModel().ranked.length,0);
  assert.match(h.ids.prepResults.innerHTML,/Waiting for compatible tournaments/);
  assert.doesNotMatch(h.ids.prepResults.innerHTML,/recommendation-card/);
  assert.equal(h.context.MetaWSIPSource.select('NEW'),false);
  h.predictions.NEW.available=true;h.predictions.NEW.reason='';h.context.dispatchEvent({type:'meta:data-changed'});await tick();
  assert.ok(h.context.MetaPrep.buildModel().ranked.length>0);
});

test('WSIP rejects wrong-format payloads and retries without adding persistent handlers',async()=>{
  let fail=true;
  const h=harness({loadOverride:async(key,payload)=>fail?{...payload,format:'WRONG'}:payload});
  const count=()=>[...h.listeners.values()].reduce((sum,rows)=>sum+rows.length,0);
  const initial=count();await h.context.MetaPrep.activate();await tick();
  assert.match(h.ids.prepResults.innerHTML,/Compatible evidence could not load/);
  assert.equal(h.context.MetaData.dataForFormat('online','NEW').matchups.length,0);
  fail=false;await h.context.MetaPrep.activate(true);await tick();
  assert.match(h.ids.prepResults.innerHTML,/recommendation-card/);
  for(let n=0;n<8;n++){h.choose('blend',n%2?'NEW':'OLD');await h.context.MetaPrep.activate();await tick();}
  assert.equal(count(),initial);assert.equal(h.ids.playFieldFormat.listeners.get('change').length,1);
});

test('late target loads cannot overwrite current WSIP analysis, and stale releases are discarded',async()=>{
  let deliver;
  const h=harness({loadOverride:(key,payload)=>key==='onlineMatchups'?new Promise(resolve=>{deliver=()=>resolve(payload)}):Promise.resolve(payload)});
  const pending=h.context.MetaPrep.activate();await tick();
  h.choose('blend','OLD');await h.context.MetaPrep.activate();await tick();deliver();await pending;await tick();
  assert.equal(h.context.PrepField.definition().format,'OLD');assert.equal(h.context.MetaPrep.buildModel().ranked[0].name,'D');
  let deliverOld;
  const next=harness({loadOverride:(key,payload)=>new Promise(resolve=>{deliverOld=()=>resolve(payload)})});
  next.ids.prep.classList.toggle('hidden',true);
  const old=next.context.MetaData.ensureForFormat('online','NEW');await tick();next.replace({...next.core,release:'r2'});await tick();deliverOld();await old;
  assert.equal(next.context.MetaData.dataForFormat('online','NEW').matchups.length,0);
});

test('saved field with unknown format is preserved but receives no borrowed H2H',async()=>{
  const h=harness();h.context.PrepField.applyExpectedField({name:'Legacy unknown',field:[{name:'B',share:1}]});await h.context.MetaPrep.activate();
  assert.equal(h.context.PrepField.getField()[0].name,'B');assert.equal(h.context.PrepField.definition().format,null);
  assert.equal(h.context.MetaPrep.buildModel().ranked.length,0);
  assert.equal(h.context.MetaWSIPSource.inputs(h.context.PrepField.definition()).evidence.online.length,0);
});

test('real release WSIP uses the same canonical prediction and recommendation engine',async()=>{
  const h=harness({real:true});await h.context.MetaPrep.activate();await tick();
  const definition=h.context.PrepField.definition(),prediction=h.context.MetaBlendedField.selected();
  assert.equal(definition.format,prediction.format);assert.equal(definition.provenance.revision,prediction.revision);
  assert.equal(JSON.stringify(definition.rows),JSON.stringify(h.context.PTCGMetaField.normalizeRows(prediction.rows)));
  assert.equal(JSON.stringify(definition.provenance.weights),JSON.stringify(prediction.weights));
  const inputs=h.context.MetaWSIPSource.inputs(definition,'combined');
  const expected=h.context.PTCGRecommendation.analyse({fieldRows:h.context.PrepField.getField(),...inputs,matchupSource:'combined'});
  assert.equal(JSON.stringify(h.context.MetaPrep.buildModel()),JSON.stringify(expected));
  assert.ok(expected.ranked.length>5);
  assert.equal((h.ids.prepResults.innerHTML.match(/data-open-deck-card=/g)||[]).length,5);
  assert.match(h.ids.prepResults.innerHTML,/Why this deck\?/);assert.match(h.ids.prepResults.innerHTML,/Unknown/);
});
