(() => {
  const state = {
    query: '',
    minShare: 0,
    minWinRate: 0,
    sortKey: 'share',
    sortDir: 'desc',
  };

  const ignored = name => !name || name === 'Other' || name === 'Unknown';
  const fmtPct = value => `${Number(value || 0).toFixed(1)}%`;

  function rows() {
    return (DATA?.archetypes || []).filter(row => !ignored(row?.name));
  }

  function ensureUi() {
    const body = document.getElementById('metaBody');
    const table = body?.closest('table');
    const wrap = table?.closest('.tablewrap');
    const panel = wrap?.closest('.panel');
    if (!body || !table || !wrap || !panel) return null;

    panel.classList.add('meta-overview-panel');
    table.classList.add('interactive-meta-table');

    if (!document.getElementById('metaTableToolbar')) {
      const toolbar = document.createElement('div');
      toolbar.id = 'metaTableToolbar';
      toolbar.className = 'meta-table-toolbar';
      toolbar.innerHTML = `
        <label class="meta-search"><span class="meta-search-icon">⌕</span><input id="metaTableSearch" type="search" autocomplete="off" placeholder="Search archetypes…" aria-label="Search archetypes"></label>
        <label class="meta-filter"><span>Meta share</span><select id="metaShareFilter" aria-label="Minimum meta share"><option value="0">All shares</option><option value="0.5">0.5%+</option><option value="1">1%+</option><option value="2">2%+</option><option value="5">5%+</option></select></label>
        <label class="meta-filter"><span>Win rate</span><select id="metaWinFilter" aria-label="Minimum win rate"><option value="0">All win rates</option><option value="50">50%+</option><option value="52">52%+</option><option value="55">55%+</option></select></label>
        <button id="metaTableClear" type="button" class="meta-table-clear">Clear</button>
        <span id="metaTableCount" class="meta-table-count"></span>`;
      wrap.before(toolbar);

      const search = document.getElementById('metaTableSearch');
      const share = document.getElementById('metaShareFilter');
      const win = document.getElementById('metaWinFilter');
      const clear = document.getElementById('metaTableClear');

      search?.addEventListener('input', () => {
        state.query = search.value.trim().toLowerCase();
        render();
      });
      share?.addEventListener('change', () => {
        state.minShare = Number(share.value || 0);
        render();
      });
      win?.addEventListener('change', () => {
        state.minWinRate = Number(win.value || 0);
        render();
      });
      clear?.addEventListener('click', () => {
        state.query = '';
        state.minShare = 0;
        state.minWinRate = 0;
        search.value = '';
        share.value = '0';
        win.value = '0';
        render();
        search.focus();
      });
    }

    const headers = [
      ['name', 'Archetype', false],
      ['players', 'Players', false],
      ['share', 'Share', false],
      ['wins', 'W', true],
      ['losses', 'L', true],
      ['ties', 'T', true],
      ['winRate', 'Win %', false],
    ];
    const headRow = table.querySelector('thead tr');
    if (headRow) {
      headRow.innerHTML = headers.map(([key, label, mobileHide]) => `<th class="${mobileHide ? 'meta-mobile-hide' : ''}" data-sort-key="${key}"><button type="button" class="meta-sort-button" data-sort="${key}"><span>${label}</span><span class="meta-sort-arrow" aria-hidden="true"></span></button></th>`).join('');
      headRow.querySelectorAll('[data-sort]').forEach(button => button.addEventListener('click', () => {
        const key = button.dataset.sort;
        if (state.sortKey === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        else {
          state.sortKey = key;
          state.sortDir = key === 'name' ? 'asc' : 'desc';
        }
        render();
      }));
    }

    return { body, table };
  }

  function compare(a, b) {
    const key = state.sortKey;
    let result;
    if (key === 'name') result = String(a.name).localeCompare(String(b.name));
    else result = Number(a[key] ?? -Infinity) - Number(b[key] ?? -Infinity);
    if (result === 0) result = String(a.name).localeCompare(String(b.name));
    return state.sortDir === 'asc' ? result : -result;
  }

  function filteredRows() {
    return rows()
      .filter(row => !state.query || String(row.name).toLowerCase().includes(state.query))
      .filter(row => Number(row.share || 0) >= state.minShare)
      .filter(row => state.minWinRate <= 0 || Number(row.winRate || 0) >= state.minWinRate)
      .sort(compare);
  }

  function sprite(name) {
    return window.DeckSprites?.html?.(name, { size: 30 }) || '';
  }

  function syncHeaders(table) {
    table.querySelectorAll('th[data-sort-key]').forEach(th => {
      const active = th.dataset.sortKey === state.sortKey;
      const arrow = th.querySelector('.meta-sort-arrow');
      th.setAttribute('aria-sort', active ? (state.sortDir === 'asc' ? 'ascending' : 'descending') : 'none');
      th.classList.toggle('active-sort', active);
      if (arrow) arrow.textContent = active ? (state.sortDir === 'asc' ? '↑' : '↓') : '↕';
    });
  }

  function render() {
    const ui = ensureUi();
    if (!ui) return;
    const { body, table } = ui;
    const all = rows();
    const visible = filteredRows();

    body.innerHTML = visible.length ? visible.map(row => `
      <tr class="click" data-archetype="${escapeHtml(row.name)}">
        <td class="sprite-table-cell" data-sprite-ready="1">${sprite(row.name)}<b>${escapeHtml(row.name)}</b></td>
        <td>${Number(row.players || 0)}</td>
        <td>${fmtPct(row.share)}</td>
        <td class="meta-mobile-hide">${Number(row.wins || 0)}</td>
        <td class="meta-mobile-hide">${Number(row.losses || 0)}</td>
        <td class="meta-mobile-hide">${Number(row.ties || 0)}</td>
        <td>${fmtPct(row.winRate)}</td>
      </tr>`).join('') : '<tr class="meta-empty-row"><td colspan="7">No archetypes match these filters.</td></tr>';

    body.querySelectorAll('tr[data-archetype]').forEach(row => row.addEventListener('click', () => openArchetype(row.dataset.archetype)));
    syncHeaders(table);

    const count = document.getElementById('metaTableCount');
    if (count) count.textContent = `Showing ${visible.length} of ${all.length} archetypes`;
    const clear = document.getElementById('metaTableClear');
    if (clear) clear.hidden = !state.query && state.minShare === 0 && state.minWinRate === 0;
  }

  const originalRender = window.render;
  if (typeof originalRender === 'function') {
    window.render = function(...args) {
      const result = originalRender.apply(this, args);
      requestAnimationFrame(render);
      return result;
    };
  }

  document.querySelector('[data-tab="overview"]')?.addEventListener('click', () => requestAnimationFrame(render));
  document.getElementById('apply')?.addEventListener('click', () => requestAnimationFrame(render));
  window.addEventListener('meta:updated', () => requestAnimationFrame(render));
  window.addEventListener('deckagg:updated', () => requestAnimationFrame(render));

  window.MetaOverviewTable = { render, state };
  requestAnimationFrame(render);
})();
