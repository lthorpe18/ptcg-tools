(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const state = { source: 'online', grouping: 'families', showAll: false, expanded: new Set(), view: 'current' };
  const ignored = name => !name || name === 'Other' || name === 'Unknown';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct = n => `${Number(n || 0).toFixed(1)}%`;

  function familyName(name) {
    if (state.grouping === 'variants') return name;
    const family = (window.ArchetypeGroups?.FAMILIES || []).find(f => f.variants.includes(name));
    return family?.name || name;
  }

  function onlineRows() {
    const tournaments = CACHE?.tournaments || [];
    const windowValue = $('currentWindow')?.value || '30';
    const newest = tournaments.length ? Math.max(...tournaments.map(t => new Date(t.date).getTime()).filter(Number.isFinite)) : Date.now();
    const cutoff = windowValue === 'all' ? -Infinity : newest - Number(windowValue) * 86400000;
    const map = new Map();
    let eventCount = 0;
    for (const t of tournaments) {
      const ts = new Date(t.date).getTime();
      if (!Number.isFinite(ts) || ts < cutoff || Number(t.players || 0) < 50 || !(t.standings || []).length) continue;
      eventCount++;
      for (const s of t.standings || []) {
        const raw = s?.deck?.name;
        if (ignored(raw)) continue;
        const name = familyName(raw);
        const row = map.get(name) || { name, entries: 0, wins: 0, losses: 0, ties: 0, variants: new Map() };
        row.entries++;
        row.wins += Number(s.record?.wins || 0);
        row.losses += Number(s.record?.losses || 0);
        row.ties += Number(s.record?.ties || 0);
        const variant = row.variants.get(raw) || { name: raw, entries: 0, wins: 0, losses: 0, ties: 0 };
        variant.entries++;
        variant.wins += Number(s.record?.wins || 0);
        variant.losses += Number(s.record?.losses || 0);
        variant.ties += Number(s.record?.ties || 0);
        row.variants.set(raw, variant);
        map.set(name, row);
      }
    }
    return finishRows([...map.values()], eventCount, CACHE?.generatedAt || new Date().toISOString());
  }

  function irlRows() {
    const data = window.IRLLabs?.getData?.() || {};
    const map = new Map();
    for (const d of data.decks || []) {
      if (ignored(d.name)) continue;
      const name = familyName(d.name);
      const row = map.get(name) || { name, entries: 0, wins: 0, losses: 0, ties: 0, variants: new Map() };
      row.entries += Number(d.entries || 0);
      row.wins += Number(d.wins || 0);
      row.losses += Number(d.losses || 0);
      row.ties += Number(d.ties || 0);
      row.variants.set(d.name, { name: d.name, entries: Number(d.entries || 0), wins: Number(d.wins || 0), losses: Number(d.losses || 0), ties: Number(d.ties || 0) });
      map.set(name, row);
    }
    return finishRows([...map.values()], (data.events || []).length, data.generatedAt || null);
  }

  function finishRows(rows, eventCount, generatedAt) {
    const total = rows.reduce((sum, r) => sum + r.entries, 0);
    for (const row of rows) {
      row.share = total ? row.entries / total : 0;
      const decisive = row.wins + row.losses;
      row.winRate = decisive ? 100 * row.wins / decisive : null;
      row.variants = [...row.variants.values()].sort((a,b) => b.entries - a.entries);
      for (const variant of row.variants) {
        variant.share = total ? variant.entries / total : 0;
        const vd = variant.wins + variant.losses;
        variant.winRate = vd ? 100 * variant.wins / vd : null;
      }
    }
    rows.sort((a,b) => b.entries - a.entries);
    return { rows, total, eventCount, generatedAt };
  }

  function currentData() { return state.source === 'irl' ? irlRows() : onlineRows(); }

  function sourceButtons() {
    document.querySelectorAll('[data-current-source]').forEach(btn => btn.classList.toggle('active', btn.dataset.currentSource === state.source));
  }

  function rowHtml(row) {
    const expandable = state.grouping === 'families' && row.variants.length > 1;
    const open = state.expanded.has(row.name);
    const variants = expandable && open ? `<div class="current-variants">${row.variants.map(v => `<div class="variant-row"><span>${esc(v.name)}</span><b>${pct(v.share * 100)}</b><small>${v.entries} entries</small></div>`).join('')}</div>` : '';
    return `<article class="current-meta-row ${expandable ? 'expandable' : ''}" data-family="${esc(row.name)}">
      <div class="current-rank"></div>
      <div class="current-name">${window.DeckSprites?.html?.(row.name,{size:34}) || ''}<span><b>${esc(row.name)}</b><small>${expandable ? `${row.variants.length} variants · tap to ${open ? 'collapse' : 'expand'}` : `${row.entries} entries`}</small></span></div>
      <div class="current-share"><b>${pct(row.share * 100)}</b><small>${row.entries}</small></div>
      ${expandable ? `<span class="row-chevron">${open ? '⌃' : '⌄'}</span>` : ''}
      ${variants}
    </article>`;
  }

  function renderCurrent() {
    sourceButtons();
    const data = currentData();
    const rows = state.showAll ? data.rows : data.rows.slice(0, 8);
    const label = state.source === 'irl' ? 'IRL majors' : '50+ online events';
    const updated = data.generatedAt ? new Date(data.generatedAt).toLocaleString([], { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '—';
    $('currentMetaStats').innerHTML = `<div><b>${data.eventCount}</b><span>Events</span></div><div><b>${data.total.toLocaleString()}</b><span>Entries</span></div><div class="wide"><b>${label}</b><span>Updated ${updated}</span></div>`;
    $('currentMetaList').innerHTML = rows.length ? rows.map(rowHtml).join('') : '<div class="meta-empty">No data is available for this source yet.</div>';
    $('currentMetaMore').hidden = data.rows.length <= 8;
    $('currentMetaMore').textContent = state.showAll ? 'Show top 8' : `View full field (${data.rows.length})`;
    $('currentGroupingToggle').textContent = state.grouping === 'families' ? 'Families' : 'Variants';
    document.querySelectorAll('.current-meta-row.expandable').forEach(row => row.addEventListener('click', () => {
      const name = row.dataset.family;
      if (state.expanded.has(name)) state.expanded.delete(name); else state.expanded.add(name);
      renderCurrent();
    }));
    renderDeckExplorer();
    renderMatchupExplorer();
  }

  function setView(view) {
    state.view = view;
    ['current','prep','matchups','decks'].forEach(name => $(name === 'current' ? 'currentMetaPage' : name)?.classList.toggle('hidden', name !== view));
    document.body.dataset.metaView = view;
    document.querySelectorAll('[data-tab="prep"]').forEach(el => el.classList.toggle('active', view === 'prep'));
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (view === 'prep') window.dispatchEvent(new CustomEvent('field:updated'));
    if (view === 'matchups') renderMatchupExplorer();
    if (view === 'decks') renderDeckExplorer();
  }

  function rawMatchup(source, a, b) {
    const rows = source === 'irl' ? (window.IRLLabs?.getData?.()?.matchups || []) : (window.DeckAggregate?.getData?.()?.matchups || []);
    return rows.find(m => m.a === a && m.b === b) || null;
  }

  function familyVariants(name) {
    const f = (window.ArchetypeGroups?.FAMILIES || []).find(x => x.name === name);
    return f?.variants || [name];
  }

  function combinedMatchup(source, a, b) {
    const aVars = familyVariants(a), bVars = familyVariants(b);
    const out = { wins:0, losses:0, ties:0, games:0 };
    let found = false;
    for (const av of aVars) for (const bv of bVars) {
      const m = rawMatchup(source,av,bv);
      if (!m) continue;
      found = true;
      out.wins += Number(m.wins || 0); out.losses += Number(m.losses || 0); out.ties += Number(m.ties || 0);
      out.games += Number(m.games || Number(m.wins||0)+Number(m.losses||0)+Number(m.ties||0));
    }
    return found ? out : null;
  }

  function renderMatchupExplorer() {
    const target = $('metaMatchupMatrix');
    if (!target) return;
    const source = $('matchupPageSource')?.value || 'online';
    const old = state.source; state.source = source === 'irl' ? 'irl' : 'online';
    const field = currentData().rows.slice(0, 10);
    state.source = old;
    if (!field.length) { target.innerHTML = '<div class="meta-empty">No matchup data available.</div>'; return; }
    const min = Math.max(1, Number($('matchupPageMin')?.value || 10));
    let html = '<div class="compact-matrix"><table><thead><tr><th>Deck</th>' + field.map(x=>`<th>${esc(x.name)}</th>`).join('') + '</tr></thead><tbody>';
    for (const row of field) {
      html += `<tr><th>${esc(row.name)}</th>`;
      for (const col of field) {
        const m = combinedMatchup(source,row.name,col.name);
        const decisive = m ? m.wins + m.losses : 0;
        const wr = m && decisive >= min ? 100 * m.wins / decisive : null;
        html += `<td title="${m ? `${m.wins}-${m.losses}-${m.ties} · ${m.games} games` : 'No data'}">${Number.isFinite(wr) ? pct(wr) : '—'}</td>`;
      }
      html += '</tr>';
    }
    target.innerHTML = html + '</tbody></table></div>';
  }

  function renderDeckExplorer() {
    const target = $('deckExplorerList');
    if (!target) return;
    const source = $('deckPageSource')?.value || state.source;
    const old = state.source; state.source = source;
    const data = currentData(); state.source = old;
    target.innerHTML = data.rows.slice(0,20).map(r => `<article class="deck-explorer-row"><div>${window.DeckSprites?.html?.(r.name,{size:36}) || ''}<span><b>${esc(r.name)}</b><small>${r.entries} entries${r.variants.length>1 ? ` · ${r.variants.length} variants` : ''}</small></span></div><span><b>${pct(r.share*100)}</b><small>${Number.isFinite(r.winRate) ? `${pct(r.winRate)} WR` : ''}</small></span></article>`).join('') || '<div class="meta-empty">No deck data available.</div>';
  }

  function bind() {
    document.querySelectorAll('[data-current-source]').forEach(btn => btn.addEventListener('click', () => { state.source = btn.dataset.currentSource; state.expanded.clear(); renderCurrent(); }));
    $('currentWindow')?.addEventListener('change', renderCurrent);
    $('currentGroupingToggle')?.addEventListener('click', () => { state.grouping = state.grouping === 'families' ? 'variants' : 'families'; state.expanded.clear(); renderCurrent(); });
    $('currentMetaMore')?.addEventListener('click', () => { state.showAll = !state.showAll; renderCurrent(); });
    document.querySelectorAll('[data-meta-view]').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.metaView)));
    document.querySelectorAll('[data-meta-back]').forEach(btn => btn.addEventListener('click', () => setView('current')));
    $('matchupPageSource')?.addEventListener('change', renderMatchupExplorer);
    $('matchupPageMin')?.addEventListener('change', renderMatchupExplorer);
    $('deckPageSource')?.addEventListener('change', renderDeckExplorer);
    window.addEventListener('meta:updated', renderCurrent);
    window.addEventListener('irl:updated', renderCurrent);
    window.addEventListener('deckagg:updated', renderMatchupExplorer);
  }

  bind();
  setView('current');
  renderCurrent();
})();
