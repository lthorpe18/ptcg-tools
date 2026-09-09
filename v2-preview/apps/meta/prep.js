(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const pct = value => `${(100 * Number(value || 0)).toFixed(0)}%`;
  const rate = value => Number.isFinite(value) ? `≈${Math.round(value)}%` : '—';
  const detailRate = value => Number.isFinite(value) ? `${value.toFixed(1)}%` : '—';
  const state = { selectedSavedId:'', saveOpen:false, addOpen:false, expandedField:false, recommendationLimit:5, loading:null, loadKey:null, loadError:null, generation:0 };

  function sprite(name, size=40) { return window.DeckSprites?.html?.(name,{ size }) || ''; }
  function matchupSource() { return $('playMatchupSource')?.value || 'combined'; }

  function buildModel() {
    const definition = window.PrepField?.definition?.();
    const inputs = window.MetaWSIPSource?.inputs?.(definition, matchupSource()) || { candidates:[], evidence:{} };
    return window.PTCGRecommendation?.analyse?.({
      fieldRows:definition?.available === false ? [] : window.PrepField?.getField?.() || [],
      ...inputs,
      matchupSource:matchupSource(),
    }) || { field:[], ranked:[], lowerEvidence:[], all:[], state:'insufficient' };
  }

  function syncFormats() {
    const source = window.MetaWSIPSource.source(), options = window.MetaWSIPSource.formats();
    const control = $('playFieldFormatControl'), select = $('playFieldFormat');
    if (control) control.hidden = source === 'expected' || source === 'custom';
    if (!select) return;
    const target = window.PrepField?.definition?.()?.format;
    const choices = options.slice();
    if (target && !choices.some(row => row.format === target)) choices.push({format:target,available:false});
    const html = choices.map(row => `<option value="${esc(row.format)}" ${row.available ? '' : 'disabled'}>${esc(row.format)}${row.available ? '' : ' · unavailable'}</option>`).join('');
    if (select.innerHTML !== html) select.innerHTML = html;
    select.value = target || '';
    const blendOption = $('playFieldSource')?.querySelector('option[value="blend"]');
    if (blendOption) {
      blendOption.disabled = !window.MetaWSIPSource.formats('blend').some(row => row.available);
      blendOption.textContent = blendOption.disabled ? 'Blended current field · unavailable' : 'Blended current field';
    }
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

  function matchupTriplet(title, rows, tone) {
    return `<section class="wsip-matchup-triplet ${tone}"><h4>${esc(title)}</h4>${rows.length ? rows.map(item => `<div>${sprite(item.opponent,22)}<span><b>${esc(item.opponent)}</b><small>${item.decisiveGames} decisive games · ${pct(item.share)} of field</small></span><strong>${detailRate(item.estimate)}</strong></div>`).join('') : '<p>No decisive matchup evidence.</p>'}</section>`;
  }

  function driverHtml(row) {
    const known=(row.matchups || []).filter(item => item.known);
    const best=known.slice().sort((a,b) => b.estimate-a.estimate || b.decisiveGames-a.decisiveGames).slice(0,3);
    const worst=known.slice().sort((a,b) => a.estimate-b.estimate || b.decisiveGames-a.decisiveGames).slice(0,3);
    return `<div class="wsip-why">
      <div class="wsip-triplet-grid">${matchupTriplet('Best against',best,'best')}${matchupTriplet('Worst against',worst,'worst')}</div>
      <div class="wsip-risk-list">${row.unknownShare > 0.005 ? `<span>${pct(row.unknownShare)} of the field has no decisive H2H evidence.</span>` : ''}${row.polarised ? '<span>Polarised: meaningful winning and losing exposure.</span>' : ''}${row.sourceDisagreement ? `<span>Online and IRL estimates differ by ${row.sourceGap.toFixed(1)} points.</span>` : ''}</div>
      <details class="full-matchup-detail"><summary>Full field matchup detail</summary><div class="wsip-matchup-list">${row.matchups.slice().sort((a,b)=>b.share-a.share).map(item => `<div class="${item.known?'':'unknown'}"><span><b>${esc(item.opponent)}</b><small>${pct(item.share)} of field · ${item.known ? `${item.decisiveGames} decisive games` : 'no decisive evidence'}</small></span><strong>${item.known ? detailRate(item.estimate) : 'Unknown'}</strong></div>`).join('')}</div><p class="advanced-method">Rates use a 12-game neutral prior. The expected rate is calculated only over covered field share; unknown matchups are not treated as 50%.</p></details>
    </div>`;
  }

  function recommendationCard(row, model, options = {}) {
    const decisionReady=row.decisionReady !== false;
    const displayRank=options.displayRank ?? row.rank ?? null;
    const rankLabel=displayRank ? (model.closeCall && row.rank && row.rank <= 2 ? '≈' : `#${displayRank}`) : '•';
    const separation=row.rank === 1 && Number.isFinite(model.gap) ? (model.closeCall ? 'Effectively tied with #2' : `+${model.gap.toFixed(1)} vs next`) : row.rank > 1 ? `${row.gapFromLeader.toFixed(1)} behind leader` : '';
    const best=row.matchups?.filter(item=>item.known).slice().sort((a,b)=>b.estimate-a.estimate)[0];
    const worst=row.matchups?.filter(item=>item.known).slice().sort((a,b)=>a.estimate-b.estimate)[0];
    return `<article class="recommendation-card ${row.rank===1?'winner':''} ${decisionReady?'':'lower-evidence'}" data-open-deck-card="${esc(row.name)}" role="link" tabindex="0" aria-label="Open ${esc(row.name)} exact variant">
      <div class="rec-rank">${rankLabel}</div>
      <div class="rec-sprite">${sprite(row.name,38)}</div>
      <div class="rec-main"><h3>${esc(row.name)}</h3><p>${best ? `Best: ${esc(best.opponent)}` : 'No decisive positive matchup'}${worst ? ` · Risk: ${esc(worst.opponent)}` : ''}</p><div class="rec-meta">${evidenceBadge(row)}<span>H2H evidence against ${pct(row.coverage)} of field</span></div></div>
      <div class="rec-score"><b>${rate(row.expectedWR)}</b>${separation ? `<span>${esc(separation)}</span>` : ''}</div>
      <details class="rec-why"><summary>Why this deck?</summary>${driverHtml(row)}</details>
    </article>`;
  }

  function recommendationHtml(model) {
    const definition = window.PrepField?.definition?.();
    if (definition?.available === false) return `<div class="play-empty"><b>${esc(definition.format || 'Selected field')} · unavailable</b><span>${esc(definition.reason)}</span><button type="button" data-retry-wsip>Retry evidence</button></div>`;
    if (state.loadError) return '<div class="play-empty"><b>Compatible evidence could not load</b><span>Retry to analyse this field.</span><button type="button" data-retry-wsip>Retry evidence</button></div>';
    if (state.loading) return '<div class="play-empty">Loading compatible matchup evidence…</div>';
    if (!model.field.length) return '<div class="play-empty"><b>No field selected</b><span>Choose a field source or saved Expected Field.</span></div>';
    const messages={
      strong:['Strong recommendation','The leader has strong evidence and a meaningful edge over the next option.'],
      close:['Close call','The leading options are within 2 percentage points. Treat their ordering as effectively tied.'],
      leading:['Best current fit','There is a leader, but evidence quality or source agreement does not support a strong call.'],
      promising:['Promising, weak evidence','Some variants look interesting, but none has enough coverage and sample quality to rank confidently.'],
      insufficient:['Insufficient evidence','No exact variant has enough covered matchup evidence for a useful recommendation.'],
    };
    const message=messages[model.state] || messages.insufficient;
    const recommendations=[...model.ranked,...model.lowerEvidence];
    const shown=recommendations.slice(0,state.recommendationLimit);
    const remaining=Math.max(0,recommendations.length-shown.length);
    const cards=shown.map((row,index) => recommendationCard(row,model,{ displayRank:row.rank || (row.decisionReady ? index+1 : null) })).join('');
    const next=Math.min(5,remaining);
    return `<div class="wsip-decision-state ${model.state}"><b>${message[0]}</b><span>${message[1]}</span></div>
      ${cards ? `<div class="recommendation-list">${cards}</div>` : ''}
      ${remaining ? `<button class="show-more-recommendations" type="button" data-show-more-recommendations>Show ${next} more deck${next===1?'':'s'}</button>` : ''}`;
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
      const item=window.SavedMetas?.save?.($('saveFieldName')?.value,window.PrepField?.snapshot?.(),window.PrepField?.definition?.()?.format || null,window.PrepField?.provenance?.());
      if (item) { state.selectedSavedId=item.id; state.saveOpen=false; render(); }
    });
  }

  function bindResults() {
    document.querySelectorAll('[data-open-deck-card]').forEach(card => {
      const open=event => {
        if (event.target.closest?.('button,a,summary,details,input,select,label')) return;
        window.MetaRouter?.openDetail?.(card.dataset.openDeckCard,'online','prep');
      };
      card.addEventListener('click',open);
      card.addEventListener('keydown',event => {
        if ((event.key==='Enter' || event.key===' ') && !event.target.closest?.('button,a,summary,details,input,select,label')) {
          event.preventDefault();
          window.MetaRouter?.openDetail?.(card.dataset.openDeckCard,'online','prep');
        }
      });
    });
    document.querySelector('[data-show-more-recommendations]')?.addEventListener('click', () => {
      state.recommendationLimit += 5;
      render();
    });
    if ($('advancedSettingsSummary')) $('advancedSettingsSummary').textContent=`12-game neutral prior · ${matchupSource()==='combined'?'Online + IRL':matchupSource()} H2H · unknowns remain unknown`;
  }

  function render() {
    const fieldTarget=$('prepFieldOverview'), resultsTarget=$('prepResults');
    if (!fieldTarget || !resultsTarget) return;
    window.PrepField?.render?.();
    syncFormats();
    const model=buildModel();
    fieldTarget.innerHTML=fieldHtml();
    resultsTarget.innerHTML=recommendationHtml(model);
    bindField();
    bindResults();
    document.querySelector('[data-retry-wsip]')?.addEventListener('click', () => activate(true));
    window.MetaContext?.renderPrep?.();
    window.SearchableDecks?.upgrade?.();
    window.dispatchEvent(new CustomEvent('wsip:rendered'));
  }

  async function activate(force = false) {
    const definition = window.PrepField?.definition?.();
    const format = definition?.format || definition?.provenance?.targetFormat;
    const key = JSON.stringify([window.MetaData?.release?.(), format, matchupSource()]);
    if (!force && state.loadKey === key) { render(); return state.loading; }
    const generation = ++state.generation;
    state.loadKey = key;
    state.loadError = null;
    const environments = matchupSource() === 'combined' ? ['online','irl'] : [matchupSource()];
    const request = Promise.all([
      window.MetaBlendedField?.ensure?.(),
      ...environments.map(env => window.MetaData?.ensureForFormat?.(env, format)),
    ]);
    state.loading = request;
    render();
    try { await request; }
    catch (error) { if (generation === state.generation) state.loadError = error; }
    finally {
      if (generation === state.generation) { state.loading = null; render(); }
    }
  }

  const active = () => !$('prep')?.classList.contains('hidden');
  $('playFieldFormat')?.addEventListener('change', event => {
    if (window.MetaWSIPSource.select(event.target.value)) window.PrepField.reset();
  });
  $('playMatchupSource')?.addEventListener('change', () => { state.recommendationLimit=5; activate(); });
  window.addEventListener('field:updated', () => { state.recommendationLimit=5; if (active()) activate(); });
  window.addEventListener('savedmetas:updated', () => { if (active()) render(); });
  window.addEventListener('meta:data-changed', () => { if (active()) activate(); });
  window.MetaPrep={ activate, render, buildModel };
})();
