(function(){
'use strict';

const $=id=>document.getElementById(id);
const ACTIVE_KEY='ptcg-tools.playtest.active.v2';
const CARD_META_KEY='ptcg-tools.card-meta.v1';
const STATE_VERSION=3;
const MAX_UNDO=40;
const BENCH_SIZE=5;
let launch=null,state=null,undoStack=[],selection=null;

const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const clone=value=>JSON.parse(JSON.stringify(value));
const uid=(prefix='card')=>`${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,9)}`;
const zone=name=>state?.zones?.[name]||[];
const cardById=id=>state?.cards?.find(card=>card.id===id)||null;
const sourceZone=id=>Object.keys(state?.zones||{}).find(key=>state.zones[key].includes(id))||null;
const zoneName=key=>({deck:'Deck',hand:'Hand',active:'Active',bench:'Bench',discard:'Discard',lost:'Lost Zone',prizes:'Prizes',stadium:'Stadium',attached:'Attached',under:'Evolution stack'})[key]||key;

function toast(message){const el=$('toast');if(!el)return;el.textContent=message;el.hidden=false;clearTimeout(el._t);el._t=setTimeout(()=>el.hidden=true,1500)}
function identityKey(identity){return [identity?.deckId||'',identity?.listHash||'',identity?.deckVersionId||'working'].join('|')}
function setCode(card){return String(card?.set||'').trim().toUpperCase()}
function cardNumber(card){const raw=String(card?.number||'').trim(),match=raw.match(/\d+/);return match?String(Number(match[0])).padStart(3,'0'):raw.padStart(3,'0')}
function imageUrl(card){const set=setCode(card),num=cardNumber(card);return set&&num?`https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/${encodeURIComponent(set)}/${encodeURIComponent(set)}_${encodeURIComponent(num)}_R_EN.png`:''}
function cardMeta(card){return [card?.set,card?.number].filter(Boolean).join(' ')}
function isPokemon(card){return card?.section==='pokemon'}
function isEnergy(card){return card?.section==='energy'}
function isTrainer(card){return card?.section==='trainers'}
function isBasic(card){return isPokemon(card)&&String(card?.stage||'').toLowerCase()==='basic'}
function fieldIds(){return [...zone('active'),...zone('bench')]}
function attachmentsFor(cardId){return zone('attached').map(cardById).filter(card=>card?.attachedTo===cardId)}
function underCards(cardId){return zone('under').map(cardById).filter(card=>card?.stackedUnder===cardId)}

function readMetaCache(){try{return JSON.parse(localStorage.getItem(CARD_META_KEY)||'{}')||{}}catch{return {}}}
function writeMetaCache(cache){try{localStorage.setItem(CARD_META_KEY,JSON.stringify(cache))}catch{}}
function metadataKey(card){return [setCode(card),String(card?.number||'').trim(),String(card?.name||'').trim().toLowerCase()].join('|')}
async function fetchPokemonMetadata(card){
  const set=setCode(card),number=String(card?.number||'').trim(),name=String(card?.name||'').trim();
  const select='name,number,supertype,subtypes,set';
  const queries=[];
  if(set&&number)queries.push(`set.ptcgoCode:${set} number:${number}`);
  if(name)queries.push(`name:\"${name.replace(/\"/g,'')}\"`);
  for(const q of queries){
    const url=`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=20&select=${encodeURIComponent(select)}`;
    const response=await fetch(url,{cache:'force-cache'});if(!response.ok)continue;
    const body=await response.json(),rows=Array.isArray(body?.data)?body.data:[];
    const exact=rows.find(row=>String(row?.name||'').toLowerCase()===name.toLowerCase()&&(!number||String(row?.number||'')===number))||rows.find(row=>String(row?.name||'').toLowerCase()===name.toLowerCase())||rows[0];
    if(exact?.supertype==='Pokémon')return {stage:(exact.subtypes||[]).find(value=>['Basic','Stage 1','Stage 2','VMAX','VSTAR','V-UNION','Mega Evolution','BREAK Evolution','Restored','LEGEND'].includes(value))||null};
  }
  return null;
}
async function hydratePokemonStages(cards){
  const cache=readMetaCache(),unique=new Map();
  cards.filter(isPokemon).forEach(card=>{const key=metadataKey(card);if(!unique.has(key))unique.set(key,card)});
  await Promise.all([...unique.entries()].map(async([key,card])=>{
    let meta=cache[key];
    if(!meta?.stage){try{meta=await fetchPokemonMetadata(card)}catch{meta=null}if(meta?.stage){cache[key]={...meta,updatedAt:Date.now()}}}
    if(meta?.stage)cards.filter(row=>metadataKey(row)===key).forEach(row=>row.stage=meta.stage);
  }));
  writeMetaCache(cache);
  const unresolved=cards.filter(isPokemon).filter(card=>!card.stage);
  if(unresolved.length){const names=[...new Set(unresolved.map(card=>card.name))].slice(0,4).join(', ');throw new Error(`Could not identify Pokémon stages for ${names}${unresolved.length>4?'…':''}. Try again while online.`)}
  if(!cards.some(isBasic))throw new Error('This deck has no Basic Pokémon, so it cannot produce a legal opening hand.');
}

function expandDeck(rawText){
  const parsed=window.PTCGDeckParser.parseDeck(rawText||''),cards=[];
  parsed.cards.forEach((row,rowIndex)=>{for(let copy=0;copy<Number(row.count||0);copy++)cards.push({id:`c_${rowIndex}_${copy}_${Math.random().toString(36).slice(2,6)}`,name:row.name||'Unknown card',set:row.set||null,number:row.number||null,section:row.section||'unknown',stage:null,damage:0,markers:[],rotated:false,attachedTo:null,stackedUnder:null})});
  return cards;
}
function shuffled(ids){const copy=[...ids];for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}return copy}
function dealOpeningHand(cards){
  const allIds=cards.map(card=>card.id);let mulligans=0,deckIds,hand;
  do{deckIds=shuffled(allIds);hand=deckIds.splice(0,Math.min(7,deckIds.length));if(hand.some(id=>isBasic(cards.find(card=>card.id===id))))break;mulligans+=1;if(mulligans>500)throw new Error('Could not generate a valid opening hand.')}while(true);
  const prizes=deckIds.splice(0,Math.min(6,deckIds.length));return {deckIds,hand,prizes,mulligans};
}
async function newState(payload){
  const cards=expandDeck(payload.rawText);if(!cards.length)throw new Error('This list has no cards to playtest.');
  await hydratePokemonStages(cards);
  const {deckIds,hand,prizes,mulligans}=dealOpeningHand(cards);
  return {stateVersion:STATE_VERSION,sessionId:uid('playtest'),startedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),source:payload.source||'working-list',identity:clone(payload.identity),turn:1,coin:null,mulligans,cards,zones:{deck:deckIds,hand,active:[],bench:[],discard:[],lost:[],prizes,stadium:[],attached:[],under:[]},history:[{at:Date.now(),text:`Opening hand ready after ${mulligans} mulligan${mulligans===1?'':'s'}`},{at:Date.now(),text:`Set up 7-card hand and ${prizes.length} prizes`}]};
}
function loadPersisted(payload){
  try{const saved=JSON.parse(localStorage.getItem(ACTIVE_KEY)||'null');if(saved&&saved.stateVersion===STATE_VERSION&&identityKey(saved.identity)===identityKey(payload.identity)&&Array.isArray(saved.cards)&&saved.zones){if(!Array.isArray(saved.zones.attached))saved.zones.attached=[];if(!Array.isArray(saved.zones.under))saved.zones.under=[];saved.cards.forEach(card=>{if(!('stackedUnder' in card))card.stackedUnder=null});return saved}}catch{}return null;
}
function persist(){if(!state)return;state.updatedAt=new Date().toISOString();try{localStorage.setItem(ACTIVE_KEY,JSON.stringify(state))}catch{}}
function pushUndo(){undoStack.push(clone(state));if(undoStack.length>MAX_UNDO)undoStack.shift()}
function log(text){state.history.unshift({at:Date.now(),text});state.history=state.history.slice(0,40)}
function mutate(text,fn){pushUndo();fn();if(text)log(text);persist();clearSelection(false);render()}
function removeFromAllZones(cardId){for(const key of Object.keys(state.zones))state.zones[key]=state.zones[key].filter(id=>id!==cardId)}
function detachChildren(cardId,destination='discard'){attachmentsFor(cardId).forEach(card=>{removeFromAllZones(card.id);card.attachedTo=null;state.zones[destination].push(card.id)})}
function moveCard(cardId,destination,label){const card=cardById(cardId);if(!card)return;mutate(label||`Moved ${card.name} to ${zoneName(destination)}`,()=>{if(sourceZone(cardId)==='attached')card.attachedTo=null;if(attachmentsFor(cardId).length)detachChildren(cardId);removeFromAllZones(cardId);card.rotated=false;card.stackedUnder=null;state.zones[destination].push(cardId)});closeSheet()}
function attachCard(cardId,targetId){const card=cardById(cardId),target=cardById(targetId);if(!card||!target)return;mutate(`Attached ${card.name} to ${target.name}`,()=>{removeFromAllZones(cardId);card.attachedTo=targetId;card.stackedUnder=null;card.rotated=false;state.zones.attached.push(cardId)});toast('Attached')}
function evolveCard(cardId,targetId){
  const evolution=cardById(cardId),target=cardById(targetId);if(!evolution||!target)return;
  const targetZone=sourceZone(targetId);if(!['active','bench'].includes(targetZone))return;
  mutate(`Evolved ${target.name} into ${evolution.name}`,()=>{
    const targetIndex=state.zones[targetZone].indexOf(targetId);
    removeFromAllZones(cardId);removeFromAllZones(targetId);
    target.stackedUnder=evolution.id;target.attachedTo=null;state.zones.under.push(targetId);
    attachmentsFor(targetId).forEach(card=>card.attachedTo=evolution.id);
    evolution.damage=target.damage||0;evolution.rotated=!!target.rotated;evolution.stackedUnder=null;
    state.zones[targetZone].splice(Math.max(0,targetIndex),0,evolution.id);
  });
  toast('Evolved')
}
function swapField(firstId,secondId){
  const a=sourceZone(firstId),b=sourceZone(secondId);if(a===b||!['active','bench'].includes(a)||!['active','bench'].includes(b))return false;
  const first=cardById(firstId),second=cardById(secondId);mutate(`Switched ${first.name} and ${second.name}`,()=>{const ai=state.zones[a].indexOf(firstId),bi=state.zones[b].indexOf(secondId);state.zones[a][ai]=secondId;state.zones[b][bi]=firstId});toast('Switched');return true;
}

