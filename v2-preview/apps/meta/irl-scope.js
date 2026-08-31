(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let onlineWindow = '30';
  let irlScope = 'latest-weekend';
  let showAll = false;
  const expanded = new Set();
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct = n => `${Number(n || 0).toFixed(1)}%`;
  const ignored = name => !name || name === 'Other' || name === 'Unknown';

  function irlActive() { return document.querySelector('[data-current-source="irl"]')?.classList.contains('active'); }
  function grouped() { return $('currentGroupingToggle')?.checked !== false; }
  function familyName(name) {
    if (!grouped()) return name;
    return (window.ArchetypeGroups?.FAMILIES || []).find(f => f.variants.includes(name))?.name || name;
  }
  function events() {
    return [...(window.IRLLabs?.getData?.()?.events || [])]
      .filter(e => Array.isArray(e.decks) && e.decks.length && Number.isFinite(new Date(e.date).getTime()))
      .sort((a,b) => new Date(b.date) - new Date(a.date));
  }
  function isoWeekKey(value) {
    const d = new Date(value);
    const u = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = u.getUTCDay() || 7;
    u.setUTCDate(u.getUTCDate() + 4 - day);
    const year = u.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year,0,1));
    const week = Math.ceil((((u - yearStart) / 86400000) + 1) / 7);
    return `${year}-W${String(week).padStart(2,'0')}`;
  }
  function setOptions(source) {
    const select = $('currentWindow');
    if (!select) return;
    if (source !== 'irl') {
      select.innerHTML = '<option value="14">Last 14 days</option><option value="30">Last 30 days</option><option value="all">All in format</option>';
      select.value = onlineWindow;
      return;
    }
    const list = events();
    const individual = list.map(e => `<option value="event:${esc(e.id)}">${esc(e.name || 'IRL tournament')} · ${new Date(e.date).toLocaleDateString([], {day:'numeric',month:'short'})}</option>`).join('');
    select.innerHTML = `<option value="latest-weekend">Latest IRL majors weekend</option><option value="all-irl">All IRL majors this format</option>${individual ? `<optgroup label="Individual tournaments">${individual}</optgroup>` : ''}`;
    select.value = irlScope;
    if (!select.value) { irlScope = 'latest-weekend'; select.value = irlScope; }
  }
  function selectedEvents() {
    const list = events();
    if (!list.length) return [];
    if (irlScope === 'all-irl') return list;
    if (irlScope.startsWith('event:')) return list.filter(e => String(e.id) === irlScope.slice(6));
    const latestWeek = isoWeekKey(list[0].date);
    return list.filter(e => isoWeekKey(e.date) === latestWeek);
  }
  function buildData() {
    const selected = selectedEvents();
    const map = new Map();
    for (const event of selected) for (const deck of event.decks || []) {
      if (ignored(deck.name)) continue;
      const raw = deck.name, name = familyName(raw);
      const row = map.get(name) || { name, entries:0, wins:0, losses:0, ties:0, variants:new Map() };
      for (const key of ['entries','wins','losses','ties']) row[key] += Number(deck[key] || 0);
      const v = row.variants.get(raw) || { name:raw, entries:0, wins:0, losses:0, ties:0 };
      for (const key of ['entries','wins','losses','ties']) v[key] += Number(deck[key] || 0);
      row.variants.set(raw,v); map.set(name,row);
    }
    const rows = [...map.values()], total = rows.reduce((s,r)=>s+r.entries,0);
    for (const row of rows) {
      row.share = total ? row.entries/total : 0;
      row.variants = [...row.variants.values()].sort((a,b)=>b.entries-a.entries);
      for (const v of row.variants) v.share = total ? v.entries/total : 0;
    }
    rows.sort((a,b)=>b.entries-a.entries);
    return { events:selected, rows, total };
  }
  function rowHtml(row,index) {
    const expandable = grouped() && row.variants.length > 1, open = expanded.has(row.name);
    const variants = expandable && open ? `<div class="current-variants">${row.variants.map(v=>`<div class="variant-row"><span>${esc(v.name)}</span><b>${pct(v.share*100)}</b><small>${v.entries} entries</small></div>`).join('')}</div>` : '';
    return `<article class="current-meta-row ${expandable?'expandable':''}" data-irl-family="${esc(row.name)}"><div class="current-rank">${index+1}</div><div class="current-name">${window.DeckSprites?.html?.(row.name,{size:34})||''}<span><b>${esc(row.name)}</b><small>${expandable?`${row.variants.length} variants · tap to ${open?'collapse':'expand'}`:`${row.entries} entries`}</small></span></div><div class="current-share"><b>${pct(row.share*100)}</b><small>${row.entries} entries</small></div><span class="row-chevron" aria-hidden="true">${expandable?(open?'⌃':'⌄'):''}</span>${variants}</article>`;
  }
  function render() {
    if (!irlActive()) return;
    setOptions('irl');
    const data = buildData(), rows = showAll ? data.rows : data.rows.slice(0,8);
    let label = 'IRL majors', detail = '';
    if (irlScope === 'latest-weekend' && data.events.length) {
      const dates = data.events.map(e=>new Date(e.date));
      const min = new Date(Math.min(...dates)), max = new Date(Math.max(...dates));
      label = data.events.length === 1 ? (data.events[0].name || 'IRL major') : 'Multiple major events';
      detail = `${min.toLocaleDateString([], {day:'numeric',month:'short'})}${min.toDateString()!==max.toDateString()?`–${max.toLocaleDateString([], {day:'numeric',month:'short'})}`:''} · ${data.events.length} event${data.events.length===1?'':'s'}`;
    } else if (irlScope.startsWith('event:') && data.events[0]) {
      label = data.events[0].name || 'IRL tournament';
      detail = [new Date(data.events[0].date).toLocaleDateString([], {day:'numeric',month:'short',year:'numeric'}), data.events[0].players ? `${Number(data.events[0].players).toLocaleString()} players` : ''].filter(Boolean).join(' · ');
    } else if (irlScope === 'all-irl') detail = `${data.events.length} events in TEF–PBL`;
    $('currentMetaStats').innerHTML = `<div><b>${data.events.length}</b><span>Event${data.events.length===1?'':'s'}</span></div><div><b>${data.total.toLocaleString()}</b><span>Entries</span></div><div class="wide"><b>${esc(label)}</b><span>${esc(detail)}</span></div>`;
    $('currentMetaList').innerHTML = rows.length ? rows.map(rowHtml).join('') : '<div class="meta-empty">No IRL field data is available for this scope yet.</div>';
    $('currentMetaMore').hidden = data.rows.length <= 8;
    $('currentMetaMore').textContent = showAll ? 'Show top 8' : `View full field (${data.rows.length})`;
    document.querySelectorAll('[data-irl-family]').forEach(row=>row.addEventListener('click',()=>{ const n=row.dataset.irlFamily; expanded.has(n)?expanded.delete(n):expanded.add(n); render(); }));
  }
  document.querySelectorAll('[data-current-source]').forEach(button=>button.addEventListener('click',()=>{
    if (button.dataset.currentSource === 'irl') { irlScope='latest-weekend'; showAll=false; expanded.clear(); setTimeout(render,0); }
    else { showAll=false; expanded.clear(); setTimeout(()=>setOptions('online'),0); }
  }));
  $('currentWindow')?.addEventListener('change',event=>{
    if (irlActive()) { irlScope=event.currentTarget.value; showAll=false; expanded.clear(); setTimeout(render,0); }
    else onlineWindow=['14','30','all'].includes(event.currentTarget.value)?event.currentTarget.value:'30';
  });
  $('currentGroupingToggle')?.addEventListener('change',()=>{ expanded.clear(); if (irlActive()) setTimeout(render,0); });
  $('currentMetaMore')?.addEventListener('click',()=>{ if (!irlActive()) return; showAll=!showAll; setTimeout(render,0); });
  window.addEventListener('irl:updated',()=>{ if (irlActive()) setTimeout(render,0); });
})();
