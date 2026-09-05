(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function card(context) {
    return `<div class="meta-source-context"><div><b>${Number(context.events || 0).toLocaleString()}</b><span>${esc(context.eventsLabel || 'Events')}</span></div><div><b>${Number(context.entries || 0).toLocaleString()}</b><span>${esc(context.entriesLabel || 'Entries')}</span></div><div class="context-wide"><b>${esc(context.label || '')}</b><span>${esc(context.detail || '')}</span></div></div>`;
  }

  function ensureAfter(anchor, id) {
    if (!anchor) return null;
    let node = $(id);
    if (!node) {
      node = document.createElement('div');
      node.id = id;
      node.className = 'meta-context-slot';
      anchor.after(node);
    }
    return node;
  }

  function combinedContext(kind) {
    const online = window.MetaData.context('online');
    const irl = window.MetaData.context('irl');
    return {
      events: Number(online.events || 0) + Number(irl.events || 0),
      entries: Number(online.entries || 0) + Number(irl.entries || 0),
      label: kind === 'field' ? 'Online + IRL expected field' : 'Online + IRL matchup evidence',
      detail: `${online.label} · ${irl.label}`,
    };
  }

  function renderSingle(selectId, slotId) {
    const select = $(selectId), slot = $(slotId);
    if (!select || !slot) return;
    slot.innerHTML = card(window.MetaData.context(select.value === 'irl' ? 'irl' : 'online'));
  }

  function renderPrep() {
    if ($('prep')?.classList.contains('hidden')) return;
    const fieldSlot = $('playFieldContext');
    const matchupSlot = $('playMatchupContext');
    if (!fieldSlot || !matchupSlot) return;
    const field = $('playFieldSource')?.value || 'online';
    const matchup = $('playMatchupSource')?.value || 'online';
    const fieldContext = field === 'irl'
      ? window.MetaData.context('irl')
      : field === 'blend'
        ? combinedContext('field')
        : field === 'custom'
          ? { events:0, entries:0, label:'Custom / saved meta', detail:'Your editable expected-field composition' }
          : window.MetaData.context('online');
    const matchupContext = matchup === 'irl'
      ? window.MetaData.context('irl')
      : matchup === 'combined'
        ? combinedContext('matchup')
        : window.MetaData.context('online');
    fieldSlot.innerHTML = card(fieldContext);
    matchupSlot.innerHTML = card(matchupContext);
  }

  function clearDetailContext() {
    $('deckDetailSourceContext')?.remove();
  }

  function renderVisible() {
    if (!$('matchups')?.classList.contains('hidden')) {
      ensureAfter($('matchupPageSource')?.closest('.single-source-control'), 'matchupSourceContext');
      renderSingle('matchupPageSource', 'matchupSourceContext');
    }
    if (!$('decks')?.classList.contains('hidden')) {
      ensureAfter($('deckPageSource')?.closest('.single-source-control'), 'deckSourceContext');
      renderSingle('deckPageSource', 'deckSourceContext');
    }
    renderPrep();
    clearDetailContext();
  }

  $('matchupPageSource')?.addEventListener('change', renderVisible);
  $('deckPageSource')?.addEventListener('change', renderVisible);
  $('playFieldSource')?.addEventListener('change', renderPrep);
  $('playMatchupSource')?.addEventListener('change', renderPrep);
  window.addEventListener('meta:data-changed', renderVisible);
  document.addEventListener('click', e => {
    if (e.target.closest('[data-meta-route],[data-explore-deck],[data-detail-source]')) setTimeout(renderVisible, 0);
  });

  window.MetaContext = { render: renderVisible, renderPrep };
  setTimeout(renderVisible, 0);
})();
