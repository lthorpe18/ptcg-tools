(() => {
  const $p = id => document.getElementById(id);
  const pct = n => Number.isFinite(n) ? `${n.toFixed(1)}%` : '—';
  const pp = n => Number.isFinite(n) ? `${n >= 0 ? '+' : ''}${n.toFixed(2)} pp` : '—';
  const ignored = name => !name || name === 'Other' || name === 'Unknown';
  let autoMatchupsRequested = false;
  let quickDeckName = '';
  let fieldExpanded = false;
  let addDeckOpen = false;
  let saveMetaOpen = false;
  let selectedSavedMetaId = '';
  let savedMetaMessage = '';
  let savedMetaMessageType = '';

  function sprite(name, size = 42, className = '') {
    return window.DeckSprites?.html?.(name, { size, className }) || '';
  }

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
    const minPlayers = Math.max(50, Number($p('prepMinPlayers')?.value || 50));
    return CACHE.tournaments.filter(t => Number(t.players || 0) >= minPlayers && (t.standings || []).length);
  }

  function aggregateCandidateStats(tournaments) {
    const map = new Map();
    for (const t of tournaments) {
      for (const s of t.standings || []) {
        const name = arch(s);
        if (ignored(name)) continue;
        if (!map.has(name)) map.set(name, { name, entries: 0, wins: 0, losses: 0, ties: 0 });
        const row = map.get(name);
        row.entries++;
        row.wins += Number(s.record?.wins || 0);
        row.losses += Number(s.record?.losses || 0);
        row.ties += Number(s.record?.ties || 0);
      }
    }

    for (const d of window.DeckAggregate?.getData?.()?.decks || []) {
      if (ignored(d.name) || map.has(d.name)) continue;
      map.set(d.name, { name: d.name, entries: 0, wins: 0, losses: 0, ties: 0 });
    }

    const irlDecks = window.IRLLabs?.getData?.()?.decks || [];
    if (($p('matchupSource')?.value || 'online') !== 'online') {
      for (const d of irlDecks) {
        if (ignored(d.name)) continue;
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
      row.winRate = decisive ? 100 * row.wins / decisive : null;
    }
    return map;
  }

  function matchupEstimate(candidate, opponent) {
    if (ignored(candidate) || ignored(opponent)) return { estimate: null, games: 0, known: false, observed: null };
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
    const equalMode = ($p('fieldAnalysisMode')?.value || 'shares') === 'equal';
    const minCoverage = Math.max(0, Math.min(100, Number($p('prepMinCoverage')?.value || 50))) / 100;
    const field = (window.PrepField?.getField?.() || []).filter(x => !ignored(x.name));
    if (!tournaments.length || !field.length) {
      return { qualified: [], watchlist: [], allRows: [], field, tournaments: tournaments.length, minCoverage, equalMode };
    }

    const minEntries = Math.max(1, Number($p('prepMinEntries')?.value || 5));
    const stats = aggregateCandidateStats(tournaments);
    const allRows = [];

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
        keyMatchups.push({ opponent: opp.name, share: opp.share, wr: m.estimate, games: m.games, known: m.known, observed: m.observed });
      }

      const expectedWR = knownShare > 0 ? weightedKnownWR / knownShare : null;
      const coveragePass = equalMode || knownShare >= minCoverage;
      allRows.push({
        ...row,
        expectedWR,
        knownShare,
        matchupGames,
        goodField,
        badField,
        confidence: confidence(row.entries, matchupGames, knownShare),
        keyMatchups,
        qualifies: row.entries >= minEntries && coveragePass && Number.isFinite(expectedWR),
      });
    }

    const qualified = allRows
      .filter(r => r.qualifies)
      .sort((a, b) => b.expectedWR - a.expectedWR || b.knownShare - a.knownShare || (b.winRate ?? -1) - (a.winRate ?? -1) || b.entries - a.entries);
    qualified.forEach((row, i) => row.rank = i + 1);

    const watchlist = allRows
      .filter(r => r.entries >= minEntries && !r.qualifies)
      .sort((a, b) => b.knownShare - a.knownShare || (b.expectedWR ?? -1) - (a.expectedWR ?? -1) || (b.winRate ?? -1) - (a.winRate ?? -1));

    return { qualified, watchlist, allRows, field, tournaments: tournaments.length, minCoverage, equalMode };
  }

  function evidenceLabel() {
    const mode = $p('prepEvidence')?.value || 'min10';
    if (mode === 'min10') return '10+ game matchups';
    if (mode === 'min5') return '5+ game matchups';
    if (mode === 'conservative') return 'conservative small-sample adjustment';
    return 'raw matchup results';
  }

  function breakdownData(row) {
    const covered = row.keyMatchups.filter(m => m.known && Number.isFinite(m.wr));
    const unknown = row.keyMatchups.filter(m => !m.known);
    const coverage = Math.max(0, Number(row.knownShare || 0));
    const rows = row.keyMatchups.map(m => {
      const normalizedShare = m.known && coverage > 0 ? m.share / coverage : 0;
      const contribution = m.known ? normalizedShare * m.wr : null;
      const impact = m.known ? normalizedShare * (m.wr - 50) : null;
      return { ...m, normalizedShare, contribution, impact };
    }).sort((a, b) => b.share - a.share);
    const helpers = rows.filter(m => m.known && m.impact > 0).sort((a, b) => b.impact - a.impact).slice(0, 3);
    const hurts = rows.filter(m => m.known && m.impact < 0).sort((a, b) => a.impact - b.impact).slice(0, 3);
    return { rows, unknown, covered, helpers, hurts };
  }

  function driverLine(row) {
    const data = breakdownData(row);
    const strong = data.helpers[0]?.opponent;
    const weak = data.hurts[0]?.opponent;
    if (strong && weak) return `Strong into ${strong} · watch ${weak}`;
    if (strong) return `Strong into ${strong}`;
    if (weak) return `Main pressure point: ${weak}`;
    return 'Balanced matchup profile across your field';
  }

  function calculationTable(row) {
    const data = breakdownData(row);
    const rows = data.rows.map(m => {
      const evidence = m.known ? `${m.games} games` : m.games ? `${m.games} games · below threshold` : 'No qualifying sample';
      const cls = m.known ? (m.impact > 0.25 ? 'bd-positive' : m.impact < -0.25 ? 'bd-negative' : '') : 'bd-unknown';
      return `<tr class="${cls}"><td><span class="calc-opponent">${sprite(m.opponent, 28)}<b>${escapeHtml(m.opponent)}</b></span></td><td>${pct(m.share * 100)}</td><td>${m.known ? pct(m.wr) : '—'}</td><td>${m.known ? pct(m.normalizedShare * 100) : '—'}</td><td>${m.known ? `${m.contribution.toFixed(2)} pp` : '—'}</td><td>${m.known ? pp(m.impact) : '—'}</td><td>${escapeHtml(evidence)}</td></tr>`;
    }).join('');
    return `<div class="tablewrap"><table class="breakdown-table"><thead><tr><th>Opponent</th><th>Your field</th><th>Matchup WR</th><th>Covered weight</th><th>Contribution</th><th>Lift vs 50%</th><th>Evidence</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function whyHtml(row) {
    const data = breakdownData(row);
    const topRows = data.rows.slice(0, 6);
    const unknownShare = data.unknown.reduce((sum, m) => sum + Number(m.share || 0), 0);
    return `<div class="why-panel">
      <div class="why-summary-grid">
        <div><span>Expected WR</span><b>${pct(row.expectedWR)}</b></div>
        <div><span>Coverage</span><b>${pct(row.knownShare * 100)}</b></div>
        <div><span>Evidence</span><b>${row.matchupGames.toLocaleString()} games</b></div>
      </div>
      <div class="why-drivers">
        ${data.helpers[0] ? `<span class="driver good">↑ ${escapeHtml(data.helpers[0].opponent)} ${pp(data.helpers[0].impact)}</span>` : ''}
        ${data.hurts[0] ? `<span class="driver bad">↓ ${escapeHtml(data.hurts[0].opponent)} ${pp(data.hurts[0].impact)}</span>` : ''}
        ${unknownShare > 0 ? `<span class="driver neutral">${pct(unknownShare * 100)} unknown</span>` : ''}
      </div>
      <div class="why-matchups">${topRows.map(m => `<div class="why-matchup ${m.known ? '' : 'unknown'}">
        <div class="why-matchup-name">${sprite(m.opponent, 30)}<span><b>${escapeHtml(m.opponent)}</b><small>${pct(m.share * 100)} of your field · ${m.games ? `${m.games} games` : 'no sample'}</small></span></div>
        <strong>${m.known ? pct(m.wr) : '—'}</strong>
      </div>`).join('')}</div>
      <details class="full-calculation"><summary>Full weighted calculation</summary>${calculationTable(row)}<p>The final WR is calculated over the covered portion of your field. Qualifying matchups are renormalised to 100%; missing evidence is never replaced by overall win rate.</p></details>
    </div>`;
  }

  function compositionsEqual(a, b) {
    const left = window.SavedMetas?.cleanField?.(a) || [];
    const right = window.SavedMetas?.cleanField?.(b) || [];
    if (left.length !== right.length) return false;
    const map = new Map(left.map(row => [row.name, row.share]));
    return right.every(row => map.has(row.name) && Math.abs(Number(map.get(row.name)) - Number(row.share)) < 0.0005);
  }

  function savedMetaUi(currentField) {
    const saved = window.SavedMetas?.list?.() || [];
    const matched = saved.find(meta => compositionsEqual(meta.field, currentField)) || null;
    if (matched) selectedSavedMetaId = matched.id;
    else if (selectedSavedMetaId && !saved.some(meta => meta.id === selectedSavedMetaId)) selectedSavedMetaId = '';
    const selected = saved.find(meta => meta.id === selectedSavedMetaId) || null;

    const savedBar = saved.length ? `<div class="saved-meta-bar">
      <label class="saved-meta-select"><span>Saved meta · on this device</span><select id="savedMetaSelect"><option value="">Choose a saved meta…</option>${saved.map(meta => `<option value="${escapeHtml(meta.id)}" ${meta.id === selectedSavedMetaId ? 'selected' : ''}>${escapeHtml(meta.name)}</option>`).join('')}</select></label>
      <button type="button" class="btn" data-load-saved-meta ${selected ? '' : 'disabled'}>Load</button>
      <button type="button" class="btn saved-meta-delete" data-delete-saved-meta ${selected ? '' : 'disabled'} aria-label="Delete saved meta">Delete</button>
    </div>` : '';

    const defaultName = matched?.name || '';
    const saveForm = saveMetaOpen ? `<form class="save-meta-form" id="saveMetaForm"><label><span>Meta name</span><input id="saveMetaName" type="text" maxlength="50" autocomplete="off" placeholder="e.g. Local League" value="${escapeHtml(defaultName)}" required></label><button type="submit" class="btn primary">${matched ? 'Update' : 'Save'}</button><button type="button" class="btn" data-cancel-save-meta>Cancel</button></form>` : '';
    const message = savedMetaMessage ? `<p class="saved-meta-note ${savedMetaMessageType}">${escapeHtml(savedMetaMessage)}</p>` : '';
    return `${savedBar}${saveForm}${message}`;
  }

  function fieldOverviewHtml() {
    const rows = (window.PrepField?.getChipRows?.() || []).filter(x => !ignored(x.name));
    const originalCoverage = Math.max(0, Math.min(1, Number(window.PrepField?.getOriginalCoverage?.() || 0)));
    const shown = fieldExpanded ? rows : rows.slice(0, 8);
    const allRows = (window.PrepField?.getAllRows?.() || []).filter(x => !ignored(x.name));
    const available = allRows.filter(x => !x.included);
    const selectedCount = allRows.filter(x => x.included).length;
    const currentField = window.PrepField?.snapshot?.() || [];
    const saved = window.SavedMetas?.list?.() || [];
    const matched = saved.find(meta => compositionsEqual(meta.field, currentField)) || null;

    return `<div class="field-overview-head"><div><h3>Your expected field</h3><p>${selectedCount} decks · active shares always total 100%${matched ? ` · ${escapeHtml(matched.name)}` : ''}</p></div><span class="field-mode-badge">${($p('fieldAnalysisMode')?.value || 'shares') === 'equal' ? 'Equal weighting' : 'Expected shares'}</span></div>
      <div class="play-field-chips">${shown.map(x => `<button type="button" class="play-field-chip ${x.included ? '' : 'off'}" data-field-toggle="${escapeHtml(x.name)}" aria-pressed="${x.included ? 'true' : 'false'}">
        ${sprite(x.name, 30)}<span class="chip-name">${escapeHtml(x.name)}</span><span class="chip-share">${x.included ? pct(x.share * 100) : 'Off'}</span><span class="chip-action">${x.included ? '×' : '+'}</span>
      </button>`).join('')}</div>
      <div class="field-coverage-line"><span class="coverage-check">✓</span><b>${pct(originalCoverage * 100)}</b><span>of the current competitive meta represented</span></div>
      <div class="field-inline-actions">
        <button type="button" class="text-action" data-add-deck>＋ Add deck</button>
        <button type="button" class="text-action" data-save-meta>♡ Save meta</button>
        ${rows.length > 8 ? `<button type="button" class="text-action" data-field-expand>${fieldExpanded ? 'Show less' : `Show all ${rows.length}`}</button>` : ''}
        <button type="button" class="text-action reset" data-field-reset>↻ Reset</button>
      </div>
      ${savedMetaUi(currentField)}
      <div class="field-add-row ${addDeckOpen ? '' : 'hidden'}"><label>Add an archetype<select id="fieldAddSelect" class="deck-searchable"><option value="">Search decks…</option>${available.map(r => `<option value="${escapeHtml(r.name)}">${escapeHtml(r.name)}</option>`).join('')}</select></label></div>`;
  }

  function bindFieldOverview() {
    const root = $p('prepFieldOverview');
    if (!root) return;
    root.querySelectorAll('[data-field-toggle]').forEach(el => el.addEventListener('click', () => {
      selectedSavedMetaId = '';
      savedMetaMessage = '';
      window.PrepField?.toggle?.(el.dataset.fieldToggle);
    }));
    root.querySelector('[data-field-reset]')?.addEventListener('click', () => {
      selectedSavedMetaId = '';
      savedMetaMessage = '';
      window.PrepField?.reset?.();
    });
    root.querySelector('[data-field-expand]')?.addEventListener('click', () => { fieldExpanded = !fieldExpanded; renderPrep(); });
    root.querySelector('[data-add-deck]')?.addEventListener('click', () => { addDeckOpen = !addDeckOpen; saveMetaOpen = false; renderPrep(); });
    root.querySelector('[data-save-meta]')?.addEventListener('click', () => { saveMetaOpen = !saveMetaOpen; addDeckOpen = false; savedMetaMessage = ''; renderPrep(); });
    root.querySelector('[data-cancel-save-meta]')?.addEventListener('click', () => { saveMetaOpen = false; renderPrep(); });

    const savedSelect = $p('savedMetaSelect');
    if (savedSelect) savedSelect.addEventListener('change', () => {
      selectedSavedMetaId = savedSelect.value;
      savedMetaMessage = '';
      renderPrep();
    });

    root.querySelector('[data-load-saved-meta]')?.addEventListener('click', () => {
      const preset = window.SavedMetas?.get?.(selectedSavedMetaId);
      if (!preset) return;
      saveMetaOpen = false;
      addDeckOpen = false;
      savedMetaMessage = `Loaded “${preset.name}”.`;
      savedMetaMessageType = 'success';
      window.PrepField?.applyComposition?.(preset.field);
    });

    root.querySelector('[data-delete-saved-meta]')?.addEventListener('click', () => {
      const preset = window.SavedMetas?.get?.(selectedSavedMetaId);
      if (!preset) return;
      if (!window.confirm(`Delete saved meta “${preset.name}”?`)) return;
      if (window.SavedMetas?.remove?.(preset.id)) {
        selectedSavedMetaId = '';
        savedMetaMessage = `Deleted “${preset.name}”.`;
        savedMetaMessageType = '';
        renderPrep();
      }
    });

    const saveForm = $p('saveMetaForm');
    if (saveForm) saveForm.addEventListener('submit', event => {
      event.preventDefault();
      const name = String($p('saveMetaName')?.value || '').trim();
      const field = window.PrepField?.snapshot?.() || [];
      if (!name || !field.length) {
        savedMetaMessage = 'Give the meta a name and select at least one deck.';
        savedMetaMessageType = 'error';
        renderPrep();
        return;
      }
      const item = window.SavedMetas?.save?.(name, field, CACHE?.format || '');
      if (!item) {
        savedMetaMessage = 'This browser could not save the meta.';
        savedMetaMessageType = 'error';
        renderPrep();
        return;
      }
      selectedSavedMetaId = item.id;
      saveMetaOpen = false;
      savedMetaMessage = `Saved “${item.name}” on this device.`;
      savedMetaMessageType = 'success';
      renderPrep();
    });

    const add = $p('fieldAddSelect');
    if (add) add.addEventListener('change', () => {
      if (!add.value) return;
      selectedSavedMetaId = '';
      savedMetaMessage = '';
      window.PrepField?.add?.(add.value);
      addDeckOpen = false;
    });
  }

  function recommendationCard(row, compact = false) {
    const conf = row.confidence.label.toLowerCase();
    return `<article class="recommendation-card ${row.rank === 1 ? 'winner' : ''} ${compact ? 'compact' : ''}">
      <div class="rec-rank">#${row.rank}</div>
      <div class="rec-sprite">${sprite(row.name, compact ? 44 : 54)}</div>
      <div class="rec-main"><h3>${escapeHtml(row.name)}</h3><p>${escapeHtml(driverLine(row))}</p><div class="rec-meta"><span>${pct(row.knownShare * 100)} coverage</span><span class="confidence-dot ${conf}">${row.confidence.label} confidence</span></div></div>
      <div class="rec-score"><b>${pct(row.expectedWR)}</b><span>Expected WR</span></div>
      <details class="rec-why"><summary>Why?</summary>${whyHtml(row)}</details>
    </article>`;
  }

  function recommendationsHtml(model) {
    if (!model.field.length) return '<div class="play-empty">Add at least one deck to your expected field.</div>';
    if (!model.qualified.length) {
      return `<div class="play-empty"><b>Not enough evidence yet</b><span>${model.equalMode ? 'The coverage threshold is bypassed, but decks still need qualifying matchup data.' : `No deck currently clears ${Math.round(model.minCoverage * 100)}% matchup coverage.`}</span></div>`;
    }
    const first = model.qualified.slice(0, 3);
    const more = model.qualified.slice(3, 10);
    const watch = model.watchlist.slice(0, 8);
    return `<div class="recommendation-list">${first.map(r => recommendationCard(r)).join('')}</div>
      ${more.length ? `<details class="more-recommendations"><summary>Show ${more.length} more ranked decks</summary><div class="recommendation-list more-list">${more.map(r => recommendationCard(r, true)).join('')}</div></details>` : ''}
      ${watch.length ? `<details class="evidence-watch"><summary>Lower-evidence decks</summary><div class="watch-grid">${watch.map(r => `<div class="watch-card">${sprite(r.name, 34)}<span><b>${escapeHtml(r.name)}</b><small>${pct(r.expectedWR)} · ${pct(r.knownShare * 100)} coverage</small></span></div>`).join('')}</div></details>` : ''}`;
  }

  function checkerHtml(model) {
    const choices = model.allRows.filter(r => !ignored(r.name)).sort((a, b) => a.name.localeCompare(b.name));
    if (!choices.length) return '<div class="play-empty">Deck data is still loading.</div>';
    if (!quickDeckName || !choices.some(r => r.name === quickDeckName)) quickDeckName = model.qualified[0]?.name || choices[0].name;
    const row = choices.find(r => r.name === quickDeckName) || choices[0];
    return `<div class="deck-check-search"><select id="quickDeckSelect" class="deck-searchable">${choices.map(r => `<option value="${escapeHtml(r.name)}" ${r.name === row.name ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join('')}</select></div>
      <article class="deck-check-result">${sprite(row.name, 52)}<div class="deck-check-name"><span>Selected deck</span><b>${escapeHtml(row.name)}</b><small>${row.entries ? `${row.entries} entries in 50+ events` : 'Not currently ranked from 50+ event entries'}</small></div><div class="deck-check-score"><b>${pct(row.expectedWR)}</b><span>Matchup-weighted WR</span><small>${pct(row.knownShare * 100)} coverage</small></div></article>
      <details class="check-details"><summary>Why this result?</summary>${Number.isFinite(row.expectedWR) ? whyHtml(row) : '<div class="play-empty">There is not enough qualifying matchup evidence for this selected field.</div>'}</details>`;
  }

  function bindChecker() {
    const select = $p('quickDeckSelect');
    if (!select) return;
    select.addEventListener('change', () => {
      quickDeckName = select.value;
      renderPrep();
    });
  }

  function settingsSummary(model) {
    const el = $p('advancedSettingsSummary');
    if (!el) return;
    const weighting = model.equalMode ? 'equal field weighting' : 'expected-share weighting';
    el.textContent = `${evidenceLabel()} · ${weighting} · ${Math.max(50, Number($p('prepMinPlayers')?.value || 50))}+ player meta events`;
  }

  function renderPrep() {
    const fieldTarget = $p('prepFieldOverview');
    const resultsTarget = $p('prepResults');
    const checkTarget = $p('prepCheckResult');
    if (!fieldTarget || !resultsTarget || !checkTarget) return;

    window.PrepField?.render?.();
    if (!CACHE?.tournaments?.length || CACHE.format !== 'TEF-PBL') {
      fieldTarget.innerHTML = '<div class="play-empty">Loading the current competitive field…</div>';
      resultsTarget.innerHTML = '<div class="play-empty">Loading recommendations…</div>';
      checkTarget.innerHTML = '';
      return;
    }

    const model = buildRecommendations();
    fieldTarget.innerHTML = fieldOverviewHtml();
    resultsTarget.innerHTML = recommendationsHtml(model);
    checkTarget.innerHTML = checkerHtml(model);
    bindFieldOverview();
    bindChecker();
    settingsSummary(model);
    window.SearchableDecks?.upgrade?.();
  }

  function activate() {
    renderPrep();
    if (window.DeckAggregate?.hasData?.()) return;
    window.MetaLive?.loadMatchupPairings?.().then(renderPrep);
  }

  function handleMetaUpdated() {
    renderPrep();
    const prepIsActive = document.querySelector('[data-tab="prep"]')?.classList.contains('active');
    if (prepIsActive && !window.DeckAggregate?.hasData?.() && !autoMatchupsRequested && CACHE?.format === 'TEF-PBL' && CACHE?.tournaments?.length && !(DATA?.matches > 0)) {
      autoMatchupsRequested = true;
      window.MetaLive?.loadMatchupPairings?.().then(renderPrep);
    }
  }

  initDate();
  ['prepRecency', 'prepEvidence', 'prepMinCoverage', 'prepMinEntries', 'prepMinPlayers', 'prepDate'].forEach(id => $p(id)?.addEventListener('change', renderPrep));
  document.querySelector('[data-tab="prep"]')?.addEventListener('click', activate);
  window.addEventListener('meta:updated', handleMetaUpdated);
  window.addEventListener('field:updated', renderPrep);
  window.addEventListener('irl:updated', renderPrep);
  window.addEventListener('deckagg:updated', renderPrep);
  window.addEventListener('savedmetas:updated', renderPrep);
})();
