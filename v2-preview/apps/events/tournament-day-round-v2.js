(function(){
'use strict';
const $=id=>document.getElementById(id);
const ID_MARKER='[ID]';
function isIdMatch(match){return String(match?.notes||'').trim().startsWith(ID_MARKER)}
function setIdSelected(selected){
  const form=$('roundForm');if(!form)return;
  form.dataset.idSelected=selected?'true':'false';
  const button=form.querySelector('[data-special-outcome="id"]');
  if(button)button.classList.toggle('selected',selected);
}
function clearPlayedGames(){
  document.querySelectorAll('.game-result-buttons button.selected').forEach(button=>button.click());
}
function ensureSpecialOutcome(){
  const form=$('roundForm');if(!form||form.querySelector('.round-special-outcomes'))return;
  document.querySelectorAll('.game-first-buttons').forEach(el=>el.remove());
  const more=form.querySelector('.round-more');
  const row=document.createElement('div');
  row.className='round-special-outcomes';
  row.innerHTML='<span>Other result</span><button type="button" data-special-outcome="id">ID</button>';
  form.insertBefore(row,more||form.querySelector('.sheet-actions'));
  row.querySelector('[data-special-outcome="id"]').addEventListener('click',()=>{
    const selected=form.dataset.idSelected!=='true';
    if(selected){clearPlayedGames();setIdSelected(true)}else setIdSelected(false);
  });
  form.addEventListener('click',event=>{
    if(event.target.closest('[data-game-result]'))setIdSelected(false);
  },true);
  form.addEventListener('submit',event=>{
    if(form.dataset.idSelected!=='true')return;
    const wins=$('gameWins'),losses=$('gameLosses'),draws=$('gameDraws'),result=$('resultDraw'),notes=$('roundNotes');
    if(wins)wins.value='0';if(losses)losses.value='0';if(draws)draws.value='1';if(result)result.checked=true;
    if(notes){const clean=String(notes.value||'').replace(/^\[ID\]\s*/,'').trim();notes.value=clean?`${ID_MARKER} ${clean}`:ID_MARKER}
  },true);
  const backdrop=$('roundBackdrop');
  if(backdrop)new MutationObserver(()=>{
    if(backdrop.classList.contains('hidden'))return;
    setTimeout(()=>{
      document.querySelectorAll('.game-first-buttons').forEach(el=>el.remove());
      const id=$('matchId')?.value,match=id?window.PTCGMatchStore?.get?.(id):null;
      if(isIdMatch(match)){
        clearPlayedGames();setIdSelected(true);
      }else setIdSelected(false);
    },20);
  }).observe(backdrop,{attributes:true,attributeFilter:['class']});
}
function boot(){ensureSpecialOutcome();setTimeout(ensureSpecialOutcome,100);setTimeout(ensureSpecialOutcome,500)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();