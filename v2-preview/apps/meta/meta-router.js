(() => {
  'use strict';

  const VIEW_IDS = {
    current: 'currentMetaPage',
    prep: 'prep',
    matchups: 'matchups',
    decks: 'decks',
    detail: 'deckDetail',
  };
  const CHILD_VIEWS = new Set(['current', 'prep', 'matchups', 'decks']);
  const BASE_URL = new URL('./', location.href);
  let route = { view: 'current', detail: null };

  function cleanView(value, fallback = 'current') {
    return Object.prototype.hasOwnProperty.call(VIEW_IDS, value) ? value : fallback;
  }

  function cleanOrigin(value) {
    return CHILD_VIEWS.has(value) ? value : 'current';
  }

  function parse(input = location.href) {
    const url = new URL(input, location.href);
    const hash = String(url.hash || '').replace(/^#/, '').toLowerCase();
    if (hash === 'detail' && url.searchParams.get('deck')) {
      return {
        view: 'detail',
        detail: {
          deckName: url.searchParams.get('deck'),
          source: url.searchParams.get('source') === 'irl' ? 'irl' : 'online',
          origin: cleanOrigin(url.searchParams.get('from')),
        },
      };
    }
    if (hash === 'what-should-i-play' || hash === 'play') return { view: 'prep', detail: null };
    if (hash === 'overview' || hash === 'meta') return { view: 'current', detail: null };
    return { view: CHILD_VIEWS.has(hash) ? hash : 'current', detail: null };
  }

  function urlFor(next) {
    const url = new URL(BASE_URL.href);
    if (next.view === 'detail' && next.detail?.deckName) {
      url.searchParams.set('deck', next.detail.deckName);
      url.searchParams.set('source', next.detail.source === 'irl' ? 'irl' : 'online');
      url.searchParams.set('from', cleanOrigin(next.detail.origin));
      url.hash = 'detail';
      return url;
    }
    url.hash = next.view === 'current' ? '' : cleanView(next.view);
    return url;
  }

  function setExclusiveView(view) {
    const active = cleanView(view);
    for (const [name, id] of Object.entries(VIEW_IDS)) {
      const element = document.getElementById(id);
      if (!element) continue;
      const on = name === active;
      element.classList.toggle('hidden', !on);
      element.hidden = !on;
      if (on) element.removeAttribute('inert');
      else element.setAttribute('inert', '');
    }
    document.body.dataset.metaActiveView = active;
    document.querySelectorAll('[data-tab="prep"]').forEach(control => control.classList.toggle('active', active === 'prep'));
  }

  function renderActive() {
    if (route.view === 'current') window.MetaHome?.render?.();
    if (route.view === 'prep') window.dispatchEvent(new CustomEvent('field:updated'));
    if (route.view === 'matchups') window.MetaExplore?.renderMatchups?.();
    if (route.view === 'decks') window.MetaExplore?.renderDeckExplorer?.();
    if (route.view === 'detail' && route.detail) window.MetaExplore?.showDetail?.(route.detail);
    window.MetaControls?.sync?.();
    window.MetaContext?.render?.();
  }

  function apply(next, { scroll = true } = {}) {
    const view = cleanView(next?.view);
    route = {
      view,
      detail: view === 'detail' ? {
        deckName: String(next?.detail?.deckName || ''),
        source: next?.detail?.source === 'irl' ? 'irl' : 'online',
        origin: cleanOrigin(next?.detail?.origin),
      } : null,
    };
    if (route.view === 'detail' && !route.detail.deckName) route = { view: 'current', detail: null };
    setExclusiveView(route.view);
    renderActive();
    if (scroll) window.scrollTo({ top: 0, behavior: 'instant' });
    return get();
  }

  function embedded() {
    return window.parent !== window;
  }

  function writeRoute(next, mode = 'push') {
    const url = urlFor(next);
    if (embedded()) {
      try {
        window.parent.postMessage({ type: 'ptcg:shell-navigate', url: url.href, mode }, location.origin);
      } catch {}
    } else {
      const state = { ptcgMetaRoute: true, view: next.view, detail: next.detail || null };
      if (mode === 'replace') history.replaceState(state, '', url);
      else history.pushState(state, '', url);
    }
  }

  function navigate(view, options = {}) {
    const next = { view: cleanView(view), detail: null };
    apply(next, options);
    if (options.history !== false) writeRoute(next, options.replace ? 'replace' : 'push');
  }

  function openDetail(deckName, source = 'online', origin = route.view) {
    const next = {
      view: 'detail',
      detail: { deckName, source: source === 'irl' ? 'irl' : 'online', origin: cleanOrigin(origin) },
    };
    apply(next);
    writeRoute(next, 'push');
  }

  function closeDetail() {
    navigate(route.detail?.origin || 'current', { replace: true });
  }

  // Source selection remains evidence state. Updating its serialized value
  // replaces the current route projection without creating a navigation entry.
  function replaceDetailSource(source) {
    if (route.view !== 'detail' || !route.detail) return;
    route = { ...route, detail: { ...route.detail, source: source === 'irl' ? 'irl' : 'online' } };
    writeRoute(route, 'replace');
  }

  function get() {
    return {
      view: route.view,
      detail: route.detail ? { ...route.detail } : null,
    };
  }

  document.querySelectorAll('[data-meta-route]').forEach(control => {
    control.addEventListener('click', () => navigate(control.dataset.metaRoute));
  });

  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== window.parent || event.data?.type !== 'ptcg:shell-apply-route') return;
    apply(parse(event.data.url));
  });

  if (!embedded()) {
    const applyLocation = () => apply(parse(location.href));
    window.addEventListener('popstate', applyLocation);
    window.addEventListener('hashchange', applyLocation);
  }

  window.MetaRouter = { get, parse, urlFor, apply, navigate, openDetail, closeDetail, replaceDetailSource };
  apply(parse(location.href), { scroll: false });
})();
