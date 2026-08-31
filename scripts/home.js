(function(){
  'use strict';
  function safeDate(snapshot){
    if(!snapshot||typeof snapshot!=='object')return null;
    const date=snapshot.startDate||snapshot.date;
    if(!date)return null;
    const time=snapshot.startTime&&/^\d{2}:\d{2}/.test(snapshot.startTime)?snapshot.startTime.slice(0,8):'12:00:00';
    const d=new Date(`${date}T${time}`);
    return Number.isNaN(d.getTime())?null:d;
  }
  function renderNextEvent(){
    if(!window.PTCGStorage)return;
    const state=window.PTCGStorage.load();
    const status=document.getElementById('competeStatus');
    if(!status)return;
    const now=Date.now();
    const upcoming=(state.plannedEvents||[])
      .filter(p=>p.status==='attending')
      .map(p=>({p,d:safeDate(p.eventSnapshot)}))
      .filter(x=>x.d&&x.d.getTime()>=now-86400000)
      .sort((a,b)=>a.d-b.d)[0];
    if(!upcoming){status.hidden=true;status.textContent='';return}
    const e=upcoming.p.eventSnapshot||{};
    const label=e.name||e.venue||e.city||'Next event';
    status.textContent=`${formatDate(upcoming.d)} · ${label}`;
    status.hidden=false;
  }
  function formatDate(d){return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'})}
  async function loadFormat(){
    try{const r=await fetch('./data/meta/index.json',{cache:'no-store'});if(!r.ok)return;const data=await r.json();const f=(data.formats||[]).find(x=>x.id===data.current);if(f){const pill=document.querySelector('#formatPill span:last-child');if(pill)pill.textContent=`${f.label} · Standard`}}catch{}
  }
  renderNextEvent();loadFormat();
  window.addEventListener('storage',renderNextEvent);
  window.addEventListener('ptcg:local-change',renderNextEvent);
})();
