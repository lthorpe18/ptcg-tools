'use strict';

const assert=require('node:assert/strict');
global.window=global;
require('../v2-preview/apps/_shared/season-engine.js');
require('../v2-preview/apps/_shared/season-rules-2027.js');

const engine=global.PTCGSeasonEngine;
const rules=global.PTCGSeasonRules.pokemon2027;

function cp(eventType,placement,playerCount){
  return engine.calculateEventCP({eventType,placement,playerCount},rules).cp;
}

// Official 2027 placement/kicker boundaries.
assert.equal(cp('league-challenge',1,2),15);
assert.equal(cp('league-challenge',2,3),0);
assert.equal(cp('league-challenge',2,4),12);
assert.equal(cp('league-challenge',5,13),0);
assert.equal(cp('league-challenge',5,14),8);
assert.equal(cp('league-challenge',17,48),4);

assert.equal(cp('league-cup',1,2),50);
assert.equal(cp('league-cup',9,47),0);
assert.equal(cp('league-cup',9,48),20);
assert.equal(cp('league-cup',33,128),13);

assert.equal(cp('regional',3,8),300);
assert.equal(cp('special',129,513),60);
assert.equal(cp('regional',513,2049),22);
assert.equal(cp('international',257,1025),85);
assert.equal(cp('international',513,2049),42);

// League Challenges: best four CP finishes count.
const challengeResults=[15,12,10,8,6].map((value,index)=>({
  participationId:`challenge-${index+1}`,
  eventType:'league-challenge',
  cp:value,
  completedAt:`2026-09-${String(index+1).padStart(2,'0')}`
}));
const countedChallenges=engine.applyBestFinishLimits(challengeResults,rules);
assert.equal(countedChallenges.reduce((sum,row)=>sum+row.countingCP,0),45);
assert.equal(countedChallenges.filter(row=>row.isCounting).length,4);

// League Cups: best four CP finishes count.
const cupResults=[50,40,32,25,20].map((value,index)=>({
  participationId:`cup-${index+1}`,
  eventType:'league-cup',
  cp:value,
  completedAt:`2026-10-${String(index+1).padStart(2,'0')}`
}));
const countedCups=engine.applyBestFinishLimits(cupResults,rules);
assert.equal(countedCups.reduce((sum,row)=>sum+row.countingCP,0),147);
assert.equal(countedCups.filter(row=>row.isCounting).length,4);

// Regionals, Specials and Internationals share a best-five bucket ranked by CP earned.
const majorResults=[
  ['regional',350],
  ['special',325],
  ['regional',300],
  ['international',500],
  ['international',420],
  ['regional',280]
].map(([eventType,value],index)=>({
  participationId:`major-${index+1}`,
  eventType,
  cp:value,
  completedAt:`2027-01-${String(index+1).padStart(2,'0')}`
}));
const countedMajors=engine.applyBestFinishLimits(majorResults,rules);
assert.equal(countedMajors.reduce((sum,row)=>sum+row.countingCP,0),1895);
assert.equal(countedMajors.filter(row=>row.isCounting).length,5);
assert.equal(countedMajors.find(row=>row.cp===280).isCounting,false);

console.log('Season engine 2027 rules tests passed.');
