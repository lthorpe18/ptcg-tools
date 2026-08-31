(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function optionHtml(options) {
    const base = options.filter(x => !x.event).map(x => `<option value="${esc(x.value)}">${esc(x.label)}</option>`).join('');
    const events = options.filter(x => x.event).map(x => `<option value="${esc(x.value)}">${esc(x.label)}</option>`).join('');
    return base + (events ? `<optgroup label="Individual tournaments">${events}</optgroup>` : '');
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

  function syncPrepScopes() {
    const header = $('playFieldSource')?.closest('.meta-child-header');
    if (!header) return;
    let row = $('playScopeControls');
    if (!row) {
      row = document.createElement('div');
      row.id = 'playScopeControls';
      row.className = 'play-scope-controls';
      row.innerHTML = '<label id="playOnlineScopeWrap"><span>Online scope</span><select id="playOnlineScope"></select></label><label id="playIrlScopeWrap"><span>IRL scope</span><select id="playIrlScope"></select></label>';
      header.appendChild(row);
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
    select.innerHTML = optionHtml(active === 'irl' ? window.MetaState.irlScopes() : window.MetaState.onlineScopes());
    select.value = active === 'irl' ? state.irlScope : state.onlineScope;
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
    if (e.target.closest('[data-explore-deck],.current-meta-row,[data-detail-source]')) setTimeout(syncDetail, 0);
  });

  const style = document.createElement('style');
  style.textContent = '.meta-scope-control,.play-scope-controls label{display:grid;gap:4px;min-width:0;color:#667085;font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}.meta-scope-control select,.play-scope-controls select{width:100%;min-height:42px;border:1px solid #d0d5dd;border-radius:10px;background:#fff;padding:0 10px;color:#101828;font:inherit;font-size:13px;font-weight:700}.play-scope-controls{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.detail-scope-control{margin-top:8px}.single-source-control{flex-wrap:wrap}.meta-scope-control{flex:1}.play-scope-controls label[hidden]{display:none!important}@media(max-width:600px){.single-source-control{display:grid!important;grid-template-columns:1fr}.play-scope-controls{grid-template-columns:1fr}}';
  document.head.appendChild(style);
  window.MetaControls = { sync: syncAll, syncDetail };
  setTimeout(syncAll, 0);
})();