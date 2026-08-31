(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let history = null;
  let showAll = false;
  const expanded = new Set();
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct = n => `${Number(n || 0).toFixed(1)}%`;
  const ignored = name => !name || name === 'Other' || name === 'Unknown';

  function onlineActive() {
    return document.querySelector('[data-current-source="online"]')?.classList.contains('active');
  }

  function grouped() {
    return $('currentGroupingToggle')?.checked !== false;
  }

  function familyName(name) {
    if (!grouped()) return name;
    const family = (window.ArchetypeGroups?.FAMILIES || []).find(f => f.variants.includes(name));
    return family?.name || name;
  }

  function buildData() {
    const windowValue = $('currentWindow')?.value || '30';
    const cutoff = windowValue === 'all' ? -Infinity : Date.now() - Number(windowValue) * 86400000;
    const map = new Map();
    let eventCount = 0;

    for (const tournament of history?.tournaments || []) {
      const ts = new Date(tournament.date).getTime();
      if (!Number.isFinite(ts) || ts < cutoff || Number(tournament.players || 0) < 50) continue;
      if (!(tournament.archetypes || []).length) continue;
      eventCount++;
      for (const deck of tournament.archetypes || []) {
        const raw = deck.name;
        if (ignored(raw)) continue;
        const name = familyName(raw);
        const row = map.get(name) || { name, entries: 0, wins: 0, losses: 0, ties: 0, variants: new Map() };
        row.entries += Number(deck.entries || 0);
        row.wins += Number(deck.wins || 0);
        row.losses += Number(deck.losses || 0);
        row.ties += Number(deck.ties || 0);
        const variant = row.variants.get(raw) || { name: raw, entries: 0, wins: 0, losses: 0, ties: 0 };
        variant.entries += Number(deck.entries || 0);
        variant.wins += Number(deck.wins || 0);
        variant.losses += Number(deck.losses || 0);
        variant.ties += Number(deck.ties || 0);
        row.variants.set(raw, variant);
        map.set(name, row);
      }
    }

    const rows = [...map.values()];
    const total = rows.reduce((sum, row) => sum + row.entries, 0);
    for (const row of rows) {
      row.share = total ? row.entries / total : 0;
      row.variants = [...row.variants.values()].sort((a, b) => b.entries - a.entries);
      for (const variant of row.variants) variant.share = total ? variant.entries / total : 0;
    }
    rows.sort((a, b) => b.entries - a.entries);
    return { rows, total, eventCount };
  }

  function rowHtml(row, index) {
    const expandable = grouped() && row.variants.length > 1;
    const open = expanded.has(row.name);
    const variants = expandable && open
      ? `<div class="current-variants">${row.variants.map(v => `<div class="variant-row"><span>${esc(v.name)}</span><b>${pct(v.share * 100)}</b><small>${v.entries} entries</small></div>`).join('')}</div>`
      : '';
    return `<article class="current-meta-row ${expandable ? 'expandable' : ''}" data-history-family="${esc(row.name)}">
      <div class="current-rank">${index + 1}</div>
      <div class="current-name">${window.DeckSprites?.html?.(row.name,{size:34}) || ''}<span><b>${esc(row.name)}</b><small>${expandable ? `${row.variants.length} variants · tap to ${open ? 'collapse' : 'expand'}` : `${row.entries} entries`}</small></span></div>
      <div class="current-share"><b>${pct(row.share * 100)}</b><small>${row.entries} entries</small></div>
      <span class="row-chevron" aria-hidden="true">${expandable ? (open ? '⌃' : '⌄') : ''}</span>
      ${variants}
    </article>`;
  }

  function render() {
    const windowControl = $('currentWindow');
    if (!onlineActive()) {
      if (windowControl) {
        windowControl.disabled = true;
        windowControl.title = 'IRL Labs currently provides an aggregate across loaded major events.';
      }
      return;
    }
    if (windowControl) {
      windowControl.disabled = false;
      windowControl.title = '';
    }
    if (!history?.tournaments?.length) return;

    const data = buildData();
    const rows = showAll ? data.rows : data.rows.slice(0, 8);
    const updated = history.generatedAt ? new Date(history.generatedAt).toLocaleString([], { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '—';
    $('currentMetaStats').innerHTML = `<div><b>${data.eventCount}</b><span>Events</span></div><div><b>${data.total.toLocaleString()}</b><span>Entries</span></div><div class="wide"><b>50+ online events</b><span>Updated ${updated}</span></div>`;
    $('currentMetaList').innerHTML = rows.length ? rows.map(rowHtml).join('') : '<div class="meta-empty">No online tournaments fall inside this window.</div>';
    $('currentMetaMore').hidden = data.rows.length <= 8;
    $('currentMetaMore').textContent = showAll ? 'Show top 8' : `View full field (${data.rows.length})`;

    document.querySelectorAll('[data-history-family]').forEach(row => row.addEventListener('click', () => {
      const name = row.dataset.historyFamily;
      if (expanded.has(name)) expanded.delete(name); else expanded.add(name);
      render();
    }));
  }

  async function load() {
    try {
      const response = await fetch(`../../data/meta/current-field.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload?.tournaments)) throw new Error('Invalid compact field history');
      history = payload;
      render();
    } catch (error) {
      console.info('Compact online field history unavailable; using live cache.', error);
    }
  }

  $('currentWindow')?.addEventListener('change', () => { expanded.clear(); render(); });
  $('currentGroupingToggle')?.addEventListener('change', () => { expanded.clear(); render(); });
  $('currentMetaMore')?.addEventListener('click', () => { showAll = !showAll; render(); });
  document.querySelectorAll('[data-current-source]').forEach(button => button.addEventListener('click', () => setTimeout(render, 0)));
  window.addEventListener('meta:updated', () => setTimeout(render, 0));
  load();
})();
