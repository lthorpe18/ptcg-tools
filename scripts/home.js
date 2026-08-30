(function(){
  'use strict';
  function safeDate(value){const d=new Date(value);return Number.isNaN(d.getTime())?null:d}
  function renderNextEvent(){
    if(!window.PTCGStorage)return;
    const state=window.PTCGStorage.load();
    const now=Date.now();
    const upcoming=state.plannedEvents.filter(p=>p.status==='attending'||p.status==='interested').map(p=>({p,d:safeDate(p.eventSnapshot&&(p.eventSnapshot.startTime||p.eventSnapshot.date))})).filter(x=>x.d&&x.d.getTime()>=now-86400000).sort((a,b)=>a.d-b.d)[0];
    if(!upcoming)return;
    const e=upcoming.p.eventSnapshot||{},days=Math.max(0,Math.ceil((upcoming.d.getTime()-now)/86400000));
    const section=document.getElementById('nextEventSection'),card=document.getElementById('nextEventCard');
    card.innerHTML=`<div><div class="app-eyebrow">${escapeHtml(e.type||'EVENT')}</div><h3>${escapeHtml(e.name||e.venue||'Upcoming event')}</h3><p>${escapeHtml(formatDate(upcoming.d))}${e.venue?` · ${escapeHtml(e.venue)}`:''}</p></div><div class="home-countdown"><b>${days}</b><span>day${days===1?'':'s'}</span></div>`;
    section.hidden=false;
  }
  function formatDate(d){return d.toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'})}
  function escapeHtml(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  async function loadFormat(){
    try{const r=await fetch('./data/meta/index.json',{cache:'no-store'});if(!r.ok)return;const data=await r.json();const f=(data.formats||[]).find(x=>x.id===data.current);if(f){const pill=document.querySelector('#formatPill span:last-child');if(pill)pill.textContent=`${f.label} · Standard`}}catch{}
  }
  renderNextEvent();loadFormat();
})();
