(() => {
  'use strict';

  let applyingRoute = false;
  let lastNonDetail = document.body.dataset.metaView || 'current';

  function detailOpen() {
    const detail = document.getElementById('deckDetail');
    return !!detail && !detail.classList.contains('hidden');
  }

  function notifyShell() {
    if (window.parent === window) return;
    try {
      window.parent.postMessage({ type:'ptcg:shell-route', url:location.href }, location.origin);
    } catch {}
  }

  function originView() {
    const value = new URLSearchParams(location.search).get('from');
    return ['current','prep','matchups','decks'].includes(value) ? value : lastNonDetail;
  }

  function detailIdentity() {
    const heading = document.querySelector('#deckDetailHead h1')?.textContent?.trim() || '';
    const activeSource = document.querySelector('#deckDetail [data-detail-source].active')?.dataset.detailSource;
    return { name:heading, source:activeSource === 'irl' ? 'irl' : 'online' };
  }

  function detailUrl(name, source, from = lastNonDetail) {
    const url = new URL(location.href);
    url.searchParams.set('deck', name);
    url.searchParams.set('source', source === 'irl' ? 'irl' : 'online');
    url.searchParams.set('from', ['current','prep','matchups','decks'].includes(from) ? from : 'current');
    url.hash = 'detail';
    return url;
  }

  function normalUrl(view = lastNonDetail) {
    const url = new URL(location.href);
    url.searchParams.delete('deck');
    url.searchParams.delete('source');
    url.searchParams.delete('from');
    url.hash = view === 'current' ? '' : view;
    return url;
  }

  function syncDetailUrl({replace=false} = {}) {
    if (applyingRoute || !detailOpen()) return;
    const {name,source} = detailIdentity();
    if (!name) return;
    const url = detailUrl(name, source);
    const same = location.pathname + location.search + location.hash === url.pathname + url.search + url.hash;
    if (!same) {
      const state = { ptcgMetaDetail:true, deck:name, source, from:lastNonDetail };
      if (replace) history.replaceState(state, '', url);
      else history.pushState(state, '', url);
    }
    notifyShell();
  }

  function closeDetailFromHistory() {
    if (!detailOpen()) return;
    applyingRoute = true;
    document.getElementById('deckDetailBack')?.click();
    setTimeout(() => { applyingRoute = false; notifyShell(); }, 0);
  }

  function applyLocation() {
    const params = new URLSearchParams(location.search);
    const name = params.get('deck') || '';
    const source = params.get('source') === 'irl' ? 'irl' : 'online';
    const wantsDetail = location.hash.toLowerCase() === '#detail' && !!name;

    if (wantsDetail) {
      const from = originView();
      applyingRoute = true;
      if (!detailOpen()) {
        window.MetaHome?.setView?.(from, false);
        lastNonDetail = from;
      }
      window.MetaExplore?.openDeck?.(name, source);
      setTimeout(() => { applyingRoute = false; notifyShell(); }, 0);
      return;
    }

    if (detailOpen()) closeDetailFromHistory();
    else notifyShell();
  }

  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type !== 'attributes' || record.attributeName !== 'data-meta-view') continue;
      const current = document.body.dataset.metaView || 'current';
      const previous = record.oldValue || lastNonDetail;
      if (current === 'detail') {
        if (previous !== 'detail' && ['current','prep','matchups','decks'].includes(previous)) lastNonDetail = previous;
        syncDetailUrl({replace:applyingRoute});
      } else {
        if (['current','prep','matchups','decks'].includes(current)) lastNonDetail = current;
        notifyShell();
      }
    }
  });
  observer.observe(document.body, { attributes:true, attributeFilter:['data-meta-view'], attributeOldValue:true });

  document.addEventListener('click', event => {
    const back = event.target.closest?.('#deckDetailBack');
    if (back && !applyingRoute && detailOpen()) {
      event.preventDefault();
      event.stopPropagation();
      if (history.state?.ptcgMetaDetail) history.back();
      else {
        applyingRoute = true;
        const from = originView();
        window.MetaHome?.setView?.(from, false);
        back.click();
        history.replaceState({ptcgMetaView:from}, '', normalUrl(from));
        setTimeout(() => { applyingRoute = false; notifyShell(); }, 0);
      }
      return;
    }

    const sourceButton = event.target.closest?.('#deckDetail [data-detail-source]');
    if (sourceButton) setTimeout(() => syncDetailUrl({replace:true}), 0);
  }, true);

  window.addEventListener('popstate', applyLocation);
  window.addEventListener('hashchange', () => {
    if (location.hash.toLowerCase() === '#detail' || detailOpen()) applyLocation();
    else notifyShell();
  });

  applyLocation();
})();