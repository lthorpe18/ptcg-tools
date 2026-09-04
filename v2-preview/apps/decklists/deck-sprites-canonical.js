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
    .deck-card-sprites,.deck-header-sprites{display:grid;place-items:center;min-width:48px;min-height:48px}
    .deck-card-sprites .deck-sprite-stack,.deck-card-sprites .deck-sprite,.deck-header-sprites .deck-sprite-stack,.deck-header-sprites .deck-sprite{position:relative;display:block;width:var(--sprite-size,48px);height:var(--sprite-size,48px)}
    .deck-card-sprites .deck-sprite-img,.deck-header-sprites .deck-sprite-img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
    .deck-card-sprites .deck-sprite-img.sprite-2,.deck-header-sprites .deck-sprite-img.sprite-2{width:65%;height:65%;left:46%;top:38%;filter:drop-shadow(0 1px 2px rgba(16,24,40,.16))}
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

function signature(archetype){
  return `${String(archetype||'')}|${JSON.stringify(window.DeckSprites?.slugs?.(archetype)||[])}`;
}

function renderTarget(target,archetype,size){
  if(!target||!window.DeckSprites)return;
  const sig=signature(archetype);
  if(target.dataset.canonicalDeckSprites===sig)return;
  target.dataset.canonicalDeckSprites=sig;
  target.innerHTML=window.DeckSprites.html(archetype||'',{size});
}

async function render(force=false){
  style();
  const map=await decks();
  document.querySelectorAll('#deckGrid .deck-card[data-id]').forEach(card=>{
    const deck=map.get(String(card.dataset.id));
    const target=card.querySelector('.deck-card-sprites');
    if(force&&target)delete target.dataset.canonicalDeckSprites;
    renderTarget(target,deck?.archetype||'',48);
  });

  const header=document.getElementById('deckHeaderSprites');
  const archetype=document.getElementById('deckArchetype')?.value||'';
  if(force&&header)delete header.dataset.canonicalDeckSprites;
  renderTarget(header,archetype,48);
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
  window.addEventListener('decksprites:updated',()=>schedule(true));
  window.addEventListener('ptcg:local-change',event=>{
    if(event.detail?.source==='decks'){deckCache=null;schedule(true)}
    if(event.detail?.source==='deck-icons')schedule(true);
  });
  schedule(true);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();