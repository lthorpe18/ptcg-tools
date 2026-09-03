(function(){
'use strict';
const $=id=>document.getElementById(id);
const ID_MARKER='[ID]';
const state={games:[null,null,null],id:false};
let suggestionTimer=null;
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]))}
function isIdMatch(match){return String(match?.notes||'').trim().startsWith(ID_MARKER)}
function syncHidden(){
  const counts=state.games.reduce((out,value)=>{if(value==='win')out.w++;else if(value==='loss')out.l++;else if(value==='draw')out.d++;return out},{w:0,l:0,d:0});
  $('gameWins').value=state.id?0:counts.w;$('gameLosses').value=state.id?0:counts.l;$('gameDraws').value=state.id?1:counts.d;
  let result='';
  if(state.id)result='draw';
  else if(counts.w+counts.l+counts.d)result=counts.w>counts.l?'win':counts.l>counts.w?'loss':'draw';
  document.querySelectorAll('input[name="result"]').forEach(input=>input.checked=input.value===result);
}
function render(){
  document.querySelectorAll('.game-result-row').forEach(row=>{
    const value=state.games[Number(row.dataset.game)-1];
    row.querySelectorAll('[data-game-result]').forEach(button=>button.classList.toggle('selected',!state.id&&button.dataset.gameResult===value));
    row.classList.toggle('disabled-by-id',state.id);
  });
  document.querySelector('[data-special-outcome="id"]')?.classList.toggle('selected',state.id);
  syncHidden();
}
function syncFromMatch(){
  const id=$('matchId')?.value,match=id?window.PTCGMatchStore?.get?.(id):null;
  state.games=[null,null,null];state.id=!!match&&isIdMatch(match);
  if(match&&!state.id&&Array.isArray(match.games))match.games.slice(0,3).forEach((game,index)=>state.games[index]=['win','loss','draw'].includes(game.result)?game.result:null);
  render();
}
function queueSuggestions(query){clearTimeout(suggestionTimer);suggestionTimer=setTimeout(()=>showSuggestions(query),70)}
function showSuggestions(query){
  const panel=document.querySelector('.archetype-suggestions');if(!panel)return;
  const rows=window.PTCGArchetypes?.search?.(query,10)||[];
  if(!rows.length){panel.classList.add('hidden');panel.innerHTML='';return}
  panel.innerHTML=rows.map(row=>`<button type="button" role="option" data-archetype="${escapeHtml(row.name)}"><strong>${escapeHtml(row.name)}</strong>${row.sources?.length?`<small>${escapeHtml(row.sources.join(' · '))}</small>`:''}</button>`).join('');
  panel.classList.remove('hidden');
}
function hideSuggestions(){document.querySelector('.archetype-suggestions')?.classList.add('hidden')}
function bind(){
  const form=$('roundForm'),opponent=$('opponentArchetype'),editor=form?.querySelector('.game-results-editor');if(!form||!opponent||!editor||form.dataset.nativeRoundBound==='true')return;
  form.dataset.nativeRoundBound='true';
  editor.addEventListener('click',event=>{
    const button=event.target.closest('[data-game-result]');if(!button||state.id)return;
    const index=Number(button.closest('.game-result-row').dataset.game)-1;
    state.games[index]=state.games[index]===button.dataset.gameResult?null:button.dataset.gameResult;render();
  });
  form.querySelector('[data-special-outcome="id"]')?.addEventListener('click',()=>{state.id=!state.id;if(state.id)state.games=[null,null,null];render()});
  opponent.addEventListener('input',()=>queueSuggestions(opponent.value));
  opponent.addEventListener('focus',()=>showSuggestions(opponent.value));
  document.querySelector('.archetype-suggestions')?.addEventListener('click',event=>{const button=event.target.closest('[data-archetype]');if(!button)return;opponent.value=button.dataset.archetype;hideSuggestions()});
  document.addEventListener('click',event=>{if(!event.target.closest('.archetype-picker'))hideSuggestions()});
  form.addEventListener('submit',()=>{
    syncHidden();
    const notes=$('roundNotes');if(!notes)return;
    const clean=String(notes.value||'').replace(/^\[ID\]\s*/,'').trim();
    notes.value=state.id?(clean?`${ID_MARKER} ${clean}`:ID_MARKER):clean;
  },true);
  const backdrop=$('roundBackdrop');if(backdrop)new MutationObserver(()=>{if(!backdrop.classList.contains('hidden'))setTimeout(syncFromMatch,0)}).observe(backdrop,{attributes:true,attributeFilter:['class']});
  syncFromMatch();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
window.addEventListener('pageshow',bind);
})();