function selectionTargets(){
  const card=selection&&cardById(selection.cardId);if(!card)return {cards:new Set(),zones:new Set()};
  const from=sourceZone(card.id),cards=new Set(),zones=new Set();
  if(from==='hand'){
    if(isPokemon(card)){if(isBasic(card)){if(!zone('active').length)zones.add('active');if(zone('bench').length<BENCH_SIZE)zones.add('bench')}else fieldIds().forEach(id=>cards.add(id))}
    else if(isEnergy(card)){fieldIds().forEach(id=>cards.add(id))}
    else if(isTrainer(card)){zones.add('discard');zones.add('stadium')}
    else {zones.add('discard')}
  } else if(['active','bench'].includes(from)){
    fieldIds().filter(id=>id!==card.id).forEach(id=>{if(sourceZone(id)!==from)cards.add(id)});
    zones.add('discard');zones.add('lost');zones.add('hand');
  } else if(from==='attached'){
    fieldIds().forEach(id=>cards.add(id));zones.add('discard');zones.add('hand');
  } else {zones.add('hand');zones.add('discard');zones.add('lost');zones.add('deck')}
  return {cards,zones};
}
function selectCard(cardId){
  const card=cardById(cardId);if(!card)return;
  const from=sourceZone(cardId);
  if(selection?.cardId===cardId){openCardSheet(cardId);clearSelection();return}
  if(!['hand','active','bench','attached'].includes(from)){openCardSheet(cardId);return}
  selection={cardId};renderSelection();
}
function clearSelection(shouldRender=true){selection=null;if(shouldRender)renderSelection()}
function resolveCardTarget(targetId){
  if(!selection)return false;const selected=cardById(selection.cardId),target=cardById(targetId);if(!selected||!target)return false;
  const targets=selectionTargets();if(!targets.cards.has(targetId))return false;
  const from=sourceZone(selected.id);
  if(from==='hand'&&isPokemon(selected)&&!isBasic(selected)){evolveCard(selected.id,targetId);return true}
  if(from==='hand'&&isEnergy(selected)){attachCard(selected.id,targetId);return true}
  if(from==='attached'){attachCard(selected.id,targetId);return true}
  if(['active','bench'].includes(from)){return swapField(selected.id,targetId)}
  return false;
}
function resolveZoneTarget(targetZone){
  if(!selection)return false;const card=cardById(selection.cardId);if(!card)return false;const targets=selectionTargets();if(!targets.zones.has(targetZone))return false;
  if(targetZone==='bench'&&zone('bench').length>=BENCH_SIZE){toast('Bench is full');return true}
  moveCard(card.id,targetZone,targetZone==='discard'&&isTrainer(card)?`Played ${card.name}`:undefined);return true;
}

