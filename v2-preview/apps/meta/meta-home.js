(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { source: 'online', grouping: 'variants', showAll: false, expanded: new Set(), query: '' };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct = value => `${Number(value || 0).toFixed(1)}%`;
  const ignored = name => !name || name === 'Other' || name === 'Unknown';

  function blendedRows() {
    const result = window.MetaBlendedField?.selected?.();
    return (result?.rows || [])
      .filter(d => !ignored(d.name))
      .map(d => ({
        ...d,
        name:d.name,
        entries:null,
        share:100 * Number(d.share || 0),
        blended:true,
        variants:[{...d,name:d.name,entries:null,share:100 * Number(d.share || 0),blended:true}],
      }))
      .sort((a,b)=>b.share-a.share || a.name.localeCompare(b.name));
  }

  function exactRows() {
    if (state.source === 'blend') return blendedRows();
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
    let result;
    if (state.grouping === 'variants') result = exact;
    else {
      const map = new Map();
      for (const d of exact) {
        const name = familyName(d.name);
        const row = map.get(name) || { name, entries:state.source === 'blend' ? null : 0, wins:0, losses:0, ties:0, share:0, variants:[], blended:state.source === 'blend' };
        if (row.entries != null) row.entries += Number(d.entries || 0);
        row.wins += Number(d.wins || 0); row.losses += Number(d.losses || 0); row.ties += Number(d.ties || 0); row.share += Number(d.share || 0); row.variants.push(d);
        map.set(name,row);
      }
      result = [...map.values()].sort((a,b)=> state.source === 'blend' ? (b.share-a.share || a.name.localeCompare(b.name)) : (b.entries-a.entries));
    }
    const q = state.query.trim().toLowerCase();
    if (!q) return result;
    return result.filter(row => row.name.toLowerCase().includes(q) || (row.variants || []).some(v => String(v.name || '').toLowerCase().includes(q)));
  }

  function rowMeta(row) {
    return row.blended || row.entries == null ? 'Blended current-field share' : `${Number(row.entries||0).toLocaleString()} entries`;
  }

  function rowHtml(row,index) {
    const expandable = state.grouping === 'families' && row.variants.length > 1;
    const open = state.expanded.has(row.name);
    const exploreSource = state.source === 'irl' ? 'irl' : 'online';
    const variants = expandable && open ? `<div class="current-variants">${row.variants.map(v => `<button type="button" class="variant-row" data-explore-deck="${esc(v.name)}" data-explore-source="${exploreSource}"><span>${esc(v.name)}</span><b>${pct(v.share)}</b><small>${v.blended || v.entries == null ? 'Blended share' : `${Number(v.entries||0).toLocaleString()} entries`}</small><span class="explore-arrow">›</span></button>`).join('')}</div>` : '';
    const sprites = window.DeckSprites?.html?.(row.name,{size:32}) || '';
    const meta = rowMeta(row);
    const content = `<div class="current-rank">${index+1}</div><div class="current-name"><span class="current-sprites">${sprites}</span><span class="current-name-copy"><b>${esc(row.name)}</b><small>${expandable?`${row.variants.length} variants · tap to ${open?'collapse':'expand'}`:esc(meta)}</small></span></div><div class="current-share"><b>${pct(row.share)}</b><small>${row.blended || row.entries == null ? 'blended' : `${Number(row.entries||0).toLocaleString()} entries`}</small></div><span class="row-chevron" aria-hidden="true">${expandable?(open?'⌃':'⌄'):'›'}</span>${variants}`;
    if (expandable) return `<article class="current-meta-row expandable" data-current-family="${esc(row.name)}">${content}</article>`;
    return `<button type="button" class="current-meta-row" data-explore-deck="${esc(row.name)}" data-explore-source="${exploreSource}">${content}</button>`;
  }

  function blendedContextHtml() {
    const result = window.MetaBlendedField?.selected?.() || {};
    if (!result.available) return `<div><b>—</b><span>IRL weight</span></div><div><b>—</b><span>Online weight</span></div><div class="wide"><b>${esc(result.format || 'Unknown format')} · unavailable</b><span>${esc(result.reason || 'Compatible evidence is unavailable.')}</span></div>`;
    const irl = Math.round(100 * Number(result.weights?.irl || 0));
    const online = Math.round(100 * Number(result.weights?.online || 0));
    const major = result.majorDate ? `Major weekend ${result.majorDate}` : 'Latest major weekend';
    return `<div><b>${irl}%</b><span>IRL weight</span></div><div><b>${online}%</b><span>Online weight</span></div><div class="wide"><b>${esc(result.format)} · ${esc(result.status)}</b><span>${esc(major)} · 50+ player Online evidence</span></div>`;
  }

  function evidenceHtml(item) {
    if (!item) return '<li>No compatible evidence used.</li>';
    const events=(item.events || []).map(event=>`${esc(event.name)}${event.date?` (${esc(event.date)})`:''}`).join(', ');
    return `<li><b>${item.source==='irl'?'IRL':'Online'} · ${esc(item.format || 'unknown')}</b> — ${Number(item.eventCount||0).toLocaleString()} tournament${Number(item.eventCount||0)===1?'':'s'}${item.from?` · ${esc(item.from)}${item.through&&item.through!==item.from?` to ${esc(item.through)}`:''}`:''}${events?`<br><span>${events}</span>`:''}</li>`;
  }

  function renderBlendControls() {
    const predictions=window.MetaBlendedField?.predictions?.() || [], result=window.MetaBlendedField?.selected?.() || {};
    const control=$('blendTargetControl'),select=$('blendTargetSelect'),method=$('blendMethod');
    if(control)control.hidden=state.source!=='blend' || predictions.length<2;
    if(select) {
      const html=predictions.map(item=>`<option value="${esc(item.format)}">${esc(item.format)}${item.available?'':' · unavailable'}</option>`).join('');
      if(select.innerHTML!==html)select.innerHTML=html;
      select.value=result.format || '';
    }
    if(method)method.hidden=state.source!=='blend';
    if($('blendMethodBody')) $('blendMethodBody').innerHTML=`<p><b>${esc(result.status || 'Unavailable')}</b>${result.reason?` — ${esc(result.reason)}`:''}</p>${result.available?`<p>This prediction uses <b>${Math.round(100*Number(result.weights?.irl||0))}% IRL</b> and <b>${Math.round(100*Number(result.weights?.online||0))}% Online</b>. Rule: ${esc(String(result.rule||'').replaceAll('-',' '))}.</p>`:''}<ul>${evidenceHtml(result.evidence?.irl)}${evidenceHtml(result.evidence?.online)}</ul><p class="blend-version">Method ${esc(result.version || window.MetaBlendedField?.policy?.version || '')} · Evidence revision ${esc(result.revision || 'not available')}</p><a href="../_shared/blended-methodology.html" target="_blank" rel="noopener">Read the shared Blended methodology</a>`;
  }

  function renderCurrent() {
    document.querySelectorAll('[data-current-source]').forEach(btn => btn.classList.toggle('active', btn.dataset.currentSource === state.source));
    if ($('currentGroupingToggle')) $('currentGroupingToggle').checked = state.grouping === 'families';
    if ($('currentMetaSearch') && $('currentMetaSearch').value !== state.query) $('currentMetaSearch').value = state.query;
    if ($('currentWindow')) $('currentWindow').hidden = state.source === 'blend';
    renderBlendControls();
    const all = rows();
    const shown = state.query ? all : (state.showAll ? all : all.slice(0,8));
    if (state.source === 'blend') {
      $('currentMetaStats').innerHTML = blendedContextHtml();
    } else {
      const context = window.MetaData?.context?.(state.source) || {events:0,entries:0,label:'Loading',detail:''};
      $('currentMetaStats').innerHTML = `<div><b>${Number(context.events||0).toLocaleString()}</b><span>Events</span></div><div><b>${Number(context.entries||0).toLocaleString()}</b><span>Entries</span></div><div class="wide"><b>${esc(context.label)}</b><span>${esc(context.detail||'')}</span></div>`;
    }
    $('currentMetaList').innerHTML = shown.length ? shown.map(rowHtml).join('') : `<div class="meta-empty">${state.query?'No decks match this search.':'No data is available for this source and scope yet.'}</div>`;
    $('currentMetaMore').hidden = !!state.query || all.length <= 8;
    $('currentMetaMore').textContent = state.showAll ? 'Show top 8' : `View full field (${all.length})`;
    document.querySelectorAll('[data-current-family].expandable').forEach(row => row.addEventListener('click', e => {
      if (e.target.closest('[data-explore-deck]')) return;
      const name = row.dataset.currentFamily;
      state.expanded.has(name) ? state.expanded.delete(name) : state.expanded.add(name);
      renderCurrent();
    }));
  }

  document.querySelectorAll('[data-current-source]').forEach(btn => btn.addEventListener('click', () => {
    const requested = btn.dataset.currentSource;
    state.source = requested === 'irl' ? 'irl' : requested === 'blend' ? 'blend' : 'online';
    state.showAll=false; state.expanded.clear(); renderCurrent();
    if(state.source==='blend')window.MetaBlendedField?.ensure?.().then(renderCurrent).catch(()=>renderCurrent());
  }));
  $('blendTargetSelect')?.addEventListener('change',event=>{window.MetaBlendedField?.select?.(event.target.value);state.showAll=false;state.expanded.clear();renderCurrent()});
  $('currentGroupingToggle')?.addEventListener('change', e => { state.grouping=e.currentTarget.checked?'families':'variants'; state.expanded.clear(); renderCurrent(); });
  $('currentMetaSearch')?.addEventListener('input', e => { state.query=e.currentTarget.value || ''; state.expanded.clear(); renderCurrent(); });
  $('currentMetaMore')?.addEventListener('click', () => { state.showAll=!state.showAll; renderCurrent(); });
  const currentIsActive = () => window.MetaRouter?.get?.().view === 'current' || (!window.MetaRouter && !$('currentMetaPage')?.classList.contains('hidden'));
  window.addEventListener('meta:data-changed', () => { if (currentIsActive()) { state.showAll=false; state.expanded.clear(); renderCurrent(); } });
  window.addEventListener('meta:blend-target-changed', () => { if (currentIsActive() && state.source==='blend') renderCurrent(); });
  window.addEventListener('decksprites:updated', () => { if (currentIsActive()) renderCurrent(); });

  window.MetaHome = { render:renderCurrent };
  renderCurrent();
})();
