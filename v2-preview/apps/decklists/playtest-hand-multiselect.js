(function(){
'use strict';

const selected=new Set();
const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const core=()=>window.PTCGPlaytestCore;
const state=()=>core()?.getState?.()||null;
const card=id=>state()?.cards?.find(row=>row.id===id)||null;
const inHand=id=>(state()?.zones?.hand||[]).includes(id);
const isPokemon=row=>row?.section==='pokemon';
const isEnergy=row=>row?.section==='energy';
const isTrainer=row=>row?.section==='trainers';

function installStyles(){
  if(document.getElementById('playtestHandMultiStyles'))return;
  const style=document.createElement('style');
  style.id='playtestHandMultiStyles';
  style.textContent=`
    #handZone .play-card.pt-multi-selected .card-frame{outline:3px solid #7ff0b8!important;outline-offset:2px;box-shadow:0 0 0 2px rgba(11,85,53,.78),0 4px 12px rgba(0,0,0,.28)!important}
    #handZone .play-card.pt-multi-selected{z-index:15!important;transform:translateY(-5px)!important}
    .pt-multi-target{border-color:rgba(174,255,215,.82)!important;background:rgba(98,220,158,.14)!important;box-shadow:inset 0 0 0 1px rgba(174,255,215,.24),0 0 0 2px rgba(36,153,94,.12)!important}
    .selection-bar[data-hand-multi="1"] strong:after{content:attr(data-count);display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;margin-left:6px;padding:0 5px;border-radius:999px;background:#175cd3;color:#fff;font-size:9px}
  `;
  document.head.appendChild(style);
}

function clean(){
  [...selected].forEach(id=>{if(!inHand(id))selected.delete(id)});
}
function rows(){clean();return [...selected].map(card).filter(Boolean)}
function all(predicate){const list=rows();return list.length>0&&list.every(predicate)}
function clearVisualTargets(){
  $$('.pt-multi-target').forEach(el=>el.classList.remove('pt-multi-target','is-target'));
  $$('#handZone .play-card.pt-multi-selected').forEach(el=>el.classList.remove('pt-multi-selected'));
}
function addTarget(selector){$$(selector).forEach(el=>el.classList.add('pt-multi-target','is-target'))}

function render(){
  clean();clearVisualTargets();
  const list=rows(),bar=$('#selectionBar');
  if(!list.length){
    if(bar?.dataset.handMulti==='1'){bar.hidden=true;bar.dataset.handMulti='0';bar.removeAttribute('data-count');const more=$('#selectionMore');if(more)more.hidden=false}
    return;
  }
  list.forEach(row=>$('#handZone .play-card[data-card-id="'+CSS.escape(row.id)+'"]')?.classList.add('pt-multi-selected'));
  if(bar){
    bar.hidden=false;bar.dataset.handMulti='1';bar.dataset.count=String(list.length);
    const name=$('#selectionName'),hint=$('#selectionHint'),more=$('#selectionMore');
    if(name){name.textContent=list.length===1?list[0].name:`${list.length} cards selected`;name.dataset.count=list.length>1?String(list.length):''}
    if(hint)hint.textContent=list.length===1?'Tap another Hand card to add it, or tap a destination':'Tap a destination to apply it to all selected cards';
    if(more)more.hidden=list.length>1;
  }
  addTarget('[data-zone-button="discard"]');
  addTarget('.side-pile[data-zone-button="deck"]');
  addTarget('[data-zone-button="prizes"]');
  if(all(isPokemon)){
    const s=state(),space=Math.max(0,8-(s?.zones?.bench?.length||0));
    if(space>=list.length)addTarget('[data-zone-target="bench"]');
    if(list.length===1&&!(s?.zones?.active||[]).length)addTarget('[data-zone-button="active"]');
    if(list.length===1)$$('.play-card[data-zone="active"],.play-card[data-zone="bench"]').forEach(el=>el.classList.add('pt-multi-target','is-target'));
  }
  if(all(isEnergy))$$('.play-card[data-zone="active"],.play-card[data-zone="bench"]').forEach(el=>el.classList.add('pt-multi-target','is-target'));
  if(list.length===1&&all(isTrainer))addTarget('[data-zone-button="stadium"]');
}

function cancel(){selected.clear();render()}
function removeFromZones(s,id){Object.keys(s.zones||{}).forEach(key=>{s.zones[key]=(s.zones[key]||[]).filter(cardId=>cardId!==id)})}
function resetLinks(row){if(!row)return;row.attachedTo=null;row.stackedUnder=null;row.rotated=false}
function mutateGroup(destination,targetId=null){
  const c=core(),ids=[...selected],cards=rows();if(!c?.mutate||!ids.length)return false;
  c.mutate(`${ids.length} Hand card${ids.length===1?'':'s'} → ${destination}`,s=>{
    const live=ids.map(id=>s.cards.find(row=>row.id===id)).filter(Boolean);
    if(destination==='attach'){
      live.forEach(row=>{removeFromZones(s,row.id);resetLinks(row);row.attachedTo=targetId;s.zones.attached.push(row.id)});return;
    }
    if(destination==='evolve'){
      const evolution=live[0],target=s.cards.find(row=>row.id===targetId),targetZone=Object.keys(s.zones||{}).find(key=>(s.zones[key]||[]).includes(targetId));
      if(!evolution||!target||!['active','bench'].includes(targetZone))return;
      const index=s.zones[targetZone].indexOf(targetId);
      removeFromZones(s,evolution.id);removeFromZones(s,targetId);
      target.stackedUnder=evolution.id;target.attachedTo=null;s.zones.under.push(target.id);
      (s.zones.attached||[]).map(id=>s.cards.find(row=>row.id===id)).filter(row=>row?.attachedTo===targetId).forEach(row=>row.attachedTo=evolution.id);
      evolution.damage=target.damage||0;evolution.rotated=!!target.rotated;evolution.stackedUnder=null;evolution.attachedTo=null;
      s.zones[targetZone].splice(Math.max(0,index),0,evolution.id);return;
    }
    if(destination==='stadium'){
      [...(s.zones.stadium||[])].forEach(oldId=>{removeFromZones(s,oldId);const old=s.cards.find(row=>row.id===oldId);resetLinks(old);s.zones.discard.push(oldId)});
      const row=live[0];removeFromZones(s,row.id);resetLinks(row);s.zones.stadium=[row.id];return;
    }
    live.forEach(row=>{removeFromZones(s,row.id);resetLinks(row)});
    if(destination==='deck')s.zones.deck=[...ids,...(s.zones.deck||[])];
    else if(destination==='bench')s.zones.bench.push(...ids);
    else s.zones[destination].push(...ids);
  });
  selected.clear();render();c.toast?.(`${cards.length} card${cards.length===1?'':'s'} moved`);return true;
}

function toggleHandCard(id){
  if(!inHand(id))return false;
  core()?.clearSelection?.();
  if(selected.has(id))selected.delete(id);else selected.add(id);
  render();return true;
}

function onClick(event){
  const handCard=event.target.closest('#handZone .play-card[data-card-id]');
  if(handCard){event.preventDefault();event.stopImmediatePropagation();toggleHandCard(handCard.dataset.cardId);return}
  if(!selected.size)return;
  const cancelButton=event.target.closest('#selectionCancel');if(cancelButton){event.preventDefault();event.stopImmediatePropagation();cancel();return}
  const list=rows();
  const field=event.target.closest('.play-card[data-card-id][data-zone]');
  if(field&&['active','bench'].includes(field.dataset.zone)){
    if(all(isEnergy)){event.preventDefault();event.stopImmediatePropagation();mutateGroup('attach',field.dataset.cardId);return}
    if(list.length===1&&all(isPokemon)){event.preventDefault();event.stopImmediatePropagation();mutateGroup('evolve',field.dataset.cardId);return}
  }
  const bench=event.target.closest('[data-zone-target="bench"]');if(bench&&all(isPokemon)){const space=Math.max(0,8-(state()?.zones?.bench?.length||0));if(space>=list.length){event.preventDefault();event.stopImmediatePropagation();mutateGroup('bench');return}}
  const active=event.target.closest('[data-zone-button="active"]');if(active&&list.length===1&&all(isPokemon)&&!(state()?.zones?.active||[]).length){event.preventDefault();event.stopImmediatePropagation();mutateGroup('active');return}
  const discard=event.target.closest('[data-zone-button="discard"]');if(discard){event.preventDefault();event.stopImmediatePropagation();mutateGroup('discard');return}
  const deck=event.target.closest('.side-pile[data-zone-button="deck"]');if(deck){event.preventDefault();event.stopImmediatePropagation();mutateGroup('deck');return}
  const prizes=event.target.closest('[data-zone-button="prizes"]');if(prizes){event.preventDefault();event.stopImmediatePropagation();mutateGroup('prizes');return}
  const stadium=event.target.closest('[data-zone-button="stadium"]');if(stadium&&list.length===1&&all(isTrainer)){event.preventDefault();event.stopImmediatePropagation();mutateGroup('stadium');return}
}

document.addEventListener('click',onClick,true);
window.addEventListener('ptcg-playtest-render',()=>{if(selected.size)render()});
function start(){installStyles();render()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
