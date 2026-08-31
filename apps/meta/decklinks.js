(() => {
  const originalRenderArchetype = window.renderArchetype || renderArchetype;

  function loadMetaOverviewTable() {
    if (!document.querySelector('link[data-meta-table-styles]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'meta-table.css?v=1';
      link.dataset.metaTableStyles = '1';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-meta-table-script]')) {
      const script = document.createElement('script');
      script.src = 'meta-table.js?v=1';
      script.dataset.metaTableScript = '1';
      document.body.appendChild(script);
    }
  }

  function decklistUrl(tournamentId, playerId) {
    return `https://play.limitlesstcg.com/tournament/${encodeURIComponent(tournamentId)}/player/${encodeURIComponent(playerId)}/decklist`;
  }

  function recordsUrl(name) {
    const deck = window.DeckAggregate?.getDeck?.(name);
    if (!deck?.slug) return '';
    const data = window.DeckAggregate?.getData?.() || {};
    const rotation = encodeURIComponent(data.rotation || 2026);
    const set = encodeURIComponent(data.set || 'PBL');
    return `https://play.limitlesstcg.com/decks/${encodeURIComponent(deck.slug)}?format=standard&rotation=${rotation}&set=${set}`;
  }

  function ensureRecommendationStyles() {
    if (document.getElementById('recommendation-record-link-styles')) return;
    const style = document.createElement('style');
    style.id = 'recommendation-record-link-styles';
    style.textContent = `
      .rec-record-link{display:inline-flex;align-items:center;min-height:24px;padding:2px 7px;border:1px solid #dbe4ee;border-radius:999px;background:#fff;color:#155eef!important;font-size:9px!important;font-weight:800!important;text-decoration:none;line-height:1;white-space:nowrap;transition:.14s ease}
      .rec-record-link:hover,.rec-record-link:focus{border-color:#84adff;background:#f5f8ff;color:#004eeb!important;outline:none}
      .winner .rec-record-link{border-color:#a6f4c5;background:#f6fef9;color:#067647!important}
      @media(max-width:760px){.rec-record-link{min-height:28px;padding:4px 8px;font-size:10px!important}}
    `;
    document.head.appendChild(style);
  }

  function addRecommendationRecordLinks(root = document) {
    ensureRecommendationStyles();
    root.querySelectorAll?.('.recommendation-card').forEach(card => {
      if (card.dataset.recordsLinked === '1') return;
      const name = card.querySelector('.rec-main h3')?.textContent?.trim();
      const meta = card.querySelector('.rec-meta');
      const url = name ? recordsUrl(name) : '';
      if (!name || !meta || !url) return;
      const link = document.createElement('a');
      link.className = 'rec-record-link';
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Records ↗';
      link.setAttribute('aria-label', `View ${name} records on Limitless`);
      meta.appendChild(link);
      card.dataset.recordsLinked = '1';
    });
  }

  function renderDecklistResults(name) {
    const target = document.getElementById('archResults');
    if (!target || !Array.isArray(FILTERED_TOURNAMENTS)) return;

    const rows = [];
    for (const tournament of FILTERED_TOURNAMENTS) {
      for (const standing of tournament.standings || []) {
        if ((standing?.deck?.name || 'Unknown') !== name) continue;
        const placing = Number(standing.placing);
        if (standing.placing == null || !Number.isFinite(placing) || placing <= 0) continue;
        rows.push({
          placing,
          player: standing.name || standing.player,
          playerId: standing.player,
          tournament: tournament.name,
          tournamentId: tournament.id,
          date: tournament.date,
          players: tournament.players,
          record: standing.record,
          hasDecklist: !!standing.decklist,
        });
      }
    }

    rows.sort((a, b) => a.placing - b.placing || new Date(b.date) - new Date(a.date));
    const top = rows.slice(0, 20);
    target.innerHTML = '<table><thead><tr><th>Place</th><th>Player</th><th>Event</th><th>Record</th><th>Decklist</th></tr></thead><tbody>' +
      top.map(r => {
        const link = r.hasDecklist && r.tournamentId && r.playerId
          ? `<a class="decklist-link" href="${decklistUrl(r.tournamentId, r.playerId)}" target="_blank" rel="noopener">View decklist ↗</a>`
          : '—';
        return `<tr><td>${r.placing}/${r.players}</td><td>${escapeHtml(r.player)}</td><td>${escapeHtml(r.tournament)}</td><td>${r.record?.wins || 0}-${r.record?.losses || 0}-${r.record?.ties || 0}</td><td>${link}</td></tr>`;
      }).join('') + '</tbody></table>';
  }

  window.renderArchetype = function(name) {
    originalRenderArchetype(name);
    renderDecklistResults(name);
  };

  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches?.('.recommendation-card')) addRecommendationRecordLinks(node.parentElement || document);
        else if (node.querySelector?.('.recommendation-card')) addRecommendationRecordLinks(node);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('deckagg:updated', () => addRecommendationRecordLinks());
  window.addEventListener('field:updated', () => requestAnimationFrame(() => addRecommendationRecordLinks()));
  window.addEventListener('meta:updated', () => requestAnimationFrame(() => addRecommendationRecordLinks()));
  loadMetaOverviewTable();
  addRecommendationRecordLinks();

  if (!document.querySelector('script[data-meta-consistency-v3]')) {
    const script = document.createElement('script');
    script.src = 'meta-consistency-v3.js?v=1';
    script.dataset.metaConsistencyV3 = '1';
    document.body.appendChild(script);
  }
})();
