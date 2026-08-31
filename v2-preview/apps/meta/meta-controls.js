(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));

  function optionHtml(options) {
    const base = options.filter(x => !x.event).map(x => `<option value="${esc(x.value)}">${esc(x.label)}</option>`).join('');
    const events = options.filter(x => x.event).map(x => `<option value="${esc(x.value)}">${esc(x.label)}</option>`).join('');
    return base + (events ? `<optgroup label="Individual tournaments">${events}</optgroup>` : '');
  }

  function selectedLabel(select) {
    return select?.selectedOptions?.[0]?.textContent?.trim() || '';
  }

  function setOptions(select, options, value) {
    if (!select) return;
    const html = optionHtml(options);
    if (select.dataset.metaOptions !== html) {
      select.innerHTML = html;
      select.dataset.metaOptions = html;
    }
    select.value = value;
  }

  function syncLandingOptions(source) {
    const select = $('currentWindow');
    if (!select) return;
    const state = window.MetaState.get();
    setOptions(select, source === 'irl' ? window.MetaState.irlScopes() : window.MetaState.onlineScopes(), source === 'irl' ? state.irlScope : state.onlineScope);
    select.setAttribute('aria-label', source === 'irl' ? 'IRL scope' : 'Online scope');
  }

  function ensureScopedControl(sourceSelectId, hostSelector, prefix) {
    const sourceSelect = $(sourceSelectId);
    const host = sourceSelect?.closest(hostSelector);
    if (!sourceSelect || !host) return;
    let wrap = $(`${prefix}ScopeWrap`);
    if (!wrap) {
      wrap = document.createElement('label');
      wrap.id = `${prefix}ScopeWrap`;
      wrap.className = 'meta-scope-control';
      wrap.innerHTML = `<span></span><select id="${prefix}Scope"></select>`;
      host.appendChild(wrap);
      $(`${prefix}Scope`).addEventListener('change', e => {
        sourceSelect.value === 'irl' ? window.MetaState.setIrlScope(e.currentTarget.value) : window.MetaState.setOnlineScope(e.currentTarget.value);
      });
    }
    const state = window.MetaState.get();
    const source = sourceSelect.value || 'online';
    wrap.querySelector('span').textContent = source === 'irl' ? 'IRL scope' : 'Online scope';
    setOptions($(`${prefix}Scope`), source === 'irl' ? window.MetaState.irlScopes() : window.MetaState.onlineScopes(), source === 'irl' ? state.irlScope : state.onlineScope);
  }

  function bindPair(visibleId, modelId) {
    const visible = $(visibleId), model = $(modelId);
    if (!visible || !model || visible.dataset.metaBound === '1') return;
    visible.dataset.metaBound = '1';
    visible.value = model.value;
    visible.addEventListener('change', () => {
      if (model.value !== visible.value) {
        model.value = visible.value;
        model.dispatchEvent(new Event('change', { bubbles: true }));
      }
      syncPrepSections();
    });
    model.addEventListener('change', () => {
      if (visible.value !== model.value) visible.value = model.value;
    });
  }

  function ensurePrepSourceDetails() {
    const sourceRow = $('playFieldSource')?.closest('.child-source-row');
    if (!sourceRow) return $('playSourceDetails');
    let details = $('playSourceDetails');
    if (!details) {
      details = document.createElement('details');
      details.id = 'playSourceDetails';
      details.className = 'play-source-details';
      details.innerHTML = '<summary><span><b>Data sources</b><small id="playSourceSummary"></small></span><span class="play-source-chevron">⌄</span></summary><div id="playSourceBody" class="play-source-body"><section id="playFieldSection" class="play-source-section"><div class="play-source-section-title">Field</div><div id="playFieldControls" class="play-source-section-controls"></div><div id="playFieldContext" class="play-source-section-context"></div></section><section id="playMatchupSection" class="play-source-section"><div class="play-source-section-title">Matchups</div><div id="playMatchupControls" class="play-source-section-controls"></div><div id="playMatchupContext" class="play-source-section-context"></div></section></div>';
      sourceRow.parentNode.insertBefore(details, sourceRow);
      const labels = [...sourceRow.querySelectorAll(':scope > label')];
      if (labels[0]) $('playFieldControls').appendChild(labels[0]);
      if (labels[1]) $('playMatchupControls').appendChild(labels[1]);
      sourceRow.remove();
    }
    return details;
  }

  function ensurePrepScope(host, source, kind) {
    const id = `play${kind}${source === 'online' ? 'Online' : 'Irl'}Scope`;
    let wrap = $(`${id}Wrap`);
    if (!wrap) {
      wrap = document.createElement('label');
      wrap.id = `${id}Wrap`;
      wrap.className = 'meta-scope-control';
      wrap.innerHTML = `<span>${source === 'online' ? 'Online' : 'IRL'} scope</span><select id="${id}"></select>`;
      host.appendChild(wrap);
      $(id).addEventListener('change', e => source === 'online'
        ? window.MetaState.setOnlineScope(e.currentTarget.value)
        : window.MetaState.setIrlScope(e.currentTarget.value));
    }
    const state = window.MetaState.get();
    setOptions($(id), source === 'online' ? window.MetaState.onlineScopes() : window.MetaState.irlScopes(), source === 'online' ? state.onlineScope : state.irlScope);
    return wrap;
  }

  function syncPrepSummary() {
    const summary = $('playSourceSummary');
    if (summary) summary.textContent = `Field: ${selectedLabel($('playFieldSource')) || 'Online'} · Matchups: ${selectedLabel($('playMatchupSource')) || 'Online'}`;
  }

  function syncPrepSections() {
    if (!ensurePrepSourceDetails()) return;
    const fieldHost = $('playFieldControls');
    const matchupHost = $('playMatchupControls');
    if (!fieldHost || !matchupHost) return;

    fieldHost.querySelectorAll('.meta-scope-control').forEach(el => { el.hidden = true; });
    matchupHost.querySelectorAll('.meta-scope-control').forEach(el => { el.hidden = true; });

    const field = $('playFieldSource')?.value || 'online';
    const matchup = $('playMatchupSource')?.value || 'online';

    if (field === 'online') ensurePrepScope(fieldHost, 'online', 'Field').hidden = false;
    if (field === 'irl') ensurePrepScope(fieldHost, 'irl', 'Field').hidden = false;
    if (field === 'blend') {
      ensurePrepScope(fieldHost, 'online', 'Field').hidden = false;
      ensurePrepScope(fieldHost, 'irl', 'Field').hidden = false;
    }

    if (matchup === 'online') ensurePrepScope(matchupHost, 'online', 'Matchup').hidden = false;
    if (matchup === 'irl') ensurePrepScope(matchupHost, 'irl', 'Matchup').hidden = false;
    if (matchup === 'combined') {
      ensurePrepScope(matchupHost, 'online', 'Matchup').hidden = false;
      ensurePrepScope(matchupHost, 'irl', 'Matchup').hidden = false;
    }

    syncPrepSummary();
  }

  function detailSource() {
    return $('deckDetailHead')?.querySelector('[data-detail-source].active')?.dataset.detailSource || 'online';
  }

  function syncDetail() {
    const head = $('deckDetailHead');
    if (!head || $('deckDetail')?.classList.contains('hidden')) return;
    let wrap = $('deckDetailScopeWrap');
    if (!wrap) {
      wrap = document.createElement('label');
      wrap.id = 'deckDetailScopeWrap';
      wrap.className = 'meta-scope-control detail-scope-control';
      wrap.innerHTML = '<span></span><select id="deckDetailScope"></select>';
      head.appendChild(wrap);
      $('deckDetailScope').addEventListener('change', e => detailSource() === 'irl' ? window.MetaState.setIrlScope(e.currentTarget.value) : window.MetaState.setOnlineScope(e.currentTarget.value));
    }
    const active = detailSource();
    wrap.querySelector('span').textContent = active === 'irl' ? 'IRL scope' : 'Online scope';
    const state = window.MetaState.get();
    setOptions($('deckDetailScope'), active === 'irl' ? window.MetaState.irlScopes() : window.MetaState.onlineScopes(), active === 'irl' ? state.irlScope : state.onlineScope);
  }

  function syncVisibleControls() {
    const activeSource = document.querySelector('[data-current-source].active')?.dataset.currentSource || 'online';
    syncLandingOptions(activeSource);
    if (!$('matchups')?.classList.contains('hidden')) ensureScopedControl('matchupPageSource', '.single-source-control', 'matchupPage');
    if (!$('decks')?.classList.contains('hidden')) ensureScopedControl('deckPageSource', '.single-source-control', 'deckPage');
    if (!$('prep')?.classList.contains('hidden')) syncPrepSections();
    if (!$('deckDetail')?.classList.contains('hidden')) syncDetail();
  }

  bindPair('playFieldSource', 'fieldSource');
  bindPair('playMatchupSource', 'matchupSource');
  document.querySelectorAll('[data-current-source]').forEach(btn => btn.addEventListener('click', () => syncLandingOptions(btn.dataset.currentSource)));
  $('currentWindow')?.addEventListener('change', e => {
    const source = document.querySelector('[data-current-source].active')?.dataset.currentSource || 'online';
    source === 'irl' ? window.MetaState.setIrlScope(e.currentTarget.value) : window.MetaState.setOnlineScope(e.currentTarget.value);
  });
  $('matchupPageSource')?.addEventListener('change', () => ensureScopedControl('matchupPageSource', '.single-source-control', 'matchupPage'));
  $('deckPageSource')?.addEventListener('change', () => ensureScopedControl('deckPageSource', '.single-source-control', 'deckPage'));
  $('playFieldSource')?.addEventListener('change', syncPrepSections);
  $('playMatchupSource')?.addEventListener('change', syncPrepSections);
  window.addEventListener('meta:data-changed', syncVisibleControls);
  document.addEventListener('click', e => {
    if (e.target.closest('[data-meta-view]')) setTimeout(syncVisibleControls, 0);
    if (e.target.closest('[data-detail-source]')) setTimeout(syncDetail, 0);
  });

  const main = document.querySelector('main.wrap');
  if (main && !document.getElementById('deckDetail')) {
    const observer = new MutationObserver(() => {
      if (!document.getElementById('deckDetail')) return;
      observer.disconnect();
      setTimeout(syncDetail, 0);
    });
    observer.observe(main, { childList: true });
  }

  const style = document.createElement('style');
  style.textContent = '.meta-scope-control,.play-source-section-controls>label{display:grid;gap:4px;min-width:0;color:#667085;font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}.meta-scope-control select,.play-source-section-controls select{appearance:auto;width:100%;min-height:42px;border:1px solid #d0d5dd;border-radius:10px;background:#fff;padding:0 10px;color:#101828;font:inherit;font-size:13px;font-weight:700;box-sizing:border-box}.detail-scope-control{margin-top:8px}.single-source-control{flex-wrap:wrap}.meta-scope-control{flex:1}.meta-scope-control[hidden]{display:none!important}.play-source-details{margin-top:10px;border:1px solid #e1e5eb;border-radius:14px;background:#fff;overflow:hidden}.play-source-details summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;cursor:pointer}.play-source-details summary::-webkit-details-marker{display:none}.play-source-details summary>span:first-child{display:grid;gap:2px;min-width:0}.play-source-details summary b{font-size:13px;color:#101828}.play-source-details summary small{font-size:11px;color:#667085;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.play-source-chevron{font-size:18px;color:#667085;transition:transform .15s ease}.play-source-details[open] .play-source-chevron{transform:rotate(180deg)}.play-source-body{padding:0 12px 12px}.play-source-details:not([open]) .play-source-body{display:none}.play-source-section{padding:12px 0}.play-source-section+.play-source-section{border-top:1px solid #e4e7ec}.play-source-section-title{margin-bottom:8px;color:#344054;font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}.play-source-section-controls{display:grid;gap:8px}.play-source-section-context{margin-top:10px}.play-source-section-context:empty{display:none}@media(max-width:600px){.single-source-control{display:grid!important;grid-template-columns:1fr}}';
  document.head.appendChild(style);
  window.MetaControls = { sync: syncVisibleControls, syncDetail, syncPrep: syncPrepSections };
  ensurePrepSourceDetails();
  syncPrepSections();
  setTimeout(syncVisibleControls, 0);
})();