(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { source: 'online', grouping: 'variants', showAll: false, expanded: new Set(), view: 'current' };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct = value => `${Number(value || 0).toFixed(1)}%`;
  const ignored = name => !name || name === 'Other' || name === 'Unknown';

  function exactRows() {
    return (window.MetaData?.data?.(state.source)?.decks || [])
      .filter(d => !ignored(d.name))
      .map(d => ({ ...d, name:d.name, entries:Number(d.entries ?? d.players ?? 0), share:Number(d.share || 0), variants:[{...d,name:d.name,entries:Number(d.entries ?? d.players ?? 0),share:Number(d.share || 0)}] }))
      .sort((a,b)=>b.entries-a.entries);
  }

  function familyName(name) {
    return (window.ArchetypeGroups?.FAMILIES || []).find(f => f.variants.includes(name))?.name || name;
  }

  function rows() {
    const exact = exactRows();
    if (state.grouping === 'variants') return exact;
    const map = new Map();
    for (const d of exact) {
      const name = familyName(d.name);
      const row = map.get(name) || { name, entries:0, wins:0, losses:0, ties:0, share:0, variants:[] };
      row.entries += Number(d.entries || 0); row.wins += Number(d.wins || 0); row.losses += Number(d.losses || 0); row.ties += Number(d.ties || 0); row.share += Number(d.share || 0); row.variants.push(d);
      map.set(name,row);
    }
    return [...map.values()].sort((a,b)=>b.entries-a.entries);
  }

  function rowHtml(row,index) {
    const expandable = state.grouping === 'families' && row.variants.length > 1;
    const open = state.expanded.has(row.name);
    const variants = expandable && open ? `<div class="current-variants">${row.variants.map(v => `<button type="button" class="variant-row" data-explore-deck="${esc(v.name)}" data-explore-source="${state.source}"><span>${esc(v.name)}</span><b>${pct(v.share)}</b><small>${Number(v.entries||0).toLocaleString()} entries</small><span class="explore-arrow">›</span></button>`).join('')}</div>` : '';
    return `<article class="current-meta-row ${expandable?'expandable':''}" data-current-family="${esc(row.name)}"><div class="current-rank">${index+1}</div><div class="current-name">${window.DeckSprites?.html?.(row.name,{size:34})||''}<span><b>${esc(row.name)}</b><small>${expandable?`${row.variants.length} variants · tap to ${open?'collapse':'expand'}`:`${Number(row.entries||0).toLocaleString()} entries`}</small></span></div><div class="current-share"><b>${pct(row.share)}</b><small>${Number(row.entries||0).toLocaleString()} entries</small></div><span class="row-chevron" aria-hidden="true">${expandable?(open?'⌃':'⌄'):''}</span>${variants}</article>`;
  }

  function renderCurrent() {
    document.querySelectorAll('[data-current-source]').forEach(btn => btn.classList.toggle('active', btn.dataset.currentSource === state.source));
    if ($('currentGroupingToggle')) $('currentGroupingToggle').checked = state.grouping === 'families';
    const all = rows();
    const shown = state.showAll ? all : all.slice(0,8);
    const context = window.MetaData?.context?.(state.source) || {events:0,entries:0,label:'Loading',detail:''};
    $('currentMetaStats').innerHTML = `<div><b>${Number(context.events||0).toLocaleString()}</b><span>Events</span></div><div><b>${Number(context.entries||0).toLocaleString()}</b><span>Entries</span></div><div class="wide"><b>${esc(context.label)}</b><span>${esc(context.detail||'')}</span></div>`;
    $('currentMetaList').innerHTML = shown.length ? shown.map(rowHtml).join('') : '<div class="meta-empty">No data is available for this source and scope yet.</div>';
    $('currentMetaMore').hidden = all.length <= 8;
    $('currentMetaMore').textContent = state.showAll ? 'Show top 8' : `View full field (${all.length})`;
    document.querySelectorAll('[data-current-family].expandable').forEach(row => row.addEventListener('click', e => {
      if (e.target.closest('[data-explore-deck]')) return;
      const name = row.dataset.currentFamily;
      state.expanded.has(name) ? state.expanded.delete(name) : state.expanded.add(name);
      renderCurrent();
    }));
  }

  function setView(view) {
    state.view = view;
    ['current','prep','matchups','decks'].forEach(name => $(name === 'current' ? 'currentMetaPage' : name)?.classList.toggle('hidden', name !== view));
    document.body.dataset.metaView = view;
    document.querySelectorAll('[data-tab="prep"]').forEach(el => el.classList.toggle('active', view === 'prep'));
    window.scrollTo({top:0,behavior:'instant'});
    if (view === 'prep') window.dispatchEvent(new CustomEvent('field:updated'));
  }

  document.querySelectorAll('[data-current-source]').forEach(btn => btn.addEventListener('click', () => { state.source=btn.dataset.currentSource==='irl'?'irl':'online'; state.showAll=false; state.expanded.clear(); renderCurrent(); }));
  $('currentWindow')?.addEventListener('change', () => { state.showAll=false; state.expanded.clear(); renderCurrent(); });
  $('currentGroupingToggle')?.addEventListener('change', e => { state.grouping=e.currentTarget.checked?'families':'variants'; state.expanded.clear(); renderCurrent(); });
  $('currentMetaMore')?.addEventListener('click', () => { state.showAll=!state.showAll; renderCurrent(); });
  document.querySelectorAll('[data-meta-view]').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.metaView)));
  document.querySelectorAll('[data-meta-back]').forEach(btn => btn.addEventListener('click', () => setView('current')));
  window.addEventListener('meta:data-changed', () => { if (!$('currentMetaPage')?.classList.contains('hidden')) renderCurrent(); });
  window.addEventListener('meta:updated', () => { if (!$('currentMetaPage')?.classList.contains('hidden')) renderCurrent(); });
  window.addEventListener('irl:updated', () => { if (!$('currentMetaPage')?.classList.contains('hidden')) renderCurrent(); });

  window.MetaHome = { render:renderCurrent, setView };
  setView('current');
  renderCurrent();
})();