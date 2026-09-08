'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
const engine = require('../v2-preview/apps/_shared/format-resolver.js');
const fixture = require('./fixtures/format-synthetic.json');
const seed = require('../data/formats/verified-seed.json');
const copy = value => JSON.parse(JSON.stringify(value));
const make = mutate => { const r = copy(fixture); if (mutate) mutate(r); return engine.create(r); };
const ids = rows => rows.map(r => r.id).sort();

test('fixture validation distinguishes verified evidence from synthetic rules', () => {
  assert.deepEqual(engine.validate(seed), []);
  assert.deepEqual(engine.validate(fixture), []);
  assert.equal(make().resolve('2030-01-20').fixtureKind, 'synthetic');
  assert.equal(engine.create(seed).resolve('2026-03-26').fixtureKind, 'verified-seed');
});
test('normal date has a complete shared pool identity, not an environment label', () => {
  const r = make().resolve('2030-01-20');
  assert.equal(r.status, 'known');
  assert.deepEqual(r.releasedSets, ['OLD', 'BASE']);
  assert.deepEqual(ids(r.environments.online.legalSets), ['BASE','OLD']);
  assert.equal(r.environments.online.format.id, r.environments.irl.format.id);
});
test('before/at/after Online boundary; release and IRL stay independent', () => {
  const resolver = make();
  for (const [day, count] of [['2030-01-31',2],['2030-02-01',4],['2030-02-02',4]]) {
    const r = resolver.resolve(day);
    assert.equal(r.environments.online.legalSets.length,count);
    assert.equal(r.environments.irl.legalSets.length,2);
    assert.equal(r.releasedSets.length,day === '2030-02-02' ? 4 : 2);
  }
  const r = resolver.resolve('2030-02-01');
  assert.notEqual(r.environments.online.format.id,r.environments.irl.format.id);
  assert.equal(r.environments.irl.nextChange.date,'2030-02-15');
  assert.equal(r.nextRelease.date,'2030-02-02');
  assert.deepEqual(ids(r.nextRelease.changes), ['A','B']);
});
test('simultaneous sets survive before/at/after IRL adoption', () => {
  for (const [day,count] of [['2030-02-14',2],['2030-02-15',4],['2030-02-16',4]]) {
    const r = make().resolve(day);
    assert.equal(r.environments.irl.legalSets.length,count);
    assert.equal(r.environments.online.format.id === r.environments.irl.format.id, count === 4);
  }
});
test('rotation without a release; Online and IRL independently before/at/after', () => {
  const resolver = make();
  for (const [day,online,irl] of [['2030-02-28','G','G'],['2030-03-01','H','G'],['2030-03-02','H','G'],['2030-03-14','H','G'],['2030-03-15','H','H'],['2030-03-16','H','H']]) {
    const r=resolver.resolve(day);
    assert.equal(r.environments.online.boundary.lowestMark,online);
    assert.equal(r.environments.irl.boundary.lowestMark,irl);
    assert.equal(r.releasedSets.length,4);
    assert.equal(ids(r.environments.online.legalSets).includes('OLD'), online==='G');
  }
});
test('mixed-mark sets retain only the permitted portion and exceptions affect identity', () => {
  const resolver=make(r=> {r.sets[0].marks.value=['G','H'];});
  assert.deepEqual(resolver.resolve('2030-03-16').environments.online.legalSets.find(s=>s.id==='OLD').legalMarks,['H']);
  const changed=make(r=>{for(const env of ['online','irl']) r.rotations[env][0].exceptions.value=['synthetic-reprint-rule-v2'];});
  assert.notEqual(changed.resolve('2030-01-20').environments.online.format.id,make().resolve('2030-01-20').environments.online.format.id);
});
test('missing history/lower boundary never inferred from first set or calendar year', () => {
  const r=make().resolve('2029-12-31');
  assert.equal(r.environments.online.boundary,null);
  assert.equal(r.environments.online.format.id,null);
  const missing=make(r=>{r.rotations.online=[];}).resolve('2030-01-20');
  assert.equal(missing.environments.online.boundary,null);
  const gap=make(r=>{r.coverage.online.complete=false;}).resolve('2030-01-20');
  assert.equal(gap.environments.online.boundary,null);
});
test('verified explicit set pool boundary requires no invented mark or first row', () => {
  const r=make(r=>{r.rotations.online[0].boundary.value={setIds:['BASE']};}).resolve('2030-01-20');
  assert.deepEqual(ids(r.environments.online.legalSets),['BASE']);
  assert.equal(r.environments.online.boundary.lowestMark,undefined);
});
test('missing legality dates remain unknown; release never supplies legality', () => {
  const r=make(r=>{r.sets[0].legality.online={value:null,status:'unknown',sources:[],convention:'calendar-day-inclusive'};}).resolve('2030-01-20');
  assert.equal(r.environments.online.unknownSets[0].reason,'legality-date-unknown');
  assert.equal(r.environments.online.format.id,null);
  assert.ok(r.environments.irl.format.id);
  assert.equal(r.environments.online.nextChange.certainty,'ordering-unknown');
});
test('announced undated set preserves established present facts but qualifies next change', () => {
  const resolver=make(r=>{
    const s=copy(r.sets[2]); s.id='ANN'; s.release={...s.release,value:null,status:'announced'};
    for(const env of ['online','irl']) s.legality[env]={...s.legality[env],value:null,status:'unknown'};
    r.sets.push(s);
  });
  const r=resolver.resolve('2030-01-20');
  assert.ok(r.environments.online.format.id);
  assert.equal(r.sets.find(s=>s.id==='ANN').release,'announced');
  assert.equal(r.environments.online.nextChange.date,'2030-02-01');
  assert.equal(r.environments.online.nextChange.certainty,'ordering-unknown');
  assert.equal(r.nextRelease.certainty,'ordering-unknown');
});
test('undated rotation is not silently ordered after a later dated change', () => {
  const r=make(r=>{r.rotations.online.push({...copy(r.rotations.online[1]),id:'unknown',effective:{value:null,status:'announced',sources:[],convention:'calendar-day-inclusive'}});}).resolve('2030-01-20');
  assert.equal(r.environments.online.nextChange.certainty,'ordering-unknown');
  assert.equal(r.environments.online.boundary.lowestMark,'G');
  assert.equal(r.environments.online.format.id,null);
});
test('missing marks, exceptions and catalog are separately explicit', () => {
  for(const mutate of [r=>r.sets[0].marks={value:null,status:'unknown',sources:[]},r=>r.rotations.online[0].exceptions={value:null,status:'unknown',sources:[]},r=>r.coverage.catalog.complete=false]) {
    const r=make(mutate).resolve('2030-01-20');
    assert.equal(r.environments.online.format.id,null);
    assert.equal(r.environments.online.boundary.lowestMark,'G');
  }
});
test('event date/environment used exactly; missing dates never use today', () => {
  const resolver=make();
  assert.equal(resolver.resolveEvent({date:'2030-03-01',environment:'online'}).boundary.lowestMark,'H');
  assert.equal(resolver.resolveEvent({date:'2030-03-01',environment:'irl'}).boundary.lowestMark,'G');
  assert.equal(resolver.resolveEvent({environment:'irl'}).status,'unknown');
  assert.equal(resolver.resolveEvent({date:'2030-03-01'}).status,'unknown');
  for(const invalid of ['2030-02-30','2030-2-01','2030-03-01T00:00:00Z',new Date(),null]) assert.equal(resolver.resolve(invalid).status,'unknown');
});
test('same date is byte-identical across viewer timezones including DST', () => {
  const program=`const e=require('./v2-preview/apps/_shared/format-resolver.js'); const r=require('./tests/fixtures/format-synthetic.json');process.stdout.write(JSON.stringify(e.create(r).resolve('2030-03-15')));`;
  const outputs=['UTC','Europe/London','America/Los_Angeles','Pacific/Kiritimati'].map(TZ=>execFileSync(process.execPath,['-e',program],{cwd:require('node:path').join(__dirname,'..'),env:{...process.env,TZ},encoding:'utf8'}));
  outputs.forEach(out=>assert.equal(out,outputs[0]));
});
test('snapshot is deeply immutable and independent of future registry revisions', () => {
  const input=copy(fixture), resolver=engine.create(input), before=resolver.resolve('2030-01-20');
  input.sets[0].legality.online.value='2030-04-01';
  assert.deepEqual(resolver.resolve('2030-01-20'),before);
  assert.throws(()=>before.environments.online.boundary.lowestMark='Z',TypeError);
  input.revision='new';
  assert.notEqual(engine.create(input).resolve('2030-01-20').environments.online.format.id,before.environments.online.format.id);
  assert.equal(before.registryRevision,fixture.revision);
});
test('reordering input and metadata revision do not change pool identity', () => {
  const a=make().resolve('2030-02-20');
  const b=make(r=>{r.revision='metadata-only';r.sets.reverse();r.rotations.online.reverse();}).resolve('2030-02-20');
  assert.equal(a.environments.online.format.id,b.environments.online.format.id);
});
test('malformed, conflicting and unsourced facts fail validation', () => {
  for(const mutate of [r=>r.schemaVersion=9,r=>r.sets.push(r.sets[0]),r=>r.sets[0].release.value='2030-02-30',r=>r.sets[0].release.sources=['missing'],r=>r.rotations.online.push({...r.rotations.online[0],id:'conflict'}),r=>r.rotations.online[0].boundary.value={}]) {
    assert.throws(()=>make(mutate),TypeError);
  }
});
test('real seed has verified rotation dates but never claims a complete card pool', () => {
  const resolver=engine.create(seed);
  for(const [day,online,irl] of [['2026-03-25','G','G'],['2026-03-26','H','G'],['2026-03-27','H','G'],['2026-04-10','H','H']]) {
    const r=resolver.resolve(day);
    assert.equal(r.environments.online.boundary.lowestMark,online);
    assert.equal(r.environments.irl.boundary.lowestMark,irl);
    assert.equal(r.environments.online.format.id,null);
  }
  assert.equal(resolver.resolve('2026-03-26').releasedSets.includes('POR'),false);
  assert.equal(resolver.resolve('2026-03-27').releasedSets.includes('POR'),true);
  assert.equal(resolver.resolve('2026-09-08').environments.online.boundary,null);
});
test('browser global module runs without document, fetch, timers, storage or a clock', () => {
  const context=vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve('../v2-preview/apps/_shared/format-resolver.js'),'utf8'),context);
  assert.equal(context.PTCGFormat.create(fixture).resolve('2030-03-15').status,'known');
});
test('dated changes beyond coverage cannot be claimed as certainly next', () => {
  const r=make(r=>{r.coverage.online.through='2030-01-31';}).resolve('2030-01-20');
  assert.equal(r.environments.online.nextChange.date,'2030-02-01');
  assert.equal(r.environments.online.nextChange.certainty,'ordering-unknown');
});
test('first-major date uses environment/date rules without tournament-type inference', () => {
  const resolver=make();
  const r=resolver.resolveEvent({date:'2030-03-15',environment:'irl',type:'first-major',name:'Synthetic major'});
  assert.equal(r.boundary.lowestMark,'H');
  assert.equal(r.format.id,resolver.resolve('2030-03-15').environments.irl.format.id);
});

