import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { resolveCurrentFormats, formatForEvent } from '../scripts/lib/format-config.mjs';
import { distributionAccuracy, varianceDiagnostics, fitBestFormula } from '../scripts/lib/blended-model.mjs';
import { buildRelease } from '../scripts/build-meta-release.mjs';

const root=path.resolve(import.meta.dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

const sets=[
  {setCode:'TEF',setTitle:'Temporal Forces',releaseOrder:1,onlineLegalDate:'2026-01-01',irlLegalDate:'2026-01-01',isRotationSet:false},
  {setCode:'PBL',setTitle:'Pitch Black',releaseOrder:2,onlineLegalDate:'2026-07-31',irlLegalDate:'2026-07-31',isRotationSet:false},
  {setCode:'NEW',setTitle:'New Set',releaseOrder:3,onlineLegalDate:'2026-09-01',irlLegalDate:'2026-09-05',isRotationSet:false},
  {setCode:'ROT',setTitle:'Rotation Set',releaseOrder:4,onlineLegalDate:'2026-10-01',irlLegalDate:'2026-10-05',isRotationSet:true,rotationLowerSetCode:'PBL'},
];

function loadBlend(runtime=null){
  const context=vm.createContext({Date,Map,Math,Number,String,Array,Object,Set,console});
  if(runtime)context.PTCGFormatRuntime={current:()=>runtime};
  vm.runInContext(read('v2-preview/apps/_shared/meta-blend.js'),context);
  return context.PTCGMetaBlend;
}

function loadMetaField(){
  const context=vm.createContext({Date,Map,Math,Number,String,Array,Object,Set,console});
  vm.runInContext(read('v2-preview/apps/_shared/meta-field.js'),context);
  return context.PTCGMetaField;
}

function core({onlineFormat='TEF-PBL',irlFormat='TEF-PBL',rotation=false,onlineDecks=[{name:'Online A',share:60},{name:'Online B',share:40}],irlEvents=[{date:'2026-08-29',endDate:'2026-08-30',decks:[{name:'IRL A',entries:70},{name:'IRL B',entries:30}]}],cutoff='2026-08-31T00:00:00Z'}={}){
  return {
    format:onlineFormat,
    config:{
      onlineFormat:{id:onlineFormat,isRotationStart:rotation},
      irlFormat:{id:irlFormat},
      formula:{versionKey:'blended-v2',irlStartWeight:.70,irlDecayPerDay:.02,irlFloor:.30,previousFormatCap:.25,transitionPolicy:'format-aware-v2'},
    },
    online:{format:onlineFormat,majorWeekend:{cutoff},scopes:{'since-major':{decks:onlineDecks}}},
    irl:{format:irlFormat,events:irlEvents},
  };
}

test('Online and IRL formats can diverge around a normal set release',()=>{
  const config={sets};
  const current=resolveCurrentFormats(config,new Date('2026-09-03T12:00:00Z'));
  assert.equal(current.online.id,'TEF-NEW');
  assert.equal(current.irl.id,'TEF-PBL');
});

test('rotation advances the lower bound only when that channel becomes legal',()=>{
  const config={sets};
  const duringGap=resolveCurrentFormats(config,new Date('2026-10-02T12:00:00Z'));
  assert.equal(duringGap.online.id,'PBL-ROT');
  assert.equal(duringGap.irl.id,'TEF-NEW');
  assert.equal(formatForEvent(config,'2026-10-06').id,'PBL-ROT');
});

test('normal set transition caps immediately previous-format IRL at 25%',()=>{
  const blend=loadBlend({online:{id:'TEF-NEW',isRotationStart:false},irl:{id:'TEF-PBL'},formula:{versionKey:'blended-v2',irlStartWeight:.70,irlDecayPerDay:.02,irlFloor:.30,previousFormatCap:.25}});
  const result=blend.currentFromCore(core({onlineFormat:'TEF-NEW',irlFormat:'TEF-PBL'}),{now:new Date('2026-09-01T12:00:00Z')});
  assert.equal(result.available,true);
  assert.equal(result.transitionState,'previous-format-prior');
  assert.equal(result.weights.irl,.25);
  assert.equal(result.weights.online,.75);
});

test('rotation forbids previous-format IRL immediately',()=>{
  const blend=loadBlend({online:{id:'PBL-ROT',isRotationStart:true},irl:{id:'TEF-NEW'},formula:{versionKey:'blended-v2',irlStartWeight:.70,irlDecayPerDay:.02,irlFloor:.30,previousFormatCap:.25}});
  const result=blend.currentFromCore(core({onlineFormat:'PBL-ROT',irlFormat:'TEF-NEW',rotation:true}),{now:new Date('2026-10-01T12:00:00Z')});
  assert.equal(result.available,true);
  assert.equal(result.transitionState,'rotation-online-only');
  assert.equal(result.weights.irl,0);
  assert.equal(result.weights.online,1);
});

test('mature current-format Blended uses 70%-2pp/day-30% curve from final Major day',()=>{
  const blend=loadBlend({online:{id:'TEF-PBL',isRotationStart:false},irl:{id:'TEF-PBL'},formula:{versionKey:'blended-v2',irlStartWeight:.70,irlDecayPerDay:.02,irlFloor:.30,previousFormatCap:.25}});
  const result=blend.currentFromCore(core({onlineFormat:'TEF-PBL',irlFormat:'TEF-PBL',cutoff:'2026-09-01T00:00:00Z'}),{now:new Date('2026-09-10T12:00:00Z')});
  assert.equal(result.transitionState,'current-format-major');
  assert.equal(result.daysSinceMajor,10);
  assert.ok(Math.abs(result.weights.irl-.50)<1e-12);
  assert.ok(Math.abs(result.weights.online-.50)<1e-12);
});

test('Blended refuses a prepared Meta release from the wrong Online format',()=>{
  const blend=loadBlend({online:{id:'TEF-NEW',isRotationStart:false},irl:{id:'TEF-PBL'},formula:{versionKey:'blended-v2',irlStartWeight:.70,irlDecayPerDay:.02,irlFloor:.30,previousFormatCap:.25}});
  const result=blend.currentFromCore(core({onlineFormat:'TEF-PBL',irlFormat:'TEF-PBL'}));
  assert.equal(result.available,false);
  assert.match(result.reason,/TEF-NEW/);
  assert.equal(Array.isArray(result.rows),true);
  assert.equal(result.rows.length,0);
  assert.equal(result.weights.irl,0);
  assert.equal(result.weights.online,0);
});

test('Blended is unavailable without a qualifying current-format Online event',()=>{
  const blend=loadBlend({online:{id:'TEF-PBL',isRotationStart:false},irl:{id:'TEF-PBL'},formula:{versionKey:'blended-v2',irlStartWeight:.70,irlDecayPerDay:.02,irlFloor:.30,previousFormatCap:.25}});
  const result=blend.currentFromCore(core({onlineDecks:[]}));
  assert.equal(result.available,false);
  assert.match(result.reason,/50\+ player Online event/);
});

test('distribution accuracy is 100% minus total variation distance',()=>{
  const predicted=[{name:'A',share:.40},{name:'B',share:.30},{name:'C',share:.30}];
  const actual=[{name:'A',share:.35},{name:'B',share:.35},{name:'C',share:.30}];
  assert.ok(Math.abs(distributionAccuracy(predicted,actual)-.95)<1e-12);
});

test('unclassified actual share stays in the accuracy denominator',()=>{
  const predicted=[{name:'A',share:1}];
  const actual=[{name:'A',share:.8},{name:'Unknown',share:.2}];
  assert.ok(Math.abs(distributionAccuracy(predicted,actual)-.8)<1e-12);
  const diagnostics=varianceDiagnostics(predicted,actual,{threshold:.01,limit:10});
  const unknown=diagnostics.allMisses.find(row=>row.name==='Unknown');
  assert.ok(unknown);
  assert.ok(Math.abs(unknown.actualShare-.2)<1e-12);
});

test('diagnostics include any exact variant at or above the 1% threshold',()=>{
  const diagnostics=varianceDiagnostics(
    [{name:'A',share:.985},{name:'Tiny',share:.005},{name:'Predicted',share:.010}],
    [{name:'A',share:.975},{name:'Tiny',share:.005},{name:'Actual surprise',share:.020}],
    {threshold:.01,limit:10},
  );
  const names=new Set(diagnostics.allMisses.map(row=>row.name));
  assert.equal(names.has('Tiny'),false);
  assert.equal(names.has('Predicted'),true);
  assert.equal(names.has('Actual surprise'),true);
});

test('best-fit formula uses all completed observations and cannot score worse than live',()=>{
  const live={irlStartWeight:.70,irlDecayPerDay:.02,irlFloor:.30,previousFormatCap:.25};
  const observations=[{
    transitionState:'current-format-major',daysSinceMajor:10,previousFormatCap:.25,
    irlInput:[{name:'A',share:1}],onlineInput:[{name:'B',share:1}],actualField:[{name:'A',share:.40},{name:'B',share:.60}],
  }];
  const fit=fitBestFormula(observations,live);
  assert.equal(fit.dataPoints,1);
  assert.ok(fit.bestAccuracy>=fit.liveAccuracy-1e-12);
  assert.ok(fit.bestFormula.irlFloor<=fit.bestFormula.irlStartWeight);
});

test('Major evaluation requires an explicit full Day 1 field marker',()=>{
  const ingest=read('scripts/update-irl-labs.mjs');
  const performance=read('scripts/update-blended-performance.mjs');
  const validator=read('scripts/validate-current-irl.mjs');
  assert.match(ingest,/day1FieldComplete\s*=\s*Number\(meta\.players/);
  assert.match(ingest,/unclassifiedEntries/);
  assert.match(performance,/event\.day1FieldComplete!==true/);
  assert.match(performance,/actualFieldEntries!==actualPlayers/);
  assert.match(performance,/actualFieldComplete=true/);
  assert.match(validator,/explicit Day 1 field completeness marker/);
});

test('snapshot job only captures in the final local hour and never falls back to UTC',()=>{
  const script=read('scripts/update-blended-performance.mjs');
  const workflow=read('.github/workflows/update-blended-performance.yml');
  assert.match(script,/if\(!group\.timeZone\)/);
  assert.match(script,/local\.hour<23/);
  assert.doesNotMatch(script,/group\.timeZone\s*\|\|\s*['"]UTC['"]/);
  assert.match(workflow,/cron:\s*['"]37 \* \* \* \*['"]/);
});

test('prepared Meta core embeds the set registry for offline event-date format resolution',()=>{
  const runtimeConfig={source:'test',formatRegistryVersion:3,formatRegistryId:'registry',sets,liveFormula:{versionKey:'blended-v2'}};
  const formats={online:{id:'TEF-PBL'},irl:{id:'TEF-PBL'},previousOnline:null,previousIrl:null};
  const built=buildRelease({
    online:{format:'TEF-PBL',generatedAt:'2026-09-06T00:00:00Z',tournaments:[],matchupScopes:{}},
    irl:{format:'TEF-PBL',events:[],decks:[],matchups:[],results:[]},
    deckAggregate:{decks:[],matchups:[],overview:{}},
    onlineResults:{results:[]},runtimeConfig,formats,
  });
  assert.equal(built.files.core.schemaVersion,2);
  assert.equal(built.files.core.config.registryVersion,3);
  assert.deepEqual(built.files.core.config.sets.map(row=>row.setCode),sets.map(row=>row.setCode));
  assert.equal(built.files.core.config.sets.at(-1).rotationLowerSetCode,'PBL');
});

test('shared shell loader uses stable data attributes and recognises the Meta-owned format runtime',()=>{
  const shell=read('v2-preview/apps/_shared/app-shell.js');
  assert.match(shell,/data-ptcg-loader/);
  assert.match(shell,/data-ptcg-style/);
  assert.match(shell,/script\[data-format-runtime\]/);
  assert.match(shell,/script\.dataset\.formatRuntime='1'/);
  assert.doesNotMatch(shell,/script\[data-\$\{key\}\]/);
});

test('Meta Blended addon loader is idempotent with camelCase keys',()=>{
  const addon=read('v2-preview/apps/meta/blended-field.js');
  assert.match(addon,/data-meta-addon/);
  assert.match(addon,/script\.dataset\.metaAddon=key/);
  assert.doesNotMatch(addon,/script\[data-\$\{key\}\]/);
});

test('historical formulas must create a new draft instead of direct reactivation',()=>{
  const admin=read('v2-preview/apps/settings/format-admin.js');
  assert.match(admin,/Draft from this/);
  assert.match(admin,/data-draft-from/);
  assert.match(admin,/createFormulaDraft/);
  assert.doesNotMatch(admin,/data-reactivate|Reactivate this historical|reactivateFormula\(/);
});

test('Blended saved-field provenance retains format, formula and availability context',()=>{
  const field=loadMetaField();
  const resolved=field.resolve({source:'blend',meta:{},blended:{
    available:false,reason:'Waiting for current-format evidence.',rows:[],weights:{irl:0,online:0},configuredWeights:{irl:.25,online:.75},
    onlineScope:'since-major',irlScope:'latest-weekend',daysSinceMajor:2,majorDate:'2026-09-01',majorFinalDate:'2026-09-02',
    formula:{versionKey:'blended-v4',irlStartWeight:.6},format:'PBL-NEW',irlFormat:'TEF-PBL',transitionState:'unavailable',earlyFormat:true,generatedAt:'2026-09-06T12:00:00Z',
  }});
  assert.equal(resolved.provenance.available,false);
  assert.equal(resolved.provenance.unavailableReason,'Waiting for current-format evidence.');
  assert.equal(resolved.provenance.formulaVersion,'blended-v4');
  assert.equal(resolved.provenance.format,'PBL-NEW');
  assert.equal(resolved.provenance.irlFormat,'TEF-PBL');
  assert.equal(resolved.provenance.transitionState,'unavailable');
  assert.equal(resolved.provenance.earlyFormat,true);
  assert.equal(resolved.provenance.generatedAt,'2026-09-06T12:00:00Z');
  assert.equal(resolved.provenance.configuredWeights.irl,.25);
});
