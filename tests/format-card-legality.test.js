const test=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../v2-preview/apps/_shared/format-resolver.js');
const maintained=require('../data/formats/maintained-calendar.json');

const copy=value=>JSON.parse(JSON.stringify(value));

test('maintained calendars reject set-wide regulation-mark claims',()=>{
  const input=copy(maintained);
  input.sets[0].marks={value:['J','K'],status:'confirmed',sources:['user-2026-09-08']};
  assert.throws(()=>engine.create(input),/maintained set marks must stay unknown/);
});

test('card legality is checked from each printing regulation mark against the maintained format',()=>{
  const resolver=engine.create(maintained);
  assert.equal(resolver.resolveCardLegality({regulationMark:'H'},{date:'2026-09-15',environment:'online'}).status,'legal');
  assert.equal(resolver.resolveCardLegality({regulationMark:'G'},{date:'2026-09-15',environment:'online'}).status,'illegal');
  assert.equal(resolver.resolveCardLegality({},{date:'2026-09-15',environment:'online'}).status,'unknown');
  assert.deepEqual(resolver.resolveCardLegality({regulationMark:'I'},{date:'2026-09-15',environment:'online'}).legalRegulationMarks,['H','I','J']);
});

test('rotation changes card legality independently for Online and IRL',()=>{
  const input=copy(maintained);
  input.kind='synthetic';
  input.revision='card-legality-split';
  input.sets[0].rotation={lowestMark:'I',regulationMarks:['I','J'],earliestSet:'SYNTHETIC-LOWER'};
  const resolver=engine.create(input);
  assert.equal(resolver.resolveCardLegality({regulationMark:'H'},{date:'2026-09-15',environment:'online'}).status,'illegal');
  assert.equal(resolver.resolveCardLegality({regulationMark:'H'},{date:'2026-09-15',environment:'irl'}).status,'legal');
  assert.equal(resolver.resolveCardLegality({regulationMark:'H'},{date:'2026-09-24',environment:'irl'}).status,'illegal');
  assert.equal(resolver.resolveCardLegality({regulationMark:'I'},{date:'2026-09-24',environment:'irl'}).status,'legal');
});