const maintained = require('../data/formats/maintained-calendar.json');
test('user-maintained calendar resolves the actual 30C boundary dates independently', () => {
  const resolver = engine.create(maintained);
  for (const [date,online,irl] of [['2026-09-08','TEF-PBL','TEF-PBL'],['2026-09-14','TEF-PBL','TEF-PBL'],['2026-09-15','TEF-30C','TEF-PBL'],['2026-09-16','TEF-30C','TEF-PBL'],['2026-09-23','TEF-30C','TEF-PBL'],['2026-09-24','TEF-30C','TEF-30C'],['2026-09-25','TEF-30C','TEF-30C']]) {
    const r=resolver.resolve(date), o=r.environments.online, i=r.environments.irl;
    assert.equal(o.formatContext.label,online); assert.equal(i.formatContext.label,irl);
    assert.deepEqual(o.formatContext.regulationMarks,['H','I','J']);
    assert.equal(o.maintainedBoundary.earliestSet,'TEF');
    assert.equal(o.formatContext.contextId===i.formatContext.contextId,online===irl);
    assert.equal(r.sets[0].release,'announced'); assert.deepEqual(r.releasedSets,[]);
    assert.equal(r.fixtureKind,'user-maintained');
  }
});
test('maintained context keeps its coverage limits and next known dates honest', () => {
  const resolver=engine.create(maintained);
  assert.equal(resolver.resolve('2026-09-07').environments.online.formatContext,undefined);
  const r=resolver.resolve('2026-09-08');
  assert.equal(r.environments.online.nextScheduledChange.date,'2026-09-15');
  assert.equal(r.environments.irl.nextScheduledChange.date,'2026-09-24');
  assert.equal(r.environments.online.formatContext.catalogComplete,false);
  assert.equal(r.environments.online.format.id,null);
  assert.equal(resolver.resolve('2026-09-25').environments.online.nextScheduledChange.certainty,'none-known');
  assert.equal(resolver.resolve('2026-09-25').environments.online.formatContext.rotation,null);
});
test('SYNTHETIC linked rotation follows each environment legality, never release date', () => {
  const input=copy(maintained); input.kind='synthetic'; input.revision='synthetic-linked-rotation';
  input.sets[0].rotation={lowestMark:'I',regulationMarks:['I','J'],earliestSet:'SYNTHETIC-NEW-LOWER'};
  const resolver=engine.create(input), split=resolver.resolve('2026-09-15');
  assert.equal(split.environments.online.maintainedBoundary.lowestMark,'I');
  assert.equal(split.environments.irl.maintainedBoundary.lowestMark,'H');
  assert.equal(split.environments.online.formatContext.earliestSet,'SYNTHETIC-NEW-LOWER');
  assert.equal(resolver.resolve('2026-09-24').environments.online.formatContext.contextId,resolver.resolve('2026-09-24').environments.irl.formatContext.contextId);
  assert.deepEqual(resolver.resolve('2026-09-14').environments.online.nextScheduledChange.changes.map(c=>c.type),['legality','rotation']);
});
test('maintained simultaneous additions and missing legality dates are retained', () => {
  const input=copy(maintained); input.kind='synthetic';
  input.sets.push({...copy(input.sets[0]),id:'SYNTHETIC-TWIN'});
  const r=engine.create(input).resolve('2026-09-15');
  assert.deepEqual(r.environments.online.formatContext.latestSets,['30C','SYNTHETIC-TWIN']);
  input.sets[1].legality.online={value:null,status:'unknown',sources:[],convention:'calendar-day-inclusive'};
  assert.equal(engine.create(input).resolve('2026-09-08').environments.online.nextScheduledChange.certainty,'ordering-unknown');
});
test('maintained results cannot be rewritten by later seed edits', () => {
  const input=copy(maintained), resolver=engine.create(input), r=resolver.resolve('2026-09-15');
  input.sets[0].legality.online.value='2026-09-30';
  assert.equal(r.environments.online.formatContext.label,'TEF-30C');
  assert.deepEqual(resolver.resolve('2026-09-15'),r);
  assert.throws(()=>r.environments.online.formatContext.latestSets.push('OTHER'),TypeError);
});
test('an undated maintained addition blocks future format certainty, not the asserted baseline', () => {
  const input=copy(maintained);input.kind='synthetic';
  const unknown=copy(input.sets[0]);unknown.id='UNDATED';
  for(const env of ['online','irl']) unknown.legality[env]={value:null,status:'unknown',sources:[],convention:'calendar-day-inclusive'};
  input.sets.push(unknown);
  const resolver=engine.create(input);
  assert.equal(resolver.resolve('2026-09-08').environments.online.formatContext.status,'known');
  assert.equal(resolver.resolve('2026-09-16').environments.online.formatContext.contextId,null);
});
test('unknown next rotation and release remain explicit in maintained results', () => {
  const r=engine.create(maintained).resolve('2026-09-24');
  assert.equal(r.environments.irl.nextRotation.status,'unknown');
  assert.equal(r.environments.irl.nextRotation.date,null);
  assert.ok(r.unknowns.includes('30C release date'));
});
