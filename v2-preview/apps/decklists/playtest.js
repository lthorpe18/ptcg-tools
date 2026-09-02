(function(){
'use strict';

const $=id=>document.getElementById(id);
const ACTIVE_KEY='ptcg-tools.playtest.active.v1';
const STATE_VERSION=1;
const MAX_UNDO=40;
let launch=null,state=null,undoStack=[],selectedCardId=null;

function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function uid(prefix='card'){return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,9)}`}
function clone(value){return JSON.parse(JSON.stringify(value))}
function toast(message){const el=$('toast');el.textContent=message;el.hidden=false;clearTimeout(el._t);el._t=setTimeout(()=>el.hidden=true,1800)}
function identityKey(identity){return [identity?.deckId||'',identity?.listHash||'',identity?.deckVersionId||'working'].join('|')}
function cardById(id){return state?.cards?.find(card=>card.id===id)||null}
function zone(name){return state.zones[name]||[]}
function cardLabel(card){return [card?.name,[card?.set,card?.number].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}

function expandDeck(rawText){
  const parsed=window.PTCGDeckParser.parseDeck(rawText||'');
  const cards=[];
  parsed.cards.forEach((row,rowIndex)=>{
    for(let copy=0;copy<Number(row.count||0);copy++)cards.push({id:`c_${rowIndex}_${copy}_${Math.random().toString(36).slice(2,6)}`,name:row.name||'Unknown card',set:row.set||null,number:row.number||null,section:row.section||'unknown',damage:0,markers:[]});
  });
  return cards;
}
function shuffled(ids){const copy=[...ids];for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}return copy}
function newState(payload){
  const cards=expandDeck(payload.rawText);
  if(!cards.length)throw new Error('This list has no cards to playtest.');
  const deckIds=shuffled(cards.map(card=>card.id));
  const hand=deckIds.splice(0,Math.min(7,deckIds.length));
  const prizes=deckIds.splice(0,Math.min(6,deckIds.length));
  return {
    stateVersion:STATE_VERSION,
    sessionId:uid('playtest'),
    startedAt:new Date().toISOString(),
    updatedAt:new Date().toISOString(),
    source:payload.source||'working-list',
    identity:clone(payload.identity),
    turn:1,
    coin:null,
    cards,
    zones:{deck:deckIds,hand,active:[],bench:[],discard:[],lost:[],prizes,stadium:[]},
    history:[{at:Date.now(),text:`Set up 7-card hand and ${prizes.length} prizes`}]
  };
}
function loadPersisted(payload){
  try{
    const saved=JSON.parse(localStorage.getItem(ACTIVE_KEY)||'null');
    if(saved&&saved.stateVersion===STATE_VERSION&&identityKey(saved.identity)===identityKey(payload.identity)&&Array.isArray(saved.cards)&&saved.zones)return saved;
  }catch{}
  return null;
}
function persist(){
  if(!state)return;
  state.updatedAt=new Date().toISOString();
  try{localStorage.setItem(ACTIVE_KEY,JSON.stringify(state))}catch{}
}
function pushUndo(){undoStack.push(clone(state));if(undoStack.length>MAX_UNDO)undoStack.shift();$('undoButton').disabled=false}
function log(text){state.history.unshift({at:Date.now(),text});state.history=state.history.slice(0,30)}
function mutate(text,fn){pushUndo();fn();if(text)log(text);persist();render()}
function removeFromAllZones(cardId){for(const key of Object.keys(state.zones))state.zones[key]=state.zones[key].filter(id=>id!==cardId)}
function moveCard(cardId,destination,{label}={}){
  const card=cardById(cardId);if(!card)return;
  mutate(label||`Moved ${card.name} to ${zoneName(destination)}`,()=>{removeFromAllZones(cardId);state.zones[destination].push(cardId)});
  closeSheet();
}
function zoneName(key){return ({deck:'Deck',hand:'Hand',active:'Active',bench:'Bench',discard:'Discard',lost:'Lost Zone',prizes:'Prizes',stadium:'Stadium'})[key]||key}
function sourceZone(cardId){return Object.keys(state.zones).find(key=>state.zones[key].includes(cardId))||null}

function cardButton(card,zoneKey){
  const damage=Number(card.damage||0)>0?`<span class="damage">${Number(card.damage)} dmg</span>`:'';
  return `<button type="button" class="card-chip" data-card-id="${esc(card.id)}" data-zone="${esc(zoneKey)}"><strong>${esc(card.name)}${damage}</strong><small>${esc([card.set,card.number].filter(Boolean).join(' '))||esc(zoneName(zoneKey))}</small></button>`;
}
function renderSingle(key,containerId,countId,emptyText){
  const ids=zone(key),container=$(containerId);$(countId).textContent=ids.length;
  if(!ids.length){container.className='zone-content empty-zone';container.innerHTML=esc(emptyText);return}
  container.className='zone-content';container.innerHTML=ids.map(id=>cardButton(cardById(id),key)).join('');
}
function render(){
  if(!state)return;
  $('deckTitle').textContent=state.identity.deckName||'Playtest';
  $('deckIdentity').textContent=state.identity.deckVersionId?(state.identity.versionLabel||'Saved version'):'Working list';
  $('turnNumber').textContent=state.turn;
  $('coinResult').textContent=state.coin||'—';
  renderSingle('active','activeZone','activeCount','Tap a card in hand to set Active.');
  renderSingle('stadium','stadiumZone','stadiumCount','Empty');
  const bench=zone('bench');$('benchCount').textContent=bench.length;$('benchZone').className=bench.length?'bench-list':'bench-list empty-zone';$('benchZone').innerHTML=bench.length?bench.map(id=>cardButton(cardById(id),'bench')).join(''):'Tap a card in hand to Bench it.';
  const hand=zone('hand');$('handCount').textContent=hand.length;$('handZone').innerHTML=hand.length?hand.map(id=>cardButton(cardById(id),'hand')).join(''):'<div class="empty-zone">Hand empty</div>';
  ['deck','prizes','discard','lost'].forEach(key=>{$(`${key}Count`).textContent=zone(key).length});
  const recent=state.history||[];$('historySummary').textContent=recent[0]?.text||'Ready';$('historyList').innerHTML=recent.length?recent.map(entry=>`<div class="history-row">${esc(entry.text)}</div>`).join(''):'<div class="history-row">No actions yet.</div>';
  $('undoButton').disabled=!undoStack.length;
}

function draw(count=1){
  const available=Math.min(Number(count)||1,zone('deck').length);
  if(!available){toast('Deck is empty');return}
  mutate(`Drew ${available} card${available===1?'':'s'}`,()=>{for(let i=0;i<available;i++)state.zones.hand.push(state.zones.deck.shift())});
}
function shuffleDeck(){if(zone('deck').length<2){toast('Not enough cards to shuffle');return}mutate('Shuffled deck',()=>{state.zones.deck=shuffled(state.zones.deck)});toast('Deck shuffled')}
function coinFlip(){const result=Math.random()<.5?'Heads':'Tails';mutate(`Coin flip: ${result}`,()=>{state.coin=result});toast(result)}
function endTurn(){mutate(`Ended turn ${state.turn}`,()=>{state.turn+=1;state.coin=null});toast(`Turn ${state.turn}`)}
function undo(){if(!undoStack.length)return;state=undoStack.pop();persist();render();toast('Undone')}
function changeDamage(cardId,delta){const card=cardById(cardId);if(!card)return;mutate(`${card.name}: damage ${delta>0?'+':''}${delta}`,()=>{card.damage=Math.max(0,Number(card.damage||0)+delta)});openCardSheet(cardId)}

function openSheet(title,eyebrow,meta,body){$('sheetTitle').textContent=title;$('sheetEyebrow').textContent=eyebrow||'';$('sheetMeta').textContent=meta||'';$('sheetBody').innerHTML=body;$('sheet').hidden=false}
function closeSheet(){$('sheet').hidden=true;selectedCardId=null}
function destinationButton(cardId,key,label,primary=false){return `<button type="button" class="${primary?'primary':''}" data-move-card="${esc(cardId)}" data-destination="${esc(key)}">${esc(label||zoneName(key))}</button>`}
function openCardSheet(cardId){
  const card=cardById(cardId);if(!card)return;selectedCardId=cardId;const from=sourceZone(cardId);const buttons=[];
  if(from!=='hand')buttons.push(destinationButton(cardId,'hand','To hand',from==='deck'));
  if(from!=='active')buttons.push(destinationButton(cardId,'active','Set Active'));
  if(from!=='bench')buttons.push(destinationButton(cardId,'bench','Bench'));
  if(from!=='stadium')buttons.push(destinationButton(cardId,'stadium','Set Stadium'));
  if(from!=='discard')buttons.push(destinationButton(cardId,'discard','Discard'));
  if(from!=='lost')buttons.push(destinationButton(cardId,'lost','Lost Zone'));
  if(from!=='deck')buttons.push(destinationButton(cardId,'deck','Return to deck'));
  const damage=(from==='active'||from==='bench')?`<div class="sheet-section-title">Damage</div><div class="action-grid"><button type="button" data-damage="-10" data-card-id="${esc(cardId)}">−10</button><button type="button" data-damage="10" data-card-id="${esc(cardId)}">+10</button></div>`:'';
  openSheet(card.name,'CARD',`${zoneName(from)}${card.set?` · ${card.set}${card.number?` ${card.number}`:''}`:''}`,`<div class="action-grid">${buttons.join('')}</div>${damage}`);
}
function openZoneSheet(key){
  if(key==='deck'){openSearchDeck();return}
  const ids=zone(key);let body='';
  if(key==='prizes'){
    body=ids.length?`<p class="sheet-note">Prize identities stay hidden. Take a prize by position.</p><div class="zone-list">${ids.map((id,index)=>`<button type="button" class="zone-row prize-row" data-take-prize="${index}"><strong>Prize ${index+1}</strong><small>Take to hand</small></button>`).join('')}</div>`:'<p class="sheet-note">No prizes remaining.</p>';
  }else body=ids.length?`<div class="zone-list">${ids.map(id=>{const card=cardById(id);return `<button type="button" class="zone-row" data-card-id="${esc(id)}"><strong>${esc(card.name)}</strong><small>${esc([card.set,card.number].filter(Boolean).join(' '))}</small></button>`}).join('')}</div>`:`<p class="sheet-note">${esc(zoneName(key))} is empty.</p>`;
  openSheet(zoneName(key),'ZONE',`${ids.length} card${ids.length===1?'':'s'}`,body);
}
function openSearchDeck(){
  const ids=zone('deck');const grouped=new Map();ids.forEach(id=>{const card=cardById(id),key=[card.name,card.set||'',card.number||''].join('|');if(!grouped.has(key))grouped.set(key,{card,ids:[]});grouped.get(key).ids.push(id)});
  const rows=[...grouped.values()].sort((a,b)=>a.card.name.localeCompare(b.card.name));
  const body=rows.length?`<p class="sheet-note">Tap a card to move one copy to your hand. Shuffle separately when you are ready.</p><div class="search-list">${rows.map(row=>`<button type="button" class="search-row" data-search-card="${esc(row.ids[0])}"><strong>${esc(row.card.name)}</strong><small>${row.ids.length} · ${esc([row.card.set,row.card.number].filter(Boolean).join(' '))}</small></button>`).join('')}</div>`:'<p class="sheet-note">Deck is empty.</p>';
  openSheet('Search Deck','DECK',`${ids.length} cards remaining`,body);
}
function takePrize(index){const id=zone('prizes')[Number(index)];if(!id)return;const card=cardById(id);mutate(`Took a prize: ${card.name}`,()=>{state.zones.prizes.splice(Number(index),1);state.zones.hand.push(id)});closeSheet();toast('Prize taken')}
function resetGame(){
  if(!launch)return;
  if(!confirm('Start a fresh setup with this exact list?'))return;
  undoStack=[];state=newState(launch);persist();render();toast('New setup ready')
}

function bind(){
  $('drawButton').addEventListener('click',()=>draw(1));$('searchButton').addEventListener('click',openSearchDeck);$('shuffleButton').addEventListener('click',shuffleDeck);$('coinButton').addEventListener('click',coinFlip);$('undoButton').addEventListener('click',undo);$('endTurn').addEventListener('click',endTurn);$('resetButton').addEventListener('click',resetGame);
  $('backButton').addEventListener('click',()=>{if(launch?.returnUrl){location.href=launch.returnUrl;return}if(history.length>1)history.back();else location.href='./'});
  document.addEventListener('click',event=>{
    const card=event.target.closest('[data-card-id]');if(card&&!event.target.closest('[data-damage]')){openCardSheet(card.dataset.cardId);return}
    const zoneButton=event.target.closest('[data-zone-button]');if(zoneButton){openZoneSheet(zoneButton.dataset.zoneButton);return}
    const move=event.target.closest('[data-move-card]');if(move){moveCard(move.dataset.moveCard,move.dataset.destination);return}
    const damage=event.target.closest('[data-damage]');if(damage){changeDamage(damage.dataset.cardId,Number(damage.dataset.damage));return}
    const search=event.target.closest('[data-search-card]');if(search){const id=search.dataset.searchCard,cardRow=cardById(id);moveCard(id,'hand',{label:`Searched ${cardRow.name} to hand`});toast('Moved to hand');return}
    const prize=event.target.closest('[data-take-prize]');if(prize){takePrize(prize.dataset.takePrize);return}
    if(event.target.closest('[data-close-sheet]'))closeSheet();
  });
}

async function fallbackLaunch(){
  const params=new URLSearchParams(location.search),deckId=params.get('deck'),deckVersionId=params.get('version');if(!deckId)return null;
  return window.PTCGPlaytestLaunch.build({deckId,deckVersionId,source:deckVersionId?'deck-version':'working-list'});
}
async function init(){
  try{
    await window.PTCGDeckStore.open();
    launch=window.PTCGPlaytestLaunch.read()||await fallbackLaunch();
    if(!launch)throw new Error('Open Playtest from a Deck or Event Prep so the exact list is known.');
    state=loadPersisted(launch)||newState(launch);persist();bind();render();$('playtestApp').hidden=false;$('quickActions').hidden=false;
  }catch(error){console.error(error);$('fatal').textContent=error.message||'Playtest could not start.';$('fatal').hidden=false}
}
init();
})();
