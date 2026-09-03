(function(){
'use strict';
const ACTIVE_KEY='ptcg-tools.playtest.active.v2';
const UNDO_KEY='ptcg-tools.playtest.enhancement-undo.v1';
const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];

function readState(){const live=window.PTCGPlaytestCore?.getState?.();if(live)return live;try{return JSON.parse(localStorage.getItem(ACTIVE_KEY)||'null')}catch{return null}}
function writeState(state){state.updatedAt=new Date().toISOString();localStorage.setItem(ACTIVE_KEY,JSON.stringify(state))}
function saveUndo(state){try{sessionStorage.setItem(UNDO_KEY,JSON.stringify(state))}catch{}}
function log(state,text){if(!Array.isArray(state.history))state.history=[];state.history.unshift({at:Date.now(),text});state.history=state.history.slice(0,40)}
function mutate(label,fn){const core=window.PTCGPlaytestCore;if(core?.mutate){core.mutate(label,fn);return true}const state=readState();if(!state?.zones)return false;saveUndo(state);fn(state);log(state,label);writeState(state);location.reload();return true}
function cardById(state,id){return state?.cards?.find(card=>card.id===id)||null}
function selectedElement(){return $('.play-card.is-selected[data-card-id]')}
function selectedId(){return selectedElement()?.dataset?.cardId||null}
function zoneOf(state,id){return Object.keys(state?.zones||{}).find(key=>(state.zones[key]||[]).includes(id))||null}
function removeFromZones(state,id){Object.keys(state.zones||{}).forEach(key=>{state.zones[key]=(state.zones[key]||[]).filter(cardId=>cardId!==id)})}
function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function cardMeta(card){return [card?.set,card?.number].filter(Boolean).join(' ')}

function installStyles(){
  if(document.getElementById('playtestCompletenessStyles'))return;
  const style=document.createElement('style');style.id='playtestCompletenessStyles';style.textContent=`
    .side-pile.pt-zone-target{border-color:rgba(174,255,215,.82)!important;background:rgba(98,220,158,.14)!important;box-shadow:inset 0 0 0 1px rgba(174,255,215,.24),0 0 0 2px rgba(36,153,94,.12)!important}
    .hand-tray.pt-zone-target{border-top-color:#55c58b!important;box-shadow:0 -2px 0 rgba(85,197,139,.34),0 -2px 8px rgba(16,24,40,.06)!important}
    .pt-sheet-actions{display:flex;gap:7px;margin:0 0 10px;flex-wrap:wrap}
    .pt-sheet-actions button{min-height:34px;padding:6px 10px;border:1px solid #d0d5dd;border-radius:9px;background:#fff;color:#344054;font-size:10px;font-weight:800}
    .pt-sheet-actions button.primary{background:#176b45;border-color:#176b45;color:#fff}
    .pt-sheet-actions button.danger{color:#b42318;border-color:#fecdca;background:#fff6f5}
    .pt-manage-list{display:grid;gap:7px}
    .pt-manage-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:7px 8px;border:1px solid #e4e7ec;border-radius:10px;background:#fff}
    .pt-manage-row strong{display:block;font-size:10px;line-height:1.15}.pt-manage-row small{display:block;margin-top:2px;color:#667085;font-size:8px}
    .pt-manage-buttons{display:flex;gap:4px}.pt-manage-buttons button{min-height:28px;padding:4px 7px;border:1px solid #d0d5dd;border-radius:8px;background:#f9fafb;color:#344054;font-size:8px;font-weight:850}
    .pt-manage-buttons button.danger{color:#b42318;background:#fff6f5;border-color:#fecdca}
    .pt-stack-note{margin:6px 0 0;color:#667085;font-size:9px;line-height:1.35}
  `;document.head.appendChild(style)
}

function directUnderIds(state,topId){return (state.zones.under||[]).filter(id=>cardById(state,id)?.stackedUnder===topId)}
function evolutionIds(state,topId){
  const result=[];let parents=[topId];
  while(parents.length){const parent=parents.shift();directUnderIds(state,parent).forEach(id=>{if(!result.includes(id)){result.push(id);parents.push(id)}})}
  return result;
}
function attachedIds(state,targetId){return (state.zones.attached||[]).filter(id=>cardById(state,id)?.attachedTo===targetId)}
function resetCardLinks(card){if(!card)return;card.attachedTo=null;card.stackedUnder=null;card.rotated=false}

function moveCardComplete(cardId,destination,label){
  const before=readState(),card=cardById(before,cardId);if(!card||!destination)return false;
  const from=zoneOf(before,cardId),field=['active','bench'].includes(from),under=field?evolutionIds(before,cardId):[],attachments=field?attachedIds(before,cardId):[];
  return mutate(label||`Moved ${card.name} to ${destination}`,state=>{
    const row=cardById(state,cardId);removeFromZones(state,cardId);resetCardLinks(row);
    if(destination==='deck')state.zones.deck=[cardId,...(state.zones.deck||[])];else state.zones[destination].push(cardId);
    if(field){
      under.forEach(id=>{const child=cardById(state,id);removeFromZones(state,id);resetCardLinks(child);if(destination==='deck')state.zones.deck=[...state.zones.deck,id];else state.zones[destination].push(id)});
      attachments.forEach(id=>{const attachment=cardById(state,id);removeFromZones(state,id);resetCardLinks(attachment);state.zones.discard.push(id)});
    }else if(from==='attached'){if(row)row.attachedTo=null}
    else if(from==='under'){if(row)row.stackedUnder=null}
  });
}

function replaceStadium(cardId){
  const before=readState(),card=cardById(before,cardId);if(!card)return false;
  return mutate(`Played Stadium — ${card.name}`,state=>{
    const old=[...(state.zones.stadium||[])];
    old.forEach(id=>{removeFromZones(state,id);const row=cardById(state,id);resetCardLinks(row);state.zones.discard.push(id)});
    removeFromZones(state,cardId);const row=cardById(state,cardId);resetCardLinks(row);state.zones.stadium=[cardId];
  });
}

function moveManagedCard(cardId,destination){const state=readState(),card=cardById(state,cardId);if(!card)return false;return moveCardComplete(cardId,destination,`${card.name} → ${destination==='lost'?'Lost Zone':destination}`)}
function shuffleDeck(){const core=window.PTCGPlaytestCore;if(core?.shuffleDeck){core.shuffleDeck();return true}const before=readState();if(!before?.zones?.deck||before.zones.deck.length<2)return false;return mutate('Shuffled deck',state=>{const deck=[...state.zones.deck];for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]]}state.zones.deck=deck})}
function drawTop(){const core=window.PTCGPlaytestCore;if(core?.draw){core.draw(1);return true}const before=readState();if(!before?.zones?.deck?.length)return false;const card=cardById(before,before.zones.deck[0]);return mutate(`Drew ${card?.name||'a card'}`,state=>{const id=state.zones.deck.shift();if(id)state.zones.hand.push(id)})}
function clearDamage(cardId){const state=readState(),card=cardById(state,cardId);if(!card)return false;return mutate(`Cleared damage from ${card.name}`,s=>{const row=cardById(s,cardId);if(row)row.damage=0})}
function changeDamage(cardId,delta){const state=readState(),card=cardById(state,cardId);if(!card)return false;return mutate(`${card.name}: damage ${delta>0?'+':''}${delta}`,s=>{const row=cardById(s,cardId);if(row)row.damage=Math.max(0,Number(row.damage||0)+delta)})}

