(function(){
  'use strict';

  const DAY=86400000;
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[c]));
  let metaRuntimeWindow=null;

  function safeDate(snapshot){
    if(!snapshot||typeof snapshot!=='object')return null;
    const date=snapshot.startDate||snapshot.date;
    if(!date)return null;
    const time=snapshot.startTime&&/^\d{2}:\d{2}/.test(snapshot.startTime)?snapshot.startTime.slice(0,8):'12:00:00';
    const d=new Date(`${date}T${time}`);
    return Number.isNaN(d.getTime())?null:d;
  }

  function rootState(){return window.PTCGStorage?.load?.()||{}}

  function getNextEvent(){
    const now=Date.now();
    return (rootState().eventParticipations||[])
      .filter(p=>p&&p.attendanceStatus==='attending'&&!p.completion)
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

  function seasonSummary(){
    const engine=window.PTCGSeasonEngine;
    const season=window.PTCGCompetitiveSeasons?.pokemon2027;
    const rules=window.PTCGSeasonRules?.pokemon2027;
    if(!engine||!season||!rules)return null;
    return engine.buildSeasonSummary(rootState().eventParticipations||[],season,rules);
  }

  function renderCompetePreview(){
    const el=document.getElementById('competePreview');
    if(!el)return;
    const upcoming=getNextEvent();
    if(upcoming){
      const e=upcoming.p.eventSnapshot||{};
      const label=e.name||e.venue||e.city||'Next tournament';
      const extra=[daysUntil(upcoming.d),e.type,e.city].filter(Boolean).join(' · ');
      el.href='./apps/events/';
      el.innerHTML=`<span class="home-preview-calendar">${esc(formatDate(upcoming.d))}</span><span class="home-preview-copy"><span class="home-preview-kicker">Next tournament</span><span class="home-preview-title">${esc(label)}</span>${extra?`<span class="home-preview-meta">${esc(extra)}</span>`:''}</span>`;
      const calendar=el.querySelector('.home-preview-calendar');
      if(calendar)calendar.innerHTML=esc(formatDate(upcoming.d)).replace(' ','<br>');
      el.hidden=false;
      return;
    }

    const summary=seasonSummary();
    el.href='./apps/events/?view=season';
    if(summary&&summary.completedEvents){
      el.innerHTML=`<span class="home-preview-tool-icon">★</span><span class="home-preview-copy"><span class="home-preview-kicker">2027 Season</span><span class="home-preview-title">${Number(summary.countingCP||0).toLocaleString()} CP</span><span class="home-preview-meta">${Number(summary.eligibleEvents||0)} eligible · ${Number(summary.completedEvents||0)} completed</span></span>`;
    }else{
      el.innerHTML='<span class="home-preview-tool-icon">★</span><span class="home-preview-copy"><span class="home-preview-kicker">2027 Season</span><span class="home-preview-title">Season record</span><span class="home-preview-meta">No upcoming tournament · view Season</span></span>';
    }
    el.hidden=false;
  }

  function parentMetaFrame(){
    if(window.parent===window)return null;
    try{return window.parent.document.querySelector('iframe[data-section="meta"]')}catch{return null}
  }

  function renderMetaPreview(){
    const el=document.getElementById('metaPreview');
    if(!el)return false;
    let runtime=null;
    try{runtime=parentMetaFrame()?.contentWindow}catch{}
    const metaData=runtime?.MetaData;
    if(!metaData){
      el.href='./apps/meta/#current';
      el.innerHTML='<span class="home-preview-tool-icon">◈</span><span class="home-preview-copy"><span class="home-preview-kicker">Current Meta</span><span class="home-preview-title">Loading latest IRL field…</span><span class="home-preview-meta">Latest major weekend</span></span>';
      el.hidden=false;
      return false;
    }
    try{
      const data=metaData.data('irl',{scope:'latest-weekend'});
      const top=(data.decks||[]).find(d=>d&&d.name&&Number(d.entries||0)>0);
      const context=metaData.context('irl',{scope:'latest-weekend'});
      if(!top){
        el.href='./apps/meta/#current';
        el.innerHTML='<span class="home-preview-tool-icon">◈</span><span class="home-preview-copy"><span class="home-preview-kicker">Current Meta</span><span class="home-preview-title">No IRL major field yet</span><span class="home-preview-meta">Open Meta for current evidence</span></span>';
        el.hidden=false;
        return true;
      }
      const sprite=window.DeckSprites?.html?.(top.name,{size:48})||`<span class="deck-sprite deck-sprite-fallback">${esc(top.name.charAt(0))}</span>`;
      const detail=[context?.label,context?.detail].filter(Boolean).join(' · ');
      el.href='./apps/meta/#current';
      el.innerHTML=`<span class="home-preview-sprite">${sprite}</span><span class="home-preview-copy"><span class="home-preview-kicker">Latest IRL leader</span><span class="home-preview-title">${esc(top.name)}</span><span class="home-preview-value">${Number(top.share||0).toFixed(1)}%</span>${detail?`<span class="home-preview-meta">${esc(detail)}</span>`:''}</span>`;
      el.hidden=false;
      return true;
    }catch(error){
      console.warn('Home meta preview unavailable',error);
      return false;
    }
  }

  function bindMetaRuntime(){
    const frame=parentMetaFrame();
    if(!frame){renderMetaPreview();return}
    const bind=()=>{
      let runtime=null;
      try{runtime=frame.contentWindow}catch{}
      if(!runtime)return;
      if(metaRuntimeWindow!==runtime){
        metaRuntimeWindow=runtime;
        runtime.addEventListener('irl:updated',renderMetaPreview);
        runtime.addEventListener('meta:data-changed',renderMetaPreview);
        runtime.addEventListener('decksprites:updated',renderMetaPreview);
      }
      renderMetaPreview();
    };
    frame.addEventListener('load',bind);
    bind();
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

  function savedDeckSprite(deck){
    const shared=window.DeckSprites?.html?.(deck?.archetype||deck?.name,{size:48});
    if(shared)return `<span class="home-preview-sprite">${shared}</span>`;
    const sprite=deck?.sprites?.find(Boolean);
    if(sprite?.spriteUrl)return `<span class="home-preview-deck-sprite"><img src="${esc(sprite.spriteUrl)}" alt=""></span>`;
    return '<span class="home-preview-deck-sprite home-preview-tool-icon">▤</span>';
  }

  async function renderDeckPreview(){
    const el=document.getElementById('deckPreview');
    if(!el)return null;
    try{
      const deck=await latestDeck();
      if(!deck){
        el.href='./apps/decklists/';
        el.innerHTML='<span class="home-preview-tool-icon">▤</span><span class="home-preview-copy"><span class="home-preview-kicker">My Decks</span><span class="home-preview-title">No saved decks yet</span><span class="home-preview-meta">Create or import a deck</span></span>';
        el.hidden=false;
        return null;
      }
      el.href=`./apps/decklists/?deck=${encodeURIComponent(deck.id)}`;
      el.innerHTML=`${savedDeckSprite(deck)}<span class="home-preview-copy"><span class="home-preview-kicker">Recently edited</span><span class="home-preview-title">${esc(deck.name||'Untitled deck')}</span><span class="home-preview-meta">${esc(deck.archetype||ago(deck.updatedAt))}${deck.archetype?` · ${esc(ago(deck.updatedAt))}`:''}</span></span>`;
      el.hidden=false;
      return deck;
    }catch(error){
      console.warn('Home deck preview unavailable',error);
      el.href='./apps/decklists/';
      el.innerHTML='<span class="home-preview-tool-icon">▤</span><span class="home-preview-copy"><span class="home-preview-kicker">My Decks</span><span class="home-preview-title">Open Decks</span><span class="home-preview-meta">Saved decks and testing</span></span>';
      el.hidden=false;
      return null;
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
      el.innerHTML='<span class="home-preview-tool-icon">⊕</span><span class="home-preview-copy"><span class="home-preview-kicker">For your next event</span><span class="home-preview-title">Cut / ID calculator</span><span class="home-preview-meta">Check your path to cut</span></span>';
    }else if(recentDeck){
      el.href='./apps/tools/';
      el.innerHTML=`<span class="home-preview-tool-icon">%</span><span class="home-preview-copy"><span class="home-preview-kicker">For your deck</span><span class="home-preview-title">Deck maths</span><span class="home-preview-meta">Check ${esc(deck.name||'your deck')} odds</span></span>`;
    }else{
      el.href='./apps/tools/#cut';
      el.innerHTML='<span class="home-preview-tool-icon">⊕</span><span class="home-preview-copy"><span class="home-preview-kicker">Quick utility</span><span class="home-preview-title">Cut / ID calculator</span><span class="home-preview-meta">Swiss cut and ID decisions</span></span>';
    }
    el.hidden=false;
  }

  async function renderHome(){
    renderCompetePreview();
    const deck=await renderDeckPreview();
    renderToolsPreview(deck);
    renderMetaPreview();
  }

  bindMetaRuntime();
  renderHome();
  window.addEventListener('storage',renderHome);
  window.addEventListener('ptcg:local-change',renderHome);
  window.addEventListener('decksprites:updated',()=>{renderDeckPreview();renderMetaPreview()});
})();
