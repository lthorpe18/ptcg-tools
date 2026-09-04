(function(){
'use strict';

// Deck/archetype presentation belongs to DeckSprites. Keep legacy deck.sprites
// fields readable for compatibility, but do not use or update them for current UI.
if(window.PTCGSprites){
  window.PTCGSprites.getIndex=async()=>[];
  window.PTCGSprites.searchNamesSync=()=>[];
  window.PTCGSprites.fetchSprite=async()=>null;
  window.PTCGSprites.getQuickSpriteUrl=()=>null;
}

let deckCache=null;
let scheduled=false;

function style(){
  if(document.getElementById('canonicalDeckSpriteStyle'))return;
  const el=document.createElement('style');
  el.id='canonicalDeckSpriteStyle';
  el.textContent=`
    .sprite-grid{display:none!important}
    .deck-card-sprites,.deck-header-sprites{display:flex;align-items:center;justify-content:center;min-width:48px;min-height:48px}
    .deck-card-sprites .deck-sprite-fallback,.deck-header-sprites .deck-sprite-fallback{display:grid;place-items:center;border-radius:50%;background:#f2f4f7;color:#475467;font-weight:800}
  `;
  document.head.appendChild(el);
}

async function decks(){
  if(deckCache)return deckCache;
  if(!window.PTCGDeckStore)return new Map();
  const rows=await window.PTCGDeckStore.all();
  deckCache=new Map(rows.map(deck=>[String(deck.id),deck]));
  return deckCache;
}

function signature(label){
  return `${String(label||'')}|${JSON.stringify(window.DeckSprites?.slugs?.(label)||[])}`;
}

function renderTarget(target,label,size){
  if(!target||!window.DeckSprites)return;
  const sig=signature(label);
  if(target.dataset.canonicalDeckSprites===sig)return;
  target.dataset.canonicalDeckSprites=sig;
  target.innerHTML=window.DeckSprites.html(label||'',{size});
}

async function render(force=false){
  style();
  const map=await decks();
  document.querySelectorAll('#deckGrid .deck-card[data-id]').forEach(card=>{
    const deck=map.get(String(card.dataset.id));
    const target=card.querySelector('.deck-card-sprites');
    const label=deck?.archetype||deck?.name||'';
    if(force&&target)delete target.dataset.canonicalDeckSprites;
    renderTarget(target,label,42);
  });

  const header=document.getElementById('deckHeaderSprites');
  const archetype=document.getElementById('deckArchetype')?.value||'';
  const deckName=document.getElementById('deckName')?.value||'';
  if(force&&header)delete header.dataset.canonicalDeckSprites;
  renderTarget(header,archetype||deckName,44);
}

function schedule(force=false){
  if(force){render(true).catch(console.error);return}
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{
    scheduled=false;
    render(false).catch(console.error);
  });
}

function init(){
  style();
  const root=document.querySelector('.decks-page');
  if(root)new MutationObserver(()=>schedule()).observe(root,{subtree:true,childList:true});
  document.getElementById('deckArchetype')?.addEventListener('input',()=>schedule(true));
  document.getElementById('deckName')?.addEventListener('input',()=>schedule(true));
  window.addEventListener('decksprites:updated',()=>schedule(true));
  window.addEventListener('storage',()=>schedule(true));
  window.addEventListener('ptcg:local-change',event=>{
    if(event.detail?.source==='decks'){deckCache=null;schedule(true)}
    if(event.detail?.source==='deck-icons')schedule(true);
  });
  schedule(true);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();