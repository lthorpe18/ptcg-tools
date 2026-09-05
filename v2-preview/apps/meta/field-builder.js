(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { rows:new Map(), touched:false, showAll:false, expectedField:null, definition:null };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const pct = value => `${(100 * Number(value || 0)).toFixed(1)}%`;

  function source() { return $('playFieldSource')?.value || 'blend'; }

  function resolveDefinition() {
    return window.PTCGMetaField?.resolve?.({ source:source(), expectedField:state.expectedField }) || { source:source(), rows:[], provenance:{} };
  }

  function resetFromDefinition() {
    state.definition=resolveDefinition();
    const selection=(state.definition.source === 'expected' || state.definition.source === 'custom')
      ? { rows:state.definition.rows }
      : (window.PTCGMetaField?.selectCoverage?.(state.definition.rows, 0.9) || { rows:[] });
    state.rows.clear();
    const selectedNames=new Set(selection.rows.map(row => row.name));
    for (const row of state.definition.rows) state.rows.set(row.name, {
      name:row.name, share:row.share, originalShare:row.share,
      included:selectedNames.has(row.name), defaultIncluded:selectedNames.has(row.name), pinned:false,
    });
    state.touched=false;
    state.showAll=false;
  }

  function ensure() {
    if (!state.definition) resetFromDefinition();
    return state.definition;
  }

  function selectedRaw() { ensure(); return [...state.rows.values()].filter(row => row.included && row.share > 0); }
  function getField() { return window.PTCGMetaField?.normalizeRows?.(selectedRaw()) || []; }
  function snapshot() { return getField().map(({ name, share }) => ({ name, share })); }
  function originalCoverage() { return selectedRaw().reduce((sum,row) => sum + Number(row.originalShare || 0), 0); }

  function allRows() {
    ensure();
    const selected=new Map(getField().map(row => [row.name, row.share]));
    return [...state.rows.values()].sort((a,b) => b.originalShare-a.originalShare || a.name.localeCompare(b.name)).map(row => ({
      ...row, modelShare:row.included ? Number(selected.get(row.name) || 0) : null,
    }));
  }

  function getChipRows() { return allRows().filter(row => row.defaultIncluded || row.included || row.pinned); }

  function provenance() {
    const definition=ensure();
    return { ...(definition.provenance || {}), identity:'exact-variant', selectedCoverage:originalCoverage(), fieldRows:snapshot().length };
  }

  function sourceLabel() {
    const definition=ensure();
    if (definition.source === 'blend') {
      const weights=definition.provenance?.weights || {};
      return `Blended current field · ${Math.round(100 * Number(weights.online || 0))}% Online / ${Math.round(100 * Number(weights.irl || 0))}% IRL`;
    }
    return definition.provenance?.label || definition.definition?.label || 'Expected field';
  }

  function renderEditor() {
    const target=$('fieldEditor');
    if (!target) return;
    const rows=allRows();
    if (!rows.length) {
      target.innerHTML='<div class="prep-empty">No exact-variant field data is available for this source.</div>';
      if ($('fieldCoverage')) $('fieldCoverage').textContent='0% represented';
      return;
    }
    const visible=state.showAll ? rows : rows.filter(row => row.defaultIncluded || row.included || row.pinned);
    if ($('fieldCoverage')) $('fieldCoverage').textContent=`${visible.filter(row => row.included).length} variants · ${pct(originalCoverage())} of source field represented`;
    if ($('fieldShowAll')) $('fieldShowAll').textContent=state.showAll ? 'Top field' : 'Show all';
    target.innerHTML=`<div class="field-edit-list">${visible.map(row => `<label class="field-edit-row ${row.included ? '' : 'off'}"><input class="field-check" data-name="${esc(row.name)}" type="checkbox" ${row.included ? 'checked' : ''}><span>${window.DeckSprites?.html?.(row.name,{size:28}) || ''}<b>${esc(row.name)}</b></span><span class="field-edit-share"><input class="field-share" data-name="${esc(row.name)}" type="number" min="0" max="100" step="0.1" value="${(100 * Number(row.share || 0)).toFixed(1)}" ${row.included ? '' : 'disabled'}><i>%</i></span></label>`).join('')}</div>`;
    target.querySelectorAll('.field-check').forEach(input => input.addEventListener('change', () => setIncluded(input.dataset.name, input.checked)));
    target.querySelectorAll('.field-share').forEach(input => input.addEventListener('change', () => {
      const row=state.rows.get(input.dataset.name);
      if (!row) return;
      row.share=Math.max(0, Number(input.value || 0)) / 100;
      row.included=row.share > 0;
      row.pinned=true;
      state.touched=true;
      renderEditor();
      notify();
    }));
  }

  function notify() { window.dispatchEvent(new CustomEvent('field:updated')); }
  function setIncluded(name, included=true) {
    ensure();
    const row=state.rows.get(name);
    if (!row) return false;
    row.included=!!included;
    row.pinned=true;
    state.touched=true;
    renderEditor();
    notify();
    return true;
  }
  function toggle(name) { const row=state.rows.get(name); return row ? setIncluded(name,!row.included) : false; }
  function add(name) { return setIncluded(name,true); }
  function reset() { resetFromDefinition(); renderEditor(); notify(); }

  function applyExpectedField(record) {
    const rows=window.PTCGMetaField?.normalizeRows?.(record?.field || record?.rows || []) || [];
    if (!rows.length) return false;
    state.expectedField={ ...record, field:rows };
    if ($('playFieldSource')) $('playFieldSource').value='expected';
    resetFromDefinition();
    renderEditor();
    notify();
    return true;
  }

  function applyComposition(rows) { return applyExpectedField({ name:'Custom Expected Field', field:rows, provenance:{ type:'expected-field', source:'custom', identity:'exact-variant' } }); }

  function handleSourceChange() {
    if (source() === 'expected' && !state.expectedField) state.expectedField=window.SavedMetas?.list?.()[0] || null;
    resetFromDefinition();
    renderEditor();
    notify();
  }

  function bind() {
    $('playFieldSource')?.addEventListener('change', handleSourceChange);
    $('fieldReset')?.addEventListener('click', reset);
    $('fieldAll')?.addEventListener('click', () => { ensure(); for (const row of state.rows.values()) row.included=true; state.touched=true; renderEditor(); notify(); });
    $('fieldNone')?.addEventListener('click', () => { ensure(); for (const row of state.rows.values()) row.included=false; state.touched=true; renderEditor(); notify(); });
    $('fieldShowAll')?.addEventListener('click', () => { state.showAll=!state.showAll; renderEditor(); });
    window.addEventListener('meta:data-changed', () => { if (!state.touched && source() !== 'expected') { resetFromDefinition(); renderEditor(); notify(); } });
  }

  window.PrepField={ getField, getChipRows, getAllRows:allRows, getOriginalCoverage:originalCoverage, snapshot, provenance, sourceLabel, applyExpectedField, applyComposition, render:renderEditor, toggle, add, setIncluded, reset };
  bind();
})();
