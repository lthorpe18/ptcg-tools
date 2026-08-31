(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  let onlineWindow = '30';
  let irlScope = 'latest';
  let showAll = false;
  const expanded = new Set();
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct = n => `${Number(n || 0).toFixed(1)}%`;
  const ignored = name => !name || name === 'Other' || name === 'Unknown';

  function irlActive() {
    return document.querySelector('[data-current-source="irl"]')?.classList.contains('active');
  }

  function grouped() {
    return $('currentGroupingToggle')?.checked !== false;
  }

  function familyName(name) {
    if (!grouped()) return name;
    const family = (window.ArchetypeGroups?.FAMILIES || []).find(f => f.variants.includes(name));
    return family?.name || name;
  }

  function setOptions(source) {
    const select = $('currentWindow');
    if (!select) return;

    if (source === 'irl') {
      select.disabled = false;
      select.title = '';
      select.innerHTML = '<option value="latest">Latest IRL tournament</option><option value="all-irl">All IRL tournaments in format</option>';
      select.value = irlScope;
      return;
    }

    select.disabled = false;
    select.title = '';
    select.innerHTML = '<option value="14">Last 14 days</option><option value="30">Last 30 days</option><option value="all">All in format</option>';
    select.value = onlineWindow;
  }

  function selectedEvents() {
    const events = [...(window.IRLLabs?.getData?.()?.events || [])]
      .filter(event => Array.isArray(event.decks) && event.decks.length)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    return irlScope === 'latest' ? events.slice(0, 1) : events;
  }

  function buildData() {
    const events = selectedEvents();
    const map = new Map();

    for (const event of events) {
      for (const deck of event.decks || []) {
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
    return { events, rows, total };
  }

  function rowHtml(row, index) {
    const expandable = grouped() && row.variants.length > 1;
    const open = expanded.has(row.name);
    const variants = expandable && open
      ? `<div class="current-variants">${row.variants.map(v => `<div class="variant-row"><span>${esc(v.name)}</span><b>${pct(v.share * 100)}</b><small>${v.entries} entries</small></div>`).join('')}</div>`
      : '';
    return `<article class="current-meta-row ${expandable ? 'expandable' : ''}" data-irl-family="${esc(row.name)}">
      <div class="current-rank">${index + 1}</div>
      <div class="current-name">${window.DeckSprites?.html?.(row.name,{size:34}) || ''}<span><b>${esc(row.name)}</b><small>${expandable ? `${row.variants.length} variants · tap to ${open ? 'collapse' : 'expand'}` : `${row.entries} entries`}</small></span></div>
      <div class="current-share"><b>${pct(row.share * 100)}</b><small>${row.entries} entries</small></div>
      <span class="row-chevron" aria-hidden="true">${expandable ? (open ? '⌃' : '⌄') : ''}</span>
      ${variants}
    </article>`;
  }

  function render() {
    if (!irlActive()) return;
    setOptions('irl');
    const data = buildData();
    const rows = showAll ? data.rows : data.rows.slice(0, 8);
    const latest = data.events[0];
    const cache = window.IRLLabs?.getData?.() || {};

    let label = 'IRL tournaments';
    let detail = cache.generatedAt ? `Updated ${new Date(cache.generatedAt).toLocaleString([], { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}` : 'Limitless Labs';
    if (irlScope === 'latest' && latest) {
      label = latest.name || 'Latest IRL tournament';
      const date = latest.date ? new Date(latest.date).toLocaleDateString([], { day:'numeric', month:'short', year:'numeric' }) : '';
      detail = [date, latest.players ? `${Number(latest.players).toLocaleString()} players` : ''].filter(Boolean).join(' · ');
    }

    $('currentMetaStats').innerHTML = `<div><b>${data.events.length}</b><span>Event${data.events.length === 1 ? '' : 's'}</span></div><div><b>${data.total.toLocaleString()}</b><span>Entries</span></div><div class="wide"><b>${esc(label)}</b><span>${esc(detail)}</span></div>`;
    $('currentMetaList').innerHTML = rows.length ? rows.map(rowHtml).join('') : '<div class="meta-empty">No IRL field data is available for this scope yet.</div>';
    $('currentMetaMore').hidden = data.rows.length <= 8;
    $('currentMetaMore').textContent = showAll ? 'Show top 8' : `View full field (${data.rows.length})`;

    document.querySelectorAll('[data-irl-family]').forEach(row => row.addEventListener('click', () => {
      const name = row.dataset.irlFamily;
      if (expanded.has(name)) expanded.delete(name); else expanded.add(name);
      render();
    }));
  }

  document.querySelectorAll('[data-current-source]').forEach(button => button.addEventListener('click', () => {
    const source = button.dataset.currentSource;
    if (source === 'irl') {
      irlScope = 'latest';
      showAll = false;
      expanded.clear();
      setTimeout(render, 0);
    } else {
      showAll = false;
      expanded.clear();
      setTimeout(() => setOptions('online'), 0);
    }
  }));

  $('currentWindow')?.addEventListener('change', event => {
    if (irlActive()) {
      irlScope = event.currentTarget.value === 'all-irl' ? 'all-irl' : 'latest';
      showAll = false;
      expanded.clear();
      setTimeout(render, 0);
    } else {
      onlineWindow = ['14','30','all'].includes(event.currentTarget.value) ? event.currentTarget.value : '30';
    }
  });

  $('currentGroupingToggle')?.addEventListener('change', () => {
    expanded.clear();
    if (irlActive()) setTimeout(render, 0);
  });

  $('currentMetaMore')?.addEventListener('click', () => {
    if (!irlActive()) return;
    showAll = !showAll;
    setTimeout(render, 0);
  });

  window.addEventListener('irl:updated', () => {
    if (irlActive()) setTimeout(render, 0);
  });
})();
