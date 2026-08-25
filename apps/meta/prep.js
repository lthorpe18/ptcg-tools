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
      row.adjustedWR = 100 * (row.wins + 10) / (decisive + 20);
    }
    return map;
  }

  function matchupEstimate(candidate, opponent, fallback) {
    const m = window.PrepField?.getMatchup?.(candidate, opponent) || DATA?.matchups?.get(`${candidate}|||${opponent}`);
    const decisive = m ? Number(m.wins || 0) + Number(m.losses || 0) : 0;
    const games = m ? Number(m.games || decisive) : 0;
    if (!m || !decisive) return { estimate: fallback, games, known: false, observed: null };
    const raw = 100 * Number(m.wins || 0) / decisive;
    const mode = $p('prepEvidence')?.value || 'min10';
    if (mode === 'min10' && decisive < 10) return { estimate: fallback, games, known: false, observed: raw };
    if (mode === 'min5' && decisive < 5) return { estimate: fallback, games, known: false, observed: raw };
    if (mode === 'conservative') return { estimate: 100 * (Number(m.wins || 0) + 6) / (decisive + 12), games, known: true, observed: raw };
    return { estimate: raw, games, known: true, observed: raw };
  }

  function confidence(entries, matchupGames, coverage) {
    const score = Math.min(1, entries / 45) * 0.45 + Math.min(1, matchupGames / 80) * 0.35 + coverage * 0.20;
    if (score >= 0.72) return { label: 'High', score };
    if (score >= 0.43) return { label: 'Medium', score };
    return { label: 'Low', score };
  }

  function buildRecommendations() {
    const tournaments = eligibleTournaments();
    if (!tournaments.length) return { rows: [], allRows: [], field: [], tournaments: 0 };
    const minEntries = Math.max(1, Number($p('prepMinEntries')?.value || 5));
    const field = window.PrepField?.getField?.() || [];
    const stats = aggregateCandidateStats(tournaments);
    const allRows = [];
    if (!field.length) return { rows: [], allRows: [], field: [], tournaments: tournaments.length };

    for (const row of stats.values()) {
      let expectedWR = 0, knownShare = 0, matchupGames = 0, goodField = 0, badField = 0;
      const keyMatchups = [];
      for (const opp of field) {
        const m = matchupEstimate(row.name, opp.name, row.adjustedWR);
        expectedWR += opp.share * m.estimate;
        if (m.known) {
          knownShare += opp.share;
          matchupGames += m.games;
          if (m.estimate >= 55) goodField += opp.share;
          if (m.estimate <= 45) badField += opp.share;
        }
        if (opp.share >= 0.015 || field.length <= 12) keyMatchups.push({ opponent: opp.name, share: opp.share, wr: m.estimate, games: m.games, known: m.known, observed: m.observed });
      }
      allRows.push({ ...row, expectedWR, knownShare, matchupGames, goodField, badField, confidence: confidence(row.entries, matchupGames, knownShare), keyMatchups });
    }
    allRows.sort((a, b) => b.expectedWR - a.expectedWR || b.confidence.score - a.confidence.score || b.entries - a.entries);
    allRows.forEach((row, i) => row.rank = i + 1);
    return { rows: allRows.filter(r => r.entries >= minEntries), allRows, field, tournaments: tournaments.length };
  }

  function reason(row) {
    const parts = [];
    if (row.goodField >= 0.25) parts.push(`favoured into ~${Math.round(row.goodField * 100)}% of selected field`);
    if (row.badField >= 0.20) parts.push(`unfavoured into ~${Math.round(row.badField * 100)}%`);
    if (row.adjustedWR >= 54) parts.push('strong overall results');
    else if (row.adjustedWR < 49) parts.push('weak overall results');
    if (row.knownShare < 0.35) parts.push('limited matchup coverage');
    return parts.length ? parts.join(' • ') : 'balanced profile against the selected field';
  }

  function evidenceLabel() {
    const mode = $p('prepEvidence')?.value || 'min10';
    if (mode === 'min10') return 'matchups under 10 games ignored';
    if (mode === 'min5') return 'matchups under 5 games ignored';
    if (mode === 'conservative') return 'small samples shrunk toward 50%';
    return 'raw matchup results used';
  }

  function renderInspect(model) {
    const select = $p('prepInspect'), target = $p('prepInspectResult');
    if (!select || !target) return;
    const previous = select.value;
    select.innerHTML = model.allRows.map(r => `<option value="${escapeHtml(r.name)}">#${r.rank} ${escapeHtml(r.name)}</option>`).join('');
    if (model.allRows.some(r => r.name === previous)) select.value = previous;
    const row = model.allRows.find(r => r.name === select.value) || model.allRows[0];
    if (!row) { target.innerHTML = '<div class="prep-empty">No archetype data available for this field.</div>'; return; }
    const matchupRows = row.keyMatchups.sort((a,b)=>b.share-a.share).map(m => {
      const source = m.known ? `${m.games} games` : m.games ? `${m.games} games — ignored` : 'no matchup sample';
      return `<tr><td><b>${escapeHtml(m.opponent)}</b></td><td>${pct(m.share * 100)}</td><td>${pct(m.wr)}</td><td>${escapeHtml(source)}</td></tr>`;
    }).join('');
    target.innerHTML = `<div class="inspect-metrics"><div class="metric"><b>#${row.rank}</b><span>Field rank</span></div><div class="metric"><b>${pct(row.expectedWR)}</b><span>Expected WR</span></div><div class="metric"><b>${pct(row.winRate)}</b><span>Overall WR</span></div><div class="metric"><b>${pct(row.knownShare * 100)}</b><span>Matchup coverage</span></div></div><div class="inspect-note"><b>${escapeHtml(row.name)}</b> • ${row.entries} observed entries • ${row.confidence.label} confidence • ${escapeHtml(window.PrepField?.sourceLabel?.() || '')}</div><div class="tablewrap"><table><thead><tr><th>Opponent</th><th>Expected field</th><th>Used WR</th><th>Evidence</th></tr></thead><tbody>${matchupRows}</tbody></table></div>`;
  }

  function renderPrep() {
    const target = $p('prepResults');
    if (!target) return;
    window.PrepField?.render?.();
    if (!CACHE?.tournaments?.length || CACHE.format !== 'TEF-PBL') { target.innerHTML = '<div class="prep-empty">Load the current TEF–PBL data to generate tournament recommendations.</div>'; return; }
    const model = buildRecommendations();
    const { rows, field, tournaments } = model;
    if (!field.length) {
      $p('prepSummary').innerHTML = '';
      target.innerHTML = '<div class="prep-empty">No decks are selected in the expected metagame, or this source has no current-format data yet.</div>';
      renderInspect(model); return;
    }
    if (!rows.length) { target.innerHTML = '<div class="prep-empty">No archetypes meet the candidate sample threshold.</div>'; renderInspect(model); return; }
    const top = rows.slice(0, 10), fieldTop = field.slice().sort((a,b)=>b.share-a.share).slice(0, 10);
    const matchupReady = model.allRows.some(r => r.knownShare > 0);
    const date = $p('prepDate')?.value;
    const dateLabel = date ? new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday:'short', day:'numeric', month:'short' }) : 'upcoming event';
    $p('prepSummary').innerHTML = `<div class="prep-callout"><span>TOP PICK FOR ${dateLabel.toUpperCase()}</span><b>${escapeHtml(top[0].name)}</b><strong>${pct(top[0].expectedWR)} expected win rate</strong><em>${top[0].confidence.label.toLowerCase()} confidence • ${escapeHtml(window.PrepField?.sourceLabel?.() || '')}</em></div><div class="prep-field"><span>Your expected field</span>${fieldTop.map(x => `<i><b>${escapeHtml(x.name)}</b> ${pct(x.share * 100)}</i>`).join('')}</div>`;
    target.innerHTML = `<div class="prep-table-note">${escapeHtml(window.PrepField?.sourceLabel?.() || '')} • ${escapeHtml(evidenceLabel())}. ${matchupReady ? 'Selected matchup evidence is included.' : 'No qualifying matchup evidence is available yet, so estimates lean on overall results.'}</div><div class="tablewrap"><table class="prep-table"><thead><tr><th>#</th><th>Deck</th><th>Expected WR</th><th>Overall WR</th><th>Entries</th><th>Matchup coverage</th><th>Confidence</th><th>Why</th></tr></thead><tbody>${top.map(r => `<tr class="prep-row ${r === top[0] ? 'prep-winner' : ''}" data-deck="${escapeHtml(r.name)}"><td>${r.rank}</td><td><b>${escapeHtml(r.name)}</b></td><td class="prep-expected"><b>${pct(r.expectedWR)}</b></td><td>${pct(r.winRate)}</td><td>${r.entries}</td><td>${pct(r.knownShare * 100)}</td><td><span class="confidence confidence-${r.confidence.label.toLowerCase()}">${r.confidence.label}</span></td><td class="prep-reason">${escapeHtml(reason(r))}</td></tr>`).join('')}</tbody></table></div><p class="prep-method">Expected WR is calculated against the metagame you built above. Field composition and matchup evidence can come from different sources. Missing or ignored matchup evidence falls back to the deck’s conservatively adjusted overall win rate.</p>`;
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
  $p('prepMinEntries')?.addEventListener('change', renderPrep);
  $p('prepDate')?.addEventListener('change', renderPrep);
  $p('prepInspect')?.addEventListener('change', () => renderInspect(buildRecommendations()));
  document.querySelector('[data-tab="prep"]')?.addEventListener('click', activate);
  window.addEventListener('meta:updated', handleMetaUpdated);
  window.addEventListener('field:updated', renderPrep);
  window.addEventListener('irl:updated', renderPrep);
})();
