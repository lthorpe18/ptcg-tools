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
function selectedCardElement(){return $('.play-card.is-selected[data-card-id]')}
function selectedHandCard(){return $('#handZone .play-card.is-selected[data-card-id]')}
function esc(value){return String(value==null?'':value).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]))}
function setCode(card){return String(card?.set||'').trim().toUpperCase()}
function cardNumber(card){const raw=String(card?.number||'').trim(),match=raw.match(/\d+/);return match?String(Number(match[0])).padStart(3,'0'):raw.padStart(3,'0')}
function imageUrl(card){const set=setCode(card),num=cardNumber(card);return set&&num?`https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/${encodeURIComponent(set)}/${encodeURIComponent(set)}_${encodeURIComponent(num)}_R_EN.png`:''}

function installStyles(){
  if(document.getElementById('playtestEnhancementStyles'))return;
  const style=document.createElement('style');style.id='playtestEnhancementStyles';style.textContent=`
    .play-card .attachment-stack,.play-card .attachment-count{display:none!important}

    /* Selection and valid-target feedback: obvious, but does not alter geometry. */
    .play-card{transition:filter .12s ease,transform .12s ease}
    .play-card.is-selected .card-frame{outline:3px solid #7ff0b8;outline-offset:2px;box-shadow:0 0 0 2px rgba(11,85,53,.75),0 5px 14px rgba(0,0,0,.32)!important}
    .play-card.is-selected{z-index:14;filter:saturate(1.08) brightness(1.04)}
    .play-card.is-target:not(.is-selected) .card-frame{outline:2px solid rgba(184,255,219,.92);outline-offset:2px;box-shadow:0 0 0 3px rgba(47,172,111,.22),0 3px 10px rgba(0,0,0,.25)!important}
    .bench-target-slot.is-target,.field-slot.is-target,.side-pile.is-target,.stadium-slot.is-target{border-color:rgba(174,255,215,.78)!important;background:rgba(98,220,158,.12)!important;box-shadow:inset 0 0 0 1px rgba(174,255,215,.22),0 0 0 2px rgba(36,153,94,.10)!important}
    .bench-target-slot.is-target{color:rgba(225,255,240,.96)!important}
    .side-pile.is-target>span:not(.card-back):not(.prize-stack):not(.pile-preview),.side-pile.is-target>b{color:#fff!important}

    /* Statuses occupy the top edge; Energy stays on the bottom edge. */
    .playtest-marker-tray{top:-7px!important;bottom:auto!important;gap:2px!important;z-index:12!important}
    .playtest-marker{height:17px!important;min-width:17px!important;padding:0 4px!important;border-width:1.5px!important;font-size:7px!important;box-shadow:0 2px 5px rgba(0,0,0,.28)!important}
    .damage-badge{right:-5px!important;top:-5px!important;min-width:29px!important;padding:4px 5px!important;border:2px solid #fff!important;border-radius:999px!important;background:#c62828!important;font-size:9px!important;line-height:1!important;box-shadow:0 2px 6px rgba(0,0,0,.32)!important}

    .playtest-energy-tray{position:absolute;z-index:10;left:50%;bottom:0;transform:translateX(-50%);display:flex;gap:3px;max-width:98%;justify-content:center;pointer-events:none;white-space:nowrap}
    .playtest-energy-pill{display:inline-flex;align-items:center;justify-content:center;min-width:23px;height:18px;padding:0 5px;border:2px solid rgba(255,255,255,.98);border-radius:999px;color:#fff;font-size:8px;font-weight:950;line-height:1;letter-spacing:.01em;box-shadow:0 2px 5px rgba(0,0,0,.34)}
    .energy-fire{background:#d94832}.energy-water{background:#2878c8}.energy-lightning{background:#f0c62e;color:#342b00}.energy-grass{background:#429451}.energy-psychic{background:#8b55a5}.energy-fighting{background:#b7663d}.energy-darkness{background:#3f4650}.energy-metal{background:#788995}.energy-fairy{background:#d86e9d}.energy-colorless{background:#8a918e}.energy-special{background:#344054}

    .prize-reveal-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .prize-reveal-card{display:grid;grid-template-columns:52px minmax(0,1fr);align-items:center;gap:8px;min-height:82px;padding:6px;border:1px solid #e4e7ec;border-radius:11px;background:#fff;color:#101828;text-align:left}
    .prize-reveal-card img{display:block;width:52px;aspect-ratio:2.5/3.5;object-fit:cover;border-radius:5px;background:#e4e7ec}
    .prize-reveal-card strong{display:block;font-size:10px;line-height:1.15}.prize-reveal-card small{display:block;margin-top:3px;color:#667085;font-size:8px}.prize-reveal-card em{display:block;margin-top:7px;color:#175cd3;font-size:8px;font-style:normal;font-weight:850}
    @media(max-width:359px){.prize-reveal-grid{grid-template-columns:1fr}}
  `;document.head.appendChild(style)
}

