(function(){
'use strict';
const ACTIVE_KEY='ptcg-tools.playtest.active.v2';
const UNDO_KEY='ptcg-tools.playtest.enhancement-undo.v1';
const MARKERS=[
  ['ability','Ability used'],['poisoned','Poisoned'],['burned','Burned'],
  ['asleep','Asleep'],['confused','Confused'],['paralyzed','Paralyzed']
];
const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];

function readState(){try{return JSON.parse(localStorage.getItem(ACTIVE_KEY)||'null')}catch{return null}}
function writeState(state){state.updatedAt=new Date().toISOString();localStorage.setItem(ACTIVE_KEY,JSON.stringify(state))}
function saveUndo(state){try{sessionStorage.setItem(UNDO_KEY,JSON.stringify(state))}catch{}}
function clearUndo(){try{sessionStorage.removeItem(UNDO_KEY)}catch{}}
function hasUndo(){try{return !!sessionStorage.getItem(UNDO_KEY)}catch{return false}}
function log(state,text){if(!Array.isArray(state.history))state.history=[];state.history.unshift({at:Date.now(),text});state.history=state.history.slice(0,40)}
function shuffled(ids){const copy=[...ids];for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}return copy}
function cardById(state,id){return state?.cards?.find(card=>card.id===id)||null}
function reload(){location.reload()}
function mutate(label,fn){const state=readState();if(!state?.zones)return;saveUndo(state);fn(state);log(state,label);writeState(state);reload()}
function selectedHandCard(){return $('#handZone .play-card.is-selected[data-card-id]')}

function handAction(action){
  const state=readState();if(!state?.zones)return;
  const hand=[...(state.zones.hand||[])];if(!hand.length)return;
  if(action==='shuffle-in')mutate(`Shuffled ${hand.length} hand card${hand.length===1?'':'s'} into deck`,s=>{s.zones.deck=shuffled([...(s.zones.deck||[]),...(s.zones.hand||[])]);s.zones.hand=[]});
  if(action==='bottom')mutate(`Shuffled ${hand.length} hand card${hand.length===1?'':'s'} onto bottom of deck`,s=>{s.zones.deck=[...(s.zones.deck||[]),...shuffled(s.zones.hand||[])];s.zones.hand=[]});
  if(action==='discard-all')mutate(`Discarded ${hand.length} hand card${hand.length===1?'':'s'}`,s=>{s.zones.discard=[...(s.zones.discard||[]),...(s.zones.hand||[])];s.zones.hand=[]});
}
function moveSelectedToTop(){
  const selected=selectedHandCard();if(!selected)return false;const id=selected.dataset.cardId;
  mutate('Put a card from hand on top of deck',state=>{state.zones.hand=(state.zones.hand||[]).filter(cardId=>cardId!==id);state.zones.deck=[id,...(state.zones.deck||[]).filter(cardId=>cardId!==id)]});
  return true;
}
function endTurnAndDraw(){
  const state=readState();if(!state?.zones)return;
  const nextTurn=Number(state.turn||1)+1;const canDraw=(state.zones.deck||[]).length>0;
  mutate(canDraw?`Started turn ${nextTurn} — drew 1 card`:`Started turn ${nextTurn} — deck empty`,s=>{
    s.turn=nextTurn;s.coin=null;
    if(canDraw)s.zones.hand.push(s.zones.deck.shift());
  });
}
function toggleMarker(cardId,marker){
  const label=MARKERS.find(([key])=>key===marker)?.[1]||marker;
  mutate(`Toggled ${label}`,state=>{const card=cardById(state,cardId);if(!card)return;if(!Array.isArray(card.markers))card.markers=[];card.markers=card.markers.includes(marker)?card.markers.filter(value=>value!==marker):[...card.markers,marker]});
}
function undoEnhancement(){let snapshot='';try{snapshot=sessionStorage.getItem(UNDO_KEY)||''}catch{}if(!snapshot)return false;try{localStorage.setItem(ACTIVE_KEY,snapshot);clearUndo();reload();return true}catch{return false}}

