(function(){
  'use strict';

  const DAY=86400000;
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  let metaIndexPromise=null;

  function safeDate(snapshot){
    if(!snapshot||typeof snapshot!=='object')return null;
    const date=snapshot.startDate||snapshot.date;
    if(!date)return null;
    const time=snapshot.startTime&&/^\d{2}:\d{2}/.test(snapshot.startTime)?snapshot.startTime.slice(0,8):'12:00:00';
    const d=new Date(`${date}T${time}`);
    return Number.isNaN(d.getTime())?null:d;
  }

  function getNextEvent(){
    if(!window.PTCGStorage)return null;
    const state=window.PTCGStorage.load();
    const now=Date.now();
    return (state.eventParticipations||[])
      .filter(p=>p.attendanceStatus==='attending')
      .map(p=>({p,d:safeDate(p.eventSnapshot)}))
      .filter(x=>x.d&&x.d.getTime()>=now-DAY)
      .sort((a,b)=>a.d-b.d)[0]||null;
  }

  function formatDate(d){return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'})}
  function daysUntil(d){
    const now=new Date();
    const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    const target=new Date(d.getFullYear(),d.getMonth(),d.getDate());
    const days=Math.round((target-today)/DAY);
    if(days===0)return 'Today';
    if(days===1)return 'Tomorrow';
    return days>1?`${days} days away`:'';
  }

  function renderNextEvent(){
    const el=document.getElementById('competePreview');
    if(!el)return;
    const upcoming=getNextEvent();
    if(!upcoming){el.hidden=true;el.innerHTML='';return}
    const e=upcoming.p.eventSnapshot||{};
    const label=e.name||e.venue||e.city||'Next event';
    const extra=[daysUntil(upcoming.d),e.city].filter(Boolean).join(' · ');
    el.innerHTML=`<span class="home-preview-calendar">${esc(formatDate(upcoming.d).replace(' ','<br>'))}</span><span class="home-preview-copy"><span class="home-preview-kicker">Next event</span><span class="home-preview-title">${esc(label)}</span>${extra?`<span class="home-preview-meta">${esc(extra)}</span>`:''}</span>`;
    const calendar=el.querySelector('.home-preview-calendar');
    if(calendar)calendar.innerHTML=esc(formatDate(upcoming.d)).replace(' ','<br>');
    el.hidden=false;
  }

  function mondayKey(date){
    const d=new Date(date);
    if(Number.isNaN(d.getTime()))return '';
    const utc=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));
    const diff=(utc.getUTCDay()+6)%7;
    utc.setUTCDate(utc.getUTCDate()-diff);
    return utc.toISOString().slice(0,10);
  }

  function weekendDateLabel(events){
    const dates=events.map(e=>new Date(e.date)).filter(d=>!Number.isNaN(d.getTime())).sort((a,b)=>a-b);
    if(!dates.length)return '';
    const first=dates[0],last=dates[dates.length-1];
    if(first.toISOString().slice(0,10)===last.toISOString().slice(0,10))return first.toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
    if(first.getUTCMonth()===last.getUTCMonth())return `${first.getUTCDate()}–${last.getUTCDate()} ${last.toLocaleDateString('en-GB',{month:'short',timeZone:'UTC'})}`;
    return `${first.toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'})}–${last.toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'})}`;
  }

  async function loadMetaIndex(){
    if(!metaIndexPromise){
      metaIndexPromise=fetch('./data/meta/index.json',{cache:'default'}).then(r=>{
        if(!r.ok)throw new Error('format index unavailable');
        return r.json();
      }).catch(error=>{metaIndexPromise=null;throw error});
    }
    return metaIndexPromise;
  }

  async function renderMetaPreview(){
    const el=document.getElementById('metaPreview');
    if(!el)return;
    try{
      const index=await loadMetaIndex();
      const format=(index.formats||[]).find(x=>x.id===index.current);
      const formatId=format?.id||index.current||'TEF-PBL';
      const response=await fetch(`./data/meta/irl/${encodeURIComponent(formatId)}.json`,{cache:'default'});
      if(!response.ok)throw new Error('IRL data unavailable');
      const data=await response.json();
      const events=(data.events||[]).filter(e=>e&&e.date&&Array.isArray(e.decks));
      if(!events.length)throw new Error('no IRL events');
      events.sort((a,b)=>new Date(b.date)-new Date(a.date));
      const key=mondayKey(events[0].date);
      const weekend=events.filter(e=>mondayKey(e.date)===key);
      const grouped=new Map();
      let total=0;
      for(const event of weekend){
        for(const deck of event.decks||[]){
          const entries=Number(deck.entries||0);
          if(!entries||!deck.name)continue;
          const family=window.ArchetypeGroups?.familyName?.(deck.name)||deck.name;
          grouped.set(family,(grouped.get(family)||0)+entries);
          total+=entries;
        }
      }
      const top=[...grouped.entries()].sort((a,b)=>b[1]-a[1])[0];
      if(!top||!total)throw new Error('no IRL field');
      const [name,entries]=top;
      const share=100*entries/total;
      const context=weekend.length===1?(weekend[0].name||'Latest IRL major'):`Last ${weekend.length} majors · ${weekendDateLabel(weekend)}`;
      const sprite=window.DeckSprites?.html?.(name,{size:48})||`<span class="deck-sprite deck-sprite-fallback">${esc(name.charAt(0))}</span>`;
      el.innerHTML=`<span class="home-preview-sprite">${sprite}</span><span class="home-preview-copy"><span class="home-preview-kicker">Latest IRL leader</span><span class="home-preview-title">${esc(name)}</span><span class="home-preview-value">${share.toFixed(1)}%</span><span class="home-preview-meta">${esc(context)}</span></span>`;
      el.hidden=false;
    }catch(error){
      console.warn('Home meta preview unavailable',error);
      el.hidden=true;el.innerHTML='';
    }
  }

  function ago(ts){
    const days=Math.floor(Math.max(0,Date.now()-Number(ts||0))/DAY);
    if(days<1)return 'Edited today';
    if(days===1)return 'Edited yesterday';
    return `Edited ${days} days ago`;
  }

  async function latestDeck(){
    if(!window.PTCGDeckStore)return null;
    await window.PTCGDeckStore.open();
    const decks=await window.PTCGDeckStore.all();
    return decks.sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0))[0]||null;
  }

  async function renderDeckPreview(){
    const el=document.getElementById('deckPreview');
    if(!el)return null;
    try{
      const deck=await latestDeck();
      if(!deck){el.hidden=true;el.innerHTML='';return null}
      const sprite=deck.sprites?.find(Boolean);
      const visual=sprite?.spriteUrl?`<span class="home-preview-deck-sprite"><img src="${esc(sprite.spriteUrl)}" alt=""></span>`:`<span class="home-preview-deck-sprite home-preview-tool-icon">▤</span>`;
      el.href=`./apps/decklists/?deck=${encodeURIComponent(deck.id)}`;
      el.innerHTML=`${visual}<span class="home-preview-copy"><span class="home-preview-kicker">Recently edited</span><span class="home-preview-title">${esc(deck.name||'Untitled deck')}</span><span class="home-preview-meta">${esc(ago(deck.updatedAt))}</span></span>`;
      el.hidden=false;
      return deck;
    }catch(error){
      console.warn('Home deck preview unavailable',error);
      el.hidden=true;el.innerHTML='';return null;
    }
  }

  function renderToolsPreview(deck){
    const el=document.getElementById('toolsPreview');
    if(!el)return;
    const upcoming=getNextEvent();
    const nearEvent=upcoming&&Math.ceil((upcoming.d.getTime()-Date.now())/DAY)<=2;
    const recentDeck=deck&&Date.now()-Number(deck.updatedAt||0)<=7*DAY;
    if(nearEvent){
      el.href='./apps/tools/#cut';
      el.innerHTML='<span class="home-preview-tool-icon">⊕</span><span class="home-preview-copy"><span class="home-preview-kicker">Suggested</span><span class="home-preview-title">Cut / ID calculator</span><span class="home-preview-meta">Work out your path to cut</span></span>';
    }else if(recentDeck){
      el.href='./apps/tools/';
      el.innerHTML=`<span class="home-preview-tool-icon">%</span><span class="home-preview-copy"><span class="home-preview-kicker">Suggested</span><span class="home-preview-title">Deck maths</span><span class="home-preview-meta">Check ${esc(deck.name||'your deck')} odds</span></span>`;
    }else{
      el.href='./apps/tools/#cut';
      el.innerHTML='<span class="home-preview-tool-icon">⊕</span><span class="home-preview-copy"><span class="home-preview-kicker">Suggested</span><span class="home-preview-title">Cut / ID calculator</span><span class="home-preview-meta">Swiss cut and ID decisions</span></span>';
    }
  }

  async function loadFormat(){
    try{const data=await loadMetaIndex();const f=(data.formats||[]).find(x=>x.id===data.current);if(f){const pill=document.querySelector('#formatPill span:last-child');if(pill)pill.textContent=`${f.label} · Standard`}}catch{}
  }

  async function renderHome(){
    renderNextEvent();
    const deck=await renderDeckPreview();
    renderToolsPreview(deck);
    renderMetaPreview();
    loadFormat();
  }

  renderHome();
  window.addEventListener('storage',renderHome);
  window.addEventListener('ptcg:local-change',renderHome);
})();
