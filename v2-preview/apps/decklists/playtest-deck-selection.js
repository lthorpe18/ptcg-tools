(function(){
'use strict';

let deckSelection=null;
let randomView=false;
const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const core=()=>window.PTCGPlaytestCore;
const state=()=>core()?.getState?.()||null;
const cardById=id=>state()?.cards?.find(card=>card.id===id)||null;
const zoneOf=id=>Object.keys(state()?.zones||{}).find(key=>(state().zones[key]||[]).includes(id))||null;
const isPokemon=card=>card?.section==='pokemon';
const isEnergy=card=>card?.section==='energy';
const isTrainer=card=>card?.section==='trainers';
const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const setCode=card=>String(card?.set||'').trim().toUpperCase();
const cardNumber=card=>{const raw=String(card?.number||'').trim(),match=raw.match(/\d+/);return match?String(Number(match[0])).padStart(3,'0'):raw.padStart(3,'0')};
const imageUrl=card=>{const set=setCode(card),num=cardNumber(card);return set&&num?`https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/${encodeURIComponent(set)}/${encodeURIComponent(set)}_${encodeURIComponent(num)}_R_EN.png`:''};

function removeFromZones(s,id){Object.keys(s.zones||{}).forEach(key=>{s.zones[key]=(s.zones[key]||[]).filter(cardId=>cardId!==id)})}
function clearLinks(card){if(!card)return;card.attachedTo=null;card.stackedUnder=null;card.rotated=false}
function shuffled(ids){const copy=[...ids];for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}return copy}

function selectionBar(){return $('#selectionBar')}
function ensureDestinationButton(bar,key,label,before){let button=bar.querySelector(`[data-deck-destination="${key}"]`);if(!button){button=document.createElement('button');button.type='button';button.dataset.deckDestination=key;button.textContent=label;bar.insertBefore(button,before||null)}return button}
function renderSelection(){
  $$('.deck-search-target').forEach(el=>el.classList.remove('deck-search-target','is-target'));
  const bar=selectionBar();
  if(!deckSelection){if(bar&&bar.dataset.deckSearchSelection==='1'){bar.hidden=true;bar.dataset.deckSearchSelection='0'}return}
  const card=cardById(deckSelection);if(!card){deckSelection=null;renderSelection();return}
  if(bar){
    bar.hidden=false;bar.dataset.deckSearchSelection='1';
    const name=$('#selectionName'),hint=$('#selectionHint');if(name)name.textContent=card.name;if(hint)hint.textContent='Tap a destination';
    const more=$('#selectionMore');if(more)more.hidden=true;
    const cancel=$('#selectionCancel');
    ensureDestinationButton(bar,'hand','Hand',cancel);
    ensureDestinationButton(bar,'prizes','Prizes',cancel);
    ensureDestinationButton(bar,'lost','Lost Zone',cancel);
  }
  const targets=['#handTray','[data-zone-button="discard"]','[data-zone-button="prizes"]'];
  if(isTrainer(card))targets.push('[data-zone-button="stadium"]');
  if(isPokemon(card)){targets.push('[data-zone-button="active"]','[data-zone-target="bench"]');$$('.play-card[data-zone="active"],.play-card[data-zone="bench"]').forEach(el=>el.classList.add('deck-search-target','is-target'))}
  if(isEnergy(card))$$('.play-card[data-zone="active"],.play-card[data-zone="bench"]').forEach(el=>el.classList.add('deck-search-target','is-target'));
  targets.forEach(selector=>$$(selector).forEach(el=>el.classList.add('deck-search-target','is-target')));
}

function cancel(){deckSelection=null;const bar=selectionBar();if(bar){bar.querySelectorAll('[data-deck-destination]').forEach(el=>el.remove());const more=$('#selectionMore');if(more)more.hidden=false}renderSelection()}

function mutateTo(destination,targetId=null){
  const c=core(),id=deckSelection,card=cardById(id);if(!c?.mutate||!id||!card)return false;
  const label=`${card.name} from Deck → ${destination}`;
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

function renderRandomDeckView(){
  const sheet=$('#sheet'),body=$('#sheetBody');if(!sheet||sheet.hidden||$('#sheetTitle')?.textContent!=='Search Deck'||!body)return;
  const list=body.querySelector('.search-list');if(!list)return;
  let controls=body.querySelector('.deck-view-toggle');
  if(!controls){
    controls=document.createElement('div');controls.className='pt-sheet-actions deck-view-toggle';
    controls.innerHTML='<button type="button" data-deck-view="list">List</button><button type="button" data-deck-view="random">Random</button>';
    body.insertBefore(controls,list);
  }
  controls.querySelectorAll('[data-deck-view]').forEach(button=>button.classList.toggle('primary',(button.dataset.deckView==='random')===randomView));
  if(!randomView){
    list.querySelectorAll('[data-random-copy="1"]').forEach(el=>el.remove());
    list.querySelectorAll('.search-row[data-search-card]').forEach(el=>el.hidden=false);
    return;
  }
  list.querySelectorAll('.search-row[data-search-card]').forEach(el=>el.hidden=true);
  list.querySelectorAll('[data-random-copy="1"]').forEach(el=>el.remove());
  const ids=shuffled([...(state()?.zones?.deck||[])]);
  ids.forEach(id=>{
    const card=cardById(id);if(!card)return;
    const row=document.createElement('button');row.type='button';row.className='search-row';row.dataset.searchCard=id;row.dataset.randomCopy='1';
    const url=imageUrl(card);
    row.innerHTML=`${url?`<img class="search-thumb" src="${esc(url)}" alt="" loading="lazy" decoding="async">`:''}<span class="search-copy"><strong>${esc(card.name)}</strong><small>${esc([card.set,card.number].filter(Boolean).join(' '))}</small></span><span class="row-count">1</span>`;
    list.appendChild(row);
  });
}

function onClick(event){
  const view=event.target.closest('[data-deck-view]');if(view){event.preventDefault();event.stopImmediatePropagation();randomView=view.dataset.deckView==='random';renderRandomDeckView();return}
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
window.addEventListener('ptcg-playtest-render',()=>{if(deckSelection)renderSelection();renderRandomDeckView()});
setInterval(renderRandomDeckView,500);
})();
