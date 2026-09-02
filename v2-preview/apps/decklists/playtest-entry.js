(function(){
'use strict';
const ACTIVE_KEY='ptcg-tools.decklists.active-deck.v1';
const $=id=>document.getElementById(id);
const PLAYTEST_TARGET='playtest-v2.html?interaction=3';

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
    await window.PTCGPlaytestLaunch.open({deckId,rawText,listHash,source:'working-list',targetUrl:PLAYTEST_TARGET});
  }catch(error){toast(error.message||'Playtest could not start')}
}
async function launchVersion(versionId){
  try{
    let deckId=remembered(),deck=deckId?await window.PTCGDeckStore.get(deckId):null;
    if(!deck||!window.PTCGDeckStore.getVersion(deck,versionId)){
      deck=(await window.PTCGDeckStore.all()).find(row=>window.PTCGDeckStore.getVersion(row,versionId))||null;deckId=deck?.id||'';if(deckId)remember(deckId);
    }
    if(!deckId){toast('Could not identify this saved version');return}
    await window.PTCGPlaytestLaunch.open({deckId,deckVersionId:versionId,source:'deck-version',targetUrl:PLAYTEST_TARGET});
  }catch(error){toast(error.message||'Playtest could not start')}
}
function enhanceVersions(){
  document.querySelectorAll('[data-load-version]').forEach(loadButton=>{
    const row=loadButton.closest('.version-row');if(!row||row.querySelector('[data-playtest-version]'))return;
    const button=document.createElement('button');button.type='button';button.dataset.playtestVersion=loadButton.dataset.loadVersion;button.textContent='Playtest';button.className='version-playtest-button';loadButton.insertAdjacentElement('beforebegin',button);
  });
}
function bind(){
  document.addEventListener('pointerdown',event=>{const card=event.target.closest('.deck-card[data-id]');if(card)remember(card.dataset.id)},true);
  document.addEventListener('keydown',event=>{if(event.key!=='Enter'&&event.key!==' ')return;const card=event.target.closest('.deck-card[data-id]');if(card)remember(card.dataset.id)},true);
  document.addEventListener('click',event=>{
    const card=event.target.closest('.deck-card[data-id]');if(card)remember(card.dataset.id);
    const button=event.target.closest('[data-playtest-version]');if(button){event.preventDefault();event.stopPropagation();launchVersion(button.dataset.playtestVersion)}
  },true);
  const playtest=$('playtestButton');if(playtest){playtest.disabled=false;playtest.textContent='▶ Playtest';playtest.addEventListener('click',launchWorking)}
  new MutationObserver(enhanceVersions).observe(document.documentElement,{childList:true,subtree:true});enhanceVersions();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
