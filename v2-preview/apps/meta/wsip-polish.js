(() => {
  'use strict';

  const $ = id => document.getElementById(id);

  function setLoading(active) {
    $('prep')?.classList.toggle('wsip-loading', !!active);
  }

  function setText(node, text) {
    if (node && node.textContent !== text) node.textContent = text;
  }

  function setAttr(node, name, value) {
    if (node && node.getAttribute(name) !== value) node.setAttribute(name, value);
  }

  function savedFieldName() {
    const selected = $('savedMetaSelect')?.value;
    return selected ? window.SavedMetas?.get?.(selected)?.name || '' : '';
  }

  function syncTopFieldControl() {
    const select = $('playFieldSource');
    if (!select) return;
    const expected = select.querySelector('option[value="expected"]');
    if (expected) expected.hidden = true;
    const active = select.value === 'expected';
    const label = select.closest('label');
    if (label) {
      label.hidden = active;
      label.classList.remove('custom-field-active');
    }
    setAttr(select, 'aria-label', 'Field source');
  }

  function dayKey(value) {
    return String(value || '').slice(0, 10);
  }

  function todayKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function allParticipations() {
    if (window.PTCGStorage?.allParticipations) return window.PTCGStorage.allParticipations();
    try {
      const raw = JSON.parse(localStorage.getItem('ptcg-tools-v2') || '{}');
      return Array.isArray(raw.eventParticipations) ? raw.eventParticipations : [];
    } catch {
      return [];
    }
  }

  function nextAttendingEvent() {
    const today = todayKey();
    return allParticipations()
      .filter(row => {
        const date = dayKey(row?.eventSnapshot?.startDate);
        return row?.attendanceStatus === 'attending' && !row.archivedAt && !row.completion && date && date >= today;
      })
      .sort((a, b) => dayKey(a.eventSnapshot?.startDate).localeCompare(dayKey(b.eventSnapshot?.startDate)))[0] || null;
  }

  function eventName(row) {
    const event = row?.eventSnapshot || {};
    return event.name || event.venue || event.city || 'Upcoming tournament';
  }

  function eventMeta(row) {
    const event = row?.eventSnapshot || {};
    const key = dayKey(event.startDate);
    let date = '';
    if (key) {
      const parsed = new Date(`${key}T12:00:00`);
      if (!Number.isNaN(parsed.getTime())) date = parsed.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' });
    }
    const parts = [date, event.type].filter(Boolean);
    return parts.join(' · ');
  }

  function fieldModeLabel() {
    const source = $('playFieldSource')?.value || 'blend';
    if (source === 'expected') return savedFieldName() ? `Saved · ${savedFieldName()}` : 'Saved field';
    if (source === 'online') return 'Online';
    if (source === 'irl') return 'IRL';
    return 'Blended';
  }

  function fieldSummary() {
    const definition = window.PrepField?.definition?.() || {};
    const format = definition.format || definition.provenance?.targetFormat || '';
    const coverage = Number(window.PrepField?.getOriginalCoverage?.());
    const parts = [fieldModeLabel(), format];
    if (Number.isFinite(coverage) && coverage > 0) parts.push(`${Math.round(coverage * 100)}%`);
    return parts.filter(Boolean).join(' · ');
  }

  function matchupLabel() {
    const source = $('playMatchupSource')?.value || 'combined';
    return source === 'online' ? 'Online H2H' : source === 'irl' ? 'IRL H2H' : 'Online+IRL H2H';
  }

  function setupSummary() {
    return [fieldSummary(), matchupLabel()].filter(Boolean).join(' · ');
  }

  function ensureSimplifiedLayout() {
    const prep = $('prep');
    const header = prep?.querySelector('.meta-child-header');
    const title = header?.querySelector('.meta-child-title');
    const controls = header?.querySelector('.child-source-row');
    const sourceContext = $('playSourceContext');
    const fieldSurface = prep?.querySelector('.field-surface');
    if (!prep || !header || !title || !controls || !sourceContext || !fieldSurface) return;

    const subtitle = title.querySelector('p');
    setText(subtitle, 'Best choices for the field you expect.');

    if (!$('wsipContextCard')) {
      $('wsipEventContext')?.remove();
      $('wsipFieldEditor')?.remove();
      $('wsipAnalysisSettings')?.remove();

      const card = document.createElement('section');
      card.id = 'wsipContextCard';
      card.className = 'wsip-context-card';

      const event = document.createElement('div');
      event.id = 'wsipEventContext';
      event.className = 'wsip-event-context';
      event.innerHTML = `<div><small>Preparing for</small><strong id="wsipEventName">Next tournament</strong><span id="wsipEventMeta"></span></div><a href="../events/" class="wsip-context-action" id="wsipEventAction">Change</a>`;

      const setup = document.createElement('details');
      setup.id = 'wsipFieldEditor';
      setup.className = 'wsip-field-editor';
      setup.innerHTML = `<summary><span><small>Setup</small><strong id="wsipSetupSummary">Current field</strong></span><span class="wsip-context-action">Adjust</span></summary><div class="wsip-setup-body"><div class="wsip-field-editor-body"></div><div class="wsip-analysis-body"></div></div>`;

      card.appendChild(event);
      card.appendChild(setup);
      title.after(card);

      setup.querySelector('.wsip-field-editor-body')?.appendChild(fieldSurface);
      const analysis = setup.querySelector('.wsip-analysis-body');
      analysis?.appendChild(controls);
      analysis?.appendChild(sourceContext);
    }

    prep.querySelector('.wsip-step')?.setAttribute('aria-hidden', 'true');
  }

  function syncCompactContext() {
    ensureSimplifiedLayout();
    const event = nextAttendingEvent();
    setText($('wsipEventName'), event ? eventName(event) : 'No upcoming attending event');
    setText($('wsipEventMeta'), event ? eventMeta(event) : 'Choose an event in Compete when you are ready.');
    setText($('wsipEventAction'), event ? 'Change' : 'Choose');
    setText($('wsipSetupSummary'), setupSummary() || 'Expected field');
  }

  function installSavedFieldAutoLoad() {
    document.addEventListener('change', event => {
      if (event.target?.id !== 'savedMetaSelect') return;
      const id = event.target.value;
      if (!id) { syncTopFieldControl(); syncCompactContext(); return; }
      queueMicrotask(() => {
        const item = window.SavedMetas?.get?.(id);
        if (item) window.PrepField?.applyExpectedField?.(item);
        syncTopFieldControl();
        syncCompactContext();
      });
    });
    document.addEventListener('change', event => {
      if (event.target?.id !== 'playFieldSource') return;
      if (event.target.value !== 'expected') {
        const saved = $('savedMetaSelect');
        if (saved) saved.value = '';
      }
      queueMicrotask(() => { syncTopFieldControl(); syncCompactContext(); });
    });
    document.addEventListener('change', event => {
      if (event.target?.id === 'playMatchupSource' || event.target?.id === 'playFieldFormat') queueMicrotask(syncCompactContext);
    });
    window.addEventListener('savedmetas:updated', () => queueMicrotask(() => { syncTopFieldControl(); syncCompactContext(); }));
  }

  function installLoadingGuard() {
    const original = window.MetaPrep?.activate;
    if (!original || original.__wsipPolished) return;
    const wrapped = async function(...args) {
      setLoading(true);
      try {
        return await original.apply(this, args);
      } finally {
        setLoading(false);
        syncTopFieldControl();
        syncCompactContext();
      }
    };
    wrapped.__wsipPolished = true;
    window.MetaPrep.activate = wrapped;
  }

  function detailFieldOptions() {
    const saved = window.SavedMetas?.list?.() || [];
    const base = `<option value="source:blend">Blended current field</option><option value="source:online">Online field</option><option value="source:irl">IRL field</option>`;
    const savedOptions = saved.length ? `<optgroup label="Saved Expected Fields">${saved.map(item => `<option value="saved:${item.id}">${item.name}</option>`).join('')}</optgroup>` : '';
    return base + savedOptions;
  }

  function installDeckDetailFieldLens() {
    const head = $('deckDetailHead');
    if (!head) return;
    let detailChoice = 'source:blend';
    const render = () => {
      if (!$('deckDetail') || $('deckDetail').classList.contains('hidden') || head.querySelector('[data-detail-field-lens]')) return;
      const h1 = head.querySelector('h1');
      if (!h1) return;
      const panel = document.createElement('div');
      panel.className = 'detail-field-lens';
      panel.dataset.detailFieldLens = 'true';
      panel.innerHTML = `<label><span>Evaluate against</span><select data-detail-field-select>${detailFieldOptions()}</select></label><button type="button" class="btn" data-detail-field-open>Open in What should I play?</button><small class="detail-field-note">Choose the current field or one of your saved Expected Fields.</small>`;
      const select = panel.querySelector('[data-detail-field-select]');
      if ([...select.options].some(option => option.value === detailChoice)) select.value = detailChoice;
      else detailChoice = select.value;
      select.addEventListener('change', () => { detailChoice = select.value; });
      panel.querySelector('[data-detail-field-open]').addEventListener('click', () => {
        if (detailChoice.startsWith('saved:')) {
          const item = window.SavedMetas?.get?.(detailChoice.slice(6));
          if (item) window.PrepField?.applyExpectedField?.(item);
        } else {
          const value = detailChoice.replace('source:','');
          const source = $('playFieldSource');
          if (source) {
            source.value = value;
            source.dispatchEvent(new Event('change', { bubbles:true }));
          }
        }
        document.querySelector('[data-meta-route="prep"]')?.click();
        queueMicrotask(() => { syncTopFieldControl(); syncCompactContext(); });
      });
      head.appendChild(panel);
    };
    new MutationObserver(() => requestAnimationFrame(render)).observe(head, { childList:true, subtree:true });
    window.addEventListener('savedmetas:updated', () => {
      head.querySelector('[data-detail-field-lens]')?.remove();
      requestAnimationFrame(render);
    });
    render();
  }

  function boot() {
    ensureSimplifiedLayout();
    installLoadingGuard();
    installSavedFieldAutoLoad();
    installDeckDetailFieldLens();
    syncTopFieldControl();
    syncCompactContext();
    window.addEventListener('wsip:rendered', () => { syncTopFieldControl(); syncCompactContext(); });
    window.addEventListener('ptcg:local-change', syncCompactContext);
    window.addEventListener('pageshow', syncCompactContext);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();