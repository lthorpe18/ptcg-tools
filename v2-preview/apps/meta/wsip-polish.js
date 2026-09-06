(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  let detailField = 'blend';

  function setLoading(active) {
    $('prep')?.classList.toggle('wsip-loading', !!active);
  }

  function polishCompareButtons(root = document) {
    root.querySelectorAll?.('[data-toggle-compare]').forEach(button => {
      const selected = button.textContent.trim().toLowerCase() === 'remove';
      button.textContent = 'Compare';
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
      button.setAttribute('aria-label', `${selected ? 'Remove from' : 'Add to'} comparison: ${button.dataset.toggleCompare || ''}`);
    });
  }

  function installSavedFieldAutoLoad() {
    document.addEventListener('change', event => {
      if (event.target?.id !== 'savedMetaSelect') return;
      const id = event.target.value;
      if (!id) return;
      queueMicrotask(() => {
        const item = window.SavedMetas?.get?.(id);
        if (item) window.PrepField?.applyExpectedField?.(item);
      });
    });
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
        polishCompareButtons();
      }
    };
    wrapped.__wsipPolished = true;
    window.MetaPrep.activate = wrapped;
  }

  function fieldLabel(value) {
    return ({ blend:'Blended current field', online:'Online field', irl:'IRL field', expected:'Saved Expected Field' })[value] || 'Blended current field';
  }

  function installDeckDetailFieldLens() {
    const head = $('deckDetailHead');
    if (!head) return;
    const render = () => {
      if (!$('deckDetail') || $('deckDetail').classList.contains('hidden') || head.querySelector('[data-detail-field-lens]')) return;
      const h1 = head.querySelector('h1');
      if (!h1) return;
      const panel = document.createElement('div');
      panel.className = 'detail-field-lens';
      panel.dataset.detailFieldLens = 'true';
      panel.innerHTML = `<label><span>Expected field</span><select data-detail-field-select><option value="blend">Blended current field</option><option value="online">Online field</option><option value="irl">IRL field</option><option value="expected">Saved Expected Field</option></select></label><button type="button" class="btn" data-detail-field-open>Evaluate in What should I play?</button>`;
      const select = panel.querySelector('[data-detail-field-select]');
      select.value = detailField;
      select.addEventListener('change', () => { detailField = select.value; });
      panel.querySelector('[data-detail-field-open]').addEventListener('click', () => {
        const source = $('playFieldSource');
        if (source) {
          source.value = detailField;
          source.dispatchEvent(new Event('change', { bubbles:true }));
        }
        document.querySelector('[data-meta-route="prep"]')?.click();
      });
      panel.title = `Evaluate ${h1.textContent.trim()} against ${fieldLabel(detailField)}`;
      head.appendChild(panel);
    };
    new MutationObserver(() => requestAnimationFrame(render)).observe(head, { childList:true, subtree:true });
    render();
  }

  function boot() {
    installLoadingGuard();
    installSavedFieldAutoLoad();
    installDeckDetailFieldLens();
    polishCompareButtons();
    new MutationObserver(mutations => mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
      if (node.nodeType === 1) polishCompareButtons(node);
    }))).observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();