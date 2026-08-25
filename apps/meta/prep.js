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
    const irlDecks = window.IRLLabs?.getData?.()?.decks || [];
    if (($p('matchupSource')?.value || 'online') !== 'online') {
      for (const d of irlDecks) {
        if (!map.has(d.name)) map.set(d.name, { name: d.name, entries: 0, wins: 0, losses: 0, ties: 0 });
        const row = map.get(d.name);
        row.entries += Number(d.entries || 0);
        row.wins += Number(d.wins || 0);
        row.losses += Number(d.losses || 0);
        row.ties += Number(d.ties || 0);
      }
    }
    for (const row of map.values()) {
      const decisive = row.wins + row.losses;
      row.winRate = decisive ? 100 * row.wins / decisive : 50;
    }
    return map;
  }

  function matchupEstimate(candidate, opponent) {
    const m = window.PrepField?.getMatchup?.(candidate, opponent) || DATA?.matchups?.get(`${candidate}|||${opponent}`);
    const decisive = m ? Number(m.wins || 0) + Number(m.losses || 0) : 0;
    const games = m ? Number(m.games || decisive) : 0;
    if (!m || !decisive) return { estimate: null, games, known: false, observed: null };
    const raw = 100 * Number(m.wins || 0) / decisive;
    const mode = $p('prepEvidence')?.value || 'min10';
    if (mode === 'min10' && decisive < 10) return { estimate: null, games, known: false, observed: raw };
    if (mode === 'min5' && decisive < 5) return { estimate: null, games, known: false, observed: raw };
    if (mode === 'conservative') return { estimate: 100 * (Number(m.wins || 0) + 6) / (decisive + 12), games, known: true, observed: raw };
    return { estimate: raw, games, known: true, observed: raw };
  }

  function confidence(entries, matchupGames, coverage) {
    const score = Math.min(1, entries / 45) * 0.30 + Math.min(1, matchupGames / 100) * 0.35 + coverage * 0.35;
    if (score >= 0.72) return { label: 'High', score };
    if (score >= 0.43) return { label: 'Medium', score };
    return { label: 'Low', score };
  }

  function buildRecommendations() {
    const tournaments = eligibleTournaments();
    if (!tournaments.length) return { qualified: [], watchlist: [], allRows: [], field: [], tournaments: 0, minCoverage: 0.5 };
    const minEntries = Math.max(1, Number($p('prepMinEntries')?.value || 5));
    const minCoverage = Math.max(0, Math.min(100, Number($p('prepMinCoverage')?.value || 50))) / 100;
    const field = window.PrepField?.getField?.() || [];
    const stats = aggregateCandidateStats(tournaments);
    const allRows = [];
    if (!field.length) return { qualified: [], watchlist: [], allRows: [], field: [], tournaments: tournaments.length, minCoverage };

    for (const row of stats.values()) {
      let weightedKnownWR = 0;
      let knownShare = 0;
      let matchupGames = 0;
      let goodField = 0;
      let badField = 0;
      const keyMatchups = [];

      for (const opp of field) {
        const m = matchupEstimate(row.name, opp.name);
        if (m.known) {
          knownShare += opp.share;
          weightedKnownWR += opp.share * m.estimate;
          matchupGames += m.games;
          if (m.estimate >= 55) goodField += opp.share;
          if (m.estimate <= 45) badField += opp.share;
        }
        if (opp.share >= 0.015 || field.length <= 12) {
          keyMatchups.push({ opponent: opp.name, share: opp.share, wr: m.estimate, games: m.games, known: m.known, observed: m.observed });
        }
      }

      const expectedWR = knownShare > 0 ? weightedKnownWR / knownShare : null;
      allRows.push({
        ...row,
        expectedWR,
        knownShare,
        matchupGames,
        goodField,
        badField,
        confidence: confidence(row.entries, matchupGames, knownShare),
        keyMatchups,
        qualifies: row.entries >= minEntries && knownShare >= minCoverage && Number.isFinite(expectedWR),
      });
    }

    const qualified = allRows
      .filter(r => r.qualifies)
      .sort((a, b) => b.expectedWR - a.expectedWR || b.knownShare - a.knownShare || b.winRate - a.winRate || b.entries - a.entries);
    qualified.forEach((row, i) => row.rank = i + 1);

    const watchlist = allRows
      .filter(r => r.entries >= minEntries && !r.qualifies)
      .sort((a, b) => b.knownShare - a.knownShare || (Number.isFinite(b.expectedWR) ? b.expectedWR : -1) - (Number.isFinite(a.expectedWR) ? a.expectedWR : -1) || b.winRate - a.winRate);

    return { qualified, watchlist, allRows, field, tournaments: tournaments.length, minCoverage };
  }

  function reason(row) {
    const parts = [];
    if (row.goodField >= 0.25) parts.push(`favoured into ~${Math.round(row.goodField * 100)}% of selected field`);
    if (row.badField >= 0.20) parts.push(`unfavoured into ~${Math.round(row.badField * 100)}%`);
    if (row.knownShare < 0.75) parts.push(`${Math.round(row.knownShare * 100)}% matchup coverage`);
    return parts.length ? parts.join(' • ') : 'well-covered matchup profile against the selected field';
  }

  function evidenceLabel() {
    const mode = $p('prepEvidence')?.value || 'min10';
    if (mode === 'min10') return 'matchups under 10 games ignored';
    if (mode === 'min5') return 'matchups under 5 games ignored';
    if (mode === 'conservative') return 'small samples shrunk toward 50%';
    return 'raw matchup results used';
  }

  function displayRank(row) {
    return row.qualifies && row.rank ? `#${row.rank}` : 'Watchlist';
  }

  function renderInspect(model) {
    const select = $p('prepInspect'), target = $p('prepInspectResult');
    if (!select || !target) return;
    const previous = select.value;
    const ordered = [...model.qualified, ...model.watchlist, ...model.allRows.filter(r => !model.qualified.includes(r) && !model.watchlist.includes(r))];
    const seen = new Set();
    const unique = ordered.filter(r => !seen.has(r.name) && seen.add(r.name));
    select.innerHTML = unique.map(r => `<option value="${escapeHtml(r.name)}">${r.qualifies ? `#${r.rank}` : '—'} ${escapeHtml(r.name)}</option>`).join('');
    if (unique.some(r => r.name === previous)) select.value = previous;
    const row = unique.find(r => r.name === select.value) || unique[0];
    if (!row) { target.innerHTML = '<div class="prep-empty">No archetype data available for this field.</div>'; return; }

    const matchupRows = row.keyMatchups.slice().sort((a,b)=>b.share-a.share).map(m => {
      const source = m.known ? `${m.games} games` : m.games ? `${m.games} games — ignored` : 'no qualifying sample';
      return `<tr><td><b>${escapeHtml(m.opponent)}</b></td><td>${pct(m.share * 100)}</td><td>${m.known ? pct(m.wr) : '—'}</td><td>${escapeHtml(source)}</td></tr>`;
    }).join('');
    const threshold = Math.round(model.minCoverage * 100);
    const verdict = row.qualifies ? `Qualified for ranking • ${row.confidence.label} confidence` : `Below ${threshold}% coverage threshold • insufficient evidence for main ranking`;
    target.innerHTML = `<div class="inspect-metrics"><div class="metric"><b>${displayRank(row)}</b><span>Recommendation status</span></div><div class="metric"><b>${pct(row.expectedWR)}</b><span>Matchup WR on covered field</span></div><div class="metric"><b>${pct(row.winRate)}</b><span>Overall WR</span></div><div class="metric"><b>${pct(row.knownShare * 100)}</b><span>Matchup coverage</span></div></div><div class="inspect-note"><b>${escapeHtml(row.name)}</b> • ${row.entries} observed entries • ${escapeHtml(verdict)} • ${escapeHtml(window.PrepField?.sourceLabel?.() || '')}</div><div class="tablewrap"><table><thead><tr><th>Opponent</th><th>Your field</th><th>Used matchup WR</th><th>Evidence</th></tr></thead><tbody>${matchupRows}</tbody></table></div>`;
  }

  function bindFieldChips() {
    $p('prepSummary')?.querySelectorAll('.field-chip[data-field-toggle]').forEach(chip => chip.addEventListener('click', () => window.PrepField?.toggle?.(chip.dataset.fieldToggle)));
    $p('prepSummary')?.querySelector('[data-field-reset]')?.addEventListener('click', () => window.PrepField?.reset?.());
  }

  function fieldPanel(originalCoverage) {
    const chips = window.PrepField?.getChipRows?.() || [];
    return `<div class="prep-field"><div class="prep-field-head"><span>Your expected field · active decks = 100% · ${pct(originalCoverage * 100)} original meta coverage</span><button type="button" class="btn field-reset-btn" data-field-reset>Reset field</button></div><div class="field-chip-list">${chips.map(x => `<button type="button" class="field-chip ${x.included ? '' : 'excluded'}" data-field-toggle="${escapeHtml(x.name)}" aria-pressed="${x.included ? 'true' : 'false'}"><b>${escapeHtml(x.name)}</b><small>${x.included ? pct(x.share * 100) : 'Off'}</small><span>${x.included ? '×' : '+'}</span></button>`).join('')}</div></div>`;
  }

  function renderPrep() {
    const target = $p('prepResults');
    if (!target) return;
    window.PrepField?.render?.();
    if (!CACHE?.tournaments?.length || CACHE.format !== 'TEF-PBL') { target.innerHTML = '<div class="prep-empty">Load the current TEF–PBL data to generate tournament recommendations.</div>'; return; }
    const model = buildRecommendations();
    const { qualified, watchlist, field } = model;
    const originalCoverage = Math.max(0, Math.min(1, Number(window.PrepField?.getOriginalCoverage?.() || 0)));

    if (!field.length) {
      $p('prepSummary').innerHTML = `<div class="prep-callout empty-callout"><span>EXPECTED FIELD</span><b>No decks selected</b><em>Tap a dimmed chip to add it back, or reset the field.</em></div>${fieldPanel(originalCoverage)}`;
      bindFieldChips();
      target.innerHTML = '<div class="prep-empty">No decks are selected in your expected metagame.</div>';
      renderInspect(model); return;
    }

    const date = $p('prepDate')?.value;
    const dateLabel = date ? new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday:'short', day:'numeric', month:'short' }) : 'upcoming event';

    const topCallout = qualified.length
      ? `<div class="prep-callout"><span>BEST POSITIONED FOR ${dateLabel.toUpperCase()}</span><b>${escapeHtml(qualified[0].name)}</b><strong>${pct(qualified[0].expectedWR)} matchup-weighted WR</strong><em>${pct(qualified[0].knownShare * 100)} matchup coverage • ${qualified[0].confidence.label.toLowerCase()} confidence</em></div>`
      : `<div class="prep-callout empty-callout"><span>RECOMMENDATION</span><b>Not enough matchup evidence</b><em>No deck currently meets the ${Math.round(model.minCoverage * 100)}% coverage threshold.</em></div>`;

    $p('prepSummary').innerHTML = `${topCallout}${fieldPanel(originalCoverage)}`;
    bindFieldChips();

    const mainRows = qualified.slice(0, 10);
    const mainTable = mainRows.length
      ? `<div class="tablewrap"><table class="prep-table"><thead><tr><th>#</th><th>Deck</th><th>Expected WR</th><th>Overall WR</th><th>Entries</th><th>Matchup coverage</th><th>Confidence</th><th>Why</th></tr></thead><tbody>${mainRows.map(r => `<tr class="prep-row ${r === mainRows[0] ? 'prep-winner' : ''}" data-deck="${escapeHtml(r.name)}"><td>${r.rank}</td><td><b>${escapeHtml(r.name)}</b></td><td class="prep-expected"><b>${pct(r.expectedWR)}</b></td><td>${pct(r.winRate)}</td><td>${r.entries}</td><td>${pct(r.knownShare * 100)}</td><td><span class="confidence confidence-${r.confidence.label.toLowerCase()}">${r.confidence.label}</span></td><td class="prep-reason">${escapeHtml(reason(r))}</td></tr>`).join('')}</tbody></table></div>`
      : `<div class="prep-empty">No archetype meets the current ${Math.round(model.minCoverage * 100)}% matchup-coverage threshold.</div>`;

    const watchRows = watchlist.slice(0, 12);
    const watchTable = watchRows.length
      ? `<div class="watchlist-block"><div class="sectionhead"><div><div class="eyebrow">INSUFFICIENT EVIDENCE</div><h3>Watchlist</h3></div><span class="muted">Not included in the ranking</span></div><div class="tablewrap"><table><thead><tr><th>Deck</th><th>Partial matchup WR</th><th>Coverage</th><th>Overall WR</th><th>Entries</th></tr></thead><tbody>${watchRows.map(r => `<tr><td><b>${escapeHtml(r.name)}</b></td><td>${pct(r.expectedWR)}</td><td>${pct(r.knownShare * 100)}</td><td>${pct(r.winRate)}</td><td>${r.entries}</td></tr>`).join('')}</tbody></table></div></div>`
      : '';

    target.innerHTML = `<div class="prep-table-note">${escapeHtml(window.PrepField?.sourceLabel?.() || '')} • ${escapeHtml(evidenceLabel())} • minimum ranking coverage ${Math.round(model.minCoverage * 100)}%. Expected WR uses qualifying matchup data only.</div>${mainTable}${watchTable}<p class="prep-method">Your selected field is always renormalised to 100% after decks are added or removed. Expected WR is calculated only across the portion of that field with qualifying matchup evidence; Matchup Coverage shows how much of your selected field is represented. Overall WR is supporting context only and does not fill missing matchups.</p>`;
    target.querySelectorAll('.prep-row').forEach(row => row.addEventListener('click', () => openArchetype(row.dataset.deck)));
    renderInspect(model);
  }

  function activate() { renderPrep(); window.MetaLive?.loadMatchupPairings?.().then(renderPrep); }
  function handleMetaUpdated() {
    renderPrep();
    const prepIsActive = document.querySelector('[data-tab="prep"]')?.classList.contains('active');
    if (prepIsActive && !autoMatchupsRequested && CACHE?.format === 'TEF-PBL' && CACHE?.tournaments?.length && !(DATA?.matches > 0)) { autoMatchupsRequested = true; window.MetaLive?.loadMatchupPairings?.().then(renderPrep); }
  }

  initDate();
  $p('prepRun')?.addEventListener('click', activate);
  $p('prepRecency')?.addEventListener('change', renderPrep);
  $p('prepEvidence')?.addEventListener('change', renderPrep);
  $p('prepMinCoverage')?.addEventListener('change', renderPrep);
  $p('prepMinEntries')?.addEventListener('change', renderPrep);
  $p('prepDate')?.addEventListener('change', renderPrep);
  $p('prepInspect')?.addEventListener('change', () => renderInspect(buildRecommendations()));
  document.querySelector('[data-tab="prep"]')?.addEventListener('click', activate);
  window.addEventListener('meta:updated', handleMetaUpdated);
  window.addEventListener('field:updated', renderPrep);
  window.addEventListener('irl:updated', renderPrep);
})();