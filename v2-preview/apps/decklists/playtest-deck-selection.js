(function(){
'use strict';

let deckSelection=null;
const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const core=()=>window.PTCGPlaytestCore;
const state=()=>core()?.getState?.()||null;
const cardById=id=>state()?.cards?.find(card=>card.id===id)||null;
const zoneOf=id=>Object.keys(state()?.zones||{}).find(key=>(state().zones[key]||[]).includes(id))||null;
const isPokemon=card=>card?.section==='pokemon';
const isEnergy=card=>card?.section==='energy';
const isTrainer=card=>card?.section==='trainers';

function removeFromZones(s,id){Object.keys(s.zones||{}).forEach(key=>{s.zones[key]=(s.zones[key]||[]).filter(cardId=>cardId!==id)})}
function clearLinks(card){if(!card)return;card.attachedTo=null;card.stackedUnder=null;card.rotated=false}

function selectionBar(){return $('#selectionBar')}
function renderSelection(){
  $$('.deck-search-target').forEach(el=>el.classList.remove('deck-search-target','is-target'));
  const bar=selectionBar();
  if(!deckSelection){if(bar&&bar.dataset.deckSearchSelection==='1'){bar.hidden=true;bar.dataset.deckSearchSelection='0'}return}
  const card=cardById(deckSelection);if(!card){deckSelection=null;renderSelection();return}
  if(bar){
    bar.hidden=false;bar.dataset.deckSearchSelection='1';
    const name=$('#selectionName'),hint=$('#selectionHint');if(name)name.textContent=card.name;if(hint)hint.textContent='Tap where this card should go';
    const more=$('#selectionMore');if(more)more.hidden=true;
    let lost=bar.querySelector('[data-deck-destination="lost"]');
    if(!lost){lost=document.createElement('button');lost.type='button';lost.dataset.deckDestination='lost';lost.textContent='Lost Zone';bar.insertBefore(lost,$('#selectionCancel')||null)}
    let prizes=bar.querySelector('[data-deck-destination="prizes"]');
    if(!prizes){prizes=document.createElement('button');prizes.type='button';prizes.dataset.deckDestination='prizes';prizes.textContent='Prizes';bar.insertBefore(prizes,lost)}
  }
  const targets=['#handTray','[data-zone-button="discard"]','[data-zone-button="prizes"]'];
  if(isTrainer(card))targets.push('[data-zone-button="stadium"]');
  if(isPokemon(card)){targets.push('[data-zone-button="active"]','[data-zone-target="bench"]');$$('.play-card[data-zone="active"],.play-card[data-zone="bench"]').forEach(el=>el.classList.add('deck-search-target','is-target'))}
  if(isEnergy(card))$$('.play-card[data-zone="active"],.play-card[data-zone="bench"]').forEach(el=>el.classList.add('deck-search-target','is-target'));
  targets.forEach(selector=>$$(selector).forEach(el=>el.classList.add('deck-search-target','is-target')));
}

function cancel(){deckSelection=null;const bar=selectionBar();if(bar){bar.querySelector('[data-deck-destination="lost"]')?.remove();bar.querySelector('[data-deck-destination="prizes"]')?.remove();const more=$('#selectionMore');if(more)more.hidden=false}renderSelection()}

function mutateTo(destination,targetId=null){
  const c=core(),id=deckSelection,card=cardById(id);if(!c?.mutate||!id||!card)return false;
  const label=targetId?`${card.name} from Deck → ${destination}`:`${card.name} from Deck → ${destination}`;
  deckSelection=null;
  c.mutate(label,s=>{
    const selected=s.cards.find(row=>row.id===id);if(!selected)return;
    if(destination==='evolve'){
      const target=s.cards.find(row=>row.id===targetId);const targetZone=Object.keys(s.zones||{}).find(key=>(s.zones[key]||[]).includes(targetId));
      if(!target||!['active','bench'].includes(targetZone))return;
      const index=s.zones[targetZone].indexOf(targetId);
      removeFromZones(s,id);removeFromZones(s,targetId);
      target.stackedUnder=selected.id;target.attachedTo=null;s.zones.under.push(target.id);
      (s.zones.attached||[]).map(attachedId=>s.cards.find(row=>row.id===attachedId)).filter(row=>row?.attachedTo===targetId).forEach(row=>row.attachedTo=selected.id);
      selected.damage=target.damage||0;selected.rotated=!!target.rotated;selected.stackedUnder=null;selected.attachedTo=null;
      s.zones[targetZone].splice(Math.max(0,index),0,selected.id);return;
    }
    if(destination==='attach'){
      const target=s.cards.find(row=>row.id===targetId);if(!target)return;
      removeFromZones(s,id);selected.attachedTo=targetId;selected.stackedUnder=null;selected.rotated=false;s.zones.attached.push(id);return;
    }
    if(destination==='stadium'){
      [...(s.zones.stadium||[])].forEach(oldId=>{removeFromZones(s,oldId);const old=s.cards.find(row=>row.id===oldId);clearLinks(old);s.zones.discard.push(oldId)});
      removeFromZones(s,id);clearLinks(selected);s.zones.stadium=[id];return;
    }
    removeFromZones(s,id);clearLinks(selected);s.zones[destination].push(id);
  });
  cancel();
  c.toast?.(`Moved to ${destination==='lost'?'Lost Zone':destination}`);
  return true;
}

function chooseSearchCard(id){
  const s=state();if(!s?.zones?.deck?.includes(id))return;
  deckSelection=id;core()?.closeSheet?.();renderSelection();core()?.toast?.('Choose destination');
}

function onClick(event){
  const search=event.target.closest('[data-search-card]');
  if(search){event.preventDefault();event.stopImmediatePropagation();chooseSearchCard(search.dataset.searchCard);return}
  if(!deckSelection)return;
  const card=cardById(deckSelection);if(!card){cancel();return}
  const cancelButton=event.target.closest('#selectionCancel');if(cancelButton){event.preventDefault();event.stopImmediatePropagation();cancel();return}
  const explicit=event.target.closest('[data-deck-destination]');if(explicit){event.preventDefault();event.stopImmediatePropagation();mutateTo(explicit.dataset.deckDestination);return}
  const fieldCard=event.target.closest('.play-card[data-card-id][data-zone]');
  if(fieldCard&&['active','bench'].includes(fieldCard.dataset.zone)){
    if(isPokemon(card)){event.preventDefault();event.stopImmediatePropagation();mutateTo('evolve',fieldCard.dataset.cardId);return}
    if(isEnergy(card)){event.preventDefault();event.stopImmediatePropagation();mutateTo('attach',fieldCard.dataset.cardId);return}
  }
  const active=event.target.closest('[data-zone-button="active"]');if(active&&isPokemon(card)&&!(active.querySelector('.play-card'))){event.preventDefault();event.stopImmediatePropagation();mutateTo('active');return}
  const bench=event.target.closest('[data-zone-target="bench"]');if(bench&&isPokemon(card)){event.preventDefault();event.stopImmediatePropagation();mutateTo('bench');return}
  const discard=event.target.closest('[data-zone-button="discard"]');if(discard){event.preventDefault();event.stopImmediatePropagation();mutateTo('discard');return}
  const prizes=event.target.closest('[data-zone-button="prizes"]');if(prizes){event.preventDefault();event.stopImmediatePropagation();mutateTo('prizes');return}
  const stadium=event.target.closest('[data-zone-button="stadium"]');if(stadium&&isTrainer(card)){event.preventDefault();event.stopImmediatePropagation();mutateTo('stadium');return}
  const hand=event.target.closest('#handTray');if(hand&&!event.target.closest('.play-card,button')){event.preventDefault();event.stopImmediatePropagation();mutateTo('hand');return}
  const handHead=event.target.closest('.hand-head');if(handHead&&!event.target.closest('button')){event.preventDefault();event.stopImmediatePropagation();mutateTo('hand');return}
}

document.addEventListener('click',onClick,true);
window.addEventListener('ptcg-playtest-render',()=>{if(deckSelection)renderSelection()});
})();
