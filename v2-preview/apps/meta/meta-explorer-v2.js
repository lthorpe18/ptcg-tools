(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct = n => Number.isFinite(Number(n)) ? `${Number(n).toFixed(1)}%` : '—';
  const ignored = name => !name || name === 'Other' || name === 'Unknown';
  let detailOrigin = 'currentMetaPage';
  let detailName = '';
  let detailSource = 'online';
  let matchupDeck = '';

  function familyFor(name) {
    return (window.ArchetypeGroups?.FAMILIES || []).find(f => f.name === name || f.variants.includes(name)) || null;
  }
  function sprite(name,size=38){ return window.DeckSprites?.html?.(name,{size}) || ''; }
  function sourceData(source, options={}) { return window.MetaData?.data?.(source, options) || { decks:[], matchups:[], events:[], overview:{} }; }
  function sourceDecks(source) { return sourceData(source).decks || []; }
  function sourceMatchups(source) { return sourceData(source).matchups || []; }

  function variantRows(source) {
    const raw = sourceDecks(source).filter(d => !ignored(d.name));
    const total = raw.reduce((sum,d) => sum + Number(d.entries ?? d.count ?? d.players ?? 0), 0);
    return raw.map(d => {
      const entries = Number(d.entries ?? d.count ?? d.players ?? 0);
      const wins = Number(d.wins || 0), losses = Number(d.losses || 0), ties = Number(d.ties || 0);
      const decisive = wins + losses;
      const share = Number.isFinite(Number(d.share)) ? Number(d.share) : (total ? 100 * entries / total : null);
      const winRate = Number.isFinite(Number(d.winRate)) ? Number(d.winRate) : (decisive ? 100 * wins / decisive : null);
      return { ...d, name:d.name, entries, wins, losses, ties, share, winRate };
    }).sort((a,b) => b.entries-a.entries || (b.share||0)-(a.share||0));
  }

  function exactMatchup(source,a,b) {
    if (!a || !b || a === b) return null;
    const m = sourceMatchups(source).find(x => x.a === a && x.b === b);
    if (!m) return null;
    const wins=Number(m.wins||0), losses=Number(m.losses||0), ties=Number(m.ties||0);
    const games=Number(m.games || wins+losses+ties), decisive=wins+losses;
    return { wins,losses,ties,games,winRate:decisive ? 100*wins/decisive : null };
  }

  function deckEvidenceGames(source, name) {
    return sourceMatchups(source)
      .filter(row => row.a === name)
      .reduce((sum,row) => sum + Number(row.games || Number(row.wins||0) + Number(row.losses||0) + Number(row.ties||0)), 0);
  }

  function referenceShare(source, name) {
    const scope = source === 'irl' ? 'latest-weekend' : 'since-major';
    const data = sourceData(source, { scope });
    const row = (data.decks || []).find(d => d.name === name);
    return {
      share: row && Number.isFinite(Number(row.share)) ? Number(row.share) : null,
      label: source === 'irl' ? 'Latest IRL weekend' : 'Since last major',
    };
  }

  function searchBox(id, placeholder='Search decks') {
    return `<label class="deck-list-search"><span class="search-glyph">⌕</span><input id="${id}" type="search" autocomplete="off" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}"></label>`;
  }

  function wireListFilter(inputId, container, itemSelector, nameSelector) {
    const input=$(inputId); if(!input||!container)return;
    const apply=()=>{
      const q=(input.value||'').trim().toLowerCase();
      container.querySelectorAll(itemSelector).forEach(item=>{
        const name=(item.querySelector(nameSelector)?.textContent||item.dataset.exploreDeck||'').toLowerCase();
        item.hidden=!!q&&!name.includes(q);
      });
    };
    input.addEventListener('input',apply);
    apply();
  }

  function ensureDetail() {
    if ($('deckDetail')) return;
    const section = document.createElement('section');
    section.id = 'deckDetail';
    section.className = 'meta-child deck-detail hidden';
    section.innerHTML = '<header class="meta-child-header"><button class="meta-back" id="deckDetailBack" type="button">← Back</button><div id="deckDetailHead"></div></header><div id="deckDetailBody"></div>';
    document.querySelector('main.wrap')?.appendChild(section);
    $('deckDetailBack')?.addEventListener('click', closeDetail);
  }
  function hideMainSections() {
    ['currentMetaPage','prep','matchups','decks'].forEach(id => $(id)?.classList.add('hidden'));
  }
  function openDetail(name, source) {
    if (!name) return;
    ensureDetail();
    const visible = ['currentMetaPage','prep','matchups','decks'].find(id => !$(id)?.classList.contains('hidden'));
    if (visible) detailOrigin = visible;
    detailName = name;
    detailSource = source === 'irl' ? 'irl' : 'online';
    hideMainSections();
    $('deckDetail')?.classList.remove('hidden');
    document.body.dataset.metaView = 'detail';
    renderDetail();
    window.scrollTo({top:0,behavior:'instant'});
  }
  function closeDetail() {
    $('deckDetail')?.classList.add('hidden');
    $(detailOrigin)?.classList.remove('hidden');
    document.body.dataset.metaView = detailOrigin === 'currentMetaPage' ? 'current' : detailOrigin;
    window.MetaControls?.sync?.();
    window.MetaContext?.render?.();
    window.scrollTo({top:0,behavior:'instant'});
  }

  function matchupCards(name,source,limit=20) {
    const opponents = variantRows(source).filter(r=>r.name!==name);
    const rows = opponents.map(opponent=>({opponent,m:exactMatchup(source,name,opponent.name)})).filter(x=>x.m).sort((a,b)=>b.m.games-a.m.games).slice(0,limit);
    if (!rows.length) return '<div class="meta-empty">No matchup evidence is available for this exact variant in the selected source and scope.</div>';
    return `<div class="matchup-card-list">${rows.map(({opponent,m})=>`<button class="matchup-card" type="button" data-explore-deck="${esc(opponent.name)}" data-explore-kind="variant" data-explore-source="${source}"><span class="matchup-opponent">${sprite(opponent.name,32)}<span><b>${esc(opponent.name)}</b><small>${m.wins}-${m.losses}-${m.ties} · ${m.games} games</small></span></span><strong>${pct(m.winRate)}</strong></button>`).join('')}</div>`;
  }

  function scopedRecentResults(name) {
    const data = sourceData('online');
    const selectedNames = new Set((data.events || []).map(e=>e.name).filter(Boolean));
    return (data.results || [])
      .filter(r => r.archetype === name)
      .filter(r => !selectedNames.size || selectedNames.has(r.tournament))
      .sort((a,b)=>new Date(b.date)-new Date(a.date)||Number(a.placing||999)-Number(b.placing||999))
      .slice(0,8);
  }

  function variantDetail() {
    const panelWasOpen = $('deckDetailEvidence')?.open || false;
    const data = sourceData(detailSource);
    const variants = variantRows(detailSource);
    const row = variants.find(r=>r.name===detailName);
    const sourceLabel = detailSource === 'irl' ? 'IRL' : 'Online';
    const family = familyFor(detailName);
    const current = referenceShare(detailSource, detailName);
    const currentShare = current.share == null ? '—' : pct(current.share);

    $('deckDetailHead').innerHTML = `<div class="detail-heading-row"><div class="detail-title">${sprite(detailName,52)}<div><div class="eyebrow">${sourceLabel} DECK</div><h1>${esc(detailName)}</h1><p>${family ? `${esc(family.name)} family · exact variant` : 'Exact variant detail'}</p></div></div><div class="detail-current-share"><span>Current share</span><b>${currentShare}</b><small>${esc(current.label)}</small></div></div>`;

    if (!row) {
      $('deckDetailBody').innerHTML = `<details id="deckDetailEvidence" class="detail-data-panel" ${panelWasOpen?'open':''}><summary><span><b>Data & performance</b><small>${sourceLabel} · selected scope</small></span><span class="detail-panel-chevron">⌄</span></summary><div class="detail-data-body"><div id="deckDetailControlsHost" class="detail-evidence-controls"><div class="detail-source"><button type="button" data-detail-source="online" class="${detailSource==='online'?'active':''}">Online</button><button type="button" data-detail-source="irl" class="${detailSource==='irl'?'active':''}">IRL</button></div></div><div class="meta-empty">This exact variant is not present in the selected ${sourceLabel} source and scope.</div></div></details>`;
      setTimeout(()=>{ window.MetaControls?.syncDetail?.(); window.MetaContext?.render?.(); },0);
      return;
    }

    const games = deckEvidenceGames(detailSource, detailName);
    const scopeContext = window.MetaData?.context?.(detailSource) || {};
    const scopeText = scopeContext.label || sourceLabel;
    const fieldEvents = Number(data?.overview?.events || data?.events?.length || 0);
    const results = detailSource === 'online' ? scopedRecentResults(detailName) : [];
    const resultsHtml = results.length ? `<section class="detail-section"><div class="section-row"><h2>Recent results</h2><span>Live result sample within selected field scope</span></div><div class="result-card-list">${results.map(r=>`<div class="result-card"><b>${r.placing}/${r.players}</b><span>${esc(r.player)}</span><small>${esc(r.tournament)} · ${r.record?.wins||0}-${r.record?.losses||0}-${r.record?.ties||0}</small></div>`).join('')}</div></section>` : '';

    const evidencePanel = `<details id="deckDetailEvidence" class="detail-data-panel" ${panelWasOpen?'open':''}><summary><span><b>Data & performance</b><small>${esc(scopeText)} · ${row.entries.toLocaleString()} deck entries · ${pct(row.winRate)} WR</small></span><span class="detail-panel-chevron">⌄</span></summary><div class="detail-data-body"><div id="deckDetailControlsHost" class="detail-evidence-controls"><div class="detail-source"><button type="button" data-detail-source="online" class="${detailSource==='online'?'active':''}">Online</button><button type="button" data-detail-source="irl" class="${detailSource==='irl'?'active':''}">IRL</button></div></div><div class="detail-evidence-block"><div class="detail-evidence-block-title"><b>Field performance</b><small>This exact variant within the selected field</small></div><div class="detail-stats"><div><b>${row.entries.toLocaleString()}</b><span>Deck entries</span></div><div><b>${pct(row.share)}</b><span>Field share</span></div><div><b>${pct(row.winRate)}</b><span>Win rate</span></div></div><div class="detail-sample-strip"><span>Field sample</span><b>${row.entries.toLocaleString()} deck entries across ${fieldEvents.toLocaleString()} ${fieldEvents===1?'event':'events'}</b></div></div><div class="detail-evidence-block"><div class="detail-evidence-block-title"><b>Matchup evidence</b><small>Head-to-head games involving this exact variant</small></div><div class="detail-sample-strip matchup-sample"><span>Matchup sample</span><b>${games.toLocaleString()} games involving ${esc(detailName)}</b></div></div></div></details>`;

    $('deckDetailBody').innerHTML = `${evidencePanel}<section class="detail-section detail-matchups"><div class="section-row"><h2>Matchups</h2><span>${esc(scopeText)}</span></div>${searchBox('detailMatchupSearch','Filter matchups')}${matchupCards(detailName,detailSource,60)}</section>${resultsHtml}`;
    setTimeout(()=>{
      window.MetaControls?.syncDetail?.(); window.MetaContext?.render?.();
      const list=$('detailMatchupSearch')?.closest('.detail-section')?.querySelector('.matchup-card-list');
      wireListFilter('detailMatchupSearch',list,'.matchup-card','.matchup-opponent b');
    },0);
  }

  function renderDetail() {
    variantDetail();
    document.querySelectorAll('#deckDetail [data-detail-source]').forEach(btn=>btn.addEventListener('click',()=>{
      detailSource=btn.dataset.detailSource;
      renderDetail();
    }));
  }

  function renderDeckExplorerV2() {
    const target=$('deckExplorerList'); if(!target)return;
    const source=$('deckPageSource')?.value||'online';
    const rows=variantRows(source);
    const cards=rows.length?rows.slice(0,100).map((r,i)=>`<button class="deck-explorer-card" type="button" data-explore-deck="${esc(r.name)}" data-explore-source="${source}"><span class="deck-explorer-rank">${i+1}</span>${sprite(r.name,38)}<span class="deck-explorer-copy"><b>${esc(r.name)}</b><small>${r.entries.toLocaleString()} entries</small></span><span class="deck-explorer-score"><b>${pct(r.share)}</b><small>${pct(r.winRate)} WR</small></span><span class="explore-arrow">›</span></button>`).join(''):'<div class="meta-empty">No deck data available in the selected source and scope.</div>';
    target.innerHTML=`${searchBox('deckExplorerSearch','Search deck variants')}<div class="deck-explorer-card-list">${cards}</div>`;
    wireListFilter('deckExplorerSearch',target.querySelector('.deck-explorer-card-list'),'.deck-explorer-card','.deck-explorer-copy b');
  }

  function renderMatchupsV2() {
    const target=$('metaMatchupMatrix'); if(!target)return;
    const source=$('matchupPageSource')?.value||'online';
    const decks=variantRows(source).filter(d=>sourceMatchups(source).some(m=>m.a===d.name));
    if(!decks.length){target.innerHTML='<div class="meta-empty">No variant-level matchup data available in the selected source and scope.</div>';return;}
    if(!matchupDeck||!decks.some(d=>d.name===matchupDeck))matchupDeck=decks[0].name;
    target.innerHTML=`<div class="matchup-picker"><label>Deck variant<select id="matchupDeckSelect">${decks.slice(0,100).map(d=>`<option value="${esc(d.name)}" ${d.name===matchupDeck?'selected':''}>${esc(d.name)}</option>`).join('')}</select></label><button type="button" class="open-deck-detail" data-explore-deck="${esc(matchupDeck)}" data-explore-kind="variant" data-explore-source="${source}">Explore variant ›</button></div><div class="variant-only-note">Matchup evidence is variant-to-variant. Family grouping is not used here.</div>${searchBox('matchupOpponentSearch','Filter opponent decks')}${matchupCards(matchupDeck,source,80)}`;
    $('matchupDeckSelect')?.addEventListener('change',e=>{matchupDeck=e.currentTarget.value;renderMatchupsV2();});
    wireListFilter('matchupOpponentSearch',target.querySelector('.matchup-card-list'),'.matchup-card','.matchup-opponent b');
  }

  function sourceForContext() {
    if(!$('currentMetaPage')?.classList.contains('hidden')) return document.querySelector('[data-current-source="irl"]')?.classList.contains('active')?'irl':'online';
    if(!$('decks')?.classList.contains('hidden'))return $('deckPageSource')?.value||'online';
    if(!$('matchups')?.classList.contains('hidden'))return $('matchupPageSource')?.value||'online';
    if(!$('prep')?.classList.contains('hidden'))return ($('playMatchupSource')?.value||'online')==='irl'?'irl':'online';
    return 'online';
  }
  function targetInfo(target) {
    const explicit=target.closest('[data-explore-deck]');
    if(explicit)return{name:explicit.dataset.exploreDeck,source:explicit.dataset.exploreSource};
    const variantRow=target.closest('.variant-row');
    if(variantRow)return{name:variantRow.querySelector('span')?.textContent?.trim()||''};
    const current=target.closest('.current-meta-row');
    if(current){
      const grouping=$('currentGroupingToggle')?.checked!==false;
      const expandable=current.classList.contains('expandable');
      if(!grouping || !expandable)return{name:current.querySelector('.current-name b')?.textContent?.trim()||''};
      return null;
    }
    const node=target.closest('.rec-main h3,.deck-check-name b,.watch-card b,.why-matchup-name b');
    if(node)return{name:node.textContent?.trim()||''};
    return null;
  }

  document.addEventListener('click',event=>{
    const info=targetInfo(event.target); if(!info?.name)return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    openDetail(info.name,info.source||sourceForContext());
  },true);

  document.querySelector('[data-meta-view="matchups"]')?.addEventListener('click',()=>setTimeout(renderMatchupsV2,0));
  document.querySelector('[data-meta-view="decks"]')?.addEventListener('click',()=>setTimeout(renderDeckExplorerV2,0));
  $('matchupPageSource')?.addEventListener('change',()=>{matchupDeck='';setTimeout(renderMatchupsV2,0);});
  $('matchupPageMin')?.closest('label')?.remove();
  $('deckPageSource')?.addEventListener('change',()=>setTimeout(renderDeckExplorerV2,0));
  window.addEventListener('deckagg:updated',()=>{if(!$('matchups')?.classList.contains('hidden'))setTimeout(renderMatchupsV2,0);if(!$('decks')?.classList.contains('hidden'))setTimeout(renderDeckExplorerV2,0);if(!$('deckDetail')?.classList.contains('hidden'))renderDetail();});
  window.addEventListener('irl:updated',()=>{if(!$('matchups')?.classList.contains('hidden'))setTimeout(renderMatchupsV2,0);if(!$('decks')?.classList.contains('hidden'))setTimeout(renderDeckExplorerV2,0);if(!$('deckDetail')?.classList.contains('hidden'))renderDetail();});
  window.addEventListener('meta:data-changed',()=>{if(!$('deckDetail')?.classList.contains('hidden'))setTimeout(renderDetail,0);});
  window.addEventListener('decksprites:updated',()=>{if(!$('matchups')?.classList.contains('hidden'))renderMatchupsV2();if(!$('decks')?.classList.contains('hidden'))renderDeckExplorerV2();if(!$('deckDetail')?.classList.contains('hidden'))renderDetail();});
  window.MetaExplore={openDeck:(name,source)=>openDetail(name,source)};
})();