function cardFrame(card){if(!card)return '<span class="empty-slot">Empty</span>';const url=imageUrl(card);return `<span class="card-frame">${url?`<img class="card-art" src="${esc(url)}" alt="${esc(card.name)}" loading="lazy">`:''}<span class="card-fallback">${esc(card.name)}</span></span>`}
function attachmentDecor(card){const count=attachmentsFor(card.id).length,under=underCards(card.id).length;if(!count&&!under)return '';return `<span class="attachment-stack" aria-hidden="true">${under?'<i></i>':''}${count?'<i></i>':''}</span>${count?`<span class="attachment-count">+${count}</span>`:''}`}
function fieldCard(card,zoneKey){const damage=Number(card.damage||0)>0?`<span class="damage-badge">${Number(card.damage)}</span>`:'';return `<button type="button" class="play-card ${card.rotated?'rotated':''}" data-card-id="${esc(card.id)}" data-zone="${zoneKey}" aria-label="${esc(card.name)}">${attachmentDecor(card)}${cardFrame(card)}${damage}</button>`}
function handCard(card){return `<button type="button" class="play-card" data-card-id="${esc(card.id)}" data-zone="hand" aria-label="${esc(card.name)}">${cardFrame(card)}</button>`}
function emptyBenchSlot(index){return `<button type="button" class="bench-target-slot" data-zone-target="bench" aria-label="Empty Bench slot ${index+1}"><span>＋</span></button>`}
function pileImage(card){const url=imageUrl(card);return url?`<img src="${esc(url)}" alt="">`:''}

