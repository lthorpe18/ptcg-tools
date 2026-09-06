import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { resolveCurrentFormats, formatForEvent } from '../scripts/lib/format-config.mjs';
import { distributionAccuracy, varianceDiagnostics, fitBestFormula } from '../scripts/lib/blended-model.mjs';

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

test('snapshot job only captures in the final local hour and never falls back to UTC',()=>{
  const script=read('scripts/update-blended-performance.mjs');
  const workflow=read('.github/workflows/update-blended-performance.yml');
  assert.match(script,/if\(!group\.timeZone\)/);
  assert.match(script,/local\.hour<23/);
  assert.doesNotMatch(script,/group\.timeZone\s*\|\|\s*['"]UTC['"]/);
  assert.match(workflow,/cron:\s*['"]37 \* \* \* \*['"]/);
});
