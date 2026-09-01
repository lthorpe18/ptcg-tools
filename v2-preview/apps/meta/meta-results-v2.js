(() => {
  'use strict';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeUrl = value => {
    try {
      const url = new URL(String(value || ''), location.href);
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch { return ''; }
  };

  function currentDeck() {
    const detail = document.getElementById('deckDetail');
    if (!detail || detail.classList.contains('hidden')) return null;
    const name = detail.querySelector('#deckDetailHead h1')?.textContent?.trim();
    if (!name) return null;
    const source = detail.querySelector('[data-detail-source].active')?.dataset.detailSource === 'irl' ? 'irl' : 'online';
    return { detail, name, source };
  }

  function selectedEventIdentity(data) {
    return {
      ids: new Set((data?.events || []).map(e => String(e.id ?? '')).filter(Boolean)),
      names: new Set((data?.events || []).map(e => String(e.name || '')).filter(Boolean)),
    };
  }

  function inSelectedScope(row, identity) {
    const eventId = row?.eventId ?? row?.tournamentId ?? row?.id;
    if (eventId != null && identity.ids.size) return identity.ids.has(String(eventId));
    if (identity.names.size && row?.tournament) return identity.names.has(String(row.tournament));
    return !identity.ids.size && !identity.names.size;
  }

  function rowsFor(source, name) {
    const data = window.MetaData?.data?.(source) || { events:[], results:[] };
    const identity = selectedEventIdentity(data);
    return (Array.isArray(data.results) ? data.results : [])
      .filter(r => r?.archetype === name)
      .filter(r => inSelectedScope(r, identity))
      .filter(r => Number.isFinite(Number(r?.placing)) && Number(r.placing) > 0)
      .sort((a,b) => Number(a.placing) - Number(b.placing) || new Date(b.date || 0) - new Date(a.date || 0) || String(a.player || '').localeCompare(String(b.player || '')))
      .slice(0, 20);
  }

  function resultRow(row, source) {
    const record = row.record || {};
    const recordText = `${Number(record.wins || 0)}-${Number(record.losses || 0)}-${Number(record.ties || 0)}`;
    const placing = Number(row.placing || 0);
    const players = Number(row.players || 0);
    const placement = players ? `${placing}/${players}` : `#${placing}`;
    const href = source === 'irl' ? safeUrl(row.decklistUrl || row.sourceUrl) : '';
    const linkText = row.decklistUrl ? 'Decklist ↗' : (href ? 'Limitless ↗' : '');
    const body = `<b>${esc(placement)}</b><span>${esc(row.player || 'Unknown player')}</span><small>${esc(row.tournament || '')}${row.tournament ? ' · ' : ''}${esc(recordText)}</small>${linkText ? `<em>${esc(linkText)}</em>` : ''}`;
    return href
      ? `<a class="result-card result-card-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${body}</a>`
      : `<div class="result-card">${body}</div>`;
  }

  function removeLegacyResults(detail) {
    detail.querySelectorAll('.detail-section').forEach(section => {
      if (section.id === 'deckRecentResults') return;
      if (section.querySelector('h2')?.textContent?.trim() === 'Recent results') section.remove();
    });
  }

  function render() {
    const current = currentDeck();
    if (!current) return;
    const { detail, name, source } = current;
    const body = detail.querySelector('#deckDetailBody');
    if (!body) return;

    removeLegacyResults(detail);
    body.querySelector('#deckRecentResults')?.remove();

    const rows = rowsFor(source, name);
    if (!rows.length) return;

    const context = window.MetaData?.context?.(source) || {};
    const section = document.createElement('section');
    section.id = 'deckRecentResults';
    section.className = 'detail-section deck-recent-results';
    section.innerHTML = `<div class="section-row"><h2>Recent results</h2><span>${esc(context.label || (source === 'irl' ? 'Selected IRL scope' : 'Selected online scope'))} · sorted by placement</span></div><div class="result-card-list">${rows.map(r => resultRow(r, source)).join('')}</div>`;
    body.appendChild(section);
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; render(); }, 0);
  }

  const observer = new MutationObserver(mutations => {
    if (mutations.some(m => m.target?.closest?.('#deckDetail') || m.addedNodes?.length)) schedule();
  });
  observer.observe(document.documentElement, { childList:true, subtree:true });

  window.addEventListener('meta:data-changed', schedule);
  window.addEventListener('irl:updated', schedule);
  window.addEventListener('deckagg:updated', schedule);
  document.addEventListener('click', event => {
    if (event.target.closest('[data-detail-source], [data-explore-deck]')) setTimeout(schedule, 0);
  });

  schedule();
})();