function ensureSelectionBar(){if($('selectionBar'))return;const bar=document.createElement('div');bar.id='selectionBar';bar.className='selection-bar';bar.hidden=true;bar.innerHTML='<div><strong id="selectionName"></strong><span id="selectionHint"></span></div><button id="selectionMore" type="button">More</button><button id="selectionCancel" type="button">Cancel</button>';document.querySelector('.table-toolbar')?.after(bar);$('selectionMore').addEventListener('click',()=>{if(selection)openCardSheet(selection.cardId)});$('selectionCancel').addEventListener('click',()=>clearSelection())}
function renderSelection(){
  const bar=$('selectionBar');if(!bar)return;
  document.querySelectorAll('.is-selected,.is-target').forEach(el=>el.classList.remove('is-selected','is-target'));
  if(!selection){bar.hidden=true;return}
  const card=cardById(selection.cardId),from=sourceZone(selection.cardId),targets=selectionTargets();if(!card){selection=null;bar.hidden=true;return}
  bar.hidden=false;$('selectionName').textContent=card.name;
  $('selectionHint').textContent=from==='hand'&&isPokemon(card)?(isBasic(card)?'Tap Active or an empty Bench slot':'Tap a Pokémon in play to evolve'):from==='hand'&&isEnergy(card)?'Tap a Pokémon to attach':from==='hand'&&isTrainer(card)?'Tap Stadium or Discard to play':'Tap a highlighted destination';
  document.querySelector(`[data-card-id="${CSS.escape(card.id)}"]`)?.classList.add('is-selected');
  targets.cards.forEach(id=>document.querySelectorAll(`[data-card-id="${CSS.escape(id)}"]`).forEach(el=>el.classList.add('is-target')));
  targets.zones.forEach(key=>document.querySelectorAll(`[data-zone-button="${key}"],[data-zone-target="${key}"]`).forEach(el=>el.classList.add('is-target')));
}
function render(){
  if(!state)return;
  $('deckTitle').textContent=state.identity.deckName||'Playtest';
  const versionText=state.identity.deckVersionId?(state.identity.versionLabel||'Saved version'):'Working list';
  $('deckIdentity').textContent=`${versionText} · ${Number(state.mulligans||0)} mulligan${Number(state.mulligans||0)===1?'':'s'}`;
  $('turnNumber').textContent=state.turn;$('coinResult').textContent=state.coin||'Coin';
  const active=zone('active').map(cardById).filter(Boolean),stadium=zone('stadium').map(cardById).filter(Boolean);
  $('activeContent').innerHTML=active.length?active.map(card=>fieldCard(card,'active')).join(''):'<span class="empty-slot">Tap a Basic Pokémon from your hand</span>';
  $('stadiumContent').innerHTML=stadium.length?stadium.map(card=>fieldCard(card,'stadium')).join(''):'<span class="empty-slot">Empty</span>';
  const bench=zone('bench').map(cardById).filter(Boolean),emptyCount=Math.max(0,BENCH_SIZE-bench.length);$('benchCount').textContent=bench.length;$('benchZone').innerHTML=bench.map(card=>fieldCard(card,'bench')).join('')+Array.from({length:emptyCount},(_,i)=>emptyBenchSlot(i)).join('');
  const hand=zone('hand').map(cardById).filter(Boolean);$('handCount').textContent=hand.length;$('handZone').innerHTML=hand.length?hand.map(handCard).join(''):'<div class="hand-empty">Hand empty</div>';
  ['deck','prizes','discard','lost'].forEach(key=>{$(`${key}Count`).textContent=zone(key).length});
  const discardTop=cardById(zone('discard').at(-1)),lostTop=cardById(zone('lost').at(-1));$('discardPreview').className=`pile-preview ${discardTop?'':'empty'}`;$('discardPreview').innerHTML=discardTop?pileImage(discardTop):'';$('lostPreview').className=`pile-preview ${lostTop?'':'empty'}`;$('lostPreview').innerHTML=lostTop?pileImage(lostTop):'';$('undoButton').disabled=!undoStack.length;
  renderSelection();
}