function markerLabel(key){return MARKERS.find(([marker])=>marker===key)?.[1]||key}
function renderCardMarkers(){
  const state=readState();if(!state)return;
  $$('.play-card[data-card-id]').forEach(el=>{
    const card=cardById(state,el.dataset.cardId);const markers=Array.isArray(card?.markers)?card.markers:[];
    let tray=el.querySelector('.playtest-marker-tray');
    if(!markers.length){tray?.remove();return}
    const signature=markers.join('|');
    if(!tray){tray=document.createElement('span');tray.className='playtest-marker-tray';el.appendChild(tray)}
    if(tray.dataset.signature===signature)return;
    tray.dataset.signature=signature;
    tray.innerHTML=markers.map(marker=>`<span class="playtest-marker marker-${marker}" title="${markerLabel(marker)}">${marker==='ability'?'A':marker==='poisoned'?'P':marker==='burned'?'B':marker==='asleep'?'Z':marker==='confused'?'?':'!'}</span>`).join('');
  });
}
function injectMarkerControls(){
  const sheet=$('#sheet');if(!sheet||sheet.hidden)return;
  const body=$('#sheetBody');if(!body||body.querySelector('.marker-controls'))return;
  const cardButton=body.querySelector('[data-move-card]')||body.querySelector('[data-card-id]');
  let cardId=cardButton?.dataset?.moveCard||cardButton?.dataset?.cardId||null;
  if(!cardId){const title=$('#sheetTitle')?.textContent||'';const state=readState();cardId=state?.cards?.find(card=>card.name===title)?.id||null}
  if(!cardId)return;
  const state=readState();const card=cardById(state,cardId);if(!card)return;
  const zone=Object.keys(state.zones||{}).find(key=>(state.zones[key]||[]).includes(cardId));
  if(!['active','bench'].includes(zone))return;
  const wrap=document.createElement('div');wrap.className='marker-controls';
  wrap.innerHTML=`<div class="sheet-section-title">Markers</div><div class="marker-grid">${MARKERS.map(([key,label])=>`<button type="button" data-marker="${key}" data-marker-card="${cardId}" class="${card.markers?.includes(key)?'active':''}">${label}</button>`).join('')}</div>`;
  body.appendChild(wrap);
}
function updateDeckTarget(){const deck=$('.side-pile[data-zone-button="deck"]');if(deck)deck.classList.toggle('is-target',!!selectedHandCard())}
function refreshUndo(){const button=$('#undoButton');if(button&&hasUndo()&&button.disabled)button.disabled=false}
function refresh(){renderCardMarkers();injectMarkerControls();updateDeckTarget();refreshUndo()}

document.addEventListener('click',event=>{
  const handButton=event.target.closest('[data-hand-action]');if(handButton){event.preventDefault();event.stopImmediatePropagation();handAction(handButton.dataset.handAction);return}
  const marker=event.target.closest('[data-marker][data-marker-card]');if(marker){event.preventDefault();event.stopImmediatePropagation();toggleMarker(marker.dataset.markerCard,marker.dataset.marker);return}
  const end=event.target.closest('#endTurn');if(end){event.preventDefault();event.stopImmediatePropagation();endTurnAndDraw();return}
  const undo=event.target.closest('#undoButton');if(undo&&hasUndo()){event.preventDefault();event.stopImmediatePropagation();undoEnhancement();return}
  const deck=event.target.closest('.side-pile[data-zone-button="deck"]');if(deck&&selectedHandCard()){event.preventDefault();event.stopImmediatePropagation();moveSelectedToTop();return}
  if(hasUndo()&&event.target.closest('button,.play-card'))clearUndo();
},true);

function startRefreshLoop(){refresh();window.setInterval(refresh,400)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startRefreshLoop,{once:true});else startRefreshLoop();
})();