const test=require('node:test');
const assert=require('node:assert/strict');
const results=require('../v2-preview/apps/_shared/personal-results.js');

const deck={
  id:'deck-a',
  name:'Deck A',
  versions:[
    {id:'v1',label:'V1',listHash:'hash-1'},
    {id:'v2',label:'V2',name:'Cup list',listHash:'hash-2'}
  ]
};

function match(overrides={}){
  return {
    id:overrides.id||Math.random().toString(36),
    deckId:'deck-a',
    result:'win',
    source:'ptcgl',
    playedAt:'2026-09-10T12:00:00.000Z',
    opponentArchetype:'Gardevoir',
    deckVersionId:'v1',
    listHash:'hash-1',
    ...overrides
  };
}

test('aggregates only canonically linked matches and keeps tournament evidence separate',()=>{
  const rows=[
    match({id:'t1',result:'win',source:'irl',participationId:'event-1',eventName:'League Cup'}),
    match({id:'p1',result:'loss',source:'ptcgl',playedAt:'2026-09-09T12:00:00.000Z'}),
    match({id:'i1',result:'draw',source:'irl',participationId:null,playedAt:'2026-09-08T12:00:00.000Z'}),
    match({id:'other',deckId:'deck-b',result:'win'}),
    match({id:'unknown',result:'unknown',playedAt:'2026-09-07T12:00:00.000Z'})
  ];
  const out=results.aggregateDeck(deck,rows);

  assert.equal(out.matches.length,4);
  assert.equal(out.scoredMatches.length,3);
  assert.equal(out.unscoredCount,1);
  assert.deepEqual(out.overall,{wins:1,losses:1,draws:1,total:3,winRate:1/3});
  assert.deepEqual(out.tournament,{wins:1,losses:0,draws:0,total:1,winRate:1});
  assert.deepEqual(out.training,{wins:0,losses:1,draws:1,total:2,winRate:0});
  assert.deepEqual(out.ptcgl,{wins:0,losses:1,draws:0,total:1,winRate:0});
  assert.deepEqual(out.inPersonTraining,{wins:0,losses:0,draws:1,total:1,winRate:0});
});

test('groups personal results by opponent archetype including unknown opponents',()=>{
  const rows=[
    match({id:'g1',result:'win',opponentArchetype:'Dragapult'}),
    match({id:'g2',result:'loss',opponentArchetype:'Dragapult',playedAt:'2026-09-09T12:00:00.000Z'}),
    match({id:'g3',result:'draw',opponentArchetype:null,playedAt:'2026-09-08T12:00:00.000Z'})
  ];
  const out=results.aggregateDeck(deck,rows);

  assert.equal(out.opponents[0].label,'Dragapult');
  assert.deepEqual(out.opponents[0].stats,{wins:1,losses:1,draws:0,total:2,winRate:.5});
  assert.equal(out.opponents[1].label,'Unknown');
  assert.equal(out.opponents[1].stats.total,1);
});

test('resolves version evidence by version id, list hash, then historical snapshot',()=>{
  const rows=[
    match({id:'v1-id',deckVersionId:'v1',listHash:'hash-1'}),
    match({id:'v2-hash',deckVersionId:null,listHash:'hash-2',result:'loss'}),
    match({id:'legacy',deckVersionId:'deleted-version',listHash:'old-hash',deckVersionLabelSnapshot:'Old Cup list',result:'draw'})
  ];
  const out=results.aggregateDeck(deck,rows);
  const byLabel=new Map(out.versions.map(row=>[row.label,row]));

  assert.equal(byLabel.get('V1').stats.total,1);
  assert.equal(byLabel.get('V2 · Cup list').stats.losses,1);
  assert.equal(byLabel.get('Old Cup list').stats.draws,1);
});

test('recent evidence is newest-first and recent form is capped at five scored matches',()=>{
  const rows=Array.from({length:7},(_,index)=>match({
    id:`m${index}`,
    result:index%2?'loss':'win',
    playedAt:new Date(Date.UTC(2026,8,1+index)).toISOString()
  }));
  const out=results.aggregateDeck(deck,rows);

  assert.equal(out.recent.length,7);
  assert.equal(out.recent[0].id,'m6');
  assert.deepEqual(out.recentForm,['win','loss','win','loss','win']);
});

test('sample labels avoid overstating tiny evidence sets',()=>{
  assert.equal(results.sampleLabel(0),'No linked results');
  assert.equal(results.sampleLabel(3),'Very small sample');
  assert.equal(results.sampleLabel(8),'Small sample');
  assert.equal(results.sampleLabel(15),'Developing sample');
  assert.equal(results.sampleLabel(25),'25 matches');
});