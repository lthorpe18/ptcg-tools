(() => {
  const $p = id => document.getElementById(id);
  const pct = n => Number.isFinite(n) ? `${n.toFixed(1)}%` : '—';
  let autoMatchupsRequested = false;

  function initDate() {
    const el = $p('prepDate');
    if (!el || el.value) return;
    const d = new Date();
    d.setDate(d.getDate() + 7);
    el.value = d.toISOString().slice(0, 10);
  }

  function arch(standing) { return standing?.deck?.name || 'Unknown'; }

  function eligibleTournaments() {
    if (!CACHE?.tournaments?.length || CACHE.format !== 'TEF-PBL') return [];
    const minPlayers = Math.max(50, Number($('minPlayers')?.value || 50));
    return CACHE.tournaments.filter(t => Number(t.players || 0) >= minPlayers && (t.standings || []).length);
  }

  function recencyWeight(date, mode, newestTs) {
    if (mode === 'equal') return 1;
    const ageDays = Math.max(0, (newestTs - new Date(date).getTime()) / 86400000);
    const halfLife = mode === 'high' ? 7 : 18;
    return Math.pow(0.5, ageDays / halfLife);
  }

  function fieldModel(tournaments, mode) {
    const newest = Math.max(...tournaments.map(t => new Date(t.date).getTime()).filter(Number.isFinite));
    const counts = new Map();
    let total = 0;
    for (const t of tournaments) {
      const w = recencyWeight(t.date, mode, newest);
      for (const s of t.standings || []) {
        const name = arch(s);
        if (name === 'Unknown') continue;
        counts.set(name, (counts.get(name) || 0) + w);
        total += w;
      }
    }
    return [...counts.entries()]
      .map(([name, value]) => ({ name, share: total ? value / total : 0 }))
      .sort((a, b) => b.share - a.share);
  }

  function aggregateCandidateStats(tournaments) {
    const map = new Map();
    for (const t of tournaments) {
      for (const s of t.standings || []) {
        const name = arch(s);
        if (name === 'Unknown') continue;
        if (!map.has(name)) map.set(name, { name, entries: 0, wins: 0, losses: 0, ties: 0 });
        const row = map.get(name);
        row.entries++;
        row.wins += Number(s.record?.wins || 0);
        row.losses += Number(s.record?.losses || 0);
        row.ties += Number(s.record?.ties || 0);
      }
    }
    for (const row of map.values()) {
      const decisive = row.wins + row.losses;
      row.winRate = decisive ? 100 * row.wins / decisive : 50;
      row.adjustedWR = 100 * (row.wins + 10) / (decisive + 20);
    }
    return map;
  }

  function matchupEstimate(candidate, opponent, fallback) {
    const m = DATA?.matchups?.get(`${candidate}|||${opponent}`);
    if (!m) return { estimate: fallback, games: 0, known: false };
    const decisive = Number(m.wins || 0) + Number(m.losses || 0);
    if (!decisive) return { estimate: fallback, games: Number(m.games || 0), known: false };
    const estimate = 100 * (Number(m.wins || 0) + 6) / (decisive + 12);
    return { estimate, games: Number(m.games || decisive), known: true };
  }

  function confidence(entries, matchupGames, coverage) {
    const score = Math.min(1, entries / 45) * 0.45 + Math.min(1, matchupGames / 80) * 0.35 + coverage * 0.20;
    if (score >= 0.72) return { label: 'High', score };
    if (score >= 0.43) return { label: 'Medium', score };
    return { label: 'Low', score };
  }

  function buildRecommendations() {
    const tournaments = eligibleTournaments();
    if (!tournaments.length) return { rows: [], field: [], tournaments: 0 };
    const mode = $p('prepRecency')?.value || 'balanced';
    const minEntries = Math.max(1, Number($p('prepMinEntries')?.value || 5));
    const field = fieldModel(tournaments, mode);
    const stats = aggregateCandidateStats(tournaments);
    const rows = [];

    for (const row of stats.values()) {
      if (row.entries < minEntries) continue;
      let expectedWR = 0;
      let knownShare = 0;
      let matchupGames = 0;
      let goodField = 0;
      let badField = 0;

      for (const opp of field) {
        const m = matchupEstimate(row.name, opp.name, row.adjustedWR);
        expectedWR += opp.share * m.estimate;
        if (m.known) {
          knownShare += opp.share;
          matchupGames += m.games;
          if (m.estimate >= 55) goodField += opp.share;
          if (m.estimate <= 45) badField += opp.share;
        }
      }

      rows.push({ ...row, expectedWR, knownShare, matchupGames, goodField, badField, confidence: confidence(row.entries, matchupGames, knownShare) });
    }

    rows.sort((a, b) => b.expectedWR - a.expectedWR || b.confidence.score - a.confidence.score || b.entries - a.entries);
    return { rows, field, tournaments: tournaments.length };
  }

  function reason(row) {
    const parts = [];
    if (row.goodField >= 0.25) parts.push(`favoured into ~${Math.round(row.goodField * 100)}% of known field`);
    if (row.badField >= 0.20) parts.push(`unfavoured into ~${Math.round(row.badField * 100)}%`);
    if (row.adjustedWR >= 54) parts.push('strong overall results');
    else if (row.adjustedWR < 49) parts.push('weak overall results');
    if (row.knownShare < 0.35) parts.push('limited matchup coverage');
    return parts.length ? parts.join(' • ') : 'balanced profile against the observed field';
  }

  function renderPrep() {
    const target = $p('prepResults');
    if (!target) return;
    if (!CACHE?.tournaments?.length || CACHE.format !== 'TEF-PBL') {
      target.innerHTML = '<div class="prep-empty">Load the current TEF–PBL data to generate tournament recommendations.</div>';
      return;
    }

    const { rows, field, tournaments } = buildRecommendations();
    if (!rows.length) {
      target.innerHTML = '<div class="prep-empty">No archetypes meet the candidate sample threshold.</div>';
      return;
    }

    const top = rows.slice(0, 10);
    const fieldTop = field.slice(0, 8);
    const matchupReady = (DATA?.matches || 0) > 0;
    const date = $p('prepDate')?.value;
    const dateLabel = date ? new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday:'short', day:'numeric', month:'short' }) : 'upcoming event';

    $p('prepSummary').innerHTML = `
      <div class="prep-callout"><span>TOP PICK FOR ${dateLabel.toUpperCase()}</span><b>${escapeHtml(top[0].name)}</b><strong>${pct(top[0].expectedWR)} expected win rate</strong><em>${top[0].confidence.label.toLowerCase()} confidence • ${top[0].entries} observed entries</em></div>
      <div class="prep-field"><span>Expected field</span>${fieldTop.map(x => `<i><b>${escapeHtml(x.name)}</b> ${pct(x.share * 100)}</i>`).join('')}</div>`;

    target.innerHTML = `<div class="prep-table-note">Based on ${tournaments} recent 50+ player tournaments. ${matchupReady ? 'Observed matchup data is included.' : 'Matchup data is loading; estimates currently fall back more heavily on each deck’s overall results.'}</div>
      <div class="tablewrap"><table class="prep-table"><thead><tr><th>#</th><th>Deck</th><th>Expected WR</th><th>Overall WR</th><th>Entries</th><th>Matchup coverage</th><th>Confidence</th><th>Why</th></tr></thead><tbody>
      ${top.map((r, i) => `<tr class="prep-row ${i === 0 ? 'prep-winner' : ''}" data-deck="${escapeHtml(r.name)}"><td>${i + 1}</td><td><b>${escapeHtml(r.name)}</b></td><td class="prep-expected"><b>${pct(r.expectedWR)}</b></td><td>${pct(r.winRate)}</td><td>${r.entries}</td><td>${pct(r.knownShare * 100)}</td><td><span class="confidence confidence-${r.confidence.label.toLowerCase()}">${r.confidence.label}</span></td><td class="prep-reason">${escapeHtml(reason(r))}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="prep-method">Expected WR is the deck’s estimated win rate against the current expected field. Head-to-head results are shrunk toward 50% to control small samples; where matchup evidence is missing, the model falls back to that deck’s conservatively adjusted overall win rate. Click a deck to inspect its archetype page.</p>`;

    target.querySelectorAll('.prep-row').forEach(row => row.addEventListener('click', () => openArchetype(row.dataset.deck)));
  }

  function activate() {
    renderPrep();
    window.MetaLive?.loadMatchupPairings?.().then(renderPrep);
  }

  function handleMetaUpdated() {
    renderPrep();
    const prepIsActive = document.querySelector('[data-tab="prep"]')?.classList.contains('active');
    if (prepIsActive && !autoMatchupsRequested && CACHE?.format === 'TEF-PBL' && CACHE?.tournaments?.length && !(DATA?.matches > 0)) {
      autoMatchupsRequested = true;
      window.MetaLive?.loadMatchupPairings?.().then(renderPrep);
    }
  }

  initDate();
  $p('prepRun')?.addEventListener('click', activate);
  $p('prepRecency')?.addEventListener('change', renderPrep);
  $p('prepMinEntries')?.addEventListener('change', renderPrep);
  $p('prepDate')?.addEventListener('change', renderPrep);
  document.querySelector('[data-tab="prep"]')?.addEventListener('click', activate);
  window.addEventListener('meta:updated', handleMetaUpdated);
})();
