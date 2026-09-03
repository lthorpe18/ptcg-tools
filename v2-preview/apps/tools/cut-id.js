(function(){
'use strict';
const $=id=>document.getElementById(id);
function nums(text){return String(text||'').split(/[\s,;]+/).map(Number).filter(Number.isFinite)}
function pairings(text){return String(text||'').split(/\n+/).map(line=>nums(line)).filter(row=>row.length).map(row=>row.slice(0,2))}
function showError(message){const el=$('cutResult');el.className='calc-result unsafe';el.innerHTML=`<strong>More standings detail needed</strong><span>${message}</span>`}
function calculate(){
  const wins=Number($('cutWins').value)||0,draws=Number($('cutDraws').value)||0,cutSize=Number($('cutSize').value)||8,playerCount=Number($('cutPlayers').value),otherPoints=nums($('cutPoints').value),known=pairings($('cutPairings').value),opponentRaw=$('cutOpponent').value.trim(),opponentPoints=opponentRaw===''?null:Number(opponentRaw);
  if(!Number.isInteger(playerCount)||playerCount<2){showError('Enter the total player count so the deterministic bound can verify that every other player is represented.');return}
  const hasOpponent=Number.isFinite(opponentPoints),expectedOthers=playerCount-1-(hasOpponent?1:0);
  if(known.length){
    if(!hasOpponent){showError('Enter your paired opponent’s current points before using pairing-aware mode. Your own pairing is handled as the ID; the remaining pairings should exclude both of you.');return}
    const represented=known.reduce((total,row)=>total+row.length,0);
    if(represented!==expectedOthers){showError(`Complete pairing data is required for a pairing-aware guarantee. Expected ${expectedOthers} other players across the remaining pairings, but ${represented} are represented.`);return}
  }else if(otherPoints.length!==expectedOthers){
    showError(`Enter all ${expectedOthers} other players’ current point totals${hasOpponent?' (excluding your paired opponent)':''}. ${otherPoints.length} are currently supplied.`);return
  }
  const input={wins,draws,cutSize,otherPoints,pairings:known.length?known:null,opponentPoints:hasOpponent?opponentPoints:null};
  const result=window.PTCGCutId.decision(input),el=$('cutResult');el.className=`calc-result ${result.status}`;const headline=result.status==='guaranteed'?'ID is guaranteed on points':result.status==='unsafe'?'ID is not safe':'ID depends on tiebreaks';el.innerHTML=`<strong>${headline}</strong><span>You would finish on ${result.idPoints} points. At most ${result.maxPlayersAbove} player${result.maxPlayersAbove===1?'':'s'} can finish above you and ${result.maxPlayersAtOrAbove} can finish at or above you under this ${result.pairingAware?'complete pairing-aware':'conservative complete-standings'} bound. Top ${result.cutSize}.</span>`
}
const q=new URLSearchParams(location.search);if(q.has('w'))$('cutWins').value=q.get('w');if(q.has('l'))$('cutLosses').value=q.get('l');if(q.has('d'))$('cutDraws').value=q.get('d');$('cutCalculate').addEventListener('click',calculate);if(q.has('participation'))location.hash='cut';
})();