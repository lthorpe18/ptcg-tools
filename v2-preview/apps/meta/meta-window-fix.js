(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let history = null;
  let showAll = false;
  const expanded = new Set();
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct = n => `${Number(n || 0).toFixed(1)}%`;
  const ignored = name => !name || name === 'Other' || name === 'Unknown';

  function onlineActive() { return document.querySelector('[data-current-source="online"]')?.classList.contains('active'); }
  function grouped() { return $('currentGroupingToggle')?.checked !== false; }
  function familyName(name) {
    if (!grouped()) return name;
    return (window.ArchetypeGroups?.FAMILIES || []).find(f => f.variants.includes(name))?.name || name;
  }

  function buildData() {
    const windowValue = $('currentWindow')?.value || '30';
    const cutoff = windowValue === 'all' ? -Infinity : Date.now() - Number(windowValue) * 86400000;
    const map = new Map(); let eventCount = 0;
    for (const tournament of history?.tournaments || []) {
      const ts = new Date(tournament.date).getTime();
      if (!Number.isFinite(ts) || ts < cutoff || Number(tournament.players || 0) < 50 || !(tournament.archetypes || []).length) continue;
      eventCount++;
      for (const deck of tournament.archetypes || []) {
        const raw = deck.name; if (ignored(raw)) continue;
        const name = familyName(raw);
        const row = map.get(name) || { name, entries:0, wins:0, losses:0, ties:0, variants:new Map() };
        for (const key of ['entries','wins','losses','ties']) row[key] += Number(deck[key] || 0);
        const variant = row.variants.get(raw) || { name:raw, entries:0, wins:0, losses:0, ties:0 };
        for (const key of ['entries','wins','losses','ties']) variant[key] += Number(deck[key] || 0);
        row.variants.set(raw, variant); map.set(name,row);
      }
    }
    const rows=[...map.values()], total=rows.reduce((s,r)=>s+r.entries,0);
    for (const row of rows) { row.share=total?row.entries/total:0; row.variants=[...row.variants.values()].sort((a,b)=>b.entries-a.entries); for (const v of row.variants) v.share=total?v.entries/total:0; }
    rows.sort((a,b)=>b.entries-a.entries); return { rows,total,eventCount };
  }

  function rowHtml(row,index) {
    const expandable=grouped()&&row.variants.length>1, open=expanded.has(row.name);
    const variants=expandable&&open?`<div class="current-variants">${row.variants.map(v=>`<div class="variant-row"><span>${esc(v.name)}</span><b>${pct(v.share*100)}</b><small>${v.entries} entries</small></div>`).join('')}</div>`:'';
    return `<article class="current-meta-row ${expandable?'expandable':''}" data-history-family="${esc(row.name)}"><div class="current-rank">${index+1}</div><div class="current-name">${window.DeckSprites?.html?.(row.name,{size:34})||''}<span><b>${esc(row.name)}</b><small>${expandable?`${row.variants.length} variants · tap to ${open?'collapse':'expand'}`:`${row.entries} entries`}</small></span></div><div class="current-share"><b>${pct(row.share*100)}</b><small>${row.entries} entries</small></div><span class="row-chevron">${expandable?(open?'⌃':'⌄'):''}</span>${variants}</article>`;
  }

  function render() {
    if (!onlineActive() || !history?.tournaments?.length) return;
    const control=$('currentWindow'); if (control) { control.disabled=false; control.title=''; }
    const data=buildData(), rows=showAll?data.rows:data.rows.slice(0,8);
    const updated=history.generatedAt?new Date(history.generatedAt).toLocaleString([],{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'—';
    $('currentMetaStats').innerHTML=`<div><b>${data.eventCount}</b><span>Events</span></div><div><b>${data.total.toLocaleString()}</b><span>Entries</span></div><div class="wide"><b>50+ online events</b><span>Updated ${updated}</span></div>`;
    $('currentMetaList').innerHTML=rows.length?rows.map(rowHtml).join(''):'<div class="meta-empty">No online tournaments fall inside this window.</div>';
    $('currentMetaMore').hidden=data.rows.length<=8; $('currentMetaMore').textContent=showAll?'Show top 8':`View full field (${data.rows.length})`;
    document.querySelectorAll('[data-history-family]').forEach(row=>row.addEventListener('click',()=>{const n=row.dataset.historyFamily;expanded.has(n)?expanded.delete(n):expanded.add(n);render();}));
  }

  async function load() {
    try { const r=await fetch(`../../data/meta/current-field.json?t=${Date.now()}`,{cache:'no-store'}); if(!r.ok) throw new Error(`HTTP ${r.status}`); const p=await r.json(); if(!Array.isArray(p?.tournaments)) throw new Error('Invalid compact field history'); history=p; render(); }
    catch(error){ console.info('Compact online field history unavailable; using live cache.',error); }
  }

  $('currentWindow')?.addEventListener('change',()=>{ if(!onlineActive()) return; expanded.clear(); render(); });
  $('currentGroupingToggle')?.addEventListener('change',()=>{ if(!onlineActive()) return; expanded.clear(); render(); });
  $('currentMetaMore')?.addEventListener('click',()=>{ if(!onlineActive()) return; showAll=!showAll; render(); });
  document.querySelectorAll('[data-current-source]').forEach(button=>button.addEventListener('click',()=>{ if(button.dataset.currentSource==='online') setTimeout(render,0); }));
  window.addEventListener('meta:updated',()=>{ if(onlineActive()) setTimeout(render,0); });
  load();
})();
