(function(){
'use strict';
const ACTIVE_KEY='ptcg-tools.decklists.active-deck.v1';
const $=id=>document.getElementById(id);

function remember(id){if(id)try{sessionStorage.setItem(ACTIVE_KEY,id)}catch{}}
function remembered(){try{return sessionStorage.getItem(ACTIVE_KEY)||''}catch{return ''}}
function toast(message){const el=$('toast');if(!el)return;el.textContent=message;el.hidden=false;clearTimeout(el._t);el._t=setTimeout(()=>el.hidden=true,2200)}
async function workingDeckId(){
  const rawText=$('deckText')?.value||'',name=$('deckName')?.value?.trim()||'';
  const stored=remembered(),storedDeck=stored?await window.PTCGDeckStore.get(stored):null;
  if(storedDeck){
    const sameName=name&&storedDeck.name===name;
    const sameList=window.PTCGDeckParser.canonicalDecklist(storedDeck.rawText||'')===window.PTCGDeckParser.canonicalDecklist(rawText);
    if(sameName||sameList)return storedDeck.id;
  }
  const decks=await window.PTCGDeckStore.all();
  const canonical=window.PTCGDeckParser.canonicalDecklist(rawText),matches=decks.filter(deck=>deck.name===name||window.PTCGDeckParser.canonicalDecklist(deck.rawText||'')===canonical);
  if(matches.length===1){remember(matches[0].id);return matches[0].id}
  return '';
}
async function launchWorking(){
  try{
    const deckId=await workingDeckId();if(!deckId){toast('Could not identify this Deck. Return to My Decks and reopen it.');return}
    const rawText=$('deckText')?.value||'',listHash=await window.PTCGDeckParser.hashDecklist(rawText);
    await window.PTCGPlaytestLaunch.open({deckId,rawText,listHash,source:'working-list'});
  }catch(error){toast(error.message||'Playtest could not start')}
}
async function launchVersion(versionId){
  try{
    let deckId=remembered(),deck=deckId?await window.PTCGDeckStore.get(deckId):null;
    if(!deck||!window.PTCGDeckStore.getVersion(deck,versionId)){
      deck=(await window.PTCGDeckStore.all()).find(row=>window.PTCGDeckStore.getVersion(row,versionId))||null;deckId=deck?.id||'';if(deckId)remember(deckId);
    }
    if(!deckId){toast('Could not identify this saved version');return}
    await window.PTCGPlaytestLaunch.open({deckId,deckVersionId:versionId,source:'deck-version'});
  }catch(error){toast(error.message||'Playtest could not start')}
}
function enhanceVersions(){
  document.querySelectorAll('[data-load-version]').forEach(loadButton=>{
    const row=loadButton.closest('.version-row');if(!row||row.querySelector('[data-playtest-version]'))return;
    const button=document.createElement('button');button.type='button';button.dataset.playtestVersion=loadButton.dataset.loadVersion;button.textContent='Playtest';button.className='version-playtest-button';loadButton.insertAdjacentElement('beforebegin',button);
  });
}
function cleanRouteQuery(){
  try{
    const url=new URL(location.href);url.searchParams.delete('playtest');url.searchParams.delete('workspace');history.replaceState(history.state,'',url);
  }catch{}
}
function closePicker(){
  const sheet=$('playtestPickerSheet');if(sheet)sheet.hidden=true;
  document.documentElement.classList.remove('sheet-open');
  cleanRouteQuery();
}
function ensurePicker(){
  let sheet=$('playtestPickerSheet');if(sheet)return sheet;
  sheet=document.createElement('div');sheet.id='playtestPickerSheet';sheet.className='sheet';sheet.hidden=true;
  sheet.innerHTML='<div class="sheet-backdrop" data-close-playtest-picker></div><section class="sheet-card" role="dialog" aria-modal="true" aria-labelledby="playtestPickerTitle"><div class="sheet-handle"></div><h2 id="playtestPickerTitle">Choose a deck</h2><p class="playtest-picker-note">Start Mobile Playtest with the current working list.</p><div id="playtestPickerList" class="playtest-picker-list"></div><button class="sheet-action" type="button" data-close-playtest-picker>Cancel</button></section>';
  document.body.appendChild(sheet);
  const style=document.createElement('style');style.textContent='.playtest-picker-note{margin:4px 0 12px;color:var(--app-muted);font-size:12px}.playtest-picker-list{display:grid;gap:8px;margin-bottom:8px}.playtest-picker-deck{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:52px;border:1px solid var(--app-border);border-radius:12px;background:#fff;padding:10px 12px;color:var(--app-text);font:inherit;text-align:left}.playtest-picker-deck span{min-width:0}.playtest-picker-deck strong,.playtest-picker-deck small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.playtest-picker-deck strong{font-size:13px}.playtest-picker-deck small{margin-top:3px;color:var(--app-muted);font-size:11px}.playtest-picker-deck b{color:var(--app-blue);font-size:18px}.playtest-picker-empty{padding:12px;color:var(--app-muted);font-size:12px;text-align:center}';document.head.appendChild(style);
  return sheet;
}
async function openPicker(){
  try{
    await window.PTCGDeckStore.open();
    const decks=(await window.PTCGDeckStore.all()).sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0));
    const sheet=ensurePicker(),list=$('playtestPickerList');
    list.innerHTML=decks.length?decks.map(deck=>{
      const cards=window.PTCGDeckParser.parseDeck(deck.rawText||'').totalCards;
      const detail=[deck.archetype,`${cards} cards`].filter(Boolean).join(' · ');
      return `<button class="playtest-picker-deck" type="button" data-picker-deck="${String(deck.id).replace(/"/g,'&quot;')}"><span><strong>${String(deck.name||'Untitled deck').replace(/[&<>]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]))}</strong><small>${String(detail).replace(/[&<>]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]))}</small></span><b>›</b></button>`;
    }).join(''):'<div class="playtest-picker-empty">No saved decks yet. Create or import a deck first.</div>';
    sheet.hidden=false;document.documentElement.classList.add('sheet-open');
  }catch(error){toast(error.message||'Decks could not be loaded')}
}
async function launchPickedDeck(deckId){
  try{remember(deckId);await window.PTCGPlaytestLaunch.open({deckId,source:'working-list'})}catch(error){toast(error.message||'Playtest could not start')}
}
function openCardSearchRoute(){
  const params=new URLSearchParams(location.search);if(params.get('workspace')!=='cards')return;
  let attempts=0;const timer=setInterval(()=>{
    if(window.PTCGCardSearch?.showBrowse){clearInterval(timer);window.PTCGCardSearch.showBrowse();return}
    if(++attempts>=100)clearInterval(timer);
  },30);
}
function handleEntryRoute(){
  const params=new URLSearchParams(location.search);
  if(params.get('playtest')==='pick')openPicker();
  openCardSearchRoute();
}
function bind(){
  document.addEventListener('pointerdown',event=>{const card=event.target.closest('.deck-card[data-id]');if(card)remember(card.dataset.id)},true);
  document.addEventListener('keydown',event=>{if(event.key!=='Enter'&&event.key!==' ')return;const card=event.target.closest('.deck-card[data-id]');if(card)remember(card.dataset.id)},true);
  document.addEventListener('click',event=>{
    const card=event.target.closest('.deck-card[data-id]');if(card)remember(card.dataset.id);
    const button=event.target.closest('[data-playtest-version]');if(button){event.preventDefault();event.stopPropagation();launchVersion(button.dataset.playtestVersion);return}
    const picked=event.target.closest('[data-picker-deck]');if(picked){event.preventDefault();launchPickedDeck(picked.dataset.pickerDeck);return}
    if(event.target.closest('[data-close-playtest-picker]')){event.preventDefault();closePicker()}
  },true);
  const playtest=$('playtestButton');if(playtest){playtest.disabled=false;playtest.textContent='▶ Playtest';playtest.addEventListener('click',launchWorking)}
  new MutationObserver(enhanceVersions).observe(document.documentElement,{childList:true,subtree:true});enhanceVersions();handleEntryRoute();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
