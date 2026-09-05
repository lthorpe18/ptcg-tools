(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const pct = value => `${(100 * Number(value || 0)).toFixed(0)}%`;
  const rate = value => Number.isFinite(value) ? `≈${Math.round(value)}%` : '—';
  const detailRate = value => Number.isFinite(value) ? `${value.toFixed(1)}%` : '—';
  const pp = value => `${value >= 0 ? '+' : ''}${Number(value || 0).toFixed(1)} pp`;
  const state = { compare:new Set(), selectedSavedId:'', saveOpen:false, addOpen:false, expandedField:false, loading:null };

  function sprite(name, size=40) { return window.DeckSprites?.html?.(name,{ size }) || ''; }
  function matchupSource() { return $('playMatchupSource')?.value || 'combined'; }

  function candidatePool() {
    const current=window.MetaState?.get?.() || {};
    const defaults=window.PTCGRecommendation?.DEFAULTS || {};
    const map=new Map();
    const add=(rows, source) => {
      for (const row of rows || []) {
        if (!window.PTCGMetaField?.isUsableName?.(row.name)) continue;
        const item=map.get(row.name) || { name:row.name, entries:0, onlineEntries:0, irlEntries:0 };
        const entries=Number(row.entries || 0);
        item.entries += entries;
        item[`${source}Entries`] += entries;
        map.set(row.name,item);
      }
    };
    add(window.MetaData?.data?.('online',{ scope:current.onlineScope || defaults.onlineScope, minPlayers:50 })?.decks,'online');
    add(window.MetaData?.data?.('irl',{ scope:defaults.irlScope })?.decks,'irl');
    return [...map.values()];
  }

  function buildModel() {
    const current=window.MetaState?.get?.() || {};
    const defaults=window.PTCGRecommendation?.DEFAULTS || {};
    return window.PTCGRecommendation?.analyse?.({
      fieldRows:window.PrepField?.getField?.() || [],
      candidates:candidatePool(),
      evidence:{
        online:window.MetaData?.data?.('online',{ scope:current.onlineScope || defaults.onlineScope, minPlayers:50 })?.matchups || [],
        irl:window.MetaData?.data?.('irl',{ scope:defaults.irlScope })?.matchups || [],
      },
      matchupSource:matchupSource(),
    }) || { field:[], ranked:[], lowerEvidence:[], all:[], state:'insufficient' };
  }

  function compositionsEqual(a,b) {
    const left=window.PTCGMetaField?.normalizeRows?.(a) || [], right=window.PTCGMetaField?.normalizeRows?.(b) || [];
    if (left.length !== right.length) return false;
    const map=new Map(left.map(row => [row.name,row.share]));
    return right.every(row => map.has(row.name) && Math.abs(map.get(row.name)-row.share) < 0.0005);
  }

  function fieldHtml() {
    const chips=(window.PrepField?.getChipRows?.() || []).filter(row => row.included);
    const shown=state.expandedField ? chips : chips.slice(0,7);
    const all=window.PrepField?.getAllRows?.() || [];
    const available=all.filter(row => !row.included);
    const saved=window.SavedMetas?.list?.() || [];
    const snapshot=window.PrepField?.snapshot?.() || [];
    const matched=saved.find(item => compositionsEqual(item.field,snapshot));
    if (matched && !state.selectedSavedId) state.selectedSavedId=matched.id;
    const selected=saved.find(item => item.id === state.selectedSavedId);
    const provenance=window.PrepField?.provenance?.() || {};
    const legacy=selected ? (window.PTCGMetaField?.legacyAmbiguities?.(selected.field,selected.provenance) || []) : [];
    return `<div class="wsip-stage-label"><span>1</span><b>Field</b></div>
      <div class="field-overview-head"><div><h2>${esc(window.PrepField?.sourceLabel?.() || 'Expected field')}</h2><p>${chips.length} exact variants · shares below total 100% in the model</p></div><span class="field-mode-badge">${pct(window.PrepField?.getOriginalCoverage?.() || 0)} represented</span></div>
      <div class="play-field-chips">${shown.map(row => `<button type="button" class="play-field-chip" data-field-toggle="${esc(row.name)}">${sprite(row.name,28)}<span class="chip-name">${esc(row.name)}</span><span class="chip-share">${pct(row.modelShare)}</span><span class="chip-action">×</span></button>`).join('')}</div>
      ${chips.length > 7 ? `<button class="text-action" type="button" data-field-expand>${state.expandedField ? 'Show less' : `Show all ${chips.length}`}</button>` : ''}
      <div class="field-inline-actions"><button type="button" class="text-action" data-add-deck>＋ Add variant</button><button type="button" class="text-action" data-save-field>♡ Save Expected Field</button><button type="button" class="text-action reset" data-field-reset>↻ Reset source</button></div>
      ${saved.length ? `<div class="saved-meta-bar"><label><span>Saved Expected Field</span><select id="savedMetaSelect"><option value="">Choose…</option>${saved.map(item => `<option value="${esc(item.id)}" ${item.id===state.selectedSavedId?'selected':''}>${esc(item.name)}</option>`).join('')}</select></label><button class="btn" type="button" data-load-saved ${selected?'':'disabled'}>Use field</button></div>` : ''}
      ${legacy.length ? `<p class="wsip-warning">Review this legacy field: ${esc(legacy.join(', '))} may be a family label. WSIP will not silently expand it into variants.</p>` : ''}
      ${state.addOpen ? `<label class="field-add-row">Add exact variant<select id="fieldAddSelect" class="deck-searchable"><option value="">Search variants…</option>${available.map(row => `<option value="${esc(row.name)}">${esc(row.name)}</option>`).join('')}</select></label>` : ''}
      ${state.saveOpen ? `<form id="saveFieldForm" class="save-meta-form"><label><span>Expected Field name</span><input id="saveFieldName" maxlength="50" required placeholder="e.g. Saturday League"></label><button class="btn primary" type="submit">Save</button><button class="btn" type="button" data-cancel-save>Cancel</button></form>` : ''}
      <p class="field-provenance">${esc(provenance.label || window.PrepField?.sourceLabel?.() || '')}</p>`;
  }

  function evidenceBadge(row) { return `<span class="wsip-evidence ${row.evidenceLevel}">${esc(row.evidenceLabel)}</span>`; }

  function driverHtml(row) {
    const helpers=row.helpers || [], hurts=row.hurts || [];
    return `<div class="wsip-why">
      <div class="wsip-driver-group"><h4>Helps</h4>${helpers.length ? helpers.map(item => `<div>${sprite(item.opponent,26)}<span><b>${esc(item.opponent)}</b><small>${pct(item.share)} of field · ${item.decisiveGames} decisive games</small></span><strong>${detailRate(item.estimate)} <i>${pp(item.contribution)}</i></strong></div>`).join('') : '<p>No material positive driver in covered matchups.</p>'}</div>
      <div class="wsip-driver-group hurts"><h4>Hurts</h4>${hurts.length ? hurts.map(item => `<div>${sprite(item.opponent,26)}<span><b>${esc(item.opponent)}</b><small>${pct(item.share)} of field · ${item.decisiveGames} decisive games</small></span><strong>${detailRate(item.estimate)} <i>${pp(item.contribution)}</i></strong></div>`).join('') : '<p>No material negative driver in covered matchups.</p>'}</div>
      <div class="wsip-risk-list">${row.unknownShare > 0.005 ? `<span>${pct(row.unknownShare)} of the field has no decisive H2H evidence.</span>` : ''}${row.polarised ? '<span>Polarised: meaningful winning and losing exposure.</span>' : ''}${row.sourceDisagreement ? `<span>Online and IRL estimates differ by ${row.sourceGap.toFixed(1)} points.</span>` : ''}</div>
      <details><summary>Field matchup detail</summary><div class="wsip-matchup-list">${row.matchups.slice().sort((a,b)=>b.share-a.share).map(item => `<div class="${item.known?'':'unknown'}"><span><b>${esc(item.opponent)}</b><small>${pct(item.share)} of field · ${item.known ? `${item.decisiveGames} decisive games` : 'no decisive evidence'}</small></span><strong>${item.known ? detailRate(item.estimate) : 'Unknown'}</strong></div>`).join('')}</div><p class="advanced-method">Rates use a 12-game neutral prior. The expected rate is calculated only over covered field share; unknown matchups are not treated as 50%.</p></details>
    </div>`;
  }

  function recommendationCard(row, model) {
    const selected=state.compare.has(row.name);
    const sourceSplit=row.sourceDisagreement ? ` · source split ${detailRate(row.sourceProfiles.online.estimate)} Online / ${detailRate(row.sourceProfiles.irl.estimate)} IRL` : '';
    const rankLabel=model.closeCall && row.rank <= 2 ? '≈' : `#${row.rank}`;
    const separation=row.rank === 1 && Number.isFinite(model.gap) ? (model.closeCall ? ' · effectively tied with #2' : ` · ${model.gap.toFixed(1)} point lead`) : row.rank > 1 ? ` · ${row.gapFromLeader.toFixed(1)} points behind leader` : '';
    return `<article class="recommendation-card ${row.rank===1?'winner':''}">
      <div class="rec-rank">${rankLabel}</div><div class="rec-sprite">${sprite(row.name,50)}</div>
      <div class="rec-main"><h3>${esc(row.name)}</h3><p>${row.helpers[0] ? `Best lift: ${esc(row.helpers[0].opponent)}` : 'No single positive driver dominates'}${row.hurts[0] ? ` · risk: ${esc(row.hurts[0].opponent)}` : ''}</p><div class="rec-meta">${evidenceBadge(row)}<span>${pct(row.coverage)} coverage · ${pct(row.evidenceQuality)} sample quality</span></div></div>
      <div class="rec-score"><b>${rate(row.expectedWR)}</b><span>covered-field estimate${esc(separation)}</span></div>
      <div class="rec-actions"><button type="button" class="btn" data-toggle-compare="${esc(row.name)}">${selected?'Remove':'Compare'}</button><button type="button" class="btn" data-open-deck="${esc(row.name)}">Open exact variant</button></div>
      <details class="rec-why"><summary>3 · Why this deck?</summary>${driverHtml(row)}</details>
      ${sourceSplit ? `<p class="wsip-source-split">${esc(sourceSplit.replace(/^ · /,''))}</p>` : ''}
    </article>`;
  }

  function recommendationHtml(model) {
    if (!model.field.length) return '<div class="play-empty"><b>No field selected</b><span>Choose a field source or saved Expected Field.</span></div>';
    const messages={
      strong:['Strong recommendation','The leader has strong evidence and a meaningful edge over the next option.'],
      close:['Close call','The leading options are within 2 percentage points. Treat their ordering as effectively tied.'],
      leading:['Best current fit','There is a leader, but evidence quality or source agreement does not support a strong call.'],
      promising:['Promising, weak evidence','Some variants look interesting, but none has enough coverage and sample quality to rank confidently.'],
      insufficient:['Insufficient evidence','No exact variant has enough covered matchup evidence for a useful recommendation.'],
    };
    const message=messages[model.state] || messages.insufficient;
    const primary=model.ranked.slice(0,3);
    const weak=model.lowerEvidence.slice(0,4);
    return `<div class="wsip-decision-state ${model.state}"><b>${message[0]}</b><span>${message[1]}</span></div>
      ${primary.length ? `<div class="recommendation-list">${primary.map(row => recommendationCard(row,model)).join('')}</div>` : ''}
      ${weak.length ? `<details class="evidence-watch" ${primary.length?'':'open'}><summary>${primary.length?'Promising variants with weaker evidence':'Evidence-limited variants'}</summary><div class="watch-grid">${weak.map(row => `<div class="watch-card">${sprite(row.name,32)}<span><b>${esc(row.name)}</b><small>${rate(row.expectedWR)} · ${pct(row.coverage)} coverage · ${esc(row.evidenceLabel)}</small></span></div>`).join('')}</div></details>` : ''}`;
  }

  function syncCompare(model) {
    const eligible=model.ranked.slice(0,3);
    const valid=new Set(eligible.map(row => row.name));
    for (const name of [...state.compare]) if (!valid.has(name)) state.compare.delete(name);
    if (!state.compare.size) eligible.slice(0,Math.min(3,eligible.length)).forEach(row => state.compare.add(row.name));
  }

  function compareHtml(model) {
    const eligible=model.ranked.slice(0,3);
    const rows=eligible.filter(row => state.compare.has(row.name));
    if (rows.length < 2) return '<div class="play-empty">At least two decision-ready variants are needed for a useful comparison.</div>';
    return `<div class="wsip-compare-grid">${rows.map(row => `<article><div class="compare-title">${sprite(row.name,36)}<b>${esc(row.name)}</b></div><dl><div><dt>Estimate</dt><dd>${rate(row.expectedWR)}</dd></div><div><dt>Evidence</dt><dd>${esc(row.evidenceLabel.replace(' evidence',''))}</dd></div><div><dt>Unknown field</dt><dd>${pct(row.unknownShare)}</dd></div><div><dt>Bad exposure</dt><dd>${pct(row.badExposure)}</dd></div><div><dt>Favourable exposure</dt><dd>${pct(row.favourableExposure)}</dd></div><div><dt>Profile</dt><dd>${row.polarised?'Polarised':'Balanced'}</dd></div></dl></article>`).join('')}</div>`;
  }

  function decideHtml(model) {
    const rows=model.ranked.slice(0,3);
    if (!rows.length) return '<p class="play-empty">Build more evidence before committing a deck choice.</p>';
    return `<p>Open an exact variant to inspect its results and H2H evidence. To use one for an event, make the choice explicitly in that event’s Prep workspace.</p><div class="wsip-decide-actions">${rows.map(row => `<button class="btn" type="button" data-open-deck="${esc(row.name)}">${esc(row.name)}</button>`).join('')}<a class="btn primary" href="../events/">Open Events</a></div>`;
  }

  function bindField() {
    const root=$('prepFieldOverview');
    root?.querySelectorAll('[data-field-toggle]').forEach(button => button.addEventListener('click', () => window.PrepField?.toggle?.(button.dataset.fieldToggle)));
    root?.querySelector('[data-field-reset]')?.addEventListener('click', () => window.PrepField?.reset?.());
    root?.querySelector('[data-field-expand]')?.addEventListener('click', () => { state.expandedField=!state.expandedField; render(); });
    root?.querySelector('[data-add-deck]')?.addEventListener('click', () => { state.addOpen=!state.addOpen; state.saveOpen=false; render(); });
    root?.querySelector('[data-save-field]')?.addEventListener('click', () => { state.saveOpen=!state.saveOpen; state.addOpen=false; render(); });
    root?.querySelector('[data-cancel-save]')?.addEventListener('click', () => { state.saveOpen=false; render(); });
    $('savedMetaSelect')?.addEventListener('change', event => { state.selectedSavedId=event.target.value; render(); });
    root?.querySelector('[data-load-saved]')?.addEventListener('click', () => { const item=window.SavedMetas?.get?.(state.selectedSavedId); if (item) window.PrepField?.applyExpectedField?.(item); });
    $('fieldAddSelect')?.addEventListener('change', event => { if (event.target.value) { window.PrepField?.add?.(event.target.value); state.addOpen=false; } });
    $('saveFieldForm')?.addEventListener('submit', event => {
      event.preventDefault();
      const item=window.SavedMetas?.save?.($('saveFieldName')?.value,window.PrepField?.snapshot?.(),'TEF-PBL',window.PrepField?.provenance?.());
      if (item) { state.selectedSavedId=item.id; state.saveOpen=false; render(); }
    });
  }

  function bindResults(model) {
    document.querySelectorAll('[data-toggle-compare]').forEach(button => button.addEventListener('click', () => {
      const name=button.dataset.toggleCompare;
      if (state.compare.has(name)) state.compare.delete(name);
      else if (state.compare.size < 3) state.compare.add(name);
      render();
    }));
    document.querySelectorAll('[data-open-deck]').forEach(button => button.addEventListener('click', () => window.MetaRouter?.openDetail?.(button.dataset.openDeck,'online','prep')));
    if ($('advancedSettingsSummary')) $('advancedSettingsSummary').textContent=`12-game neutral prior · ${matchupSource()==='combined'?'Online + IRL':matchupSource()} H2H · unknowns remain unknown`;
  }

  function render() {
    const fieldTarget=$('prepFieldOverview'), resultsTarget=$('prepResults'), compareTarget=$('prepCompare'), decideTarget=$('prepDecide');
    if (!fieldTarget || !resultsTarget || !compareTarget || !decideTarget) return;
    window.PrepField?.render?.();
    const model=buildModel();
    syncCompare(model);
    fieldTarget.innerHTML=fieldHtml();
    resultsTarget.innerHTML=recommendationHtml(model);
    compareTarget.innerHTML=compareHtml(model);
    decideTarget.innerHTML=decideHtml(model);
    bindField();
    bindResults(model);
    window.SearchableDecks?.upgrade?.();
  }

  async function activate() {
    render();
    if (!state.loading) state.loading=window.MetaData?.ensure?.(['onlineHistory','onlineMatchups','irlMatchups']).catch(error => console.warn('WSIP evidence unavailable.',error)).finally(() => { state.loading=null; });
    await state.loading;
    render();
  }

  $('playMatchupSource')?.addEventListener('change', activate);
  window.addEventListener('field:updated', render);
  window.addEventListener('savedmetas:updated', render);
  window.addEventListener('meta:data-changed', () => { if (!$('prep')?.classList.contains('hidden')) render(); });
  window.MetaPrep={ activate, render };
})();
