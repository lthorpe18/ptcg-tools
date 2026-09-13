'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {spawnSync}=require('node:child_process');

const day=fs.readFileSync('v2-preview/apps/events/tournament-day.js','utf8');
const dayHtml=fs.readFileSync('v2-preview/apps/events/tournament-day.html','utf8');
const tournaments=fs.readFileSync('v2-preview/apps/events/tournaments-inline.js','utf8');
const seasonUi=fs.readFileSync('v2-preview/apps/events/season.js','utf8');
const eventsHtml=fs.readFileSync('v2-preview/apps/events/index.html','utf8');

global.window=global;
require('../v2-preview/apps/_shared/season-engine.js');
require('../v2-preview/apps/_shared/season-rules-2027.js');
const engine=global.PTCGSeasonEngine;
const rules=global.PTCGSeasonRules.pokemon2027;

test('Tournament Day accepts a blank final placement as an explicit drop',()=>{
  const parsed=spawnSync(process.execPath,['--check','v2-preview/apps/events/tournament-day.js'],{encoding:'utf8'});
  assert.equal(parsed.status,0,parsed.stderr||parsed.stdout);
  assert.match(dayHtml,/Final placement <small>blank if dropped<\/small>/);
  assert.match(dayHtml,/placeholder="Blank = dropped"/);
  assert.match(day,/placementRaw=String\(\$\('placement'\)\.value\|\|''\)\.trim\(\),dropped=placementRaw===''/);
  assert.match(day,/row\.completion=\{completedAt:now\(\),placement,dropped,playerCount/);
  assert.match(day,/Event completed · dropped/);
  assert.doesNotMatch(day,/toast\('Enter your final placement'\)/);
});

test('Dropped completion stays distinct from genuinely missing legacy placement',()=>{
  const dropped=engine.effectiveParticipationFacts({
    id:'drop-1',
    eventSnapshot:{type:'League Cup',startDate:'2026-09-13'},
    completion:{dropped:true,placement:null,playerCount:32,completedAt:'2026-09-13T18:00:00Z'}
  });
  assert.equal(dropped.placement,null);
  assert.equal(dropped.dropped,true);
  assert.deepEqual(engine.calculateEventCP(dropped,rules),{eligible:false,cp:0,reason:'dropped'});

  const legacy=engine.effectiveParticipationFacts({
    id:'legacy-1',
    eventSnapshot:{type:'League Cup',startDate:'2026-09-13'},
    completion:{placement:null,playerCount:32,completedAt:'2026-09-13T18:00:00Z'}
  });
  assert.equal(legacy.dropped,false);
  assert.equal(engine.calculateEventCP(legacy,rules).reason,'missing-placement');
});

test('A later season placement correction overrides the dropped display state',()=>{
  const facts=engine.effectiveParticipationFacts({
    id:'drop-corrected',
    eventSnapshot:{type:'League Cup',startDate:'2026-09-13'},
    completion:{dropped:true,placement:null,playerCount:32,completedAt:'2026-09-13T18:00:00Z'},
    seasonCorrection:{fields:{placement:17}}
  });
  assert.equal(facts.placement,17);
  assert.equal(facts.dropped,false);
  assert.equal(engine.calculateEventCP(facts,rules).reason,'awarded');
});

test('Tournament and Season views label explicit drops rather than showing a fake placement',()=>{
  assert.match(tournaments,/completion\?\.dropped\)return'Dropped'/);
  assert.match(seasonUi,/Dropped · placement not recorded/);
  assert.match(seasonUi,/activeResult\.dropped\?'Dropped'/);
  assert.match(seasonUi,/activeResult\.dropped\?'Not calculated'/);
  assert.match(dayHtml,/tournament-day\.js\?v=7/);
  assert.match(dayHtml,/season-engine\.js\?v=3/);
  assert.match(eventsHtml,/tournaments-inline\.js\?v=9/);
  assert.match(eventsHtml,/season-inline\.js\?v=4/);
});
