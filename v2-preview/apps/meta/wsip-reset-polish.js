(() => {
  'use strict';
  const source = () => document.getElementById('playFieldSource');
  function sync() {
    const button = document.querySelector('[data-field-reset]');
    if (!button) return;
    const custom = source()?.value === 'expected';
    button.textContent = custom ? '↩ Back to Blended' : '↻ Reset source';
    button.title = custom ? 'Leave this saved Expected Field and return to the blended current field' : 'Reset edits to this field source';
  }
  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-field-reset]');
    if (!button || source()?.value !== 'expected') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const saved = document.getElementById('savedMetaSelect');
    if (saved) saved.value = '';
    source().value = 'blend';
    source().dispatchEvent(new Event('change', { bubbles:true }));
    queueMicrotask(sync);
  }, true);
  document.addEventListener('change', event => {
    if (event.target?.id === 'playFieldSource' || event.target?.id === 'savedMetaSelect') queueMicrotask(sync);
  });
  new MutationObserver(sync).observe(document.body, { childList:true, subtree:true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync, { once:true }); else sync();
})();