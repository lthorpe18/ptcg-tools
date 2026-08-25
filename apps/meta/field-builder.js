(() => {
  const $f = id => document.getElementById(id);
  const state = { custom: new Map(), touched: false, showAll: false };
  const pct = n => `${Number(n || 0).toFixed(1)}%`;

  function onlineFieldFromCache() {
    if (!CACHE?.tournaments?.length) return [];
    const mode = $f('prepRecency')?.value || 'balanced';
    const tournaments = CACHE.tournaments.filter(t => (t.standings || []).length);
    if (!tournaments.length) return [];
    const newest = Math.max(...tournaments.map(t => new Date(t.date).getTime()).filter(Number.isFinite));
    const counts = new Map();
    let total = 0;
    const halfLife = mode === 'high' ? 7 : mode === 'balanced' ? 18 : Infinity;
    for (const t of tournaments) {
      const age = Math.max(0, (newest - new Date(t.date).getTime()) / 86400000);
      const weight = Number.isFinite(halfLife) ? Math.pow(0.5, age / halfLife) : 1;
      for (const s of t.standings || []) {
        const name = s?.deck?.name;
        if (!name) continue;
        counts.set(name, (counts.get(name) || 0) + weight);
        total += weight;
      }
    }
    return [...counts.entries()].map(([name, value]) => ({ name, share: total ? value / total : 0, source: 'online' }));
  }

  function irlField() {
    const data = window.IRLLabs?.getData?.() || {};
    const decks = Array.isArray(data.decks) ? data.decks : [];
    const total = decks.reduce((sum, d) => sum + Number(d.entries || 0), 0);
    return decks.map(d => ({ name: d.name, share: total ? Number(d.entries || 0) / total : Number(d.share || 0), source: 'irl' }));
  }

  function mergeFields(a, b, bWeight) {
    const map = new Map();
    for (const row of a) map.set(row.name, (map.get(row.name) || 0) + row.share * (1 - bWeight));
    for (const row of b) map.set(row.name, (map.get(row.name) || 0) + row.share * bWeight);
    const total = [...map.values()].reduce((s, x) => s + x, 0);
    return [...map.entries()].map(([name, value]) => ({ name, share: total ? value / total : 0, source: 'blend' }));
  }

  function baseField() {
    const source = $f('fieldSource')?.value || 'online';
    const online = onlineFieldFromCache();
    const irl = irlField();
    if (source === 'irl') return irl;
    if (source === 'blend') return mergeFields(online, irl, Number($f('fieldBlend')?.value || 50) / 100);
    if (source === 'custom') return online.length ? online : irl;
    return online;
  }

  function top90Names(base) {
    const names = new Set();
    let cumulative = 0;
    for (const row of base) {
      if (cumulative >= 0.9 && names.size) break;
      names.add(row.name);
      cumulative += Math.max(0, Number(row.share || 0));
    }
    return names;
  }

  function syncCustom(reset = false) {
    const base = baseField().sort((a, b) => b.share - a.share);
    if (reset || !state.touched) {
      const defaults = top90Names(base);
      state.custom.clear();
      for (const row of base) {
        state.custom.set(row.name, {
          name: row.name,
          share: row.share,
          included: defaults.has(row.name),
        });
      }
      state.touched = false;
      return;
    }
    for (const row of base) {
      if (!state.custom.has(row.name)) {
        state.custom.set(row.name, { name: row.name, share: row.share, included: false });
      }
    }
  }

  function selectedField() {
    syncCustom(false);
    const rows = [...state.custom.values()].filter(r => r.included);
    if (!rows.length) return [];
    if (($f('fieldAnalysisMode')?.value || 'shares') === 'equal') {
      return rows.map(r => ({ name: r.name, share: 1 / rows.length }));
    }
    const total = rows.reduce((sum, r) => sum + Math.max(0, Number(r.share || 0)), 0);
    return rows.map(r => ({ name: r.name, share: total ? Math.max(0, Number(r.share || 0)) / total : 1 / rows.length }));
  }

  function visibleRows(rows) {
    if (state.showAll) return rows;
    let cumulative = 0;
    const visible = [];
    for (const row of rows) {
      if (cumulative >= 0.9 && visible.length) break;
      visible.push(row);
      cumulative += Math.max(0, Number(row.share || 0));
    }
    return visible;
  }

  function render() {
    const editor = $f('fieldEditor');
    if (!editor) return;
    syncCustom(false);
    const rows = [...state.custom.values()].sort((a, b) => Number(b.share || 0) - Number(a.share || 0));
    if (!rows.length) {
      editor.innerHTML = '<div class="prep-empty">No data is available for this field source in the current legality.</div>';
      window.dispatchEvent(new CustomEvent('field:updated'));
      return;
    }
    const shown = visibleRows(rows);
    const shownShare = shown.reduce((sum, r) => sum + Number(r.share || 0), 0);
    const selected = rows.filter(r => r.included);
    const selectedRawShare = selected.reduce((sum, r) => sum + Number(r.share || 0), 0);
    const coverage = $f('fieldCoverage');
    if (coverage) {
      coverage.textContent = state.showAll
        ? `Showing all ${rows.length} archetypes • ${selected.length} selected (${pct(selectedRawShare * 100)} raw meta coverage).`
        : `Default field: ${selected.length} archetypes covering ${pct(selectedRawShare * 100)} of the modelled meta.`;
    }
    const showAll = $f('fieldShowAll');
    if (showAll) showAll.textContent = state.showAll ? 'Top 90%' : 'Show all';

    editor.innerHTML = `<div class="tablewrap"><table class="field-table"><thead><tr><th>Use</th><th>Archetype</th><th>Share</th></tr></thead><tbody>${shown.map(r => `<tr class="field-row ${r.included ? 'included' : 'excluded'}" data-name="${escapeHtml(r.name)}"><td><input class="field-check" data-name="${escapeHtml(r.name)}" type="checkbox" ${r.included ? 'checked' : ''}></td><td><b>${escapeHtml(r.name)}</b></td><td><input class="field-share" data-name="${escapeHtml(r.name)}" type="number" min="0" max="100" step="0.1" value="${(Number(r.share || 0) * 100).toFixed(1)}">%</td></tr>`).join('')}</tbody></table></div>`;
    editor.querySelectorAll('.field-row').forEach(row => row.addEventListener('click', e => {
      if (e.target.matches('input')) return;
      toggle(row.dataset.name);
    }));
    editor.querySelectorAll('.field-check').forEach(el => el.addEventListener('change', () => {
      const r = state.custom.get(el.dataset.name); if (r) { r.included = el.checked; state.touched = true; render(); notify(); }
    }));
    editor.querySelectorAll('.field-share').forEach(el => el.addEventListener('change', () => {
      const r = state.custom.get(el.dataset.name); if (r) { r.share = Math.max(0, Number(el.value || 0)) / 100; state.touched = true; render(); notify(); }
    }));
    notify(false);
  }

  function toggle(name) {
    syncCustom(false);
    const row = state.custom.get(name);
    if (!row) return;
    row.included = !row.included;
    state.touched = true;
    render();
    notify();
  }

  function notify(dispatch = true) {
    if (dispatch) window.dispatchEvent(new CustomEvent('field:updated'));
  }

  function matchup(candidate, opponent, onlineFallback) {
    const mode = $f('matchupSource')?.value || 'online';
    const online = DATA?.matchups?.get(`${candidate}|||${opponent}`) || null;
    const irlRows = window.IRLLabs?.getData?.()?.matchups || [];
    const irl = irlRows.find(m => m.a === candidate && m.b === opponent) || null;
    if (mode === 'irl') return irl || null;
    if (mode === 'combined') {
      if (!online) return irl || null;
      if (!irl) return online;
      return {
        a: candidate, b: opponent,
        wins: Number(online.wins || 0) + Number(irl.wins || 0),
        losses: Number(online.losses || 0) + Number(irl.losses || 0),
        ties: Number(online.ties || 0) + Number(irl.ties || 0),
        games: Number(online.games || 0) + Number(irl.games || 0),
      };
    }
    return online || onlineFallback || null;
  }

  function sourceLabel() {
    const field = $f('fieldSource')?.value || 'online';
    const matchup = $f('matchupSource')?.value || 'online';
    const fieldLabels = { online: 'online field', irl: 'IRL Labs field', blend: `${$f('fieldBlend')?.value || 50}% IRL blend`, custom: 'custom field' };
    const matchLabels = { online: 'online matchups', irl: 'IRL matchups', combined: 'combined matchups' };
    return `${fieldLabels[field]} • ${matchLabels[matchup]}`;
  }

  function bind() {
    $f('fieldSource')?.addEventListener('change', () => {
      $f('blendControl')?.classList.toggle('hidden', $f('fieldSource').value !== 'blend');
      state.touched = false; syncCustom(true); render(); notify();
    });
    $f('fieldBlend')?.addEventListener('input', () => { $f('blendValue').textContent = `${$f('fieldBlend').value}%`; state.touched = false; syncCustom(true); render(); notify(); });
    $f('fieldAnalysisMode')?.addEventListener('change', () => notify());
    $f('matchupSource')?.addEventListener('change', () => notify());
    $f('fieldReset')?.addEventListener('click', () => { state.touched = false; syncCustom(true); render(); notify(); });
    $f('fieldAll')?.addEventListener('click', () => { syncCustom(false); for (const r of state.custom.values()) r.included = true; state.touched = true; render(); notify(); });
    $f('fieldNone')?.addEventListener('click', () => { syncCustom(false); for (const r of state.custom.values()) r.included = false; state.touched = true; render(); notify(); });
    $f('fieldShowAll')?.addEventListener('click', () => { state.showAll = !state.showAll; render(); });
    $f('prepRecency')?.addEventListener('change', () => { if (!state.touched) { syncCustom(true); render(); notify(); } });
    window.addEventListener('meta:updated', () => { if (!state.touched) { syncCustom(true); render(); } });
    window.addEventListener('irl:updated', () => { if (!state.touched) { syncCustom(true); render(); } });
  }

  window.PrepField = { getField: selectedField, getMatchup: matchup, render, sourceLabel, toggle };
  bind();
})();
