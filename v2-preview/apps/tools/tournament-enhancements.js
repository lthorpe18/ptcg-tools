(function(){
'use strict';
const $=id=>document.getElementById(id);
const NAME_KEY='ptcg-tools.tools.tournament-player-names.v1';
let activeUser=null;

function userKey(){return activeUser?.id?`${NAME_KEY}:${activeUser.id}`:null}
function readNames(){const key=userKey();if(!key)return[];try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value.filter(Boolean):[]}catch{return[]}}
function writeNames(names){const key=userKey();if(!key)return;const clean=[...new Set(names.map(v=>String(v||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));localStorage.setItem(key,JSON.stringify(clean.slice(0,100)))}
function ensureDatalist(){const input=$('tmPlayerName');if(!input)return null;let list=$('tmPlayerSuggestions');if(!list){list=document.createElement('datalist');list.id='tmPlayerSuggestions';document.body.appendChild(list)}input.setAttribute('list',list.id);return list}
function renderNames(){const input=$('tmPlayerName'),list=ensureDatalist();if(!input||!list)return;if(!activeUser){input.removeAttribute('list');list.innerHTML='';return}list.innerHTML=readNames().map(name=>`<option value="${String(name).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}"></option>`).join('')}
function rememberCurrentName(){if(!activeUser)return;const input=$('tmPlayerName'),name=input?.value?.trim();if(!name)return;writeNames([...readNames(),name]);setTimeout(renderNames,0)}
async function refreshUser(){if(!window.PTCGCloud){activeUser=null;renderNames();return}try{activeUser=await window.PTCGCloud.getUser()}catch{activeUser=null}renderNames()}
function positionNextRound(){const run=$('tm-run'),rounds=$('tmRun'),button=$('tmNextRound');if(run&&rounds&&button&&button.nextElementSibling!==rounds)run.insertBefore(button,rounds)}
function install(){
  positionNextRound();
  const add=$('tmAddPlayer'),input=$('tmPlayerName');
  add?.addEventListener('click',rememberCurrentName);
  input?.addEventListener('keydown',event=>{if(event.key==='Enter')rememberCurrentName()});
  refreshUser();
  window.addEventListener('ptcg:auth-change',refreshUser);
  if(window.PTCGCloud?.onAuthStateChange)window.PTCGCloud.onAuthStateChange(()=>refreshUser()).catch(()=>{});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();