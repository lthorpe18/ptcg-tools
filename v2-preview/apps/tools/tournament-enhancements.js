(function(){
'use strict';
const $=id=>document.getElementById(id);
const NAME_KEY='ptcg-tools.tools.tournament-player-names.v1';
let activeUser=null,userPromise=null;

function userKey(){return activeUser?.id?`${NAME_KEY}:${activeUser.id}`:null}
function cleanNames(names){return [...new Set((names||[]).map(v=>String(v||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b)).slice(0,100)}
function readNames(){const key=userKey();if(!key)return[];try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?cleanNames(value):[]}catch{return[]}}
function writeNames(names){const key=userKey();if(!key)return;localStorage.setItem(key,JSON.stringify(cleanNames(names)))}
async function ensureUser(){if(activeUser)return activeUser;if(userPromise)return userPromise;if(!window.PTCGCloud)return null;userPromise=window.PTCGCloud.getUser().then(user=>{activeUser=user||null;userPromise=null;renderSavedPicker();return activeUser}).catch(()=>{activeUser=null;userPromise=null;renderSavedPicker();return null});return userPromise}
async function rememberName(name){const clean=String(name||'').trim();if(!clean)return;const user=await ensureUser();if(!user)return;writeNames([...readNames(),clean]);renderSavedPicker()}
function ensureSavedPicker(){const pane=$('tm-players'),addRow=pane?.querySelector('.tm-player-add');if(!pane||!addRow)return null;let wrap=$('tmSavedPlayerWrap');if(!wrap){wrap=document.createElement('div');wrap.id='tmSavedPlayerWrap';wrap.className='tm-saved-player hidden';wrap.innerHTML='<label for="tmSavedPlayer">Saved player</label><select id="tmSavedPlayer" class="tm-select"><option value="">Choose saved player…</option></select>';pane.insertBefore(wrap,addRow);const select=wrap.querySelector('select');select.addEventListener('change',()=>{if(!select.value)return;const input=$('tmPlayerName');if(input){input.value=select.value;input.focus()}select.value=''})}return wrap}
function renderSavedPicker(){const wrap=ensureSavedPicker();if(!wrap)return;const select=$('tmSavedPlayer');const names=activeUser?readNames():[];wrap.classList.toggle('hidden',!activeUser||!names.length);if(!select)return;select.innerHTML='<option value="">Choose saved player…</option>'+names.map(name=>`<option value="${name.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}">${name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</option>`).join('')}
async function refreshUser(){activeUser=null;await ensureUser();renderSavedPicker()}
function positionNextRound(){const run=$('tm-run'),rounds=$('tmRun'),button=$('tmNextRound');if(run&&rounds&&button&&button.nextElementSibling!==rounds)run.insertBefore(button,rounds)}
function updateSwissState(){const button=$('tmNextRound'),host=$('tmRun');if(!button||!host)return;const rounds=[...host.querySelectorAll('.tm-round')];if(!rounds.length)return;const latest=rounds[rounds.length-1];const latestStatus=latest.querySelector('.tm-round-head small')?.textContent?.trim();const latestNumber=Number((latest.querySelector('.tm-round-head b')?.textContent||'').match(/\d+/)?.[0]||0);const generated=Number((button.textContent||'').match(/\d+/)?.[0]||0);const plannedReached=button.disabled&&generated===latestNumber+1;
  if(plannedReached&&latestStatus==='Complete')button.textContent='Swiss complete';
  else if(button.textContent.trim()==='Swiss complete'&&latestStatus!=='Complete')button.textContent=`Generate Round ${latestNumber+1}`;
}
function syncEnhancements(){positionNextRound();updateSwissState();renderSavedPicker()}
function install(){
  positionNextRound();
  ensureSavedPicker();
  const add=$('tmAddPlayer'),input=$('tmPlayerName');
  add?.addEventListener('click',()=>{const name=input?.value?.trim();if(name)rememberName(name)},true);
  input?.addEventListener('keydown',event=>{if(event.key==='Enter'){const name=input.value.trim();if(name)rememberName(name)}},true);
  refreshUser();
  window.addEventListener('ptcg:auth-change',refreshUser);
  if(window.PTCGCloud?.onAuthStateChange)window.PTCGCloud.onAuthStateChange(()=>refreshUser()).catch(()=>{});
  const observer=new MutationObserver(syncEnhancements);
  const workspace=$('tmWorkspace');if(workspace)observer.observe(workspace,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled','class']});
  const style=document.createElement('style');style.textContent='.tm-saved-player{display:grid;gap:5px}.tm-saved-player label{color:var(--app-muted);font-size:11px;font-weight:750}.tm-primary:disabled{background:#e4e9f0!important;border-color:#e4e9f0!important;color:#98a2b3!important;opacity:1!important}';document.head.appendChild(style);
  setTimeout(syncEnhancements,0);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();