function draw(count=1){const available=Math.min(Number(count)||1,zone('deck').length);if(!available){toast('Deck is empty');return}mutate(`Drew ${available} card${available===1?'':'s'}`,()=>{for(let i=0;i<available;i++)state.zones.hand.push(state.zones.deck.shift())})}
function shuffleDeck(){if(zone('deck').length<2){toast('Not enough cards to shuffle');return}mutate('Shuffled deck',()=>{state.zones.deck=shuffled(state.zones.deck)});toast('Deck shuffled')}
function coinFlip(){const result=Math.random()<.5?'Heads':'Tails';mutate(`Coin flip: ${result}`,()=>{state.coin=result});toast(result)}
function endTurn(){mutate(`Ended turn ${state.turn}`,()=>{state.turn+=1;state.coin=null});toast(`Turn ${state.turn}`)}
function undo(){if(!undoStack.length)return;state=undoStack.pop();selection=null;persist();render();toast('Undone')}
function changeDamage(cardId,delta){const card=cardById(cardId);if(!card)return;mutate(`${card.name}: damage ${delta>0?'+':''}${delta}`,()=>{card.damage=Math.max(0,Number(card.damage||0)+delta)});openCardSheet(cardId)}
function toggleRotate(cardId){const card=cardById(cardId);if(!card)return;mutate(`${card.rotated?'Untapped':'Tapped'} ${card.name}`,()=>{card.rotated=!card.rotated});openCardSheet(cardId)}

