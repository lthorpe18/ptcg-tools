(function(){
  'use strict';
  function safeDate(value){const d=new Date(value);return Number.isNaN(d.getTime())?null:d}
  function renderNextEvent(){
    if(!window.PTCGStorage)return;
    const state=window.PTCGStorage.load();
    const now=Date.now();
    const upcoming=state.plannedEvents.filter(p=>p.status==='attending'||p.status==='interested').map(p=>({p,d:safeDate(p.eventSnapshot&&(p.eventSnapshot.startTime||p.eventSnapshot.date))})).filter(x=>x.d&&x.d.getTime()>=now-86400000).sort((a,b)=>a.d-b.d)[0];
    if(!upcoming)return;
    const e=upcoming.p.eventSnapshot||{};
    const status=document.getElementById('competeStatus');
    if(!status)return;
    const label=e.name||e.venue||'Next event';
    status.textContent=`${formatDate(upcoming.d)} · ${label}`;
    status.hidden=false;
  }
  function formatDate(d){return d.toLocaleDateString(undefined,{day:'numeric',month:'short'})}
  async function loadFormat(){
    try{const r=await fetch('./data/meta/index.json',{cache:'no-store'});if(!r.ok)return;const data=await r.json();const f=(data.formats||[]).find(x=>x.id===data.current);if(f){const pill=document.querySelector('#formatPill span:last-child');if(pill)pill.textContent=`${f.label} · Standard`}}catch{}
  }
  renderNextEvent();loadFormat();
})();
