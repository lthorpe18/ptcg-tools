const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ Date, Math, Map, Set, String, Number, Array, Object });
context.window = context;
context.globalThis = context;
vm.runInContext(fs.readFileSync(path.join(root, 'v2-preview/apps/_shared/meta-blend.js'), 'utf8'), context);
const Blend = context.PTCGMetaBlend;

const rows = (a = 60, b = 40) => [{ name:'A', share:a }, { name:'B', share:b }];
const event = (id, date, players = 60, decks = rows()) => ({ id, name:`Event ${id}`, date, players, decks:decks.map(row => ({ name:row.name, entries:row.share })) });
const online = (format, events, since = events, majorIds = []) => ({
  format, generatedAt:'2030-02-10T12:00:00Z', majorWeekend:{ events:majorIds.map(id => ({ id })) },
  scopes:{ all:{ events, decks:rows(), overview:{ events:events.length } }, 'since-major':{ events:since, decks:since.length ? rows() : [], overview:{ events:since.length } } },
});
const irl = (format, events, formatContext) => ({ format, generatedAt:'2030-02-10T12:00:00Z', events, formatContext });
const oldContext = { label:'OLD', effectiveDate:'2030-01-01', regulationMarks:['H','I','J'], earliestSet:'BASE', addedSetIds:[], rotation:null };
const newContext = { label:'NEW', effectiveDate:'2030-02-01', regulationMarks:['H','I','J'], earliestSet:'BASE', addedSetIds:['NEW'], rotation:null };
const rotatedContext = { label:'ROT', effectiveDate:'2030-02-01', regulationMarks:['I','J','K'], earliestSet:'ROT', addedSetIds:['ROT'], rotation:{ lowestMark:'I' } };
const prediction = (evidence, format, now = '2030-02-10') => Blend.predictions(evidence, { now }).find(row => row.format === format);
const weightsAre = (actual, irl, online) => {
  assert.ok(Math.abs(actual.irl - irl) < 1e-12);
  assert.ok(Math.abs(actual.online - online) < 1e-12);
};

test('settled-format curve uses the major weekend final day and floors at 30 percent IRL', () => {
  const major = event('major', '2030-01-25', 800);
  const evidence = { currentFormats:{ online:oldContext, irl:oldContext }, online:{ OLD:online('OLD', [event('o','2030-01-28')], [event('o','2030-01-28')], ['major']) }, irl:{ OLD:irl('OLD',[major],oldContext) } };
  weightsAre(Blend.predictions(evidence,{now:'2030-01-27'})[0].weights,.7,.3);
  weightsAre(Blend.predictions(evidence,{now:'2030-02-06'})[0].weights,.5,.5);
  weightsAre(Blend.predictions(evidence,{now:'2030-03-01'})[0].weights,.3,.7);
});

test('49-player Online evidence is rejected while one 50-player event is sufficient', () => {
  const base = { currentFormats:{ online:oldContext, irl:oldContext }, irl:{ OLD:irl('OLD',[],oldContext) } };
  assert.equal(prediction({...base,online:{OLD:online('OLD',[event('small','2030-02-03',49)])}},'OLD').available,false);
  const accepted=prediction({...base,online:{OLD:online('OLD',[event('enough','2030-02-03',50)])}},'OLD');
  assert.equal(accepted.available,true);weightsAre(accepted.weights,0,1);
});

test('ordinary split exposes two targets, freezes old evidence and gives new format a 75/25 prior', () => {
  const major=event('major','2030-01-25',800);
  const evidence={currentFormats:{online:newContext,irl:oldContext},online:{
    NEW:online('NEW',[event('new-online','2030-02-02')]),
    OLD:online('OLD',[event('old-online','2030-01-29')],[event('old-online','2030-01-29')],['major']),
  },irl:{OLD:irl('OLD',[major],oldContext)}};
  const predictions=Blend.predictions(evidence,{now:'2030-02-10'});
  assert.deepEqual(Array.from(predictions,row=>row.format),['NEW','OLD']);
  const next=predictions[0],old=predictions[1];
  assert.equal(next.rule,'ordinary-set-transition-prior');weightsAre(next.weights,.25,.75);
  assert.equal(old.rule,'frozen-old-format');assert.equal(old.frozen,true);assert.equal(old.evidence.online.frozenAt,'2030-02-01');assert.equal(old.evidence.online.through,'2030-01-29');
  assert.deepEqual(Blend.onlineTarget(evidence,{now:'2030-02-10'}),next);
});

