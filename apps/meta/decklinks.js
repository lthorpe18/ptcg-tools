(() => {
  const originalRenderArchetype = window.renderArchetype || renderArchetype;

  function decklistUrl(tournamentId, playerId) {
    return `https://play.limitlesstcg.com/tournament/${encodeURIComponent(tournamentId)}/player/${encodeURIComponent(playerId)}/decklist`;
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
})();
