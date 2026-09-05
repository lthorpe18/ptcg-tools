(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const MAIN = ['currentMetaPage','prep','matchups','decks'];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct = value => Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}%` : '—';
  const ignored = name => !name || name === 'Other' || name === 'Unknown';

  const detail = {
    name:'',
    source:'online',
    origin:'current',
    renderTimer:0,
  };
  let matchupDeck = '';

  const sectionForView = view => view === 'current' ? 'currentMetaPage' : ['prep','matchups','decks'].includes(view) ? view : 'currentMetaPage';
  const viewForSection = id => id === 'currentMetaPage' ? 'current' : ['prep','matchups','decks'].includes(id) ? id : 'current';
  const sourceData = source => window.MetaData?.data?.(source) || {decks:[],matchups:[],events:[],overview:{}};

  function rows(source) {
    const raw = (sourceData(source).decks || []).filter(d => !ignored(d.name));
    const total = raw.reduce((sum,d)=>sum + Number(d.entries ?? d.count ?? d.players ?? 0),0);
    return raw.map(d=>{
      const entries = Number(d.entries ?? d.count ?? d.players ?? 0);
      const wins = Number(d.wins||0), losses = Number(d.losses||0), ties = Number(d.ties||0);
      const decisive = wins + losses;
      const share = Number.isFinite(Number(d.share)) ? Number(d.share) : total ? 100*entries/total : 0;
      const winRate = Number.isFinite(Number(d.winRate)) ? Number(d.winRate) : decisive ? 100*wins/decisive : null;
      return {...d,entries,wins,losses,ties,share,winRate};
    }).sort((a,b)=>b.entries-a.entries || b.share-a.share);
  }

  function sprite(name,size=38) { return window.DeckSprites?.html?.(name,{size}) || ''; }
  function familyFor(name) { return (window.ArchetypeGroups?.FAMILIES || []).find(f=>f.name===name || f.variants.includes(name)) || null; }

  function matchup(source,a,b) {
    const m = (sourceData(source).matchups || []).find(x=>x.a===a && x.b===b);
    if (!m) return null;
    const wins=Number(m.wins||0), losses=Number(m.losses||0), ties=Number(m.ties||0);
    const games=Number(m.games || wins+losses+ties), decisive=wins+losses;
    return {wins,losses,ties,games,winRate:decisive ? 100*wins/decisive : null};
  }

  function matchupCards(name,source,limit=60) {
    const list = rows(source)
      .filter(r=>r.name!==name)
      .map(opponent=>({opponent,m:matchup(source,name,opponent.name)}))
      .filter(x=>x.m)
      .sort((a,b)=>b.m.games-a.m.games)
      .slice(0,limit);
    if (!list.length) return '<div class="meta-empty">No matchup evidence is available for this exact variant in the selected source and scope.</div>';
    return `<div class="matchup-card-list">${list.map(({opponent,m})=>`<button class="matchup-card" type="button" data-explore-deck="${esc(opponent.name)}" data-explore-source="${source}"><span class="matchup-opponent">${sprite(opponent.name,32)}<span><b>${esc(opponent.name)}</b><small>${m.wins}-${m.losses}-${m.ties} · ${m.games} games</small></span></span><strong>${pct(m.winRate)}</strong></button>`).join('')}</div>`;
  }

  function ensureDetail() {
    if ($('deckDetail')) return;
    const section=document.createElement('section');
    section.id='deckDetail';
    section.className='meta-child deck-detail hidden';
    section.innerHTML='<header class="meta-child-header"><button class="meta-back" id="deckDetailBack" type="button">← Back</button><div id="deckDetailHead"></div></header><div id="deckDetailBody"></div>';
    document.querySelector('main.wrap')?.appendChild(section);
  }

  function enterDetail() {
    ensureDetail();
    MAIN.forEach(id=>$(id)?.classList.add('hidden'));
    $('deckDetail')?.classList.remove('hidden');
    document.body.dataset.metaView='detail';
  }

  function detailUrl() {
    const url=new URL(location.href);
    url.searchParams.set('deck',detail.name);
    url.searchParams.set('source',detail.source);
    url.searchParams.set('from',detail.origin);
    url.hash='detail';
    return url;
  }

  function syncDetailUrl(mode='replace') {
    const url=detailUrl();
    const state={ptcgMetaDetail:true,deck:detail.name,source:detail.source,from:detail.origin};
    if (mode==='push') history.pushState(state,'',url);
    else history.replaceState(state,'',url);
    if (window.parent!==window) {
      try { window.parent.postMessage({type:'ptcg:shell-route',url:location.href},location.origin); } catch {}
    }
  }

  function scopeOptions(source) {
    const state=window.MetaState?.get?.() || {};
    const options=source==='irl' ? (window.MetaState?.irlScopes?.() || []) : (window.MetaState?.onlineScopes?.() || []);
    const selected=source==='irl' ? state.irlScope : state.onlineScope;
    const normal=options.filter(o=>!o.event).map(o=>`<option value="${esc(o.value)}" ${o.value===selected?'selected':''}>${esc(o.label)}</option>`).join('');
    const events=options.filter(o=>o.event).map(o=>`<option value="${esc(o.value)}" ${o.value===selected?'selected':''}>${esc(o.label)}</option>`).join('');
    return normal + (events ? `<optgroup label="Individual tournaments">${events}</optgroup>` : '');
  }

  function context(source) { return window.MetaData?.context?.(source) || {}; }

  function recentResults(name) {
    const data=sourceData('online');
    const selected=new Set((data.events||[]).map(e=>e.name).filter(Boolean));
    return (data.results||[]).filter(r=>r.archetype===name).filter(r=>!selected.size || selected.has(r.tournament)).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,8);
  }

  function renderDetail() {
    if (!detail.name) return;
    enterDetail();
    const previousOpen=$('deckDetailEvidence')?.open ?? true;
    const scrollY=window.scrollY;
    const data=sourceData(detail.source);
    const row=rows(detail.source).find(r=>r.name===detail.name);
    const family=familyFor(detail.name);
    const sourceLabel=detail.source==='irl'?'IRL':'Online';
    const ctx=context(detail.source);
    const currentScope=ctx.label || sourceLabel;
    const referenceScope=detail.source==='irl'?'latest-weekend':'since-major';
    const ref=(window.MetaData?.data?.(detail.source,{scope:referenceScope})?.decks||[]).find(d=>d.name===detail.name);
    const currentShare=ref && Number.isFinite(Number(ref.share)) ? pct(ref.share) : '—';
    const currentShareLabel=detail.source==='irl'?'Latest IRL weekend':'Since last major';

    $('deckDetailHead').innerHTML=`<div class="detail-heading-row"><div class="detail-title">${sprite(detail.name,52)}<div><div class="eyebrow">${sourceLabel} DECK</div><h1>${esc(detail.name)}</h1><p>${family?`${esc(family.name)} family · exact variant`:'Exact variant detail'}</p></div></div><div class="detail-current-share"><span>Current share</span><b>${currentShare}</b><small>${esc(currentShareLabel)}</small></div></div>`;

    const scopeControl=`<label id="deckDetailScopeWrap" class="meta-scope-control detail-scope-control"><span>${sourceLabel} scope</span><select id="deckDetailScope">${scopeOptions(detail.source)}</select></label>`;
    const sourceControl=`<div class="detail-source"><button type="button" data-detail-source="online" class="${detail.source==='online'?'active':''}">Online</button><button type="button" data-detail-source="irl" class="${detail.source==='irl'?'active':''}">IRL</button></div>`;

    if (!row) {
      $('deckDetailBody').innerHTML=`<details id="deckDetailEvidence" class="detail-data-panel" ${previousOpen?'open':''}><summary><span><b>Data & performance</b><small>${sourceLabel} · selected scope</small></span><span class="detail-panel-chevron">⌄</span></summary><div class="detail-data-body"><div id="deckDetailControlsHost" class="detail-evidence-controls">${sourceControl}${scopeControl}</div><div class="meta-empty">This exact variant is not present in the selected ${sourceLabel} source and scope.</div></div></details>`;
      bindDetailControls();
      requestAnimationFrame(()=>window.scrollTo(0,scrollY));
      return;
    }

    const games=(data.matchups||[]).filter(m=>m.a===detail.name).reduce((sum,m)=>sum+Number(m.games||Number(m.wins||0)+Number(m.losses||0)+Number(m.ties||0)),0);
    const eventCount=Number(data.overview?.events || data.events?.length || 0);
    const results=detail.source==='online'?recentResults(detail.name):[];
    const resultsHtml=results.length?`<section class="detail-section"><div class="section-row"><h2>Recent results</h2><span>Live result sample within selected field scope</span></div><div class="result-card-list">${results.map(r=>`<div class="result-card"><b>${r.placing}/${r.players}</b><span>${esc(r.player)}</span><small>${esc(r.tournament)} · ${r.record?.wins||0}-${r.record?.losses||0}-${r.record?.ties||0}</small></div>`).join('')}</div></section>`:'';

    $('deckDetailBody').innerHTML=`<details id="deckDetailEvidence" class="detail-data-panel" ${previousOpen?'open':''}><summary><span><b>Data & performance</b><small>${esc(currentScope)} · ${row.entries.toLocaleString()} deck entries · ${pct(row.winRate)} WR</small></span><span class="detail-panel-chevron">⌄</span></summary><div class="detail-data-body"><div id="deckDetailControlsHost" class="detail-evidence-controls">${sourceControl}${scopeControl}</div><div class="detail-evidence-block"><div class="detail-evidence-block-title"><b>Field performance</b><small>This exact variant within the selected field</small></div><div class="detail-stats"><div><b>${row.entries.toLocaleString()}</b><span>Deck entries</span></div><div><b>${pct(row.share)}</b><span>Field share</span></div><div><b>${pct(row.winRate)}</b><span>Win rate</span></div></div><div class="detail-sample-strip"><span>Field sample</span><b>${row.entries.toLocaleString()} deck entries across ${eventCount.toLocaleString()} ${eventCount===1?'event':'events'}</b></div></div><div class="detail-evidence-block"><div class="detail-evidence-block-title"><b>Matchup evidence</b><small>Head-to-head games involving this exact variant</small></div><div class="detail-sample-strip matchup-sample"><span>Matchup sample</span><b>${games.toLocaleString()} games involving ${esc(detail.name)}</b></div></div></div></details><section class="detail-section detail-matchups"><div class="section-row"><h2>Matchups</h2><span>${esc(currentScope)}</span></div><label class="deck-list-search"><span class="search-glyph">⌕</span><input id="detailMatchupSearch" type="search" autocomplete="off" placeholder="Filter matchups" aria-label="Filter matchups"></label>${matchupCards(detail.name,detail.source)}</section>${resultsHtml}`;
    bindDetailControls();
    const search=$('detailMatchupSearch');
    search?.addEventListener('input',()=>{
      const q=search.value.trim().toLowerCase();
      $('deckDetail')?.querySelectorAll('.matchup-card').forEach(card=>{ card.hidden=!!q && !(card.querySelector('.matchup-opponent b')?.textContent||'').toLowerCase().includes(q); });
    });
    requestAnimationFrame(()=>window.scrollTo(0,scrollY));
  }

  function scheduleDetailRender() {
    clearTimeout(detail.renderTimer);
    detail.renderTimer=setTimeout(()=>renderDetail(),0);
  }

  function bindDetailControls() {
    $('deckDetailScope')?.addEventListener('change',event=>{
      const value=event.currentTarget.value;
      if (detail.source==='irl') window.MetaState?.setIrlScope?.(value,'detail-scope');
      else window.MetaState?.setOnlineScope?.(value,'detail-scope');
      scheduleDetailRender();
    },{once:true});
  }

  function openDetail(name,source,options={}) {
    if (!name) return;
    const visible=MAIN.find(id=>!$(id)?.classList.contains('hidden'));
    detail.origin=options.origin || (visible?viewForSection(visible):detail.origin) || 'current';
    detail.name=name;
    detail.source=source==='irl'?'irl':'online';
    renderDetail();
    if (options.syncUrl!==false) syncDetailUrl(options.replace?'replace':'push');
    if (!options.preserveScroll) window.scrollTo({top:0,behavior:'instant'});
  }

  function closeDetail({syncUrl=true}={}) {
    clearTimeout(detail.renderTimer);
    $('deckDetail')?.classList.add('hidden');
    window.MetaHome?.setView?.(detail.origin,false);
    document.body.dataset.metaView=detail.origin;
    if (syncUrl) {
      const url=new URL(location.href);
      url.searchParams.delete('deck'); url.searchParams.delete('source'); url.searchParams.delete('from');
      url.hash=detail.origin==='current'?'':detail.origin;
      history.replaceState({ptcgMetaView:detail.origin},'',url);
      if (window.parent!==window) {
        try { window.parent.postMessage({type:'ptcg:shell-route',url:location.href},location.origin); } catch {}
      }
    }
    window.scrollTo({top:0,behavior:'instant'});
  }

  function renderDeckExplorer() {
    const target=$('deckExplorerList'); if(!target)return;
    const source=$('deckPageSource')?.value||'online';
    const list=rows(source).slice(0,100);
    target.innerHTML=`<label class="deck-list-search"><span class="search-glyph">⌕</span><input id="deckExplorerSearch" type="search" autocomplete="off" placeholder="Search deck variants" aria-label="Search deck variants"></label><div class="deck-explorer-card-list">${list.map((r,i)=>`<button class="deck-explorer-card" type="button" data-explore-deck="${esc(r.name)}" data-explore-source="${source}"><span class="deck-explorer-rank">${i+1}</span>${sprite(r.name,38)}<span class="deck-explorer-copy"><b>${esc(r.name)}</b><small>${r.entries.toLocaleString()} entries</small></span><span class="deck-explorer-score"><b>${pct(r.share)}</b><small>${pct(r.winRate)} WR</small></span><span class="explore-arrow">›</span></button>`).join('')}</div>`;
    const search=$('deckExplorerSearch');
    search?.addEventListener('input',()=>{
      const q=search.value.trim().toLowerCase();
      target.querySelectorAll('.deck-explorer-card').forEach(card=>{ card.hidden=!!q && !(card.querySelector('.deck-explorer-copy b')?.textContent||'').toLowerCase().includes(q); });
    });
  }

  function renderMatchups() {
    const target=$('metaMatchupMatrix'); if(!target)return;
    const source=$('matchupPageSource')?.value||'online';
    const available=rows(source).filter(d=>(sourceData(source).matchups||[]).some(m=>m.a===d.name));
    if (!available.length) { target.innerHTML='<div class="meta-empty">No variant-level matchup data available in the selected source and scope.</div>'; return; }
    if (!matchupDeck || !available.some(d=>d.name===matchupDeck)) matchupDeck=available[0].name;
    target.innerHTML=`<div class="matchup-picker"><label>Deck variant<select id="matchupDeckSelect">${available.slice(0,100).map(d=>`<option value="${esc(d.name)}" ${d.name===matchupDeck?'selected':''}>${esc(d.name)}</option>`).join('')}</select></label><button type="button" class="open-deck-detail" data-explore-deck="${esc(matchupDeck)}" data-explore-source="${source}">Explore variant ›</button></div><div class="variant-only-note">Matchup evidence is variant-to-variant. Family grouping is not used here.</div>${matchupCards(matchupDeck,source,80)}`;
    $('matchupDeckSelect')?.addEventListener('change',event=>{ matchupDeck=event.currentTarget.value; renderMatchups(); });
  }

  document.addEventListener('click',event=>{
    const back=event.target.closest('#deckDetailBack');
    if (back) {
      event.preventDefault();
      if (history.state?.ptcgMetaDetail) history.back(); else closeDetail();
      return;
    }
    const sourceButton=event.target.closest('#deckDetail [data-detail-source]');
    if (sourceButton) {
      event.preventDefault();
      detail.source=sourceButton.dataset.detailSource==='irl'?'irl':'online';
      renderDetail();
      syncDetailUrl('replace');
      return;
    }
    const deck=event.target.closest('[data-explore-deck]');
    if (!deck) return;
    event.preventDefault();
    event.stopPropagation();
    openDetail(deck.dataset.exploreDeck,deck.dataset.exploreSource||'online');
  },true);

  document.querySelector('[data-meta-view="decks"]')?.addEventListener('click',()=>setTimeout(renderDeckExplorer,0));
  document.querySelector('[data-meta-view="matchups"]')?.addEventListener('click',()=>setTimeout(renderMatchups,0));
  $('deckPageSource')?.addEventListener('change',()=>setTimeout(renderDeckExplorer,0));
  $('matchupPageSource')?.addEventListener('change',()=>{matchupDeck='';setTimeout(renderMatchups,0);});

  // Global data changes update list views only. An open detail is deliberately
  // NOT rebuilt here; its own source/scope controls are the sole render owner.
  window.addEventListener('deckagg:updated',()=>{
    if(!$('decks')?.classList.contains('hidden'))renderDeckExplorer();
    if(!$('matchups')?.classList.contains('hidden'))renderMatchups();
  });
  window.addEventListener('irl:updated',()=>{
    if(!$('decks')?.classList.contains('hidden'))renderDeckExplorer();
    if(!$('matchups')?.classList.contains('hidden'))renderMatchups();
  });

  function applyLocation() {
    const params=new URLSearchParams(location.search);
    const name=params.get('deck');
    if (location.hash.toLowerCase()==='#detail' && name) {
      openDetail(name,params.get('source')==='irl'?'irl':'online',{origin:params.get('from')||'current',syncUrl:false});
    } else if ($('deckDetail') && !$('deckDetail').classList.contains('hidden')) {
      closeDetail({syncUrl:false});
    }
  }
  window.addEventListener('popstate',applyLocation);
  window.addEventListener('hashchange',()=>{ if(location.hash.toLowerCase()==='#detail' || ($('deckDetail')&&!$('deckDetail').classList.contains('hidden'))) applyLocation(); });

  window.MetaExplore={openDeck:(name,source)=>openDetail(name,source),closeDeck:closeDetail,renderDetail};
  applyLocation();
})();