function ensureTurnZeroSetup(){
  const state=readState();if(!state?.zones)return false;
  const history=(state.history||[]).map(entry=>String(entry?.text||''));
  const hasStartedTurn=history.some(text=>/^Started turn /i.test(text)||/^Ended turn /i.test(text));
  let changed=false;
  if(Number(state.turn)===1&&!hasStartedTurn){state.turn=0;changed=true}
  if(!state.turnFlowV2){state.turnFlowV2=true;changed=true}
  if(changed)writeState(state);
  return changed;
}

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
function removeIdFromZones(state,id){Object.keys(state.zones||{}).forEach(key=>{state.zones[key]=(state.zones[key]||[]).filter(cardId=>cardId!==id)})}
function evolutionStackIds(state,topId){
  const result=[];let parents=[topId];
  while(parents.length){const parent=parents.shift();const children=(state.zones.under||[]).map(id=>cardById(state,id)).filter(card=>card?.stackedUnder===parent);children.forEach(card=>{if(!result.includes(card.id)){result.push(card.id);parents.push(card.id)}})}
  return result;
}
function discardSelectedCard(){
  const selected=selectedCardElement();if(!selected)return false;const id=selected.dataset.cardId;
  const before=readState(),card=cardById(before,id);if(!card)return false;
  mutate(`Discarded ${card.name}`,state=>{
    const attached=(state.zones.attached||[]).map(attachedId=>cardById(state,attachedId)).filter(row=>row?.attachedTo===id).map(row=>row.id);
    const under=evolutionStackIds(state,id);
    const moving=[id,...attached,...under];
    moving.forEach(cardId=>{removeIdFromZones(state,cardId);const row=cardById(state,cardId);if(row){row.attachedTo=null;row.stackedUnder=null;row.rotated=false}state.zones.discard.push(cardId)});
  });
  return true;
}
function startNextTurn(){
  const state=readState();if(!state?.zones)return;
  const current=Number(state.turn||0),nextTurn=current+1,canDraw=(state.zones.deck||[]).length>0;
  mutate(canDraw?`Started turn ${nextTurn} — drew 1 card`:`Started turn ${nextTurn} — deck empty`,s=>{
    s.turn=nextTurn;s.coin=null;s.turnFlowV2=true;
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
    tray.innerHTML=markers.map(marker=>`<span class=\"playtest-marker marker-${marker}\" title=\"${markerLabel(marker)}\">${marker==='ability'?'A':marker==='poisoned'?'P':marker==='burned'?'B':marker==='asleep'?'Z':marker==='confused'?'?':'!'}</span>`).join('');
  });
}

function energyType(name){
  const value=String(name||'').replace(/^Basic\s+/i,'').replace(/\s+Energy$/i,'').trim();
  const known={Fire:['fire','F'],Water:['water','W'],Lightning:['lightning','L'],Grass:['grass','G'],Psychic:['psychic','P'],Fighting:['fighting','Fi'],Darkness:['darkness','D'],Metal:['metal','M'],Fairy:['fairy','Fa'],Colorless:['colorless','C']};
  return known[value]||['special',value.split(/\s+/).map(word=>word[0]).join('').slice(0,3).toUpperCase()||'E'];
}
function renderEnergyAttachments(){
  const state=readState();if(!state?.zones)return;
  const attached=(state.zones.attached||[]).map(id=>cardById(state,id)).filter(Boolean);
  $$('.play-card[data-card-id]').forEach(el=>{
    const targetId=el.dataset.cardId;
    const energies=attached.filter(card=>card.attachedTo===targetId&&card.section==='energy');
    let tray=el.querySelector('.playtest-energy-tray');
    if(!energies.length){tray?.remove();return}
    const groups=new Map();energies.forEach(card=>{const key=card.name||'Energy';groups.set(key,(groups.get(key)||0)+1)});
    const signature=[...groups.entries()].map(([name,count])=>`${name}:${count}`).join('|');
    if(!tray){tray=document.createElement('span');tray.className='playtest-energy-tray';el.appendChild(tray)}
    if(tray.dataset.signature===signature)return;tray.dataset.signature=signature;
    tray.innerHTML=[...groups.entries()].map(([name,count])=>{const [type,label]=energyType(name);return `<span class=\"playtest-energy-pill energy-${type}\" title=\"${esc(name)}\">${esc(label)}${count>1?` ×${count}`:''}</span>`}).join('');
  });
}

