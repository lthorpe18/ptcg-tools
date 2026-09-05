(function(){
'use strict';
const $=id=>document.getElementById(id);
const NAME_KEY='ptcg-tools.tools.tournament-player-names.v1';
let activeUser=null;

function userKey(){return activeUser?.id?`${NAME_KEY}:${activeUser.id}`:null}
function cleanNames(names){return [...new Set(names.map(v=>String(v||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b)).slice(0,100)}
function readNames(){const key=userKey();if(!key)return[];try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?cleanNames(value):[]}catch{return[]}}
function writeNames(names){const key=userKey();if(!key)return;localStorage.setItem(key,JSON.stringify(cleanNames(names)))}
function escapeAttr(value){return String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function ensureDatalist(){const input=$('tmPlayerName');if(!input)return null;let list=$('tmPlayerSuggestions');if(!list){list=document.createElement('datalist');list.id='tmPlayerSuggestions';document.body.appendChild(list)}return list}
function renderNames(){const input=$('tmPlayerName'),list=ensureDatalist();if(!input||!list)return;if(!activeUser){input.removeAttribute('list');list.innerHTML='';return}input.setAttribute('list',list.id);list.innerHTML=readNames().map(name=>`<option value="${escapeAttr(name)}"></option>`).join('')}
function rememberNames(names){if(!activeUser)return;writeNames([...readNames(),...names]);renderNames()}
function rememberCurrentName(){const name=$('tmPlayerName')?.value?.trim();if(name)rememberNames([name])}
function backfillVisibleNames(){if(!activeUser)return;const names=[...document.querySelectorAll('.tm-player span,[data-result="P1"],[data-result="P2"]')].map(el=>el.textContent?.trim()).filter(Boolean);if(names.length)rememberNames(names)}
async function refreshUser(){if(!window.PTCGCloud){activeUser=null;renderNames();return}try{activeUser=await window.PTCGCloud.getUser()}catch{activeUser=null}renderNames();if(activeUser)setTimeout(backfillVisibleNames,0)}
function positionNextRound(){const run=$('tm-run'),rounds=$('tmRun'),button=$('tmNextRound');if(run&&rounds&&button&&button.nextElementSibling!==rounds)run.insertBefore(button,rounds)}
function updateSwissState(){const button=$('tmNextRound'),host=$('tmRun');if(!button||!host)return;const latest=host.querySelector('.tm-round');if(!latest)return;const status=latest.querySelector('.tm-round-head small')?.textContent?.trim();if(button.disabled&&status==='Complete'&&/^Generate Round \d+$/.test(button.textContent.trim()))button.textContent='Swiss complete'}
function syncEnhancements(){positionNextRound();updateSwissState();backfillVisibleNames()}
function install(){
  positionNextRound();
  const add=$('tmAddPlayer'),input=$('tmPlayerName');
  add?.addEventListener('click',rememberCurrentName,true);
  input?.addEventListener('keydown',event=>{if(event.key==='Enter')rememberCurrentName()},true);
  refreshUser();
  window.addEventListener('ptcg:auth-change',refreshUser);
  if(window.PTCGCloud?.onAuthStateChange)window.PTCGCloud.onAuthStateChange(()=>refreshUser()).catch(()=>{});
  const observer=new MutationObserver(syncEnhancements);
  const workspace=$('tmWorkspace');if(workspace)observer.observe(workspace,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled','class']});
  setTimeout(syncEnhancements,0);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();