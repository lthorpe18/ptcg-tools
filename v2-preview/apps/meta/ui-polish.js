(() => {
  function sprite(name, size = 30, className = '') {
    return window.DeckSprites?.html?.(name, { size, className }) || '';
  }

  function activeTab() {
    return document.querySelector('.tab.active')?.dataset.tab || 'prep';
  }

  function syncTabChrome() {
    const tab = activeTab();
    document.body.dataset.activeTab = tab;
    document.body.classList.toggle('body-play', tab === 'prep');
  }

  function syncFormatBadge() {
    const badge = document.querySelector('.format-context');
    const select = document.getElementById('format');
    if (!badge || !select) return;
    badge.textContent = select.value === 'TEF-PBL' ? 'PBL · Standard' : select.value === 'TEF-CRI' ? 'CRI · Standard' : `${select.value} · Standard`;
  }

  function decorateMetaRows() {
    document.querySelectorAll('#metaBody tr[data-archetype]').forEach(row => {
      const cell = row.querySelector('td:first-child');
      if (!cell || cell.dataset.spriteReady === '1') return;
      cell.dataset.spriteReady = '1';
      const name = row.dataset.archetype;
      cell.classList.add('sprite-table-cell');
      cell.insertAdjacentHTML('afterbegin', sprite(name, 30));
    });
  }

  function decorateMatchupRows() {
    document.querySelectorAll('#archMatchups tbody tr').forEach(row => {
      const cell = row.querySelector('td:first-child');
      if (!cell || cell.dataset.spriteReady === '1') return;
      const name = cell.textContent.trim();
      if (!name || name === 'Other') return;
      cell.dataset.spriteReady = '1';
      cell.classList.add('sprite-table-cell');
      cell.insertAdjacentHTML('afterbegin', sprite(name, 28));
    });
  }

  function decorateMatrix() {
    document.querySelectorAll('#matrix tbody tr').forEach(row => {
      const cell = row.querySelector('th:first-child');
      if (!cell || cell.dataset.spriteReady === '1') return;
      const name = cell.textContent.trim();
      if (!name || name === 'Other') return;
      cell.dataset.spriteReady = '1';
      cell.classList.add('sprite-table-cell');
      cell.insertAdjacentHTML('afterbegin', sprite(name, 26));
    });
  }

  function decorateArchetypeTitle() {
    const title = document.getElementById('archTitle');
    const select = document.getElementById('archSelect');
    const name = select?.value || title?.textContent?.trim();
    if (!title || !name || name === 'Choose an archetype' || title.querySelector('.deck-title-sprite')) return;
    title.insertAdjacentHTML('afterbegin', sprite(name, 38, 'deck-title-sprite'));
    title.classList.add('sprite-title');
  }

  function decorate() {
    decorateMetaRows();
    decorateMatchupRows();
    decorateMatrix();
    decorateArchetypeTitle();
  }

  document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => requestAnimationFrame(() => { syncTabChrome(); decorate(); })));
  document.getElementById('format')?.addEventListener('change', syncFormatBadge);
  document.getElementById('archSelect')?.addEventListener('change', () => requestAnimationFrame(decorateArchetypeTitle));

  const observer = new MutationObserver(() => requestAnimationFrame(decorate));
  observer.observe(document.body, { childList: true, subtree: true });
  syncTabChrome();
  syncFormatBadge();
  decorate();
})();
