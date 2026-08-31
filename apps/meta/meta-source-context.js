(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = n => Number.isFinite(Number(n)) ? Number(n).toLocaleString() : '—';
  const formatDate = value => {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d.toLocaleDateString([], { day:'numeric', month:'short' }) : '';
  };
  const updated = value => {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? `Updated ${d.toLocaleString([], { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}` : '';
  };

  function card(events, entries, label, detail, extraClass='') {
    return `<div class="meta-source-context ${extraClass}"><div><b>${esc(fmt(events))}</b><span>Events</span></div><div><b>${esc(fmt(entries))}</b><span>Entries</span></div><div class="context-wide"><b>${esc(label)}</b><span>${esc(detail || '')}</span></div></div>`;
  }
  function combinedCard(text, detail='') {
    return `<div class="meta-source-context context-combined"><div><b>${esc(text)}</b><span>${esc(detail)}</span></div></div>`;
  }

  function irlContext() {
    const scopeApi = window.MetaIRLScope;
    const raw = scopeApi?.raw?.() || window.IRLLabs?.getRawData?.() || window.IRLLabs?.getData?.() || {};
    const events = scopeApi?.selectedEvents?.(raw) || [];
    const decks = scopeApi?.selectedDecks?.(raw) || window.IRLLabs?.getData?.()?.decks || [];
    const entries = decks.reduce((sum,d)=>sum+Number(d.entries||0),0);
    const scope = scopeApi?.get?.() || 'latest-weekend';
    let label = 'IRL majors';
    if (scope === 'latest-weekend') label = events.length === 1 ? (events[0]?.name || 'Latest IRL major') : 'Multiple major events';
    else if (scope === 'all-irl') label = 'All IRL majors this format';
    else if (scope.startsWith('event:')) label = events[0]?.name || 'IRL tournament';
    const dates = events.map(e=>new Date(e.date)).filter(d=>Number.isFinite(d.getTime()));
    let dateText = '';
    if (dates.length) {
      const min = new Date(Math.min(...dates)), max = new Date(Math.max(...dates));
      dateText = formatDate(min);
      if (min.toDateString() !== max.toDateString()) dateText += `–${formatDate(max)}`;
    }
    const detail = [dateText, updated(raw.generatedAt || raw.updatedAt)].filter(Boolean).join(' · ');
    return { events:events.length, entries, label, detail };
  }

  function onlineAggregateContext(kind='field') {
    const data = window.DeckAggregate?.getData?.() || {};
    const overview = data.overview || {};
    const label = kind === 'matchups' ? 'All TEF–PBL online matchups' : 'All TEF–PBL online data';
    return {
      events: Number(overview.tournaments || 0),
      entries: Number(overview.players || 0),
      label,
      detail: updated(data.generatedAt)
    };
  }

  function liveFieldContext() {
    const minPlayers = Math.max(50, Number($('prepMinPlayers')?.value || 50));
    const tournaments = (typeof CACHE !== 'undefined' && Array.isArray(CACHE?.tournaments))
      ? CACHE.tournaments.filter(t=>Number(t.players||0)>=minPlayers && Array.isArray(t.standings) && t.standings.length)
      : [];
    const entries = tournaments.reduce((sum,t)=>sum+(t.standings?.length||0),0);
    const mode = $('prepRecency')?.value || 'balanced';
    const modeLabel = { high:'High recency weighting', balanced:'Balanced recency weighting', equal:'Whole-format equal weighting' }[mode] || 'Recency weighted';
    return { events:tournaments.length, entries, label:`${minPlayers}+ online field`, detail:modeLabel };
  }

  function renderInto(id, context) {
    const el=$(id); if(!el) return;
    el.innerHTML=card(context.events,context.entries,context.label,context.detail);
  }

  function renderMatchups() {
    const source=$('matchupPageSource')?.value || 'online';
    renderInto('matchupSourceContext', source==='irl' ? irlContext() : onlineAggregateContext('matchups'));
  }
  function renderDecks() {
    const source=$('deckPageSource')?.value || 'online';
    renderInto('deckSourceContext', source==='irl' ? irlContext() : onlineAggregateContext('field'));
  }
  function renderPlay() {
    const field=$('playFieldSource')?.value || 'online';
    const matchups=$('playMatchupSource')?.value || 'online';
    const fieldEl=$('playFieldSourceContext');
    if(fieldEl) {
      if(field==='online') fieldEl.innerHTML=card(...Object.values(liveFieldContext()).slice(0,4));
      else if(field==='irl') { const c=irlContext(); fieldEl.innerHTML=card(c.events,c.entries,c.label,c.detail); }
      else if(field==='blend') {
        const o=liveFieldContext(), i=irlContext();
        fieldEl.innerHTML=combinedCard(`Online ${fmt(o.events)} events / ${fmt(o.entries)} entries + IRL ${fmt(i.events)} events / ${fmt(i.entries)} entries`, 'Blended expected field');
      } else fieldEl.innerHTML=combinedCard('Custom / saved meta', 'Your editable expected-field composition');
    }
    const matchupEl=$('playMatchupSourceContext');
    if(matchupEl) {
      if(matchups==='online') { const c=onlineAggregateContext('matchups'); matchupEl.innerHTML=card(c.events,c.entries,c.label,c.detail); }
      else if(matchups==='irl') { const c=irlContext(); matchupEl.innerHTML=card(c.events,c.entries,c.label,c.detail); }
      else {
        const o=onlineAggregateContext('matchups'), i=irlContext();
        matchupEl.innerHTML=combinedCard(`Online ${fmt(o.events)} events / ${fmt(o.entries)} entries + IRL ${fmt(i.events)} events / ${fmt(i.entries)} entries`, 'Combined matchup evidence');
      }
    }
  }
  function renderDetail() {
    const el=$('deckDetailSourceContext'); if(!el) return;
    const active=document.querySelector('[data-detail-source].active')?.dataset.detailSource || 'online';
    const c=active==='irl' ? irlContext() : onlineAggregateContext('field');
    el.innerHTML=card(c.events,c.entries,c.label,c.detail);
  }
  function renderAll() { renderMatchups(); renderDecks(); renderPlay(); renderDetail(); }

  ['matchupPageSource','deckPageSource','playFieldSource','playMatchupSource','prepRecency','prepMinPlayers'].forEach(id=>$(id)?.addEventListener('change',()=>setTimeout(renderAll,0)));
  window.addEventListener('deckagg:updated',()=>setTimeout(renderAll,0));
  window.addEventListener('irl:updated',()=>setTimeout(renderAll,0));
  window.addEventListener('meta-irl-scope:changed',()=>setTimeout(renderAll,0));
  window.addEventListener('field:updated',()=>setTimeout(renderPlay,0));
  document.addEventListener('click',event=>{ if(event.target.closest('[data-detail-source],[data-meta-view]')) setTimeout(renderAll,0); },true);
  window.MetaSourceContext={renderAll,irlContext,onlineAggregateContext,liveFieldContext};
  setTimeout(renderAll,0);
})();