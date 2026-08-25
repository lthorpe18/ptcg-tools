(() => {
  const TARGETS = '#archSelect, #prepInspect, #quickDeckSelect, select.deck-searchable';

  function optionRows(select) {
    return [...select.options]
      .filter(o => o.value && o.value !== 'Other' && o.textContent.trim() !== 'Other')
      .map(o => ({ value: o.value, label: o.textContent.trim() }));
  }

  function syncOne(select) {
    const wrap = select._searchableWrap;
    if (!wrap) return;
    const input = wrap.querySelector('.deck-search-input');
    if (!input || document.activeElement === input) return;
    const selected = [...select.options].find(o => o.value === select.value);
    input.value = selected ? selected.textContent.trim() : select.value || '';
  }

  function renderMenu(select, query = '') {
    const wrap = select._searchableWrap;
    if (!wrap) return;
    const menu = wrap.querySelector('.deck-search-menu');
    const q = query.trim().toLowerCase();
    const rows = optionRows(select).filter(r => !q || r.label.toLowerCase().includes(q) || r.value.toLowerCase().includes(q)).slice(0, 40);
    menu.innerHTML = rows.length
      ? rows.map(r => `<button type="button" class="deck-search-option" data-value="${escapeHtml(r.value)}">${escapeHtml(r.label)}</button>`).join('')
      : '<div class="deck-search-empty">No matching deck</div>';
    menu.hidden = false;
    menu.querySelectorAll('.deck-search-option').forEach(btn => btn.addEventListener('mousedown', e => {
      e.preventDefault();
      select.value = btn.dataset.value;
      const input = wrap.querySelector('.deck-search-input');
      const chosen = [...select.options].find(o => o.value === select.value);
      input.value = chosen ? chosen.textContent.trim() : select.value;
      menu.hidden = true;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }));
  }

  function upgradeOne(select) {
    if (!select || select.dataset.searchableDeckReady === '1') return;
    select.dataset.searchableDeckReady = '1';
    select.classList.add('deck-search-native');

    const wrap = document.createElement('div');
    wrap.className = 'deck-search-wrap';
    wrap.innerHTML = '<input type="search" class="deck-search-input" autocomplete="off" spellcheck="false" aria-label="Search decks" placeholder="Search decks…"><div class="deck-search-menu" hidden></div>';
    select.insertAdjacentElement('afterend', wrap);
    select._searchableWrap = wrap;

    const input = wrap.querySelector('.deck-search-input');
    const menu = wrap.querySelector('.deck-search-menu');
    syncOne(select);

    input.addEventListener('focus', () => renderMenu(select, input.value));
    input.addEventListener('input', () => renderMenu(select, input.value));
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') { menu.hidden = true; input.blur(); return; }
      if (e.key === 'Enter') {
        const first = menu.querySelector('.deck-search-option');
        if (first) { e.preventDefault(); first.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); }
      }
    });
    input.addEventListener('blur', () => setTimeout(() => { menu.hidden = true; syncOne(select); }, 100));
    select.addEventListener('change', () => syncOne(select));

    const observer = new MutationObserver(() => syncOne(select));
    observer.observe(select, { childList: true, subtree: true, characterData: true });
  }

  function upgrade() {
    document.querySelectorAll(TARGETS).forEach(upgradeOne);
  }

  function sync() {
    document.querySelectorAll(TARGETS).forEach(syncOne);
  }

  const bodyObserver = new MutationObserver(upgrade);
  bodyObserver.observe(document.documentElement, { childList: true, subtree: true });
  upgrade();
  setInterval(sync, 600);
  window.SearchableDecks = { upgrade, sync };
})();