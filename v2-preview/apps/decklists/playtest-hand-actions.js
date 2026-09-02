(function(){
'use strict';
const ACTIVE_KEY='ptcg-tools.playtest.active.v2';
const UNDO_KEY='ptcg-tools.playtest.bulk-undo.v1';
const $=selector=>document.querySelector(selector);

function readState(){try{return JSON.parse(localStorage.getItem(ACTIVE_KEY)||'null')}catch{return null}}
function writeState(state){state.updatedAt=new Date().toISOString();localStorage.setItem(ACTIVE_KEY,JSON.stringify(state))}
function shuffled(ids){const copy=[...ids];for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}return copy}
function saveUndo(state){try{sessionStorage.setItem(UNDO_KEY,JSON.stringify(state))}catch{}}
function clearUndo(){try{sessionStorage.removeItem(UNDO_KEY)}catch{}}
function hasUndo(){try{return !!sessionStorage.getItem(UNDO_KEY)}catch{return false}}
function log(state,text){if(!Array.isArray(state.history))state.history=[];state.history.unshift({at:Date.now(),text});state.history=state.history.slice(0,40)}
function reload(){location.reload()}
function mutate(label,fn){const state=readState();if(!state?.zones)return;saveUndo(state);fn(state);log(state,label);writeState(state);reload()}

function selectedHandCard(){return $('#handZone .play-card.is-selected[data-card-id]')}
function updateDeckTarget(){const deck=$('.side-pile[data-zone-button="deck"]');if(!deck)return;deck.classList.toggle('is-target',!!selectedHandCard())}
function refreshUndo(){const button=document.getElementById('undoButton');if(button&&hasUndo())button.disabled=false}

function handAction(action){
  const state=readState();if(!state?.zones)return;
  const hand=[...(state.zones.hand||[])];if(!hand.length)return;
  if(action==='shuffle-in'){
    mutate(`Shuffled ${hand.length} hand card${hand.length===1?'':'s'} into deck`,s=>{s.zones.deck=shuffled([...(s.zones.deck||[]),...(s.zones.hand||[])]);s.zones.hand=[]});
  }else if(action==='bottom'){
    mutate(`Shuffled ${hand.length} hand card${hand.length===1?'':'s'} onto bottom of deck`,s=>{s.zones.deck=[...(s.zones.deck||[]),...shuffled(s.zones.hand||[])];s.zones.hand=[]});
  }else if(action==='discard-all'){
    mutate(`Discarded ${hand.length} hand card${hand.length===1?'':'s'}`,s=>{s.zones.discard=[...(s.zones.discard||[]),...(s.zones.hand||[])];s.zones.hand=[]});
  }
}

function moveSelectedToTop(){
  const selected=selectedHandCard();if(!selected)return false;
  const id=selected.dataset.cardId;
  mutate('Put a card from hand on top of deck',state=>{
    state.zones.hand=(state.zones.hand||[]).filter(cardId=>cardId!==id);
    state.zones.deck=[id,...(state.zones.deck||[]).filter(cardId=>cardId!==id)];
  });
  return true;
}

function undoBulk(){
  let snapshot='';try{snapshot=sessionStorage.getItem(UNDO_KEY)||''}catch{}
  if(!snapshot)return false;
  try{localStorage.setItem(ACTIVE_KEY,snapshot);clearUndo();reload();return true}catch{return false}
}

document.addEventListener('click',event=>{
  const handButton=event.target.closest('[data-hand-action]');
  if(handButton){event.preventDefault();event.stopImmediatePropagation();handAction(handButton.dataset.handAction);return}

  const undo=event.target.closest('#undoButton');
  if(undo&&hasUndo()){event.preventDefault();event.stopImmediatePropagation();undoBulk();return}

  const deck=event.target.closest('.side-pile[data-zone-button="deck"]');
  if(deck&&selectedHandCard()){event.preventDefault();event.stopImmediatePropagation();moveSelectedToTop();return}

  if(hasUndo()&&event.target.closest('button,.play-card'))clearUndo();
},true);

new MutationObserver(()=>{updateDeckTarget();refreshUndo()}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','disabled']});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{updateDeckTarget();refreshUndo()});else{updateDeckTarget();refreshUndo()}
})();