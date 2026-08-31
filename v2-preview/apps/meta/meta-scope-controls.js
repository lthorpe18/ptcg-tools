(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let onlineScope = '30';
  const originalDeckAggregate = window.DeckAggregate ? {
    getData: window.DeckAggregate.getData?.bind(window.DeckAggregate),
    getMatchup: window.DeckAggregate.getMatchup?.bind(window.DeckAggregate),
    hasData: window.DeckAggregate.hasData?.bind(window.DeckAggregate),
  } : null;
  const originalPrepField = window.PrepField ? {
    getField: window.PrepField.getField?.bind(window.PrepField),
    getChipRows: window.PrepField.getChipRows?.bind(window.PrepField),
    getAllRows: window.PrepField.getAllRows?.bind(window.PrepField),
  } : null;

  const onlineOptions = [
    { value:'14', label:'Last 14 days' },
    { value:'30', label:'Last 30 days' },
    { value:'all', label:'All in format' },
  ];

  function onlineTournaments() {
    const rows = (typeof CACHE !== 'undefined' && Array.isArray(CACHE?.tournaments)) ? CACHE.tournaments : [];
    const eligible = rows.filter(t => Number(t.players || 0) >= 50 && (t.standings || []).length);
    if (onlineScope === 'all') return eligible;
    const validDates = eligible.map(t => new Date(t.date).getTime()).filter(Number.isFinite);
    const newest = validDates.length ? Math.max(...validDates) : Date.now();
    const cutoff = newest - Number(onlineScope) * 86400000;
    return eligible.filter(t => {
      const ts = new Date(t.date).getTime();
      return Number.isFinite(ts) && ts >= cutoff;
    });
  }

  function onlineAggregate() {
    if (typeof MetaEngine === 'undefined' || !MetaEngine?.aggregate) return null;
    return MetaEngine.aggregate(onlineTournaments());
  }

  function onlineDecks() {
    const agg = onlineAggregate();
    if (!agg) return originalDeckAggregate?.getData?.()?.decks || [];
    return (agg.archetypes || []).map(row => ({
      name: row.name,
      entries: Number(row.players || 0),
      players: Number(row.players || 0),
      wins: Number(row.wins || 0),
      losses: Number(row.losses || 0),
      ties: Number(row.ties || 0),
      games: Number(row.games || 0),
      share: Number(row.share || 0),
      winRate: Number(row.winRate || 0),
    }));
  }

  function onlineMatchups() {
    const agg = onlineAggregate();
    if (!agg) return originalDeckAggregate?.getData?.()?.matchups || [];
    return [...(agg.matchups?.values?.() || [])];
  }

  function onlineResults() { return onlineAggregate()?.results || []; }

  function onlineData() {
    const base = originalDeckAggregate?.getData?.() || {};
    const agg = onlineAggregate();
    if (!agg) return base;
    return {
      ...base,
      decks: onlineDecks(),
      matchups: onlineMatchups(),
      results: onlineResults(),
      overview: { tournaments: agg.tournamentCount || 0, players: agg.totalPlayers || 0, matches: agg.matches || 0 },
      onlineScope,
    };
  }

  function scopedOnlineMatchup(a,b) {
    return onlineMatchups().find(m => m.a === a && m.b === b) || null;
  }

  function scopedOnlineFieldRows() {
    const decks = onlineDecks().filter(d => d?.name && d.name !== 'Other' && d.name !== 'Unknown');
    const total = decks.reduce((sum,d) => sum + Number(d.entries || d.players || 0), 0);
    return decks.map(d => ({ name:d.name, share: total ? Number(d.entries || d.players || 0) / total : 0 }));
  }

  function irlFieldRows() {
    const decks = window.MetaIRLScope?.selectedDecks?.() || window.IRLLabs?.getData?.()?.decks || [];
    const total = decks.reduce((sum,d)=>sum+Number(d.entries||0),0);
    return decks.filter(d=>d?.name && d.name!=='Other' && d.name!=='Unknown').map(d=>({name:d.name,share:total?Number(d.entries||0)/total:0}));
  }

  function selectedPrepRows() {
    const source = $('fieldSource')?.value || $('playFieldSource')?.value || 'online';
    if (source === 'custom') return originalPrepField?.getField?.() || [];
    if (source === 'irl') return irlFieldRows();
    if (source === 'blend') {
      const weight = Number($('fieldBlend')?.value || 50) / 100;
      const map = new Map();
      for (const row of scopedOnlineFieldRows()) map.set(row.name,(map.get(row.name)||0)+row.share*(1-weight));
      for (const row of irlFieldRows()) map.set(row.name,(map.get(row.name)||0)+row.share*weight);
      const total=[...map.values()].reduce((s,x)=>s+x,0);
      return [...map.entries()].map(([name,value])=>({name,share:total?value/total:0})).sort((a,b)=>b.share-a.share);
    }
    return scopedOnlineFieldRows();
  }

  function chipRows() {
    return selectedPrepRows().map(row => ({ name:row.name, included:true, share:row.share, originalShare:row.share }));
  }

  function allRows() {
    return selectedPrepRows().map(row => ({ name:row.name, included:true, share:row.share, originalShare:row.share, defaultIncluded:true, pinned:false }));
  }

  function setOnline(value) {
    if (!onlineOptions.some(x => x.value === value)) value = '30';
    onlineScope = value;
    document.querySelectorAll('[data-online-scope]').forEach(el => { if (el.value !== onlineScope) el.value = onlineScope; });
    window.dispatchEvent(new CustomEvent('meta-scope:changed', { detail:{ source:'online', scope:onlineScope } }));
    window.dispatchEvent(new CustomEvent('deckagg:updated'));
    window.dispatchEvent(new CustomEvent('field:updated'));
  }

  function irlOptions() {
    return window.MetaIRLScope?.options?.() || [
      { value:'latest-weekend', label:'Latest IRL majors weekend' },
      { value:'all-irl', label:'All IRL majors this format' },
    ];
  }
  function irlOptionHtml() {
    const opts = irlOptions();
    const base = opts.filter(x => !x.event).map(x => `<option value="${x.value}">${x.label}</option>`).join('');
    const events = opts.filter(x => x.event).map(x => `<option value="${x.value}">${x.label}</option>`).join('');
    return base + (events ? `<optgroup label="Individual tournaments">${events}</optgroup>` : '');
  }
  function onlineOptionHtml() { return onlineOptions.map(x => `<option value="${x.value}">${x.label}</option>`).join(''); }

  function syncSingle(sourceSelectId, onlineId, irlId) {
    const source = $(sourceSelectId)?.value || 'online';
    const host = $(sourceSelectId)?.closest('.single-source-control');
    if (!host) return;
    if (!$(onlineId+'Wrap')) {
      const wrap = document.createElement('label'); wrap.id=onlineId+'Wrap'; wrap.className='meta-functional-scope';
      wrap.innerHTML=`<span>Online scope</span><select id="${onlineId}" data-online-scope>${onlineOptionHtml()}</select>`;
      host.appendChild(wrap);
      $(onlineId).addEventListener('change', e => setOnline(e.currentTarget.value));
    }
    if (!$(irlId+'Wrap')) {
      const wrap = document.createElement('label'); wrap.id=irlId+'Wrap'; wrap.className='meta-functional-scope';
      wrap.innerHTML=`<span>IRL scope</span><select id="${irlId}">${irlOptionHtml()}</select>`;
      host.appendChild(wrap);
      $(irlId).addEventListener('change', e => window.MetaIRLScope?.set?.(e.currentTarget.value));
    }
    $(onlineId+'Wrap').hidden = source !== 'online';
    $(irlId+'Wrap').hidden = source !== 'irl';
    $(onlineId).value = onlineScope;
    if (window.MetaIRLScope) $(irlId).value = window.MetaIRLScope.get();
  }

  function syncPrep() {
    const header = $('playFieldSource')?.closest('.meta-child-header');
    if (!header) return;
    let wrap = $('playFunctionalScopes');
    if (!wrap) {
      wrap=document.createElement('div'); wrap.id='playFunctionalScopes'; wrap.className='play-functional-scopes';
      wrap.innerHTML=`<label id="playOnlineScopeWrap"><span>Online scope</span><select id="playOnlineScope" data-online-scope>${onlineOptionHtml()}</select></label><label id="playIrlScopeWrap"><span>IRL scope</span><select id="playIrlScope">${irlOptionHtml()}</select></label>`;
      header.appendChild(wrap);
      $('playOnlineScope').addEventListener('change', e => setOnline(e.currentTarget.value));
      $('playIrlScope').addEventListener('change', e => window.MetaIRLScope?.set?.(e.currentTarget.value));
    }
    const field = $('playFieldSource')?.value || 'online';
    const matchups = $('playMatchupSource')?.value || 'online';
    $('playOnlineScopeWrap').hidden = !(field==='online'||field==='blend'||matchups==='online'||matchups==='combined');
    $('playIrlScopeWrap').hidden = !(field==='irl'||field==='blend'||matchups==='irl'||matchups==='combined');
    $('playOnlineScope').value = onlineScope;
    if (window.MetaIRLScope) $('playIrlScope').value = window.MetaIRLScope.get();
  }

  function syncUi() {
    syncSingle('matchupPageSource','matchupOnlineScope','matchupIrlScope');
    syncSingle('deckPageSource','deckOnlineScope','deckIrlScope');
    syncPrep();
  }

  window.MetaScope = {
    getOnline:()=>onlineScope,
    setOnline,
    onlineOptions:()=>onlineOptions.map(x=>({...x})),
    onlineTournaments,
    onlineDecks,
    onlineMatchups,
    onlineResults,
    irlDecks:()=>window.MetaIRLScope?.selectedDecks?.() || window.IRLLabs?.getData?.()?.decks || [],
    irlMatchups:()=>window.MetaIRLScope?.selectedMatchups?.() || window.IRLLabs?.getData?.()?.matchups || [],
  };

  if (window.DeckAggregate && originalDeckAggregate?.getData) {
    window.DeckAggregate.getData = onlineData;
    window.DeckAggregate.getMatchup = scopedOnlineMatchup;
    window.DeckAggregate.hasData = () => !!onlineDecks().length;
  }
  if (window.PrepField && originalPrepField?.getField) {
    window.PrepField.getField = selectedPrepRows;
    window.PrepField.getChipRows = chipRows;
    window.PrepField.getAllRows = allRows;
  }

  $('currentWindow')?.addEventListener('change', e => {
    if (document.querySelector('[data-current-source="online"]')?.classList.contains('active') && ['14','30','all'].includes(e.currentTarget.value)) setOnline(e.currentTarget.value);
  });
  ['matchupPageSource','deckPageSource','playFieldSource','playMatchupSource','fieldSource','fieldBlend'].forEach(id => $(id)?.addEventListener('change', () => { syncUi(); window.dispatchEvent(new CustomEvent('field:updated')); }));
  window.addEventListener('meta-irl-scope:changed', () => { syncUi(); window.dispatchEvent(new CustomEvent('field:updated')); });
  window.addEventListener('irl:updated', syncUi);
  window.addEventListener('meta:updated', () => window.dispatchEvent(new CustomEvent('meta-scope:changed', { detail:{ source:'online', scope:onlineScope } })));

  const style=document.createElement('style');
  style.textContent='.meta-functional-scope,.play-functional-scopes label{display:grid;gap:4px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#667085}.meta-functional-scope select,.play-functional-scopes select{width:100%;min-height:42px;border:1px solid #d0d5dd;border-radius:10px;background:#fff;padding:0 10px;font-size:13px;font-weight:700;color:#101828}.play-functional-scopes{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px}.meta-functional-scope[hidden],.play-functional-scopes label[hidden]{display:none!important}@media(max-width:600px){.single-source-control{display:grid!important;grid-template-columns:1fr}.play-functional-scopes{grid-template-columns:1fr}}';
  document.head.appendChild(style);
  setTimeout(syncUi,0);
})();