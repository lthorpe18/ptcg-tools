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
  function familyName(name) {
    return (window.ArchetypeGroups?.FAMILIES || []).find(f => f.variants.includes(name))?.name || name;
  }
  function familyVariants(name) {
    return familyFor(name)?.variants || [name];
  }
  function isNamedFamily(name) {
    return !!(window.ArchetypeGroups?.FAMILIES || []).find(f => f.name === name);
  }
  function sprite(name,size=38){ return window.DeckSprites?.html?.(name,{size}) || ''; }

  function sourceDecks(source) {
    if (source === 'irl') return window.IRLScope?.selectedDecks?.() || window.IRLLabs?.getData?.()?.decks || [];
    return window.DeckAggregate?.getData?.()?.decks || [];
  }
  function sourceMatchups(source) {
    if (source === 'irl') return window.IRLScope?.selectedMatchups?.() || window.IRLLabs?.getData?.()?.matchups || [];
    return window.DeckAggregate?.getData?.()?.matchups || [];
  }
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
  function familyRows(source) {
    const variants = variantRows(source);
    const total = variants.reduce((sum,row) => sum + Number(row.entries || 0), 0);
    const map = new Map();
    for (const row of variants) {
      const family = familyFor(row.name);
      const name = family?.name || row.name;
      const target = map.get(name) || { name, entries:0, variants:[], isFamily:!!family };
      target.entries += row.entries;
      target.variants.push(row);
      target.isFamily = target.isFamily || !!family;
      map.set(name,target);
    }
    const rows = [...map.values()];
    for (const row of rows) {
      row.share = total ? 100 * row.entries / total : null;
      row.variants.sort((a,b)=>b.entries-a.entries);
    }
    return rows.sort((a,b)=>b.entries-a.entries);
  }
  function exactMatchup(source,a,b) {
    if (!a || !b || a === b) return null;
    const m = sourceMatchups(source).find(x => x.a === a && x.b === b);
    if (!m) return null;
    const wins=Number(m.wins||0), losses=Number(m.losses||0), ties=Number(m.ties||0);
    const games=Number(m.games || wins+losses+ties), decisive=wins+losses;
    return { wins,losses,ties,games,winRate:decisive ? 100*wins/decisive : null };
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
    window.scrollTo({top:0,behavior:'instant'});
  }

  function matchupCards(name,source,limit=20) {
    const opponents = variantRows(source).filter(r=>r.name!==name);
    const rows = opponents.map(opponent=>({opponent,m:exactMatchup(source,name,opponent.name)})).filter(x=>x.m).sort((a,b)=>b.m.games-a.m.games).slice(0,limit);
    if (!rows.length) return '<div class="meta-empty">No matchup evidence is available for this exact variant.</div>';
    return `<div class="matchup-card-list">${rows.map(({opponent,m})=>`<button class="matchup-card" type="button" data-explore-deck="${esc(opponent.name)}" data-explore-kind="variant" data-explore-source="${source}"><span class="matchup-opponent">${sprite(opponent.name,32)}<span><b>${esc(opponent.name)}</b><small>${m.wins}-${m.losses}-${m.ties} · ${m.games} games</small></span></span><strong>${pct(m.winRate)}</strong></button>`).join('')}</div>`;
  }

  function variantDetail() {
    const variants = variantRows(detailSource);
    const row = variants.find(r=>r.name===detailName);
    const sourceLabel = detailSource === 'irl' ? 'IRL' : 'Online';
    const family = familyFor(detailName);
    $('deckDetailHead').innerHTML = `<div class="detail-title">${sprite(detailName,52)}<div><div class="eyebrow">${sourceLabel} DECK</div><h1>${esc(detailName)}</h1><p>${family ? `${esc(family.name)} family` : 'Archetype detail'}</p></div></div><div class="detail-source"><button type="button" data-detail-source="online" class="${detailSource==='online'?'active':''}">Online</button><button type="button" data-detail-source="irl" class="${detailSource==='irl'?'active':''}">IRL</button></div>`;
    if (!row) {
      $('deckDetailBody').innerHTML = `<div class="meta-empty">This exact variant is not present in the selected ${sourceLabel} source.</div>`;
      return;
    }
    const summary = `<div class="detail-stats"><div><b>${row.entries.toLocaleString()}</b><span>Entries</span></div><div><b>${pct(row.share)}</b><span>Share of source</span></div><div><b>${pct(row.winRate)}</b><span>Win rate</span></div></div>`;
    const results = detailSource==='online' ? (window.DATA?.results || DATA?.results || []).filter(r=>r.archetype===detailName).sort((a,b)=>new Date(b.date)-new Date(a.date)||a.placing-b.placing).slice(0,8) : [];
    const resultsHtml = results.length ? `<section class="detail-section"><h2>Recent results</h2><div class="result-card-list">${results.map(r=>`<div class="result-card"><b>${r.placing}/${r.players}</b><span>${esc(r.player)}</span><small>${esc(r.tournament)} · ${r.record?.wins||0}-${r.record?.losses||0}-${r.record?.ties||0}</small></div>`).join('')}</div></section>` : '';
    $('deckDetailBody').innerHTML = `${summary}<section class="detail-section"><div class="section-row"><h2>Matchups</h2><span>${sourceLabel} · exact variant</span></div>${matchupCards(detailName,detailSource,25)}</section>${resultsHtml}`;
  }

  function renderDetail() {
    variantDetail();
    document.querySelectorAll('[data-detail-source]').forEach(btn=>btn.addEventListener('click',()=>{detailSource=btn.dataset.detailSource;renderDetail();}));
  }

  function renderDeckExplorerV2() {
    const target=$('deckExplorerList'); if(!target)return;
    const source=$('deckPageSource')?.value||'online';
    const rows=variantRows(source);
    target.innerHTML=rows.length?rows.slice(0,80).map((r,i)=>`<button class="deck-explorer-card" type="button" data-explore-deck="${esc(r.name)}" data-explore-source="${source}"><span class="deck-explorer-rank">${i+1}</span>${sprite(r.name,38)}<span class="deck-explorer-copy"><b>${esc(r.name)}</b><small>${r.entries.toLocaleString()} entries</small></span><span class="deck-explorer-score"><b>${pct(r.share)}</b><small>${pct(r.winRate)} WR</small></span><span class="explore-arrow">›</span></button>`).join(''):'<div class="meta-empty">No deck data available.</div>';
  }

  function renderMatchupsV2() {
    const target=$('metaMatchupMatrix'); if(!target)return;
    const source=$('matchupPageSource')?.value||'online';
    const decks=variantRows(source).filter(d=>sourceMatchups(source).some(m=>m.a===d.name));
    if(!decks.length){target.innerHTML='<div class="meta-empty">No variant-level matchup data available.</div>';return;}
    if(!matchupDeck||!decks.some(d=>d.name===matchupDeck))matchupDeck=decks[0].name;
    target.innerHTML=`<div class="matchup-picker"><label>Deck variant<select id="matchupDeckSelect">${decks.slice(0,80).map(d=>`<option value="${esc(d.name)}" ${d.name===matchupDeck?'selected':''}>${esc(d.name)}</option>`).join('')}</select></label><button type="button" class="open-deck-detail" data-explore-deck="${esc(matchupDeck)}" data-explore-kind="variant" data-explore-source="${source}">Explore variant ›</button></div><div class="variant-only-note">Matchup evidence is variant-to-variant. Family grouping is not used here.</div>${matchupCards(matchupDeck,source,40)}`;
    $('matchupDeckSelect')?.addEventListener('change',e=>{matchupDeck=e.currentTarget.value;renderMatchupsV2();});
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
    if(explicit)return{name:explicit.dataset.exploreDeck,kind:explicit.dataset.exploreKind||'variant',source:explicit.dataset.exploreSource};
    const variantRow=target.closest('.variant-row');
    if(variantRow)return{name:variantRow.querySelector('span')?.textContent?.trim()||'',kind:'variant'};
    const node=target.closest('.rec-main h3,.deck-check-name b,.watch-card b,.why-matchup-name b');
    if(node)return{name:node.textContent?.trim()||'',kind:'variant'};
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
  window.addEventListener('irlscope:changed',()=>{if(!$('matchups')?.classList.contains('hidden'))setTimeout(renderMatchupsV2,0);if(!$('decks')?.classList.contains('hidden'))setTimeout(renderDeckExplorerV2,0);if(!$('deckDetail')?.classList.contains('hidden'))renderDetail();});
  window.MetaExplore={openDeck:(name,source)=>openDetail(name,source)};
})();
