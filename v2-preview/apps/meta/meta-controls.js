(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

  function optionHtml(options) {
    const standard=options.filter(option => !option.event).map(option => `<option value="${esc(option.value)}">${esc(option.label)}</option>`).join('');
    const events=options.filter(option => option.event).map(option => `<option value="${esc(option.value)}">${esc(option.label)}</option>`).join('');
    return standard + (events ? `<optgroup label="Individual tournaments">${events}</optgroup>` : '');
  }

  function setOptions(select, options, value) {
    if (!select) return;
    const html=optionHtml(options);
    if (select.dataset.metaOptions !== html) { select.innerHTML=html; select.dataset.metaOptions=html; }
    select.value=value;
  }

  function syncLandingOptions(source) {
    const select=$('currentWindow');
    if (!select || source === 'blend') { if (select) select.hidden=source === 'blend'; return; }
    select.hidden=false;
    const state=window.MetaState.get();
    setOptions(select,source === 'irl' ? window.MetaState.irlScopes() : window.MetaState.onlineScopes(),source === 'irl' ? state.irlScope : state.onlineScope);
    select.setAttribute('aria-label',source === 'irl' ? 'IRL scope' : 'Online scope');
  }

  function ensureScopedControl(sourceSelectId, hostSelector, prefix) {
    const sourceSelect=$(sourceSelectId), host=sourceSelect?.closest(hostSelector);
    if (!sourceSelect || !host) return;
    let wrap=$(`${prefix}ScopeWrap`);
    if (!wrap) {
      wrap=document.createElement('label'); wrap.id=`${prefix}ScopeWrap`; wrap.className='meta-scope-control';
      wrap.innerHTML=`<span></span><select id="${prefix}Scope"></select>`; host.appendChild(wrap);
      $(`${prefix}Scope`).addEventListener('change', event => sourceSelect.value === 'irl' ? window.MetaState.setIrlScope(event.target.value) : window.MetaState.setOnlineScope(event.target.value));
    }
    const state=window.MetaState.get(), source=sourceSelect.value || 'online';
    wrap.querySelector('span').textContent=source === 'irl' ? 'IRL scope' : 'Online scope';
    setOptions($(`${prefix}Scope`),source === 'irl' ? window.MetaState.irlScopes() : window.MetaState.onlineScopes(),source === 'irl' ? state.irlScope : state.onlineScope);
  }

  function sync() {
    const active=document.querySelector('[data-current-source].active')?.dataset.currentSource || 'online';
    syncLandingOptions(active);
    if (!$('matchups')?.classList.contains('hidden')) ensureScopedControl('matchupPageSource','.single-source-control','matchupPage');
    if (!$('decks')?.classList.contains('hidden')) ensureScopedControl('deckPageSource','.single-source-control','deckPage');
  }

  document.querySelectorAll('[data-current-source]').forEach(button => button.addEventListener('click', () => syncLandingOptions(button.dataset.currentSource)));
  $('currentWindow')?.addEventListener('change', event => {
    const source=document.querySelector('[data-current-source].active')?.dataset.currentSource || 'online';
    source === 'irl' ? window.MetaState.setIrlScope(event.target.value) : window.MetaState.setOnlineScope(event.target.value);
  });
  $('matchupPageSource')?.addEventListener('change',sync);
  $('deckPageSource')?.addEventListener('change',sync);
  window.addEventListener('meta:data-changed',sync);
  document.addEventListener('click',event => { if (event.target.closest('[data-meta-route]')) setTimeout(sync,0); });

  const style=document.createElement('style');
  style.textContent='.meta-scope-control{display:grid;gap:4px;min-width:0;color:#667085;font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;flex:1}.meta-scope-control select{appearance:auto;width:100%;min-height:42px;border:1px solid #d0d5dd;border-radius:10px;background:#fff;padding:0 10px;color:#101828;font:inherit;font-size:13px;font-weight:700;box-sizing:border-box}.single-source-control{flex-wrap:wrap}@media(max-width:600px){.single-source-control{display:grid!important;grid-template-columns:1fr}}';
  document.head.appendChild(style);
  window.MetaControls={ sync };
  setTimeout(sync,0);
})();
