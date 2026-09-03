(function(){
'use strict';
const $=id=>document.getElementById(id);
const state={games:[null,null,null]};
let suggestionTimer=null;
function resultName(v){return v==='win'?'W':v==='loss'?'L':v==='draw'?'T':''}
function ensureUi(){
  const form=$('roundForm'), opponent=$('opponentArchetype');
  if(!form||!opponent||form.querySelector('.game-results-editor'))return;
  const matchResult=form.querySelector('.round-choice');
  const legacyScore=form.querySelector('.round-two-col');
  if(matchResult)matchResult.classList.add('legacy-round-control');
  if(legacyScore)legacyScore.classList.add('legacy-round-control');

  const picker=document.createElement('div');
  picker.className='archetype-picker';
  opponent.parentNode.insertBefore(picker,opponent);
  picker.appendChild(opponent);
  const suggestions=document.createElement('div');
  suggestions.className='archetype-suggestions hidden';
  suggestions.setAttribute('role','listbox');
  picker.appendChild(suggestions);

  const editor=document.createElement('section');
  editor.className='game-results-editor';
  editor.innerHTML=`<div class="game-results-head"><span>Game results</span><small>Match record is calculated automatically</small></div>
    ${[1,2,3].map(n=>`<div class="game-result-row" data-game="${n}"><strong>Game ${n}</strong><div class="game-result-buttons"><button type="button" data-game-result="win">W</button><button type="button" data-game-result="loss">L</button><button type="button" data-game-result="draw">T</button></div>${n===1?'<div class="game-first-buttons"><span>Start</span><button type="button" data-first="first">1st</button><button type="button" data-first="second">2nd</button><button type="button" data-first="">?</button></div>':''}</div>`).join('')}`;
  const more=form.querySelector('.round-more');
  form.insertBefore(editor,more||form.querySelector('.sheet-actions'));

  editor.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.gameResult){
      const row=button.closest('.game-result-row'),index=Number(row.dataset.game)-1;
      state.games[index]=state.games[index]===button.dataset.gameResult?null:button.dataset.gameResult;
      syncHidden();renderGames();
    } else if('first' in button.dataset){
      const value=button.dataset.first;
      document.querySelectorAll('input[name="wentFirst"]').forEach(input=>input.checked=input.value===value);
      renderFirst();
    }
  });

  opponent.addEventListener('input',()=>queueSuggestions(opponent.value));
  opponent.addEventListener('focus',()=>showSuggestions(opponent.value));
  opponent.addEventListener('keydown',event=>{if(event.key==='Escape')hideSuggestions()});
  suggestions.addEventListener('click',event=>{
    const button=event.target.closest('[data-archetype]');if(!button)return;
    opponent.value=button.dataset.archetype;hideSuggestions();
  });
  document.addEventListener('click',event=>{if(!picker.contains(event.target))hideSuggestions()});

  const backdrop=$('roundBackdrop');
  new MutationObserver(()=>{if(!backdrop.classList.contains('hidden'))setTimeout(syncFromMatch,0)}).observe(backdrop,{attributes:true,attributeFilter:['class']});
  syncFromMatch();
}
function queueSuggestions(query){clearTimeout(suggestionTimer);suggestionTimer=setTimeout(()=>showSuggestions(query),70)}
function showSuggestions(query){
  const panel=document.querySelector('.archetype-suggestions');if(!panel)return;
  const rows=window.PTCGArchetypes?.search?.(query,10)||[];
  if(!rows.length){panel.classList.add('hidden');panel.innerHTML='';return}
  panel.innerHTML=rows.map(row=>`<button type="button" role="option" data-archetype="${escapeAttr(row.name)}"><strong>${escapeHtml(row.name)}</strong>${row.sources?.length?`<small>${escapeHtml(row.sources.join(' · '))}</small>`:''}</button>`).join('');
  panel.classList.remove('hidden');
}
function hideSuggestions(){document.querySelector('.archetype-suggestions')?.classList.add('hidden')}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]))}
function escapeAttr(value){return escapeHtml(value)}
function syncFromMatch(){
  const id=$('matchId')?.value,match=id?window.PTCGMatchStore?.get?.(id):null;
  state.games=[null,null,null];
  if(match?.games?.length)match.games.slice(0,3).forEach((game,index)=>state.games[index]=['win','loss','draw'].includes(game.result)?game.result:null);
  else {
    const wins=Number($('gameWins')?.value)||0,losses=Number($('gameLosses')?.value)||0,draws=Number($('gameDraws')?.value)||0;
    let i=0;for(let n=0;n<wins&&i<3;n++)state.games[i++]='win';for(let n=0;n<losses&&i<3;n++)state.games[i++]='loss';for(let n=0;n<draws&&i<3;n++)state.games[i++]='draw';
  }
  renderGames();renderFirst();
}
function syncHidden(){
  const counts=state.games.reduce((out,value)=>{if(value==='win')out.w++;else if(value==='loss')out.l++;else if(value==='draw')out.d++;return out},{w:0,l:0,d:0});
  if($('gameWins'))$('gameWins').value=counts.w;if($('gameLosses'))$('gameLosses').value=counts.l;if($('gameDraws'))$('gameDraws').value=counts.d;
  let matchResult='';if(counts.w+counts.l+counts.d){matchResult=counts.w>counts.l?'win':counts.l>counts.w?'loss':'draw'}
  document.querySelectorAll('input[name="result"]').forEach(input=>input.checked=input.value===matchResult);
}
function renderGames(){
  document.querySelectorAll('.game-result-row').forEach(row=>{
    const index=Number(row.dataset.game)-1,value=state.games[index];
    row.querySelectorAll('[data-game-result]').forEach(button=>button.classList.toggle('selected',button.dataset.gameResult===value));
  });
}
function renderFirst(){
  const value=document.querySelector('input[name="wentFirst"]:checked')?.value??'';
  document.querySelectorAll('[data-first]').forEach(button=>button.classList.toggle('selected',button.dataset.first===value));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureUi,{once:true});else ensureUi();
})();