(function(global){
'use strict';
function points(wins,draws){return Math.max(0,Number(wins)||0)*3+Math.max(0,Number(draws)||0)}
function countAt(scores,target,strict){return scores.reduce((n,score)=>n+(strict?score>target:score>=target?1:0),0)}
function conservativeCeiling(currentPoints,target){const finals=(currentPoints||[]).map(value=>(Number(value)||0)+3);return {above:countAt(finals,target,true),atOrAbove:countAt(finals,target,false)}}
function pairingCeiling(pairings,target){let above=0,atOrAbove=0;for(const row of pairings||[]){const a=Number(row?.[0]);const b=row?.length>1?Number(row[1]):null;const knownId=String(row?.[2]||'').toLowerCase()==='id';if(!Number.isFinite(a))continue;if(!Number.isFinite(b)){above+=a+3>target?1:0;atOrAbove+=a+3>=target?1:0;continue}const outcomes=knownId?[[a+1,b+1]]:[[a+3,b],[a,b+3],[a+1,b+1]];above+=Math.max(...outcomes.map(scores=>countAt(scores,target,true)));atOrAbove+=Math.max(...outcomes.map(scores=>countAt(scores,target,false)))}return {above,atOrAbove}}
function decision({wins=0,draws=0,cutSize=8,otherPoints=[],pairings=null,opponentPoints=null}={}){const current=points(wins,draws),target=current+1,cut=Math.max(1,Number(cutSize)||8);let ceiling=Array.isArray(pairings)&&pairings.length?pairingCeiling(pairings,target):conservativeCeiling(otherPoints,target);if(Number.isFinite(Number(opponentPoints))){const final=Number(opponentPoints)+1;ceiling={above:ceiling.above+(final>target?1:0),atOrAbove:ceiling.atOrAbove+(final>=target?1:0)}}const guaranteed=ceiling.atOrAbove<cut;const unsafe=ceiling.above>=cut;return {currentPoints:current,idPoints:target,cutSize:cut,maxPlayersAbove:ceiling.above,maxPlayersAtOrAbove:ceiling.atOrAbove,status:guaranteed?'guaranteed':unsafe?'unsafe':'tiebreak',pairingAware:Array.isArray(pairings)&&pairings.length>0}}
function record(value){if(value&&typeof value==='object')return {wins:Math.max(0,Number(value.wins)||0),losses:Math.max(0,Number(value.losses)||0),draws:Math.max(0,Number(value.draws)||0)};const parts=String(value||'').trim().split(/[-/]/).map(Number);return {wins:Math.max(0,parts[0]||0),losses:Math.max(0,parts[1]||0),draws:Math.max(0,parts[2]||0)}}
function winPercentage(value){const row=record(value),rounds=row.wins+row.losses+row.draws;if(!rounds)return null;return Math.min(1,Math.max(.25,row.wins/rounds))}
function opponentsWinPercentage(records){const values=(records||[]).map(winPercentage).filter(Number.isFinite);if(!values.length)return null;return values.reduce((sum,value)=>sum+value,0)/values.length}
function matchupWinChance(confidence){return ({unfavourable:.35,'slightly-unfavourable':.425,even:.5,'slightly-favourable':.575,favourable:.65})[confidence]??.5}
function recommendation({wins=0,draws=0,cutSize=8,relevantRecords=[],nextOpponentRecord=null,opponentRecords=[],confidence='even',relevantComplete=false}={}){
  const otherPoints=(relevantRecords||[]).map(row=>{const r=record(row);return points(r.wins,r.draws)});
  const opponent=nextOpponentRecord?record(nextOpponentRecord):null;
  const opponentPoints=opponent&&(opponent.wins+opponent.losses+opponent.draws)>0?points(opponent.wins,opponent.draws):null;
  const base=decision({wins,draws,cutSize,otherPoints,opponentPoints});
  const resistance=opponentsWinPercentage(opponentRecords);
  const matchup=matchupWinChance(confidence);
  let score=0;
  if(base.maxPlayersAbove<=base.cutSize-2)score+=1;
  if(base.maxPlayersAbove>=base.cutSize-1)score-=1;
  if(base.maxPlayersAtOrAbove<=base.cutSize)score+=1;
  if(base.maxPlayersAtOrAbove>=base.cutSize+2)score-=1;
  if(Number.isFinite(resistance)){if(resistance>=.55)score+=1;else if(resistance<.45)score-=1}
  if(matchup<=.425)score+=2;else if(matchup<.5)score+=1;else if(matchup>=.575&&matchup<.65)score-=1;else if(matchup>=.65)score-=2;
  let verdict='close',label='Too close to call';
  if(relevantComplete&&base.status==='guaranteed'){verdict='id';label='ID recommended'}
  else if(base.status==='unsafe'){verdict='play';label='Play recommended'}
  else if(score>=2){verdict='id';label=relevantComplete?'ID recommended':'Lean ID'}
  else if(score<=-2){verdict='play';label=relevantComplete?'Play recommended':'Lean play'}
  return {...base,resistance,matchupWinChance:matchup,relevantComplete,verdict,label,score};
}
global.PTCGCutId={points,conservativeCeiling,pairingCeiling,decision,record,winPercentage,opponentsWinPercentage,matchupWinChance,recommendation};
})(window);