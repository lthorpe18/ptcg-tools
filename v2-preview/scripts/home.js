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

  function compactSprite(name){
    const html=window.DeckSprites?.html?.(name,{size:24})||`<span class="deck-sprite deck-sprite-fallback">${esc(String(name||'?').charAt(0))}</span>`;
    return `<span class="home-preview-sprite" style="flex:0 0 52px;width:52px;height:32px">${html}</span>`;
  }

  function heroSprite(name){
    const sprites=window.DeckSprites;
    const slugs=sprites?.slugs?.(name)||[];
    if(!slugs.length){
      return `<div class="home-meta-sprite-placeholder" title="${esc(name)}" aria-label="${esc(name)}"><span class="home-meta-hero-fallback">${esc(String(name||'?').charAt(0))}</span></div>`;
    }
    const primary=`<img class="home-meta-hero-primary" src="${sprites.url(slugs[0])}" alt="" loading="lazy" decoding="async">`;
    const secondary=slugs[1]?`<span class="home-meta-hero-secondary-badge"><img class="home-meta-hero-secondary" src="${sprites.url(slugs[1])}" alt="" loading="lazy" decoding="async"></span>`:'';
    return `<div class="home-meta-sprite-placeholder" title="${esc(name)}" aria-label="${esc(name)}"><span class="home-meta-hero-sprite">${primary}${secondary}</span></div>`;
  }

  function groupingMode(){
    return document.querySelector('input[name="homeVariantGrouping"]:checked')?.value||'variants';
  }

  function presentationRows(rows,runtime){
    const clean=(rows||[]).filter(row=>row&&row.name&&Number(row.share)>0);
    if(groupingMode()!=='grouped')return clean;
    const families=runtime?.ArchetypeGroups?.FAMILIES||[];
    const variantToFamily=new Map();
    for(const family of families)for(const variant of family.variants||[])variantToFamily.set(variant,family.name);
    const grouped=new Map();
    for(const row of clean){
      const name=variantToFamily.get(row.name)||row.name;
      const current=grouped.get(name)||{...row,name,share:0,variants:[]};
      current.share+=Number(row.share)||0;
      if(!current.variants.includes(row.name))current.variants.push(row.name);
      grouped.set(name,current);
    }
    return [...grouped.values()].sort((a,b)=>Number(b.share||0)-Number(a.share||0)||a.name.localeCompare(b.name));
  }

  function renderMetaLoading(){
    const el=document.getElementById('blendedMetaPreview');
    if(!el)return false;
    el.innerHTML=[100,70,58,42,34].map(bar=>`<div class="home-meta-bar-item"><div class="home-meta-bar" style="--bar:${bar}%"><span>—</span></div><div class="home-meta-sprite-placeholder">◆</div></div>`).join('');
    return false;
  }

  function renderMetaPreview(){
    const el=document.getElementById('blendedMetaPreview');
    if(!el)return false;
    let runtime=null;
    try{runtime=parentMetaFrame()?.contentWindow}catch{}
    const model=runtime?.MetaBlendedField;
    if(!model?.current)return renderMetaLoading();

    try{
      const result=model.current();
      const rows=presentationRows(result?.rows||[],runtime).slice(0,5);
      if(!rows.length)return renderMetaLoading();
      const maxShare=Math.max(...rows.map(row=>Number(row.share)||0),0.001);
      el.innerHTML=rows.map(row=>{
        const share=Number(row.share)||0;
        const pct=share*100;
        const barPct=Math.max(28,Math.min(100,(share/maxShare)*100));
        return `<div class="home-meta-bar-item"><div class="home-meta-bar" style="--bar:${barPct.toFixed(1)}%"><span>${pct.toFixed(1)}%</span></div>${heroSprite(row.name)}</div>`;
      }).join('');
      return true;
    }catch(error){
      console.warn('Home blended meta unavailable',error);
      return renderMetaLoading();
    }
  }

  function bindGroupingControl(){
    document.querySelectorAll('input[name="homeVariantGrouping"]').forEach(input=>input.addEventListener('change',renderMetaPreview));
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
        runtime.addEventListener('online:updated',renderMetaPreview);
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

  function savedDeckSprite(deck){return compactSprite(deck?.archetype||deck?.name||'')}

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

  function bindPersonalCardTargets(){
    document.querySelectorAll('[data-home-card-target]').forEach(card=>{
      const go=()=>{
        const target=document.getElementById(card.dataset.homeCardTarget||'');
        if(target)target.click();
      };
      card.addEventListener('click',event=>{
        if(event.target.closest('a'))return;
        go();
      });
      card.addEventListener('keydown',event=>{
        if(event.key==='Enter'||event.key===' '){event.preventDefault();go()}
      });
    });
  }

  async function renderHome(){
    renderCompetePreview();
    await renderDeckPreview();
    renderMetaPreview();
  }

  bindPersonalCardTargets();
  bindGroupingControl();
  bindMetaRuntime();
  renderHome();
  window.addEventListener('storage',renderHome);
  window.addEventListener('ptcg:local-change',renderHome);
  window.addEventListener('decksprites:updated',()=>{renderDeckPreview();renderMetaPreview()});
})();
