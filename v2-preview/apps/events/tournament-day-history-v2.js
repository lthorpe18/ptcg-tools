(function(){
'use strict';
const ID_MARKER='[ID]';
function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[ch]))}
function resultLetter(result){return result==='win'?'W':result==='loss'?'L':result==='draw'?'D':'?'}
function gameSequence(match){if(String(match?.notes||'').trim().startsWith(ID_MARKER))return '';return (match?.games||[]).map(game=>game.result==='win'?'W':game.result==='loss'?'L':game.result==='draw'?'T':'').filter(Boolean).join(' ')}
function spriteHtml(archetype,size=40){
  const text=String(archetype||'Opponent').trim()||'Opponent';
  if(window.DeckSprites?.html)return window.DeckSprites.html(text,{size,className:'tournament-opponent-visual'});
  return `<span class="deck-sprite deck-sprite-fallback" aria-hidden="true">${esc(text.charAt(0).toUpperCase()||'?')}</span>`;
}
function enhanceRow(button){if(button.dataset.richHistory==='true')return;const match=window.PTCGMatchStore?.get?.(button.dataset.matchId);if(!match)return;button.dataset.richHistory='true';button.classList.add('rich-round-row');const isId=String(match.notes||'').trim().startsWith(ID_MARKER);const opponent=match.opponentArchetype||'Opponent';const sequence=gameSequence(match);button.innerHTML=`<span class="rich-round-number">${esc((match.roundLabel||'R').replace(/^Round\s*/i,'R'))}</span><span class="rich-matchup"><span class="rich-vs">vs</span><span class="rich-sprites rich-sprites-opponent" aria-hidden="true">${spriteHtml(opponent,40)}</span><span class="rich-opponent">${esc(opponent)}</span></span><span class="rich-game-sequence ${esc(match.result)}">${esc(sequence)}</span><span class="rich-round-result ${esc(match.result)}${isId?' id':''}"><strong>${isId?'ID':resultLetter(match.result)}</strong></span>`}
function enhance(){document.querySelectorAll('#roundHistory [data-match-id]').forEach(enhanceRow)}
function loadTopCut(){const matchStore=document.createElement('script');matchStore.src='../_shared/match-store.js?v=3';matchStore.onload=()=>{const script=document.createElement('script');script.src='./tournament-day-topcut.js?v=2';document.body.appendChild(script);setTimeout(()=>{document.querySelectorAll('#roundHistory [data-match-id]').forEach(button=>button.dataset.richHistory='false');enhance()},30)};document.body.appendChild(matchStore)}
const history=document.getElementById('roundHistory');if(history)new MutationObserver(()=>setTimeout(enhance,0)).observe(history,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{setTimeout(enhance,80);loadTopCut()},{once:true});else{setTimeout(enhance,80);loadTopCut()}
window.addEventListener('ptcg:local-change',()=>setTimeout(enhance,40));
window.addEventListener('decksprites:updated',()=>{document.querySelectorAll('#roundHistory [data-match-id]').forEach(button=>{button.dataset.richHistory='false'});setTimeout(enhance,0)});
})();