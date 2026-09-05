(function(){
'use strict';
const $=id=>document.getElementById(id);
const NAME_KEY='ptcg-tools.tools.tournament-player-names.v1';
let activeUser=null,userPromise=null,seeding=false;

function cloudApi(){
  try{if(window.parent&&window.parent!==window&&window.parent.PTCGCloud)return window.parent.PTCGCloud}catch{}
  return window.PTCGCloud||null;
}
function userKey(){return activeUser?.id?`${NAME_KEY}:${activeUser.id}`:null}
function cleanNames(names){return [...new Set((names||[]).map(v=>String(v||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b)).slice(0,100)}
function readNames(){const key=userKey();if(!key)return[];try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?cleanNames(value):[]}catch{return[]}}
function writeNames(names){const key=userKey();if(!key)return;localStorage.setItem(key,JSON.stringify(cleanNames(names)))}
function esc(value){return String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
async function ensureUser(){
  if(activeUser)return activeUser;
  if(userPromise)return userPromise;
  const api=cloudApi();if(!api?.getUser)return null;
  userPromise=api.getUser().then(user=>{activeUser=user||null;userPromise=null;renderSavedPicker();return activeUser}).catch(()=>{activeUser=null;userPromise=null;renderSavedPicker();return null});
  return userPromise;
}
async function rememberName(name){const clean=String(name||'').trim();if(!clean)return;const user=await ensureUser();if(!user)return;writeNames([...readNames(),clean]);renderSavedPicker()}
function ensureSavedPicker(){
  const pane=$('tm-players'),addRow=pane?.querySelector('.tm-player-add');if(!pane||!addRow)return null;
  let wrap=$('tmSavedPlayerWrap');
  if(!wrap){
    wrap=document.createElement('div');wrap.id='tmSavedPlayerWrap';wrap.className='tm-saved-player hidden';
    wrap.innerHTML='<label for="tmSavedPlayer">Saved player</label><select id="tmSavedPlayer" class="tm-select"><option value="">Choose saved player…</option></select>';
    pane.insertBefore(wrap,addRow);
    const select=wrap.querySelector('select');select.addEventListener('change',()=>{if(!select.value)return;const input=$('tmPlayerName');if(input){input.value=select.value;input.focus()}select.value=''})
  }
  return wrap;
}
function renderSavedPicker(){
  const wrap=ensureSavedPicker();if(!wrap)return;
  const select=$('tmSavedPlayer'),names=activeUser?readNames():[],hidden=!activeUser||!names.length;
  if(wrap.classList.contains('hidden')!==hidden)wrap.classList.toggle('hidden',hidden);
  if(!select)return;
  const html='<option value="">Choose saved player…</option>'+names.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('');
  if(select.innerHTML!==html)select.innerHTML=html;
}
function seedVisiblePlayers(){
  if(!activeUser||seeding)return;
  const names=[...document.querySelectorAll('#tmPlayers .tm-player span,#tmRun [data-result="P1"],#tmRun [data-result="P2"]')].map(el=>el.textContent?.trim()).filter(Boolean);
  if(!names.length)return;
  const before=readNames(),merged=cleanNames([...before,...names]);
  if(JSON.stringify(merged)===JSON.stringify(before))return;
  seeding=true;writeNames(merged);renderSavedPicker();seeding=false;
}
async function refreshUser(){activeUser=null;await ensureUser();seedVisiblePlayers();renderSavedPicker()}
function positionNextRound(){const run=$('tm-run'),rounds=$('tmRun'),button=$('tmNextRound');if(run&&rounds&&button&&button.nextElementSibling!==rounds)run.insertBefore(button,rounds)}
function setButtonText(button,text){if(button.textContent!==text)button.textContent=text}
function updateSwissState(){
  const button=$('tmNextRound'),host=$('tmRun');if(!button||!host)return;
  const rounds=[...host.querySelectorAll('.tm-round')];if(!rounds.length)return;
  const latest=rounds[rounds.length-1],latestStatus=latest.querySelector('.tm-round-head small')?.textContent?.trim();
  const latestNumber=Number((latest.querySelector('.tm-round-head b')?.textContent||'').match(/\d+/)?.[0]||0);
  if(button.disabled&&latestStatus!=='Complete'){setButtonText(button,`Complete Round ${latestNumber}`);return}
  if(!button.disabled&&button.textContent.trim()==='Swiss complete')setButtonText(button,`Generate Round ${latestNumber+1}`);
}
function syncRoundUi(){positionNextRound();updateSwissState();if(activeUser)seedVisiblePlayers()}
function install(){
  positionNextRound();ensureSavedPicker();
  const add=$('tmAddPlayer'),input=$('tmPlayerName');
  add?.addEventListener('click',()=>{const name=input?.value?.trim();if(name)rememberName(name)},true);
  input?.addEventListener('keydown',event=>{if(event.key==='Enter'){const name=input.value.trim();if(name)rememberName(name)}},true);
  document.querySelectorAll('[data-tm-tab]').forEach(btn=>btn.addEventListener('click',()=>setTimeout(()=>{seedVisiblePlayers();renderSavedPicker()},0)));
  refreshUser();
  try{window.parent?.addEventListener?.('ptcg:auth-change',refreshUser)}catch{}
  const api=cloudApi();if(api?.onAuthStateChange)api.onAuthStateChange(()=>refreshUser()).catch(()=>{});
  const observer=new MutationObserver(syncRoundUi),workspace=$('tmWorkspace');
  if(workspace)observer.observe(workspace,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled','class']});
  const style=document.createElement('style');style.textContent='.tm-saved-player{display:grid;gap:5px}.tm-saved-player label{color:var(--app-muted);font-size:11px;font-weight:750}.tm-primary:disabled{background:#e4e9f0!important;border-color:#e4e9f0!important;color:#98a2b3!important;opacity:1!important}';document.head.appendChild(style);
  setTimeout(()=>{syncRoundUi();seedVisiblePlayers();renderSavedPicker()},100);
  setTimeout(()=>{seedVisiblePlayers();renderSavedPicker()},600);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();