function openSheet(title,eyebrow,meta,body){$('sheetTitle').textContent=title;$('sheetEyebrow').textContent=eyebrow||'';$('sheetMeta').textContent=meta||'';$('sheetBody').innerHTML=body;$('sheet').hidden=false}
function closeSheet(){$('sheet').hidden=true}
function actionButton(cardId,key,label,classes=''){return `<button type="button" class="${classes}" data-move-card="${esc(cardId)}" data-destination="${esc(key)}">${esc(label)}</button>`}
function openCardSheet(cardId){
  const card=cardById(cardId);if(!card)return;const from=sourceZone(cardId),buttons=[];
  if(from!=='hand')buttons.push(actionButton(cardId,'hand','To hand'));if(from!=='active')buttons.push(actionButton(cardId,'active','Set Active','primary'));if(from!=='bench')buttons.push(actionButton(cardId,'bench','Bench'));if(from!=='stadium')buttons.push(actionButton(cardId,'stadium','Play Stadium'));if(from!=='discard')buttons.push(actionButton(cardId,'discard','Discard','danger'));if(from!=='lost')buttons.push(actionButton(cardId,'lost','Lost Zone'));if(from!=='deck')buttons.push(actionButton(cardId,'deck','Top of deck'));
  const field=['active','bench'].includes(from),attached=attachmentsFor(cardId),under=underCards(cardId);
  const fieldActions=field?`<div class="sheet-section-title">On the field</div><div class="action-grid"><button type="button" data-damage="-10" data-card-id="${esc(cardId)}">−10 damage</button><button type="button" data-damage="10" data-card-id="${esc(cardId)}">+10 damage</button><button type="button" class="wide" data-rotate-card="${esc(cardId)}">${card.rotated?'Untap / straighten':'Tap / rotate'}</button></div>`:'';
  const extras=[...under,...attached];const extraInfo=extras.length?`<div class="sheet-section-title">Under / attached</div><div class="zone-list">${extras.map(zoneRow).join('')}</div>`:'';
  const stage=isPokemon(card)&&card.stage?` · ${card.stage}`:'';
  openSheet(card.name,'CARD',`${zoneName(from)}${cardMeta(card)?` · ${cardMeta(card)}`:''}${stage}`,`<div class="card-sheet-layout"><div class="sheet-card-preview">${cardFrame(card)}</div><div class="action-grid">${buttons.join('')}</div></div>${fieldActions}${extraInfo}`)
}
function zoneRow(card){return `<button type="button" class="zone-row" data-card-id="${esc(card.id)}"><img class="zone-thumb" src="${esc(imageUrl(card))}" alt="" loading="lazy"><span class="zone-copy"><strong>${esc(card.name)}</strong><small>${esc(cardMeta(card))}</small></span><span class="row-count">›</span></button>`}
function openZoneSheet(key){
  if(key==='deck'){openSearchDeck();return}const ids=zone(key);
  if(key==='prizes'){const body=ids.length?`<p class="sheet-note">Prize identities stay hidden.</p><div class="zone-list">${ids.map((id,index)=>`<button type="button" class="zone-row" data-take-prize="${index}"><span class="card-back" style="position:relative;left:auto;top:auto;transform:none;width:34px"></span><span class="zone-copy"><strong>Prize ${index+1}</strong><small>Face down</small></span><span class="row-count">Take</span></button>`).join('')}</div>`:'<p class="sheet-note">No prizes remaining.</p>';openSheet('Prizes','ZONE',`${ids.length} remaining`,body);return}
  const cards=ids.map(cardById).filter(Boolean);openSheet(zoneName(key),'ZONE',`${cards.length} card${cards.length===1?'':'s'}`,cards.length?`<div class="zone-list">${cards.map(zoneRow).join('')}</div>`:`<p class="sheet-note">${esc(zoneName(key))} is empty.</p>`)
}
function openSearchDeck(){const grouped=new Map();zone('deck').forEach(id=>{const card=cardById(id),key=[card.name,card.set||'',card.number||''].join('|');if(!grouped.has(key))grouped.set(key,{card,ids:[]});grouped.get(key).ids.push(id)});const rows=[...grouped.values()].sort((a,b)=>a.card.name.localeCompare(b.card.name));openSheet('Search Deck','DECK',`${zone('deck').length} cards remaining`,rows.length?`<p class="sheet-note">Tap a card to move one copy to hand. Shuffle separately when finished.</p><div class="search-list">${rows.map(row=>`<button type="button" class="search-row" data-search-card="${esc(row.ids[0])}"><img class="search-thumb" src="${esc(imageUrl(row.card))}" alt="" loading="lazy"><span class="search-copy"><strong>${esc(row.card.name)}</strong><small>${esc(cardMeta(row.card))}</small></span><span class="row-count">×${row.ids.length}</span></button>`).join('')}</div>`:'<p class="sheet-note">Deck is empty.</p>')}
function takePrize(index){const id=zone('prizes')[Number(index)];if(!id)return;mutate(`Took prize ${Number(index)+1}`,()=>{state.zones.prizes.splice(Number(index),1);state.zones.hand.push(id)});closeSheet();toast('Prize taken')}
function openMenu(){const history=(state.history||[]).slice(0,12).map(entry=>`<div class="history-row">${esc(entry.text)}</div>`).join('')||'<div class="history-row">No actions yet.</div>';openSheet('Tabletop','PLAYTEST',`${state.identity.deckName||'Deck'} · ${Number(state.mulligans||0)} mulligan${Number(state.mulligans||0)===1?'':'s'} · turn ${state.turn}`,`<div class="menu-grid"><button type="button" data-menu-action="coin">Flip coin</button><button type="button" data-menu-action="shuffle">Shuffle deck</button><button type="button" data-menu-action="undo">Undo</button><button type="button" data-menu-action="reset">Fresh setup</button></div><div class="sheet-section-title">Recent actions</div><div class="history-list">${history}</div>`)}
async function resetGame(){if(!launch||!confirm('Start a fresh setup with this exact list?'))return;undoStack=[];selection=null;state=await newState(launch);persist();render();closeSheet();toast(`${state.mulligans} mulligan${state.mulligans===1?'':'s'}`)}

