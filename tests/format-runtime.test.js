const test=require('node:test');
const assert=require('node:assert/strict');
const runtime=require('../v2-preview/apps/_shared/format-runtime.js');
const format=require('../v2-preview/apps/_shared/format-resolver.js');
const maintained=require('../data/formats/maintained-calendar.json');

const clone=value=>JSON.parse(JSON.stringify(value));
function calendar(registry=maintained,source='test-calendar'){
  return {load:async()=>({source,status:'published',versionNumber:7,publishedAt:'2026-09-14T12:00:00Z',registry:clone(registry)})};
}

test('runtime exposes maintained Online and IRL transitions from one shared calendar',async()=>{
  await runtime.refresh({force:true,calendar:calendar(),format});
  assert.equal(runtime.currentFormat('2026-09-14','online').label,'TEF-PBL');
  assert.equal(runtime.currentFormat('2026-09-14','irl').label,'TEF-PBL');
  assert.equal(runtime.currentFormat('2026-09-15','online').label,'TEF-30C');
  assert.equal(runtime.currentFormat('2026-09-15','online').effectiveDate,'2026-09-15');
  assert.equal(runtime.currentFormat('2026-09-23','irl').label,'TEF-PBL');
  assert.equal(runtime.currentFormat('2026-09-24','irl').label,'TEF-30C');
  assert.equal(runtime.currentFormat('2026-09-24','irl').effectiveDate,'2026-09-24');
  assert.equal(runtime.revision(),maintained.revision);
});

test('runtime delegates card legality to the same maintained resolver',async()=>{
  await runtime.refresh({force:true,calendar:calendar(),format});
  assert.equal(runtime.resolveCardLegality({regulationMark:'H'},{date:'2026-09-15',environment:'online'}).status,'legal');
  assert.equal(runtime.resolveCardLegality({regulationMark:'G'},{date:'2026-09-15',environment:'online'}).status,'illegal');
  assert.equal(runtime.resolveCardLegality({regulationMark:'H'},{date:'2026-09-24',environment:'irl'}).status,'legal');
  assert.equal(runtime.currentFormat('not-a-date','online'),null);
  assert.equal(runtime.currentFormat('2026-09-15','other'),null);
});

test('forced refresh replaces the active calendar instead of retaining stale format facts',async()=>{
  await runtime.refresh({force:true,calendar:calendar(),format});
  const updated=clone(maintained);
  updated.revision='test-later-online-date';
  updated.sets[0].legality.online.value='2026-09-18';
  await runtime.refresh({force:true,calendar:calendar(updated,'updated-calendar'),format});
  assert.equal(runtime.snapshot().source,'updated-calendar');
  assert.equal(runtime.revision(),'test-later-online-date');
  assert.equal(runtime.currentFormat('2026-09-15','online').label,'TEF-PBL');
  assert.equal(runtime.currentFormat('2026-09-18','online').label,'TEF-30C');
});