test('Online-target selection never substitutes another available format', () => {
  const evidence={currentFormats:{online:newContext,irl:oldContext},online:{OLD:online('OLD',[event('old-online','2030-01-29')])},irl:{OLD:irl('OLD',[event('major','2030-01-25',800)],oldContext)}};
  const result=Blend.onlineTarget(evidence,{now:'2030-02-10'});
  assert.equal(result.format,'NEW');assert.equal(result.available,false);assert.equal(result.rule,'minimum-online-evidence');
});

test('a newer old-format major resets that frozen prediction to 70/30 without replacing its Online pool', () => {
  const newer=event('new-major','2030-02-03',700);
  const evidence={currentFormats:{online:newContext,irl:oldContext},online:{OLD:online('OLD',[event('old-online','2030-01-29')],[event('old-online','2030-01-29')],['old-major'])},irl:{OLD:irl('OLD',[newer],oldContext)}};
  const result=prediction(evidence,'OLD');
  assert.equal(result.rule,'new-old-format-major');weightsAre(result.weights,.7,.3);
  assert.equal(result.evidence.online.events[0].id,'old-online');
});

test('first same-format major removes the prior and waits for post-major Online evidence', () => {
  const major=event('new-major','2030-02-09',700);
  const before=online('NEW',[event('pre','2030-02-05')],[],['new-major']);
  const evidence={currentFormats:{online:newContext,irl:newContext},online:{NEW:before},irl:{NEW:irl('NEW',[major],newContext),OLD:irl('OLD',[event('old-major','2030-01-25')],oldContext)}};
  const waiting=prediction(evidence,'NEW','2030-02-10');
  assert.equal(waiting.available,false);assert.equal(waiting.rule,'post-major-online-required');
  evidence.online.NEW=online('NEW',[event('post','2030-02-10')],[event('post','2030-02-10')],['new-major']);
  const available=prediction(evidence,'NEW','2030-02-10');
  assert.equal(available.available,true);assert.equal(available.rule,'settled-format');weightsAre(available.weights,.7,.3);
});

test('rotation-incompatible IRL contributes zero immediately', () => {
  const evidence={currentFormats:{online:rotatedContext,irl:oldContext},online:{ROT:online('ROT',[event('rot-online','2030-02-02')])},irl:{OLD:irl('OLD',[event('old-major','2030-01-25')],oldContext)}};
  const result=prediction(evidence,'ROT');
  assert.equal(result.rule,'rotation-online-only');weightsAre(result.weights,0,1);
});

test('missing Online rows is explicitly unavailable and blended output normalises to one', () => {
  const unavailableResult=prediction({currentFormats:{online:oldContext,irl:oldContext},online:{OLD:online('OLD',[])},irl:{OLD:irl('OLD',[event('major','2030-01-25')],oldContext)}},'OLD');
  assert.equal(unavailableResult.available,false);assert.match(unavailableResult.reason,/qualifying 50\+ player Online/);
  const result=prediction({currentFormats:{online:oldContext,irl:oldContext},online:{OLD:online('OLD',[event('o','2030-02-01')])},irl:{OLD:irl('OLD',[event('major','2030-01-25')],oldContext)}},'OLD');
  assert.ok(Math.abs(result.rows.reduce((sum,row)=>sum+row.share,0)-1)<1e-12);
  assert.equal(result.version,'blended-v2.1');assert.ok(result.evidence.online.events.length);assert.ok(result.evidence.irl.events.length);
});

test('the committed release produces one available TEF-PBL prediction with reproducible provenance', () => {
  const core=JSON.parse(fs.readFileSync(path.join(root,'v2-preview/data/meta/release/core.json'),'utf8'));
  const results=Blend.predictions({asOf:core.formatDate,currentFormats:core.currentFormats,calendarRevision:core.calendarRevision,online:{[core.online.format]:core.online},irl:{[core.irl.format]:core.irl}});
  assert.equal(results.length,1);assert.equal(results[0].format,'TEF-PBL');assert.equal(results[0].available,true);
  assert.equal(results[0].rule,'settled-format');weightsAre(results[0].weights,.52,.48);
  assert.ok(results[0].evidence.online.eventCount>0);assert.equal(results[0].evidence.irl.events[0].name,'World Championship San Francisco');
});
