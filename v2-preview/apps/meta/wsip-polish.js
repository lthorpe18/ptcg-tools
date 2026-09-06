(() => {
  'use strict';

  const $ = id => document.getElementById(id);

  function setLoading(active) {
    $('prep')?.classList.toggle('wsip-loading', !!active);
  }

  function polishCompareButtons(root = document) {
    root.querySelectorAll?.('[data-toggle-compare]').forEach(button => {
      const selected = button.textContent.trim().toLowerCase() === 'remove' || button.getAttribute('aria-pressed') === 'true';
      button.textContent = 'Compare';
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
      button.setAttribute('aria-label', `${selected ? 'Remove from' : 'Add to'} comparison: ${button.dataset.toggleCompare || ''}`);
    });
  }

  function buildCompareTable() {
    const host = $('prepCompare');
    const grid = host?.querySelector('.wsip-compare-grid');
    if (!grid || grid.dataset.tablePolished === 'true') return;
    const cards = [...grid.querySelectorAll(':scope > article')];
    if (cards.length < 2) return;
    const decks = cards.map(card => ({
      title: card.querySelector('.compare-title b')?.textContent?.trim() || 'Deck',
      sprite: card.querySelector('.compare-title .deck-sprite-stack,.compare-title .deck-sprite')?.outerHTML || '',
      values: new Map([...card.querySelectorAll('dl > div')].map(row => [row.querySelector('dt')?.textContent?.trim() || '', row.querySelector('dd')?.textContent?.trim() || '—']))
    }));
    const metrics = ['Estimate','Evidence','Unknown field','Bad exposure','Favourable exposure','Profile'];
    grid.dataset.tablePolished = 'true';
    grid.innerHTML = `<div class="wsip-compare-table-wrap"><table class="wsip-compare-table"><thead><tr><th scope="col">Metric</th>${decks.map(deck => `<th scope="col"><span class="compare-deck-head">${deck.sprite}<b>${deck.title}</b></span></th>`).join('')}</tr></thead><tbody>${metrics.map(metric => `<tr><th scope="row">${metric}</th>${decks.map(deck => `<td>${deck.values.get(metric) || '—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function savedFieldName() {
    const selected = $('savedMetaSelect')?.value;
    return selected ? window.SavedMetas?.get?.(selected)?.name || '' : '';
  }

  function syncTopFieldControl() {
    const select = $('playFieldSource');
    if (!select) return;
    const expected = select.querySelector('option[value="expected"]');
    const name = savedFieldName();
    if (expected) expected.textContent = name ? `Saved · ${name}` : 'Saved Expected Field';
    const active = select.value === 'expected' && !!name;
    select.closest('label')?.classList.toggle('custom-field-active', active);
    select.setAttribute('aria-label', active ? `Field: saved expected field ${name}` : 'Field source');
  }

  function installSavedFieldAutoLoad() {
    document.addEventListener('change', event => {
      if (event.target?.id !== 'savedMetaSelect') return;
      const id = event.target.value;
      if (!id) { syncTopFieldControl(); return; }
      queueMicrotask(() => {
        const item = window.SavedMetas?.get?.(id);
        if (item) window.PrepField?.applyExpectedField?.(item);
        syncTopFieldControl();
      });
    });
    document.addEventListener('change', event => {
      if (event.target?.id !== 'playFieldSource') return;
      if (event.target.value !== 'expected') {
        const saved = $('savedMetaSelect');
        if (saved) saved.value = '';
      }
      queueMicrotask(syncTopFieldControl);
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
        buildCompareTable();
        syncTopFieldControl();
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
        queueMicrotask(syncTopFieldControl);
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
    installLoadingGuard();
    installSavedFieldAutoLoad();
    installDeckDetailFieldLens();
    polishCompareButtons();
    syncTopFieldControl();
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        polishCompareButtons(node);
      }
      buildCompareTable();
      syncTopFieldControl();
    });
    observer.observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();