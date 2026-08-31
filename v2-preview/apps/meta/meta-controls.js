(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function optionHtml(options) {
    const base = options.filter(x => !x.event).map(x => `<option value="${esc(x.value)}">${esc(x.label)}</option>`).join('');
    const events = options.filter(x => x.event).map(x => `<option value="${esc(x.value)}">${esc(x.label)}</option>`).join('');
    return base + (events ? `<optgroup label="Individual tournaments">${events}</optgroup>` : '');
  }

  function selectedLabel(select) {
    return select?.selectedOptions?.[0]?.textContent?.trim() || '';
  }

  function syncLandingOptions(source) {
    const select = $('currentWindow');
    if (!select) return;
    const state = window.MetaState.get();
    select.innerHTML = optionHtml(source === 'irl' ? window.MetaState.irlScopes() : window.MetaState.onlineScopes());
    select.value = source === 'irl' ? state.irlScope : state.onlineScope;
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
    const select = $(`${prefix}Scope`);
    select.innerHTML = optionHtml(source === 'irl' ? window.MetaState.irlScopes() : window.MetaState.onlineScopes());
    select.value = source === 'irl' ? state.irlScope : state.onlineScope;
    select.setAttribute('aria-label', source === 'irl' ? 'IRL scope' : 'Online scope');
  }

  function bindPair(visibleId, modelId) {
    const visible = $(visibleId), model = $(modelId);
    if (!visible || !model || visible.dataset.metaBound === '1') return;
    visible.dataset.metaBound = '1';
    visible.value = model.value;
    visible.addEventListener('change', () => {
      model.value = visible.value;
      model.dispatchEvent(new Event('change', { bubbles: true }));
      syncPrepScopes();
    });
    model.addEventListener('change', () => { visible.value = model.value; syncPrepScopes(); });
  }

  function ensurePrepSourceDetails() {
    const header = $('playFieldSource')?.closest('.meta-child-header');
    const sourceRow = $('playFieldSource')?.closest('.child-source-row');
    if (!header || !sourceRow) return null;
    let details = $('playSourceDetails');
    if (!details) {
      details = document.createElement('details');
      details.id = 'playSourceDetails';
      details.className = 'play-source-details';
      details.innerHTML = '<summary><span><b>Data sources</b><small id="playSourceSummary"></small></span><span class="play-source-chevron">⌄</span></summary><div id="playSourceBody" class="play-source-body"></div>';
      sourceRow.parentNode.insertBefore(details, sourceRow);
      $('playSourceBody').appendChild(sourceRow);
    }
    return details;
  }

  function syncPrepSummary() {
    const summary = $('playSourceSummary');
    if (!summary) return;
    const field = selectedLabel($('playFieldSource')) || 'Online';
    const matchups = selectedLabel($('playMatchupSource')) || 'Online';
    summary.textContent = `Field: ${field} · Matchups: ${matchups}`;
  }

  function syncPrepScopes() {
    const details = ensurePrepSourceDetails();
    const header = $('playFieldSource')?.closest('.meta-child-header');
    if (!header || !details) return;
    let row = $('playScopeControls');
    if (!row) {
      row = document.createElement('div');
      row.id = 'playScopeControls';
      row.className = 'play-scope-controls';
      row.innerHTML = '<label id="playOnlineScopeWrap"><span>Online scope</span><select id="playOnlineScope"></select></label><label id="playIrlScopeWrap"><span>IRL scope</span><select id="playIrlScope"></select></label>';
      $('playSourceBody').appendChild(row);
      $('playOnlineScope').addEventListener('change', e => window.MetaState.setOnlineScope(e.currentTarget.value));
      $('playIrlScope').addEventListener('change', e => window.MetaState.setIrlScope(e.currentTarget.value));
    }
    const field = $('playFieldSource')?.value || 'online';
    const matchups = $('playMatchupSource')?.value || 'online';
    const needsOnline = ['online','blend'].includes(field) || ['online','combined'].includes(matchups);
    const needsIrl = ['irl','blend'].includes(field) || ['irl','combined'].includes(matchups);
    const state = window.MetaState.get();
    $('playOnlineScopeWrap').hidden = !needsOnline;
    $('playIrlScopeWrap').hidden = !needsIrl;
    $('playOnlineScope').innerHTML = optionHtml(window.MetaState.onlineScopes());
    $('playOnlineScope').value = state.onlineScope;
    $('playIrlScope').innerHTML = optionHtml(window.MetaState.irlScopes());
    $('playIrlScope').value = state.irlScope;
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
      $('deckDetailScope').addEventListener('change', e => {
        detailSource() === 'irl' ? window.MetaState.setIrlScope(e.currentTarget.value) : window.MetaState.setOnlineScope(e.currentTarget.value);
      });
    }
    const active = detailSource();
    wrap.querySelector('span').textContent = active === 'irl' ? 'IRL scope' : 'Online scope';
    const state = window.MetaState.get();
    const select = $('deckDetailScope');
    const html = optionHtml(active === 'irl' ? window.MetaState.irlScopes() : window.MetaState.onlineScopes());
    if (select.dataset.options !== html) {
      select.innerHTML = html;
      select.dataset.options = html;
    }
    select.value = active === 'irl' ? state.irlScope : state.onlineScope;
    window.MetaContext?.render?.();
  }

  function syncAll() {
    const activeSource = document.querySelector('[data-current-source].active')?.dataset.currentSource || 'online';
    syncLandingOptions(activeSource);
    ensureScopedControl('matchupPageSource', '.single-source-control', 'matchupPage');
    ensureScopedControl('deckPageSource', '.single-source-control', 'deckPage');
    syncPrepScopes();
    syncDetail();
  }

  bindPair('playFieldSource', 'fieldSource');
  bindPair('playMatchupSource', 'matchupSource');
  document.querySelectorAll('[data-current-source]').forEach(btn => btn.addEventListener('click', () => syncLandingOptions(btn.dataset.currentSource)));
  $('currentWindow')?.addEventListener('change', e => {
    const source = document.querySelector('[data-current-source].active')?.dataset.currentSource || 'online';
    source === 'irl' ? window.MetaState.setIrlScope(e.currentTarget.value) : window.MetaState.setOnlineScope(e.currentTarget.value);
  });
  ['matchupPageSource','deckPageSource','playFieldSource','playMatchupSource'].forEach(id => $(id)?.addEventListener('change', syncAll));
  window.addEventListener('meta:data-changed', syncAll);
  document.addEventListener('click', e => {
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
  style.textContent = '.meta-scope-control,.play-scope-controls label{display:grid;gap:4px;min-width:0;color:#667085;font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}.meta-scope-control select,.play-scope-controls select{width:100%;min-height:42px;border:1px solid #d0d5dd;border-radius:10px;background:#fff;padding:0 10px;color:#101828;font:inherit;font-size:13px;font-weight:700}.play-scope-controls{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.detail-scope-control{margin-top:8px}.single-source-control{flex-wrap:wrap}.meta-scope-control{flex:1}.play-scope-controls label[hidden]{display:none!important}.play-source-details{margin-top:10px;border:1px solid #e1e5eb;border-radius:14px;background:#fff;overflow:hidden}.play-source-details summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;cursor:pointer}.play-source-details summary::-webkit-details-marker{display:none}.play-source-details summary>span:first-child{display:grid;gap:2px;min-width:0}.play-source-details summary b{font-size:13px;color:#101828}.play-source-details summary small{font-size:11px;color:#667085;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.play-source-chevron{font-size:18px;color:#667085;transition:transform .15s ease}.play-source-details[open] .play-source-chevron{transform:rotate(180deg)}.play-source-body{padding:0 12px 12px}.play-source-body .child-source-row{margin:0}.play-source-details:not([open]) .play-source-body{display:none}@media(max-width:600px){.single-source-control{display:grid!important;grid-template-columns:1fr}.play-scope-controls{grid-template-columns:1fr}}';
  document.head.appendChild(style);
  window.MetaControls = { sync: syncAll, syncDetail };
  setTimeout(syncAll, 0);
})();