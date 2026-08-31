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

  function familyVariants(name) {
    const family = (window.ArchetypeGroups?.FAMILIES || []).find(f => f.name === name || f.variants.includes(name));
    return family ? family.variants : [name];
  }
  function familyName(name) {
    return (window.ArchetypeGroups?.FAMILIES || []).find(f => f.variants.includes(name))?.name || name;
  }
  function sourceDecks(source) {
    return source === 'irl' ? (window.IRLLabs?.getData?.()?.decks || []) : (window.DeckAggregate?.getData?.()?.decks || []);
  }
  function sourceMatchups(source) {
    return source === 'irl' ? (window.IRLLabs?.getData?.()?.matchups || []) : (window.DeckAggregate?.getData?.()?.matchups || []);
  }
  function groupDecks(source) {
    const map = new Map();
    for (const d of sourceDecks(source)) {
      if (ignored(d.name)) continue;
      const name = familyName(d.name);
      const row = map.get(name) || { name, entries:0, wins:0, losses:0, ties:0, variants:[] };
      row.entries += Number(d.entries || d.players || 0);
      row.wins += Number(d.wins || 0); row.losses += Number(d.losses || 0); row.ties += Number(d.ties || 0);
      row.variants.push({ ...d, name:d.name, entries:Number(d.entries || d.players || 0) });
      map.set(name,row);
    }
    const rows = [...map.values()];
    const total = rows.reduce((s,r)=>s+r.entries,0);
    for (const row of rows) {
      row.share = total ? 100 * row.entries / total : null;
      const decisive = row.wins + row.losses;
      row.winRate = decisive ? 100 * row.wins / decisive : null;
      row.variants.sort((a,b)=>b.entries-a.entries);
    }
    return rows.sort((a,b)=>b.entries-a.entries);
  }
  function aggregateMatchup(source, a, b) {
    const aVars = familyVariants(a), bVars = familyVariants(b), rows = sourceMatchups(source);
    let found = false, wins=0, losses=0, ties=0, games=0;
    for (const av of aVars) for (const bv of bVars) {
      const m = rows.find(x => x.a === av && x.b === bv);
      if (!m) continue;
      found = true;
      wins += Number(m.wins||0); losses += Number(m.losses||0); ties += Number(m.ties||0);
      games += Number(m.games || Number(m.wins||0)+Number(m.losses||0)+Number(m.ties||0));
    }
    if (!found) return null;
    const decisive = wins + losses;
    return { wins, losses, ties, games, winRate: decisive ? 100*wins/decisive : null };
  }
  function sprite(name,size=38){ return window.DeckSprites?.html?.(name,{size}) || ''; }

  function ensureDetail() {
    if ($('deckDetail')) return;
    const section = document.createElement('section');
    section.id = 'deckDetail'; section.className = 'meta-child deck-detail hidden';
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
    detailName = familyName(name); detailSource = source === 'irl' ? 'irl' : 'online';
    hideMainSections(); $('deckDetail')?.classList.remove('hidden');
    document.body.dataset.metaView = 'detail';
    renderDetail(); window.scrollTo({top:0,behavior:'instant'});
  }
  function closeDetail() {
    $('deckDetail')?.classList.add('hidden');
    $(detailOrigin)?.classList.remove('hidden');
    document.body.dataset.metaView = detailOrigin === 'currentMetaPage' ? 'current' : detailOrigin;
    window.scrollTo({top:0,behavior:'instant'});
  }
  function matchupCards(name, source, limit=12) {
    const opponents = groupDecks(source).map(r=>r.name).filter(n=>n!==name);
    const rows = opponents.map(opponent => ({ opponent, m:aggregateMatchup(source,name,opponent) })).filter(x=>x.m).sort((a,b)=>b.m.games-a.m.games).slice(0,limit);
    if (!rows.length) return '<div class="meta-empty">No matchup evidence available for this deck.</div>';
    return `<div class="matchup-card-list">${rows.map(({opponent,m})=>`<button class="matchup-card" type="button" data-explore-deck="${esc(opponent)}" data-explore-source="${source}"><span class="matchup-opponent">${sprite(opponent,32)}<span><b>${esc(opponent)}</b><small>${m.wins}-${m.losses}-${m.ties} · ${m.games} games</small></span></span><strong>${pct(m.winRate)}</strong></button>`).join('')}</div>`;
  }
  function renderDetail() {
    const rows = groupDecks(detailSource), row = rows.find(r=>r.name===detailName);
    const variants = row?.variants || familyVariants(detailName).map(name=>({name,entries:0}));
    const sourceLabel = detailSource === 'irl' ? 'IRL' : 'Online';
    $('deckDetailHead').innerHTML = `<div class="detail-title">${sprite(detailName,52)}<div><div class="eyebrow">${sourceLabel} DECK</div><h1>${esc(detailName)}</h1><p>${variants.length>1?`${variants.length} grouped variants`:'Archetype detail'}</p></div></div><div class="detail-source"><button type="button" data-detail-source="online" class="${detailSource==='online'?'active':''}">Online</button><button type="button" data-detail-source="irl" class="${detailSource==='irl'?'active':''}">IRL</button></div>`;
    const summary = row ? `<div class="detail-stats"><div><b>${row.entries.toLocaleString()}</b><span>Entries</span></div><div><b>${pct(row.share)}</b><span>Share of source</span></div><div><b>${pct(row.winRate)}</b><span>Win rate</span></div></div>` : '';
    const variantHtml = variants.length>1 ? `<section class="detail-section"><h2>Variants</h2><div class="variant-detail-list">${variants.map(v=>`<button type="button" data-explore-deck="${esc(v.name)}" data-explore-source="${detailSource}"><span>${sprite(v.name,30)}<b>${esc(v.name)}</b></span><small>${Number(v.entries||0).toLocaleString()} entries</small></button>`).join('')}</div></section>` : '';
    const rawNames = new Set(familyVariants(detailName));
    const results = detailSource==='online' ? (window.DATA?.results || DATA?.results || []).filter(r=>rawNames.has(r.archetype)).sort((a,b)=>new Date(b.date)-new Date(a.date) || a.placing-b.placing).slice(0,8) : [];
    const resultsHtml = results.length ? `<section class="detail-section"><h2>Recent results</h2><div class="result-card-list">${results.map(r=>`<div class="result-card"><b>${r.placing}/${r.players}</b><span>${esc(r.player)}</span><small>${esc(r.tournament)} · ${r.record?.wins||0}-${r.record?.losses||0}-${r.record?.ties||0}</small></div>`).join('')}</div></section>` : '';
    $('deckDetailBody').innerHTML = `${summary}${variantHtml}<section class="detail-section"><div class="section-row"><h2>Matchups</h2><span>${sourceLabel} evidence</span></div>${matchupCards(detailName,detailSource,15)}</section>${resultsHtml}`;
    document.querySelectorAll('[data-detail-source]').forEach(btn=>btn.addEventListener('click',()=>{ detailSource=btn.dataset.detailSource; renderDetail(); }));
  }

  function renderDeckExplorerV2() {
    const target = $('deckExplorerList'); if (!target) return;
    const source = $('deckPageSource')?.value || 'online';
    const rows = groupDecks(source);
    target.innerHTML = rows.length ? rows.slice(0,40).map((r,i)=>`<button class="deck-explorer-card" type="button" data-explore-deck="${esc(r.name)}" data-explore-source="${source}"><span class="deck-explorer-rank">${i+1}</span>${sprite(r.name,38)}<span class="deck-explorer-copy"><b>${esc(r.name)}</b><small>${r.entries.toLocaleString()} entries${r.variants.length>1?` · ${r.variants.length} variants`:''}</small></span><span class="deck-explorer-score"><b>${pct(r.share)}</b><small>${pct(r.winRate)} WR</small></span><span class="explore-arrow">›</span></button>`).join('') : '<div class="meta-empty">No deck data available.</div>';
  }
  function renderMatchupsV2() {
    const target = $('metaMatchupMatrix'); if (!target) return;
    const source = $('matchupPageSource')?.value || 'online';
    const decks = groupDecks(source);
    if (!decks.length) { target.innerHTML='<div class="meta-empty">No matchup data available.</div>'; return; }
    if (!matchupDeck || !decks.some(d=>d.name===matchupDeck)) matchupDeck=decks[0].name;
    target.innerHTML = `<div class="matchup-picker"><label>Deck<select id="matchupDeckSelect">${decks.slice(0,50).map(d=>`<option ${d.name===matchupDeck?'selected':''}>${esc(d.name)}</option>`).join('')}</select></label><button type="button" class="open-deck-detail" data-explore-deck="${esc(matchupDeck)}" data-explore-source="${source}">Explore deck ›</button></div>${matchupCards(matchupDeck,source,30)}`;
    $('matchupDeckSelect')?.addEventListener('change',e=>{ matchupDeck=e.currentTarget.value; renderMatchupsV2(); });
  }

  function sourceForContext() {
    if (!$('currentMetaPage')?.classList.contains('hidden')) return document.querySelector('[data-current-source="irl"]')?.classList.contains('active') ? 'irl' : 'online';
    if (!$('decks')?.classList.contains('hidden')) return $('deckPageSource')?.value || 'online';
    if (!$('matchups')?.classList.contains('hidden')) return $('matchupPageSource')?.value || 'online';
    if (!$('prep')?.classList.contains('hidden')) return ($('playFieldSource')?.value || 'online') === 'irl' ? 'irl' : 'online';
    return 'online';
  }
  function deckNameFromTarget(target) {
    const explicit = target.closest('[data-explore-deck]'); if (explicit) return explicit.dataset.exploreDeck;
    const node = target.closest('.current-name,.current-share,.rec-main h3,.deck-check-name b,.watch-card b,.why-matchup-name b');
    if (!node) return '';
    if (node.matches('.current-name')) return node.querySelector('b')?.textContent?.trim() || '';
    if (node.matches('.current-share')) return node.closest('.current-meta-row')?.querySelector('.current-name b')?.textContent?.trim() || '';
    return node.textContent?.trim() || '';
  }

  document.addEventListener('click', event => {
    const name = deckNameFromTarget(event.target); if (!name) return;
    const explicit = event.target.closest('[data-explore-deck]');
    const source = explicit?.dataset.exploreSource || sourceForContext();
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    openDetail(name,source);
  }, true);

  document.querySelector('[data-meta-view="matchups"]')?.addEventListener('click',()=>setTimeout(renderMatchupsV2,0));
  document.querySelector('[data-meta-view="decks"]')?.addEventListener('click',()=>setTimeout(renderDeckExplorerV2,0));
  $('matchupPageSource')?.addEventListener('change',()=>{ matchupDeck=''; setTimeout(renderMatchupsV2,0); });
  $('matchupPageMin')?.closest('label')?.remove();
  $('deckPageSource')?.addEventListener('change',()=>setTimeout(renderDeckExplorerV2,0));
  window.addEventListener('deckagg:updated',()=>{ if (!$('matchups')?.classList.contains('hidden')) setTimeout(renderMatchupsV2,0); if (!$('decks')?.classList.contains('hidden')) setTimeout(renderDeckExplorerV2,0); if (!$('deckDetail')?.classList.contains('hidden')) renderDetail(); });
  window.addEventListener('irl:updated',()=>{ if (!$('matchups')?.classList.contains('hidden')) setTimeout(renderMatchupsV2,0); if (!$('decks')?.classList.contains('hidden')) setTimeout(renderDeckExplorerV2,0); if (!$('deckDetail')?.classList.contains('hidden')) renderDetail(); });
  window.MetaExplore = { openDeck:openDetail };
})();