function ensureSetupTurnZero(){
  const state=readState();if(!state?.zones)return;
  const history=(state.history||[]).map(entry=>String(entry?.text||''));
  const started=history.some(text=>/^Started turn /i.test(text));
  if(Number(state.turn)===1&&!started){state.turn=0;state.turnFlowV2=true;writeState(state);location.reload()}
}

function currentSheetCardId(){const body=$('#sheetBody');if(!body)return null;const move=body.querySelector('[data-move-card]');if(move?.dataset?.moveCard)return move.dataset.moveCard;const title=$('#sheetTitle')?.textContent||'',state=readState();return state?.cards?.find(card=>card.name===title)?.id||null}
function zoneRowCopy(card){return `<div><strong>${esc(card.name)}</strong><small>${esc(cardMeta(card))}</small></div>`}
function enhanceSearchSheet(){if($('#sheet')?.hidden||$('#sheetTitle')?.textContent!=='Search Deck')return;const body=$('#sheetBody');if(!body||body.querySelector('.pt-deck-actions'))return;const actions=document.createElement('div');actions.className='pt-sheet-actions pt-deck-actions';actions.innerHTML='<button type="button" class="primary" data-pt-deck-action="shuffle">Shuffle deck</button><button type="button" data-pt-deck-action="draw">Draw top card</button>';body.prepend(actions)}
function enhanceStadiumSheet(){if($('#sheet')?.hidden||$('#sheetTitle')?.textContent!=='Stadium')return;const state=readState(),id=state?.zones?.stadium?.[0],body=$('#sheetBody');if(!id||!body||body.querySelector('.pt-stadium-actions'))return;const actions=document.createElement('div');actions.className='pt-sheet-actions pt-stadium-actions';actions.innerHTML=`<button type="button" class="danger" data-pt-move-card="${esc(id)}" data-pt-destination="discard">Discard Stadium</button><button type="button" data-pt-move-card="${esc(id)}" data-pt-destination="hand">To hand</button>`;body.prepend(actions)}
function enhanceCardSheet(){
  const sheet=$('#sheet'),body=$('#sheetBody');if(!sheet||sheet.hidden||!body)return;
  const cardId=currentSheetCardId();if(!cardId||body.dataset.ptEnhancedCard===cardId)return;
  const state=readState(),card=cardById(state,cardId),from=zoneOf(state,cardId);if(!card)return;
  body.dataset.ptEnhancedCard=cardId;
  if(['active','bench'].includes(from)){
    const existingFieldTitle=[...body.querySelectorAll('.sheet-section-title')].find(el=>el.textContent.trim()==='On the field');
    if(existingFieldTitle){const grid=existingFieldTitle.nextElementSibling;if(grid&&!grid.querySelector('[data-pt-damage]')){const minus=document.createElement('button');minus.type='button';minus.dataset.ptDamage='-50';minus.dataset.ptCardId=cardId;minus.textContent='−50 damage';const clear=document.createElement('button');clear.type='button';clear.dataset.ptClearDamage=cardId;clear.textContent='Clear damage';const plus=document.createElement('button');plus.type='button';plus.dataset.ptDamage='50';plus.dataset.ptCardId=cardId;plus.textContent='+50 damage';grid.prepend(minus);grid.append(clear,plus)}}
  }
  const attached=attachedIds(state,cardId).map(id=>cardById(state,id)).filter(Boolean),under=evolutionIds(state,cardId).map(id=>cardById(state,id)).filter(Boolean);
  const oldTitle=[...body.querySelectorAll('.sheet-section-title')].find(el=>el.textContent.trim()==='Under / attached');if(oldTitle){const oldList=oldTitle.nextElementSibling;oldTitle.remove();oldList?.remove()}
  if(attached.length){const title=document.createElement('div');title.className='sheet-section-title';title.textContent='Attached cards';const list=document.createElement('div');list.className='pt-manage-list';list.innerHTML=attached.map(row=>`<div class="pt-manage-row">${zoneRowCopy(row)}<div class="pt-manage-buttons"><button type="button" data-pt-move-card="${esc(row.id)}" data-pt-destination="hand">Hand</button><button type="button" class="danger" data-pt-move-card="${esc(row.id)}" data-pt-destination="discard">Discard</button><button type="button" data-pt-move-card="${esc(row.id)}" data-pt-destination="lost">Lost</button></div></div>`).join('');body.append(title,list)}
  if(under.length){const title=document.createElement('div');title.className='sheet-section-title';title.textContent='Evolution stack';const list=document.createElement('div');list.className='pt-manage-list';list.innerHTML=under.map(row=>`<div class="pt-manage-row">${zoneRowCopy(row)}<div class="pt-manage-buttons"><button type="button" data-card-id="${esc(row.id)}">View</button></div></div>`).join('');const note=document.createElement('p');note.className='pt-stack-note';note.textContent='Underlying Pokémon are kept with the Pokémon when it moves to Hand, Deck, Discard or Lost Zone.';body.append(title,list,note)}
}
function enhanceSheets(){enhanceSearchSheet();enhanceStadiumSheet();enhanceCardSheet()}
function refreshTargets(){const id=selectedId(),state=readState(),from=id?zoneOf(state,id):null;const deck=$('.side-pile[data-zone-button="deck"]');deck?.classList.toggle('pt-zone-target',!!id);const hand=$('#handTray');hand?.classList.toggle('pt-zone-target',!!id&&!['hand',null].includes(from))}
function handleSelectedZoneClick(event){
  const id=selectedId();if(!id)return false;
  const deck=event.target.closest('.side-pile[data-zone-button="deck"]');if(deck){event.preventDefault();event.stopImmediatePropagation();return moveCardComplete(id,'deck')}
  const discard=event.target.closest('[data-zone-button="discard"]');if(discard){event.preventDefault();event.stopImmediatePropagation();return moveCardComplete(id,'discard')}
  const stadium=event.target.closest('[data-zone-button="stadium"]');if(stadium){const state=readState(),card=cardById(state,id),from=zoneOf(state,id);if(from==='hand'&&card?.section==='trainers'){event.preventDefault();event.stopImmediatePropagation();return replaceStadium(id)}}
  const handTray=event.target.closest('#handTray');if(handTray&&!event.target.closest('.play-card,button')){event.preventDefault();event.stopImmediatePropagation();return moveCardComplete(id,'hand')}
  return false;
}

