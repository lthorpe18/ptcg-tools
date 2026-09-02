(function(){
'use strict';
const ACTIVE_KEY='ptcg-tools.decklists.active-deck.v1';
const $=id=>document.getElementById(id);

function remember(id){if(id)try{sessionStorage.setItem(ACTIVE_KEY,id)}catch{}}
function remembered(){try{return sessionStorage.getItem(ACTIVE_KEY)||''}catch{return ''}}
function toast(message){const el=$('toast');if(!el)return;el.textContent=message;el.hidden=false;clearTimeout(el._t);el._t=setTimeout(()=>el.hidden=true,2200)}
async function launchWorking(){
  const deckId=remembered();if(!deckId){toast('Open the deck again, then start Playtest');return}
  const rawText=$('deckText')?.value||'';
  try{
    const listHash=await window.PTCGDeckParser.hashDecklist(rawText);
    await window.PTCGPlaytestLaunch.open({deckId,rawText,listHash,source:'working-list',targetUrl:'playtest.html'});
  }catch(error){toast(error.message||'Playtest could not start')}
}
async function launchVersion(versionId){
  const deckId=remembered();if(!deckId)return;
  try{await window.PTCGPlaytestLaunch.open({deckId,deckVersionId:versionId,source:'deck-version',targetUrl:'playtest.html'})}catch(error){toast(error.message||'Playtest could not start')}
}
function enhanceVersions(){
  document.querySelectorAll('[data-load-version]').forEach(loadButton=>{
    const row=loadButton.closest('.version-row');if(!row||row.querySelector('[data-playtest-version]'))return;
    const button=document.createElement('button');button.type='button';button.dataset.playtestVersion=loadButton.dataset.loadVersion;button.textContent='Playtest';button.className='version-playtest-button';loadButton.insertAdjacentElement('beforebegin',button);
  });
}
function bind(){
  document.addEventListener('pointerdown',event=>{const card=event.target.closest('.deck-card[data-id]');if(card)remember(card.dataset.id)},true);
  document.addEventListener('click',event=>{
    const card=event.target.closest('.deck-card[data-id]');if(card)remember(card.dataset.id);
    const button=event.target.closest('[data-playtest-version]');if(button){event.preventDefault();event.stopPropagation();launchVersion(button.dataset.playtestVersion)}
  },true);
  const playtest=$('playtestButton');if(playtest){playtest.disabled=false;playtest.textContent='▶ Playtest';playtest.addEventListener('click',launchWorking)}
  new MutationObserver(enhanceVersions).observe(document.documentElement,{childList:true,subtree:true});enhanceVersions();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