function bind(){
  ensureSelectionBar();$('drawButton').addEventListener('click',()=>draw(1));$('searchButton').addEventListener('click',openSearchDeck);$('shuffleButton').addEventListener('click',shuffleDeck);$('coinButton').addEventListener('click',coinFlip);$('undoButton').addEventListener('click',undo);$('endTurn').addEventListener('click',endTurn);$('resetButton').addEventListener('click',()=>resetGame());$('menuButton').addEventListener('click',openMenu);
  $('backButton').addEventListener('click',()=>{if(launch?.returnUrl){location.href=launch.returnUrl;return}if(history.length>1)history.back();else location.href='./'});
  document.addEventListener('error',event=>{const img=event.target;if(img?.classList?.contains('card-art'))img.closest('.card-frame')?.classList.add('image-error');if(img?.classList?.contains('search-thumb')||img?.classList?.contains('zone-thumb'))img.style.visibility='hidden'},true);
  document.addEventListener('click',event=>{
    const move=event.target.closest('[data-move-card]');if(move){moveCard(move.dataset.moveCard,move.dataset.destination);return}
    const damage=event.target.closest('[data-damage]');if(damage){changeDamage(damage.dataset.cardId,Number(damage.dataset.damage));return}
    const rotate=event.target.closest('[data-rotate-card]');if(rotate){toggleRotate(rotate.dataset.rotateCard);return}
    const search=event.target.closest('[data-search-card]');if(search){const card=cardById(search.dataset.searchCard);moveCard(card.id,'hand',`Searched ${card.name} to hand`);closeSheet();toast('Moved to hand');return}
    const prize=event.target.closest('[data-take-prize]');if(prize){takePrize(prize.dataset.takePrize);return}
    const cardEl=event.target.closest('[data-card-id]');if(cardEl){const id=cardEl.dataset.cardId;if(selection&&resolveCardTarget(id))return;selectCard(id);return}
    const target=event.target.closest('[data-zone-target]');if(target&&selection&&resolveZoneTarget(target.dataset.zoneTarget))return;
    const zoneButton=event.target.closest('[data-zone-button]');if(zoneButton){if(selection&&resolveZoneTarget(zoneButton.dataset.zoneButton))return;openZoneSheet(zoneButton.dataset.zoneButton);return}
    const menu=event.target.closest('[data-menu-action]');if(menu){const action=menu.dataset.menuAction;if(action==='coin'){closeSheet();coinFlip()}else if(action==='shuffle'){closeSheet();shuffleDeck()}else if(action==='undo'){closeSheet();undo()}else if(action==='reset')resetGame();return}
    if(event.target.closest('[data-close-sheet]'))closeSheet();
  })
}
async function fallbackLaunch(){const params=new URLSearchParams(location.search),deckId=params.get('deck'),deckVersionId=params.get('version');if(!deckId)return null;return window.PTCGPlaytestLaunch.build({deckId,deckVersionId,source:deckVersionId?'deck-version':'working-list'})}
async function init(){try{await window.PTCGDeckStore.open();launch=window.PTCGPlaytestLaunch.read()||await fallbackLaunch();if(!launch)throw new Error('Open Playtest from a Deck or Event Prep so the exact list is known.');state=loadPersisted(launch)||await newState(launch);persist();bind();render();$('playtestApp').hidden=false;$('handTray').hidden=false;$('zoneDock').hidden=false;if(state.mulligans)toast(`${state.mulligans} mulligan${state.mulligans===1?'':'s'}`)}catch(error){console.error(error);$('fatal').textContent=error.message||'Playtest could not start.';$('fatal').hidden=false}}
init();
})();