document.addEventListener('click',event=>{
  const managed=event.target.closest('[data-pt-move-card][data-pt-destination]');if(managed){event.preventDefault();event.stopImmediatePropagation();moveManagedCard(managed.dataset.ptMoveCard,managed.dataset.ptDestination);return}
  const damage=event.target.closest('[data-pt-damage][data-pt-card-id]');if(damage){event.preventDefault();event.stopImmediatePropagation();changeDamage(damage.dataset.ptCardId,Number(damage.dataset.ptDamage));return}
  const clear=event.target.closest('[data-pt-clear-damage]');if(clear){event.preventDefault();event.stopImmediatePropagation();clearDamage(clear.dataset.ptClearDamage);return}
  const deckAction=event.target.closest('[data-pt-deck-action]');if(deckAction){event.preventDefault();event.stopImmediatePropagation();deckAction.dataset.ptDeckAction==='shuffle'?shuffleDeck():drawTop();return}
  const coreMove=event.target.closest('[data-move-card][data-destination]');
  if(coreMove&&['hand','deck','discard','lost'].includes(coreMove.dataset.destination)){event.preventDefault();event.stopImmediatePropagation();moveCardComplete(coreMove.dataset.moveCard,coreMove.dataset.destination);return}
  if(coreMove&&coreMove.dataset.destination==='stadium'){event.preventDefault();event.stopImmediatePropagation();replaceStadium(coreMove.dataset.moveCard);return}
  if(handleSelectedZoneClick(event))return;
},true);

function refreshEnhancements(){enhanceSheets();refreshTargets()}
window.addEventListener('ptcg-playtest-render',refreshEnhancements);
function start(){installStyles();ensureSetupTurnZero();refreshEnhancements();setInterval(refreshEnhancements,500)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();