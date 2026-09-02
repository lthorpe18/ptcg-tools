(function(){
'use strict';

const $=id=>document.getElementById(id);
const ACTIVE_KEY='ptcg-tools.playtest.active.v2';
const STATE_VERSION=2;
const MAX_UNDO=40;
let launch=null,state=null,undoStack=[];

function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function uid(prefix='card'){return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,9)}`}
function clone(value){return JSON.parse(JSON.stringify(value))}
function toast(message){const el=$('toast');el.textContent=message;el.hidden=false;clearTimeout(el._t);el._t=setTimeout(()=>el.hidden=true,1600)}
function identityKey(identity){return [identity?.deckId||'',identity?.listHash||'',identity?.deckVersionId||'working'].join('|')}
function cardById(id){return state?.cards?.find(card=>card.id===id)||null}
function zone(name){return state?.zones?.[name]||[]}
function zoneName(key){return ({deck:'Deck',hand:'Hand',active:'Active',bench:'Bench',discard:'Discard',lost:'Lost Zone',prizes:'Prizes',stadium:'Stadium',attached:'Attached'})[key]||key}
function sourceZone(cardId){return Object.keys(state.zones||{}).find(key=>state.zones[key].includes(cardId))||null}
function setCode(card){return String(card?.set||'').trim().toUpperCase()}
function cardNumber(card){const raw=String(card?.number||'').trim();const match=raw.match(/\d+/);return match?String(Number(match[0])).padStart(3,'0'):raw.padStart(3,'0')}
function imageUrl(card){const set=setCode(card),num=cardNumber(card);return set&&num?`https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/${encodeURIComponent(set)}/${encodeURIComponent(set)}_${encodeURIComponent(num)}_R_EN.png`:''}
function cardMeta(card){return [card?.set,card?.number].filter(Boolean).join(' ')}
function attachmentsFor(cardId){return zone('attached').map(cardById).filter(card=>card?.attachedTo===cardId)}

function expandDeck(rawText){
  const parsed=window.PTCGDeckParser.parseDeck(rawText||'');
  const cards=[];
  parsed.cards.forEach((row,rowIndex)=>{
    for(let copy=0;copy<Number(row.count||0);copy++)cards.push({
      id:`c_${rowIndex}_${copy}_${Math.random().toString(36).slice(2,6)}`,
      name:row.name||'Unknown card',set:row.set||null,number:row.number||null,section:row.section||'unknown',
      damage:0,markers:[],rotated:false,attachedTo:null
    });
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
    stateVersion:STATE_VERSION,sessionId:uid('playtest'),startedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
    source:payload.source||'working-list',identity:clone(payload.identity),turn:1,coin:null,cards,
    zones:{deck:deckIds,hand,active:[],bench:[],discard:[],lost:[],prizes,stadium:[],attached:[]},
    history:[{at:Date.now(),text:`Set up 7-card hand and ${prizes.length} prizes`}]
  };
}
function loadPersisted(payload){
  try{
    const saved=JSON.parse(localStorage.getItem(ACTIVE_KEY)||'null');
    if(saved&&saved.stateVersion===STATE_VERSION&&identityKey(saved.identity)===identityKey(payload.identity)&&Array.isArray(saved.cards)&&saved.zones){
      if(!Array.isArray(saved.zones.attached))saved.zones.attached=[];
      return saved;
    }
  }catch{}
  return null;
}
function persist(){if(!state)return;state.updatedAt=new Date().toISOString();try{localStorage.setItem(ACTIVE_KEY,JSON.stringify(state))}catch{}}
function pushUndo(){undoStack.push(clone(state));if(undoStack.length>MAX_UNDO)undoStack.shift();$('undoButton').disabled=false}
function log(text){state.history.unshift({at:Date.now(),text});state.history=state.history.slice(0,40)}
function mutate(text,fn){pushUndo();fn();if(text)log(text);persist();render()}
function removeFromAllZones(cardId){for(const key of Object.keys(state.zones))state.zones[key]=state.zones[key].filter(id=>id!==cardId)}
function detachChildren(cardId,destination='discard'){
  const attached=attachmentsFor(cardId).map(card=>card.id);
  attached.forEach(id=>{const card=cardById(id);removeFromAllZones(id);card.attachedTo=null;state.zones[destination].push(id)});
}
function moveCard(cardId,destination,{label,keepAttachments=false}={}){
  const card=cardById(cardId);if(!card)return;
  mutate(label||`Moved ${card.name} to ${zoneName(destination)}`,()=>{
    const from=sourceZone(cardId);
    if(from==='attached')card.attachedTo=null;
    if(!keepAttachments&&attachmentsFor(cardId).length)detachChildren(cardId,'discard');
    removeFromAllZones(cardId);card.rotated=false;state.zones[destination].push(cardId);
  });
  closeSheet();
}
function attachCard(cardId,targetId){
  const card=cardById(cardId),target=cardById(targetId);if(!card||!target)return;
  mutate(`Attached ${card.name} to ${target.name}`,()=>{removeFromAllZones(cardId);card.attachedTo=targetId;card.rotated=false;state.zones.attached.push(cardId)});
  closeSheet();toast('Attached');
}

function cardFrame(card,extra=''){
  if(!card)return '<span class="empty-slot">Empty</span>';
  const url=imageUrl(card);
  return `<span class="card-frame ${extra}">${url?`<img class="card-art" src="${esc(url)}" alt="${esc(card.name)}">`:''}<span class="card-fallback">${esc(card.name)}</span></span>`;
}
function attachmentDecor(card){
  const count=attachmentsFor(card.id).length;if(!count)return '';
  return `<span class="attachment-stack" aria-hidden="true"><i></i>${count>1?'<i></i>':''}</span><span class="attachment-count">+${count}</span>`;
}
function fieldCard(card,zoneKey){
  if(!card)return '';
  const damage=Number(card.damage||0)>0?`<span class="damage-badge">${Number(card.damage)}</span>`:'';
  return `<button type="button" class="play-card ${card.rotated?'rotated':''}" data-card-id="${esc(card.id)}" data-zone="${esc(zoneKey)}" aria-label="${esc(card.name)}">${attachmentDecor(card)}${cardFrame(card)}${damage}</button>`;
}
function handCard(card){return `<button type="button" class="play-card" data-card-id="${esc(card.id)}" data-zone="hand" aria-label="${esc(card.name)}">${cardFrame(card)}</button>`}
function pileImage(card){const url=imageUrl(card);return url?`<img src="${esc(url)}" alt="">`:''}

function render(){
  if(!state)return;
  $('deckTitle').textContent=state.identity.deckName||'Playtest';
  $('deckIdentity').textContent=state.identity.deckVersionId?(state.identity.versionLabel||'Saved version'):'Working list';
  $('turnNumber').textContent=state.turn;$('coinResult').textContent=state.coin||'Coin';
  const active=zone('active').map(cardById).filter(Boolean),stadium=zone('stadium').map(cardById).filter(Boolean);
  $('activeContent').innerHTML=active.length?active.map(card=>fieldCard(card,'active')).join(''):'<span class="empty-slot">Tap a card from your hand</span>';
  $('stadiumContent').innerHTML=stadium.length?stadium.map(card=>fieldCard(card,'stadium')).join(''):'<span class="empty-slot">Empty</span>';
  const bench=zone('bench').map(cardById).filter(Boolean);$('benchCount').textContent=bench.length;$('benchZone').innerHTML=bench.length?bench.map(card=>fieldCard(card,'bench')).join(''):'<div class="bench-empty">Bench is empty</div>';
  const hand=zone('hand').map(cardById).filter(Boolean);$('handCount').textContent=hand.length;$('handZone').innerHTML=hand.length?hand.map(handCard).join(''):'<div class="hand-empty">Hand empty</div>';
  ['deck','prizes','discard','lost'].forEach(key=>{$(`${key}Count`).textContent=zone(key).length});
  const discardTop=cardById(zone('discard').at(-1)),lostTop=cardById(zone('lost').at(-1));
  $('discardPreview').className=`pile-preview ${discardTop?'':'empty'}`;$('discardPreview').innerHTML=discardTop?pileImage(discardTop):'';
  $('lostPreview').className=`pile-preview ${lostTop?'':'empty'}`;$('lostPreview').innerHTML=lostTop?pileImage(lostTop):'';
  $('undoButton').disabled=!undoStack.length;
}

function draw(count=1){const available=Math.min(Number(count)||1,zone('deck').length);if(!available){toast('Deck is empty');return}mutate(`Drew ${available} card${available===1?'':'s'}`,()=>{for(let i=0;i<available;i++)state.zones.hand.push(state.zones.deck.shift())})}
function shuffleDeck(){if(zone('deck').length<2){toast('Not enough cards to shuffle');return}mutate('Shuffled deck',()=>{state.zones.deck=shuffled(state.zones.deck)});toast('Deck shuffled')}
function coinFlip(){const result=Math.random()<.5?'Heads':'Tails';mutate(`Coin flip: ${result}`,()=>{state.coin=result});toast(result)}
function endTurn(){mutate(`Ended turn ${state.turn}`,()=>{state.turn+=1;state.coin=null});toast(`Turn ${state.turn}`)}
function undo(){if(!undoStack.length)return;state=undoStack.pop();persist();render();toast('Undone')}
function changeDamage(cardId,delta){const card=cardById(cardId);if(!card)return;mutate(`${card.name}: damage ${delta>0?'+':''}${delta}`,()=>{card.damage=Math.max(0,Number(card.damage||0)+delta)});openCardSheet(cardId)}
function toggleRotate(cardId){const card=cardById(cardId);if(!card)return;mutate(`${card.rotated?'Untapped':'Tapped'} ${card.name}`,()=>{card.rotated=!card.rotated});openCardSheet(cardId)}

function openSheet(title,eyebrow,meta,body){$('sheetTitle').textContent=title;$('sheetEyebrow').textContent=eyebrow||'';$('sheetMeta').textContent=meta||'';$('sheetBody').innerHTML=body;$('sheet').hidden=false}
function closeSheet(){$('sheet').hidden=true}
function actionButton(cardId,key,label,classes=''){return `<button type="button" class="${classes}" data-move-card="${esc(cardId)}" data-destination="${esc(key)}">${esc(label)}</button>`}
function targetButtons(cardId){
  const targets=[...zone('active'),...zone('bench')].map(cardById).filter(Boolean);
  if(!targets.length)return '';
  return `<div class="sheet-section-title">Attach to</div><div class="target-list">${targets.map(target=>`<button type="button" class="target-row" data-attach-card="${esc(cardId)}" data-target-card="${esc(target.id)}"><span></span><span><strong>${esc(target.name)}</strong><small>${esc(zoneName(sourceZone(target.id)))}</small></span><span>Attach</span></button>`).join('')}</div>`;
}
function openCardSheet(cardId){
  const card=cardById(cardId);if(!card)return;const from=sourceZone(cardId),buttons=[];
  if(from!=='hand')buttons.push(actionButton(cardId,'hand','To hand'));
  if(from!=='active')buttons.push(actionButton(cardId,'active','Set Active','primary'));
  if(from!=='bench')buttons.push(actionButton(cardId,'bench','Bench'));
  if(from!=='stadium')buttons.push(actionButton(cardId,'stadium','Play Stadium'));
  if(from!=='discard')buttons.push(actionButton(cardId,'discard','Discard','danger'));
  if(from!=='lost')buttons.push(actionButton(cardId,'lost','Lost Zone'));
  if(from!=='deck')buttons.push(actionButton(cardId,'deck','Top of deck'));
  const field=from==='active'||from==='bench';
  const fieldActions=field?`<div class="sheet-section-title">On the field</div><div class="action-grid"><button type="button" data-damage="-10" data-card-id="${esc(cardId)}">−10 damage</button><button type="button" data-damage="10" data-card-id="${esc(cardId)}">+10 damage</button><button type="button" class="wide" data-rotate-card="${esc(cardId)}">${card.rotated?'Untap / straighten':'Tap / rotate'}</button></div>`:'';
  const attached=attachmentsFor(cardId);const attachedInfo=attached.length?`<div class="sheet-section-title">Attached (${attached.length})</div><div class="zone-list">${attached.map(a=>zoneRow(a,true)).join('')}</div>`:'';
  const attachTargets=from==='hand'?targetButtons(cardId):'';
  const body=`<div class="card-sheet-layout"><div class="sheet-card-preview">${cardFrame(card)}</div><div class="action-grid">${buttons.join('')}</div></div>${attachTargets}${fieldActions}${attachedInfo}`;
  openSheet(card.name,'CARD',`${zoneName(from)}${cardMeta(card)?` · ${cardMeta(card)}`:''}`,body);
}
function zoneRow(card,isAttachment=false){
  return `<button type="button" class="zone-row" data-card-id="${esc(card.id)}"><img class="zone-thumb" src="${esc(imageUrl(card))}" alt=""><span class="zone-copy"><strong>${esc(card.name)}</strong><small>${esc(cardMeta(card)||(isAttachment?'Attached card':''))}</small></span><span class="row-count">›</span></button>`;
}
function openZoneSheet(key){
  if(key==='deck'){openSearchDeck();return}
  if(key==='active'){const id=zone('active')[0];if(id){openCardSheet(id);return}}
  if(key==='stadium'){const id=zone('stadium')[0];if(id){openCardSheet(id);return}}
  const ids=zone(key);
  if(key==='prizes'){
    const body=ids.length?`<p class="sheet-note">Prize cards stay hidden. Tap a position to take that prize into your hand.</p><div class="zone-list">${ids.map((id,index)=>`<button type="button" class="zone-row" data-take-prize="${index}"><span class="card-back" style="position:relative;left:auto;top:auto;transform:none;width:34px"></span><span class="zone-copy"><strong>Prize ${index+1}</strong><small>Face down</small></span><span class="row-count">Take</span></button>`).join('')}</div>`:'<p class="sheet-note">No prizes remaining.</p>';
    openSheet('Prizes','ZONE',`${ids.length} remaining`,body);return;
  }
  const cards=ids.map(cardById).filter(Boolean);openSheet(zoneName(key),'ZONE',`${cards.length} card${cards.length===1?'':'s'}`,cards.length?`<div class="zone-list">${cards.map(c=>zoneRow(c)).join('')}</div>`:`<p class="sheet-note">${esc(zoneName(key))} is empty.</p>`);
}
function openSearchDeck(){
  const ids=zone('deck'),grouped=new Map();
  ids.forEach(id=>{const card=cardById(id),key=[card.name,card.set||'',card.number||''].join('|');if(!grouped.has(key))grouped.set(key,{card,ids:[]});grouped.get(key).ids.push(id)});
  const rows=[...grouped.values()].sort((a,b)=>a.card.name.localeCompare(b.card.name));
  const body=rows.length?`<p class="sheet-note">Tap a card to take one copy into your hand. Shuffle when your search is finished.</p><div class="search-list">${rows.map(row=>`<button type="button" class="search-row" data-search-card="${esc(row.ids[0])}"><img class="search-thumb" src="${esc(imageUrl(row.card))}" alt=""><span class="search-copy"><strong>${esc(row.card.name)}</strong><small>${esc(cardMeta(row.card))}</small></span><span class="row-count">×${row.ids.length}</span></button>`).join('')}</div>`:'<p class="sheet-note">Deck is empty.</p>';
  openSheet('Search Deck','DECK',`${ids.length} cards remaining`,body);
}
function takePrize(index){const id=zone('prizes')[Number(index)];if(!id)return;mutate(`Took prize ${Number(index)+1}`,()=>{state.zones.prizes.splice(Number(index),1);state.zones.hand.push(id)});closeSheet();toast('Prize taken')}
function openMenu(){
  const history=(state.history||[]).slice(0,12).map(entry=>`<div class="history-row">${esc(entry.text)}</div>`).join('')||'<div class="history-row">No actions yet.</div>';
  openSheet('Tabletop','PLAYTEST',`${state.identity.deckName||'Deck'} · turn ${state.turn}`,`<div class="menu-grid"><button type="button" data-menu-action="coin">Flip coin</button><button type="button" data-menu-action="shuffle">Shuffle deck</button><button type="button" data-menu-action="undo">Undo</button><button type="button" data-menu-action="reset">Fresh setup</button></div><div class="sheet-section-title">Recent actions</div><div class="history-list">${history}</div>`);
}
function resetGame(){if(!launch)return;if(!confirm('Start a fresh setup with this exact list?'))return;undoStack=[];state=newState(launch);persist();render();closeSheet();toast('Fresh setup')}

function bind(){
  $('drawButton').addEventListener('click',()=>draw(1));$('searchButton').addEventListener('click',openSearchDeck);$('shuffleButton').addEventListener('click',shuffleDeck);$('coinButton').addEventListener('click',coinFlip);$('undoButton').addEventListener('click',undo);$('endTurn').addEventListener('click',endTurn);$('resetButton').addEventListener('click',resetGame);$('menuButton').addEventListener('click',openMenu);
  $('backButton').addEventListener('click',()=>{if(launch?.returnUrl){location.href=launch.returnUrl;return}if(history.length>1)history.back();else location.href='./'});
  document.addEventListener('error',event=>{const img=event.target;if(img?.classList?.contains('card-art'))img.closest('.card-frame')?.classList.add('image-error');if(img?.classList?.contains('search-thumb')||img?.classList?.contains('zone-thumb'))img.style.visibility='hidden'},true);
  document.addEventListener('click',event=>{
    const move=event.target.closest('[data-move-card]');if(move){moveCard(move.dataset.moveCard,move.dataset.destination);return}
    const attach=event.target.closest('[data-attach-card]');if(attach){attachCard(attach.dataset.attachCard,attach.dataset.targetCard);return}
    const damage=event.target.closest('[data-damage]');if(damage){changeDamage(damage.dataset.cardId,Number(damage.dataset.damage));return}
    const rotate=event.target.closest('[data-rotate-card]');if(rotate){toggleRotate(rotate.dataset.rotateCard);return}
    const search=event.target.closest('[data-search-card]');if(search){const id=search.dataset.searchCard,card=cardById(id);moveCard(id,'hand',{label:`Searched ${card.name} to hand`});toast('Moved to hand');return}
    const prize=event.target.closest('[data-take-prize]');if(prize){takePrize(prize.dataset.takePrize);return}
    const card=event.target.closest('[data-card-id]');if(card){openCardSheet(card.dataset.cardId);return}
    const zoneButton=event.target.closest('[data-zone-button]');if(zoneButton){openZoneSheet(zoneButton.dataset.zoneButton);return}
    const menu=event.target.closest('[data-menu-action]');if(menu){const action=menu.dataset.menuAction;if(action==='coin'){closeSheet();coinFlip()}else if(action==='shuffle'){closeSheet();shuffleDeck()}else if(action==='undo'){closeSheet();undo()}else if(action==='reset')resetGame();return}
    if(event.target.closest('[data-close-sheet]'))closeSheet();
  });
}

async function fallbackLaunch(){const params=new URLSearchParams(location.search),deckId=params.get('deck'),deckVersionId=params.get('version');if(!deckId)return null;return window.PTCGPlaytestLaunch.build({deckId,deckVersionId,source:deckVersionId?'deck-version':'working-list'})}
async function init(){
  try{
    await window.PTCGDeckStore.open();launch=window.PTCGPlaytestLaunch.read()||await fallbackLaunch();
    if(!launch)throw new Error('Open Playtest from a Deck or Event Prep so the exact list is known.');
    state=loadPersisted(launch)||newState(launch);persist();bind();render();$('playtestApp').hidden=false;$('handTray').hidden=false;$('zoneDock').hidden=false;
  }catch(error){console.error(error);$('fatal').textContent=error.message||'Playtest could not start.';$('fatal').hidden=false}
}
init();
})();
