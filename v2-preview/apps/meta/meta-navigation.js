(() => {
  'use strict';

  let applyingRoute = false;
  let lastNonDetail = document.body.dataset.metaView || 'current';

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
    if (applyingRoute || document.body.dataset.metaView !== 'detail') return;
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
    if (document.body.dataset.metaView !== 'detail') return;
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
      if (document.body.dataset.metaView !== 'detail') {
        window.MetaHome?.setView?.(from, false);
        lastNonDetail = from;
      }
      window.MetaExplore?.openDeck?.(name, source);
      setTimeout(() => { applyingRoute = false; notifyShell(); }, 0);
      return;
    }

    if (document.body.dataset.metaView === 'detail') closeDetailFromHistory();
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
    if (back && !applyingRoute && document.body.dataset.metaView === 'detail') {
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
    if (location.hash.toLowerCase() === '#detail' || document.body.dataset.metaView === 'detail') applyLocation();
    else notifyShell();
  });

  applyLocation();
})();