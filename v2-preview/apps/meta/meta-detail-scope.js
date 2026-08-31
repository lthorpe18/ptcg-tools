(() => {
  'use strict';
  const $ = id => document.getElementById(id);

  function render() {
    const detail = $('deckDetail');
    if (!detail || detail.classList.contains('hidden')) return;
    const sourceRow = detail.querySelector('.detail-source');
    if (!sourceRow) return;
    const source = sourceRow.querySelector('[data-detail-source].active')?.dataset.detailSource || 'online';
    let wrap = $('deckDetailFunctionalScope');
    if (!wrap) {
      wrap = document.createElement('label');
      wrap.id = 'deckDetailFunctionalScope';
      wrap.className = 'meta-functional-scope detail-functional-scope';
      sourceRow.after(wrap);
    }

    if (source === 'irl') {
      const opts = window.MetaIRLScope?.options?.() || [];
      const base = opts.filter(x=>!x.event).map(x=>`<option value="${x.value}">${x.label}</option>`).join('');
      const events = opts.filter(x=>x.event).map(x=>`<option value="${x.value}">${x.label}</option>`).join('');
      wrap.innerHTML = `<span>IRL scope</span><select id="deckDetailIrlScope">${base}${events?`<optgroup label="Individual tournaments">${events}</optgroup>`:''}</select>`;
      const select = $('deckDetailIrlScope');
      if (select) {
        select.value = window.MetaIRLScope?.get?.() || 'latest-weekend';
        select.addEventListener('change', e => window.MetaIRLScope?.set?.(e.currentTarget.value));
      }
    } else {
      const opts = window.MetaScope?.onlineOptions?.() || [];
      wrap.innerHTML = `<span>Online scope</span><select id="deckDetailOnlineScope">${opts.map(x=>`<option value="${x.value}">${x.label}</option>`).join('')}</select>`;
      const select = $('deckDetailOnlineScope');
      if (select) {
        select.value = window.MetaScope?.getOnline?.() || '30';
        select.addEventListener('change', e => window.MetaScope?.setOnline?.(e.currentTarget.value));
      }
    }
  }

  window.addEventListener('meta-scope:changed', render);
  window.addEventListener('meta-irl-scope:changed', render);
  window.addEventListener('irl:updated', render);
  setInterval(render, 500);
})();