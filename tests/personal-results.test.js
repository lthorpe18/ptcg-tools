const test=require('node:test');
const assert=require('node:assert/strict');
const results=require('../v2-preview/apps/_shared/personal-results.js');

const deck={
  id:'deck-a',
  name:'Deck A',
  archetype:'Gardevoir',
  currentVersionId:'v2',
  versions:[
    {id:'v1',label:'V1',listHash:'hash-1'},
    {id:'v2',label:'V2',name:'Cup list',listHash:'hash-2'}
  ]
};

function match(overrides={}){
  const base={
    id:overrides.id||Math.random().toString(36),
    deckId:'deck-a',
    deckNameSnapshot:'Deck A',
    result:'win',
    source:'ptcgl',
    playedAt:'2026-09-10T12:00:00.000Z',
    createdAt:'2026-09-10T12:00:00.000Z',
    opponentArchetype:'Gardevoir',
    deckVersionId:'v1',
    listHash:'hash-1'
  };
  const row={...base,...overrides};
  if(!('games' in overrides))row.games=[{id:`${row.id}-g1`,number:1,result:row.result}];
  return row;
}

test('aggregates only canonically linked evidence and keeps tournament matches separate',()=>{
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
  assert.equal(out.scoredGames.length,3);
  assert.equal(out.unscoredCount,1);
  assert.deepEqual(out.overall,{wins:1,losses:1,draws:1,total:3,winRate:1/3});
  assert.deepEqual(out.tournament,{wins:1,losses:0,draws:0,total:1,winRate:1});
  assert.deepEqual(out.tournamentGames,{wins:1,losses:0,draws:0,total:1,winRate:1});
  assert.deepEqual(out.training,{wins:0,losses:1,draws:1,total:2,winRate:0});
  assert.deepEqual(out.ptcgl,{wins:0,losses:1,draws:0,total:1,winRate:0});
  assert.deepEqual(out.inPersonTraining,{wins:0,losses:0,draws:1,total:1,winRate:0});
});

test('personal matchup evidence is game-level while tournament record stays match-level',()=>{
  const rows=[
    match({
      id:'cup-round',source:'irl',participationId:'cup',result:'win',opponentArchetype:'Dragapult',
      games:[{id:'g1',number:1,result:'win'},{id:'g2',number:2,result:'loss'},{id:'g3',number:3,result:'win'}]
    }),
    match({
      id:'training-set',source:'irl',result:'loss',opponentArchetype:'Dragapult',playedAt:'2026-09-09T12:00:00.000Z',
      games:[{id:'g4',number:1,result:'loss'},{id:'g5',number:2,result:'loss'},{id:'g6',number:3,result:'win'}]
    })
  ];
  const out=results.aggregateDeck(deck,rows);

  assert.deepEqual(out.overall,{wins:3,losses:3,draws:0,total:6,winRate:.5});
  assert.deepEqual(out.tournament,{wins:1,losses:0,draws:0,total:1,winRate:1});
  assert.deepEqual(out.tournamentGames,{wins:2,losses:1,draws:0,total:3,winRate:2/3});
  assert.deepEqual(out.training,{wins:1,losses:2,draws:0,total:3,winRate:1/3});
  assert.deepEqual(out.opponents[0].stats,{wins:3,losses:3,draws:0,total:6,winRate:.5});
});

test('groups personal game results by opponent archetype including unknown opponents',()=>{
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

test('version scope isolates one exact saved list using id or list hash',()=>{
  const v2=deck.versions[1];
  const rows=[
    match({id:'v1',deckVersionId:'v1',listHash:'hash-1',result:'win'}),
    match({id:'v2-id',deckVersionId:'v2',listHash:'hash-2',result:'loss'}),
    match({id:'v2-hash',deckVersionId:null,listHash:'hash-2',result:'draw',playedAt:'2026-09-09T12:00:00.000Z'}),
    match({id:'other-deck',deckId:'deck-b',deckVersionId:'v2',listHash:'hash-2',result:'win'})
  ];
  const out=results.aggregateVersion(deck,v2,rows);

  assert.equal(out.scope,'version');
  assert.equal(out.matches.length,2);
  assert.deepEqual(out.overall,{wins:0,losses:1,draws:1,total:2,winRate:0});
  assert.equal(out.version.id,'v2');
});

test('archetype scope combines all saved decks classified as the same archetype',()=>{
  const sibling={id:'deck-c',name:'Gardevoir Control',archetype:' gardevoir ',versions:[]};
  const other={id:'deck-b',name:'Dragapult',archetype:'Dragapult',versions:[]};
  const rows=[
    match({id:'a',deckId:'deck-a',deckNameSnapshot:'Deck A',result:'win'}),
    match({id:'c',deckId:'deck-c',deckNameSnapshot:'Gardevoir Control',result:'loss'}),
    match({id:'b',deckId:'deck-b',deckNameSnapshot:'Dragapult',result:'win'})
  ];
  const out=results.aggregateArchetype('Gardevoir',[deck,sibling,other],rows);

  assert.equal(out.scope,'archetype');
  assert.deepEqual(new Set(out.deckIds),new Set(['deck-a','deck-c']));
  assert.deepEqual(out.overall,{wins:1,losses:1,draws:0,total:2,winRate:.5});
  assert.equal(out.decks.length,2);
  assert.equal(out.decks.find(row=>row.label==='Deck A').stats.wins,1);
  assert.equal(out.decks.find(row=>row.label==='Gardevoir Control').stats.losses,1);
});

test('archetype scope does not guess from deck names when archetype metadata differs',()=>{
  const misleading={id:'deck-x',name:'Gardevoir Testing',archetype:'Dragapult',versions:[]};
  const out=results.aggregateArchetype('Gardevoir',[deck,misleading],[
    match({id:'a',deckId:'deck-a'}),
    match({id:'x',deckId:'deck-x'})
  ]);
  assert.equal(out.overall.total,1);
  assert.deepEqual(out.deckIds,['deck-a']);
});

test('recent evidence is newest-first and recent form is capped at five games',()=>{
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

test('same-day evidence uses creation time as the newest-first tie break',()=>{
  const rows=[
    match({id:'older',opponentArchetype:'Older',createdAt:'2026-09-11T18:00:00.000Z',playedAt:'2026-09-11T12:00:00.000Z'}),
    match({id:'newer',opponentArchetype:'Newer',createdAt:'2026-09-11T21:00:00.000Z',playedAt:'2026-09-11T12:00:00.000Z'})
  ];
  const out=results.aggregateDeck(deck,rows);
  assert.equal(out.recent[0].id,'newer');
  assert.equal(out.opponents[0].label,'Newer');
});

test('sample labels avoid overstating tiny game samples',()=>{
  assert.equal(results.sampleLabel(0),'No linked games');
  assert.equal(results.sampleLabel(3),'Very small sample');
  assert.equal(results.sampleLabel(8),'Small sample');
  assert.equal(results.sampleLabel(15),'Developing sample');
  assert.equal(results.sampleLabel(25),'25 games');
});