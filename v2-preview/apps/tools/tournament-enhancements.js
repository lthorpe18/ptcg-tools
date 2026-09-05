(function(){
'use strict';
const $=id=>document.getElementById(id);
const NAME_KEY='ptcg-tools.tools.tournament-player-names.v1';
let activeUser=null,userPromise=null,seeding=false;

function cloudApi(){try{if(window.parent&&window.parent!==window&&window.parent.PTCGCloud)return window.parent.PTCGCloud}catch{}return window.PTCGCloud||null}
function userKey(){return activeUser?.id?`${NAME_KEY}:${activeUser.id}`:null}
function cleanNames(names){return [...new Set((names||[]).map(v=>String(v||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b)).slice(0,100)}
function readNames(){const key=userKey();if(!key)return[];try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?cleanNames(value):[]}catch{return[]}}
function writeNames(names){const key=userKey();if(!key)return;localStorage.setItem(key,JSON.stringify(cleanNames(names)))}
function esc(value){return String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
async function ensureUser(){if(activeUser)return activeUser;if(userPromise)return userPromise;const api=cloudApi();if(!api?.getUser)return null;userPromise=api.getUser().then(user=>{activeUser=user||null;userPromise=null;renderSavedPicker();return activeUser}).catch(()=>{activeUser=null;userPromise=null;renderSavedPicker();return null});return userPromise}
async function rememberName(name){const clean=String(name||'').trim();if(!clean)return;const user=await ensureUser();if(!user)return;writeNames([...readNames(),clean]);renderSavedPicker()}
function ensureSavedPicker(){
  const pane=$('tm-players'),addRow=pane?.querySelector('.tm-player-add');if(!pane||!addRow)return null;
  let wrap=$('tmSavedPlayerWrap');
  if(!wrap){
    wrap=document.createElement('div');wrap.id='tmSavedPlayerWrap';wrap.className='tm-saved-player hidden';
    wrap.innerHTML='<label for="tmSavedPlayer">Saved player</label><select id="tmSavedPlayer" class="tm-select"><option value="">Choose saved player…</option></select>';
    pane.insertBefore(wrap,addRow);
    const select=wrap.querySelector('select');
    select.addEventListener('change',async()=>{
      const name=select.value;if(!name)return;
      select.disabled=true;
      try{
        const manager=window.PTCGTournamentManager;
        if(manager?.addPlayerByName)await manager.addPlayerByName(name);
        else{const input=$('tmPlayerName');if(input){input.value=name;$('tmAddPlayer')?.click()}}
      }finally{select.value='';select.disabled=false;renderSavedPicker()}
    });
  }
  return wrap;
}
function renderSavedPicker(){
  const wrap=ensureSavedPicker();if(!wrap)return;
  const select=$('tmSavedPlayer'),current=window.PTCGTournamentManager?.getCurrent?.(),used=new Set((current?.players||[]).map(p=>String(p.name||'').trim().toLowerCase()));
  const names=(activeUser?readNames():[]).filter(name=>!used.has(name.toLowerCase())),hidden=!activeUser||!names.length;
  wrap.classList.toggle('hidden',hidden);
  if(!select)return;
  const html='<option value="">Choose saved player…</option>'+names.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('');
  if(select.innerHTML!==html)select.innerHTML=html;
}
function seedVisiblePlayers(){
  if(!activeUser||seeding)return;
  const names=[...document.querySelectorAll('#tmPlayers .tm-player span,#tmRun [data-result="P1"],#tmRun [data-result="P2"]')].map(el=>el.textContent?.trim()).filter(Boolean);
  if(!names.length)return;
  const before=readNames(),merged=cleanNames([...before,...names]);if(JSON.stringify(merged)===JSON.stringify(before))return;
  seeding=true;writeNames(merged);renderSavedPicker();seeding=false;
}
async function refreshUser(){activeUser=null;await ensureUser();seedVisiblePlayers();renderSavedPicker()}
function positionNextRound(){const run=$('tm-run'),rounds=$('tmRun'),button=$('tmNextRound');if(run&&rounds&&button&&button.nextElementSibling!==rounds)run.insertBefore(button,rounds)}
function refreshTournamentBits(){positionNextRound();seedVisiblePlayers();renderSavedPicker()}
function install(){
  positionNextRound();ensureSavedPicker();
  const add=$('tmAddPlayer'),input=$('tmPlayerName');
  add?.addEventListener('click',()=>{const name=input?.value?.trim();if(name)rememberName(name)},true);
  input?.addEventListener('keydown',event=>{if(event.key==='Enter'){const name=input.value.trim();if(name)rememberName(name)}},true);
  window.addEventListener('ptcg:tournament-player-added',event=>{rememberName(event.detail?.name);setTimeout(refreshTournamentBits,0)});
  window.addEventListener('ptcg:tournament-opened',()=>setTimeout(refreshTournamentBits,0));
  document.querySelectorAll('[data-tm-tab]').forEach(btn=>btn.addEventListener('click',()=>setTimeout(refreshTournamentBits,0)));
  refreshUser();
  try{window.parent?.addEventListener?.('ptcg:auth-change',refreshUser)}catch{}
  const api=cloudApi();if(api?.onAuthStateChange)api.onAuthStateChange(()=>refreshUser()).catch(()=>{});
  const style=document.createElement('style');style.textContent='.tm-saved-player{display:grid;gap:5px}.tm-saved-player label{color:var(--app-muted);font-size:11px;font-weight:750}.tm-primary:disabled{background:#e4e9f0!important;border-color:#e4e9f0!important;color:#98a2b3!important;opacity:1!important}';document.head.appendChild(style);
  setTimeout(refreshTournamentBits,100);setTimeout(refreshTournamentBits,600);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();