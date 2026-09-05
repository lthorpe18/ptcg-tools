(function(){
'use strict';
const $=id=>document.getElementById(id);
let fullscreenRequested=false;

function currentRoundLabel(){
  const rounds=[...document.querySelectorAll('#tmRun .tm-round')];
  const current=rounds.find(r=>r.querySelector('.tm-round-head small')?.textContent?.trim()==='In progress')||rounds[rounds.length-1];
  return current?.querySelector('.tm-round-head b')?.textContent?.trim()||'Round clock';
}
function syncContext(){
  const overlay=$('tmClockOverlay');if(!overlay)return;
  const title=$('tmClockTournament'),round=$('tmClockRound');
  if(title)title.textContent=$('tmTitle')?.textContent?.trim()||'Tournament';
  if(round)round.textContent=currentRoundLabel();
}
function ensurePolish(){
  const overlay=$('tmClockOverlay');if(!overlay)return false;
  const face=overlay.querySelector('.tm-clock-face');if(!face)return false;
  if(!$('tmClockContext')){
    const context=document.createElement('div');
    context.id='tmClockContext';context.className='tm-clock-context';
    context.innerHTML='<div id="tmClockTournament" class="tm-clock-tournament">Tournament</div><div id="tmClockRound" class="tm-clock-round">Round clock</div>';
    face.insertBefore(context,face.firstChild);
  }
  if(!$('tmClockExitHint')){
    const hint=overlay.querySelector('.tm-clock-hint');
    if(hint){hint.id='tmClockExitHint';hint.innerHTML='<span>Tap anywhere to return to pairings</span>'}
  }
  syncContext();return true;
}
async function requestDeviceFullscreen(){
  try{
    const parent=window.parent&&window.parent!==window?window.parent:window;
    const doc=parent.document;
    if(doc.fullscreenElement)return;
    const target=doc.documentElement;
    if(typeof target.requestFullscreen==='function'){
      await target.requestFullscreen({navigationUI:'hide'}).catch(()=>target.requestFullscreen());
      fullscreenRequested=true;
    }
  }catch{}
}
async function leaveDeviceFullscreen(){
  if(!fullscreenRequested)return;
  try{
    const parent=window.parent&&window.parent!==window?window.parent:window;
    if(parent.document.fullscreenElement&&typeof parent.document.exitFullscreen==='function')await parent.document.exitFullscreen();
  }catch{}
  fullscreenRequested=false;
}
function install(){
  const timer=$('tmTimer');
  timer?.addEventListener('click',()=>{ensurePolish();syncContext();requestDeviceFullscreen()});
  timer?.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){ensurePolish();syncContext();requestDeviceFullscreen()}});
  const overlay=$('tmClockOverlay');
  overlay?.addEventListener('click',event=>{if(event.target.closest('#tmClockPause'))return;leaveDeviceFullscreen()});
  window.addEventListener('pagehide',leaveDeviceFullscreen);
  ensurePolish();

  const style=document.createElement('style');style.id='tmClockPolishStyles';style.textContent=`
    .tm-clock-overlay{background:radial-gradient(circle at 50% 38%,#17213a 0,#0a0f1c 46%,#05070d 100%)!important;padding:max(18px,env(safe-area-inset-top)) max(22px,env(safe-area-inset-right)) max(18px,env(safe-area-inset-bottom)) max(22px,env(safe-area-inset-left))!important}
    .tm-clock-face{grid-template-rows:auto 1fr auto auto!important;align-items:center;justify-items:center;max-width:1100px;margin:auto}
    .tm-clock-context{align-self:start;text-align:center;padding-top:clamp(10px,4vh,42px);display:grid;gap:7px}
    .tm-clock-tournament{font-size:clamp(24px,6vw,38px);font-weight:850;color:rgba(255,255,255,.96);letter-spacing:-.015em;line-height:1.05}
    .tm-clock-round{font-size:clamp(18px,4.5vw,28px);font-weight:800;color:rgba(255,255,255,.62);line-height:1.1}
    .tm-clock-value{align-self:center!important;font-size:clamp(96px,29vw,320px)!important;line-height:.82!important;font-weight:860!important;letter-spacing:-.065em!important;color:#fff;text-shadow:0 10px 50px rgba(0,0,0,.28);font-variant-numeric:tabular-nums lining-nums}
    .tm-clock-pause{min-width:min(280px,70vw)!important;min-height:62px!important;border:1px solid rgba(255,255,255,.14)!important;border-radius:999px!important;background:rgba(255,255,255,.11)!important;color:#fff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.08);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);font-size:18px!important}
    .tm-clock-pause:active{transform:scale(.98);background:rgba(255,255,255,.18)!important}
    .tm-clock-hint{align-self:end!important;padding:14px 0 2px!important;color:rgba(255,255,255,.35)!important;font-size:11px!important;font-weight:650;letter-spacing:.01em}
    @media(orientation:landscape){.tm-clock-context{padding-top:4px}.tm-clock-tournament{font-size:clamp(22px,3.4vw,34px)}.tm-clock-round{font-size:clamp(17px,2.5vw,24px)}.tm-clock-value{font-size:clamp(86px,22vw,250px)!important}.tm-clock-pause{min-height:54px!important}.tm-clock-hint{padding-top:6px!important}}
  `;
  document.head.appendChild(style);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();