function openPrizeViewer(){
  const state=readState();if(!state?.zones)return;
  const ids=[...(state.zones.prizes||[])],cards=ids.map(id=>cardById(state,id)).filter(Boolean);
  const sheet=$('#sheet'),body=$('#sheetBody');if(!sheet||!body)return;
  $('#sheetTitle').textContent='Prizes';$('#sheetEyebrow').textContent='ZONE';$('#sheetMeta').textContent=`${cards.length} remaining`;
  body.innerHTML=cards.length?`<p class=\"sheet-note\">Your prize cards are shown below. Tap one to take it.</p><div class=\"prize-reveal-grid\">${cards.map((card,index)=>`<button type=\"button\" class=\"prize-reveal-card\" data-enh-take-prize=\"${index}\"><img src=\"${esc(imageUrl(card))}\" alt=\"${esc(card.name)}\"><span><strong>${esc(card.name)}</strong><small>${esc([card.set,card.number].filter(Boolean).join(' '))}</small><em>Take prize</em></span></button>`).join('')}</div>`:'<p class=\"sheet-note\">No prizes remaining.</p>';
  sheet.hidden=false;
}
function takePrize(index){
  const state=readState();const id=state?.zones?.prizes?.[Number(index)];if(!id)return;
  const card=cardById(state,id);mutate(`Took prize${card?` — ${card.name}`:''}`,s=>{const prizeId=s.zones.prizes.splice(Number(index),1)[0];if(prizeId)s.zones.hand.push(prizeId)});
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
  wrap.innerHTML=`<div class=\"sheet-section-title\">Markers</div><div class=\"marker-grid\">${MARKERS.map(([key,label])=>`<button type=\"button\" data-marker=\"${key}\" data-marker-card=\"${cardId}\" class=\"${card.markers?.includes(key)?'active':''}\">${label}</button>`).join('')}</div>`;
  body.appendChild(wrap);
}
function updateDeckTarget(){const deck=$('.side-pile[data-zone-button=\"deck\"]');if(deck)deck.classList.toggle('is-target',!!selectedHandCard())}
function updateDiscardTarget(){const discard=$('.side-pile[data-zone-button=\"discard\"]');if(discard)discard.classList.toggle('is-target',!!selectedCardElement())}
function refreshUndo(){const button=$('#undoButton');if(button&&hasUndo()&&button.disabled)button.disabled=false}
function refreshTurnUI(){
  const state=readState();if(!state)return;
  const turn=$('#turnNumber');if(turn)turn.textContent=String(Number(state.turn||0));
  const button=$('#endTurn');if(button)button.textContent=Number(state.turn||0)===0?'Start turn 1':'End turn';
}
function refresh(){renderCardMarkers();renderEnergyAttachments();injectMarkerControls();updateDeckTarget();updateDiscardTarget();refreshUndo();refreshTurnUI()}

document.addEventListener('click',event=>{
  const handButton=event.target.closest('[data-hand-action]');if(handButton){event.preventDefault();event.stopImmediatePropagation();handAction(handButton.dataset.handAction);return}
  const marker=event.target.closest('[data-marker][data-marker-card]');if(marker){event.preventDefault();event.stopImmediatePropagation();toggleMarker(marker.dataset.markerCard,marker.dataset.marker);return}
  const prizeTake=event.target.closest('[data-enh-take-prize]');if(prizeTake){event.preventDefault();event.stopImmediatePropagation();takePrize(prizeTake.dataset.enhTakePrize);return}
  const prizeZone=event.target.closest('[data-zone-button=\"prizes\"]');if(prizeZone){event.preventDefault();event.stopImmediatePropagation();openPrizeViewer();return}
  const discardZone=event.target.closest('[data-zone-button=\"discard\"]');if(discardZone&&selectedCardElement()){event.preventDefault();event.stopImmediatePropagation();discardSelectedCard();return}
  const end=event.target.closest('#endTurn');if(end){event.preventDefault();event.stopImmediatePropagation();startNextTurn();return}
  const undo=event.target.closest('#undoButton');if(undo&&hasUndo()){event.preventDefault();event.stopImmediatePropagation();undoEnhancement();return}
  const deck=event.target.closest('.side-pile[data-zone-button=\"deck\"]');if(deck&&selectedHandCard()){event.preventDefault();event.stopImmediatePropagation();moveSelectedToTop();return}
  if(hasUndo()&&event.target.closest('button,.play-card'))clearUndo();
},true);

function startRefreshLoop(){installStyles();if(ensureTurnZeroSetup()){reload();return}refresh();window.setInterval(refresh,400)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startRefreshLoop,{once:true});else startRefreshLoop();
})();