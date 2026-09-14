const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

function ordered(text,...parts){
  let at=-1;
  for(const part of parts){const next=text.indexOf(part);assert.ok(next>at,`${part} should appear after the preceding dependency`);at=next}
}

test('Home, Meta and Event Prep load the shared format runtime before consuming current formats',()=>{
  const home=read('v2-preview/home-content.html');
  ordered(home,'cloud-sync.js','format-resolver.js','format-calendar-store.js','format-runtime.js','scripts/home.js');
  const meta=read('v2-preview/apps/meta/index.html');
  ordered(meta,'format-resolver.js','cloud-sync.js','format-calendar-store.js','format-runtime.js','meta-core.js','meta-format-context.js','meta-blend.js','blended-field.js','wsip-source.js');
  const prep=read('v2-preview/apps/events/prep.html');
  ordered(prep,'format-resolver.js','cloud-sync.js','format-calendar-store.js','format-runtime.js','meta-core.js','meta-format-context.js','meta-blend.js','blended-field.js','wsip-source.js','prep-field.js');
});

test('Event Prep no longer owns a calendar fetch or private calendar cache',()=>{
  const source=read('v2-preview/apps/events/prep-field.js');
  assert.doesNotMatch(source,/maintained-calendar\.json/);
  assert.doesNotMatch(source,/ptcg:event-prep:calendar/);
  assert.match(source,/PTCGFormatRuntime/);
});

test('Meta current-format and Blended context are overlaid from the runtime without mutating packaged evidence',async()=>{
  const listeners=new Map(),events=[];
  let formats={online:{label:'TEF-30C',effectiveDate:'2026-09-15'},irl:{label:'TEF-PBL'}};
  const runtime={EVENT_NAME:'ptcg:format-runtime-updated',today:()=> '2026-09-15',currentFormats:()=>formats,currentFormat:(_,env)=>formats[env]||null,revision:()=> 'runtime-r1',ready:async()=>({})};
  const packaged={asOf:'2026-09-14',currentFormats:{online:{label:'TEF-PBL'},irl:{label:'TEF-PBL'}},calendarRevision:'packaged-r0',online:{},irl:{}};
  const context={console,PTCGFormatRuntime:runtime,MetaData:{currentFormat:env=>packaged.currentFormats[env],blendEvidence:()=>packaged},
    addEventListener:(type,fn)=>listeners.set(type,[...(listeners.get(type)||[]),fn]),dispatchEvent:event=>events.push(event),
    CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}},setTimeout};
  context.window=context;context.globalThis=context;
  vm.runInContext(read('v2-preview/apps/meta/meta-format-context.js'),vm.createContext(context));
  assert.equal(context.MetaData.currentFormat('online').label,'TEF-30C');
  const evidence=context.MetaData.blendEvidence();
  assert.equal(evidence.currentFormats.online.label,'TEF-30C');
  assert.equal(evidence.currentFormats.irl.label,'TEF-PBL');
  assert.equal(evidence.calendarRevision,'runtime-r1');
  assert.equal(packaged.currentFormats.online.label,'TEF-PBL','release evidence stays immutable');
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(events.some(event=>event.type==='meta:data-changed'));
});

test('Home feeds runtime formats into the Blended model rather than changing display text only',()=>{
  const source=read('v2-preview/scripts/home.js');
  assert.match(source,/currentFormats:\{online:current\?\.online\|\|core\?\.currentFormats/);
  assert.match(source,/calendarRevision:window\.PTCGFormatRuntime\?\.revision/);
  assert.match(source,/runtime\.EVENT_NAME/);
});