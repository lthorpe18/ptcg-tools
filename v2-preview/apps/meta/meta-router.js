(() => {
  'use strict';

  const VIEW_IDS = {
    current: 'currentMetaPage',
    prep: 'prep',
    matchups: 'matchups',
    decks: 'decks',
    accuracy: 'accuracy',
    detail: 'deckDetail',
  };
  const CHILD_VIEWS = new Set(['current', 'prep', 'matchups', 'decks', 'accuracy']);
  const BASE_URL = new URL('./', location.href);
  let route = { view: 'current', detail: null };
  let restoredFieldContext=null;

  function cleanView(value, fallback = 'current') {
    return Object.prototype.hasOwnProperty.call(VIEW_IDS, value) ? value : fallback;
  }

  function cleanOrigin(value) {
    return CHILD_VIEWS.has(value) ? value : 'current';
  }

  function parse(input = location.href) {
    const url = new URL(input, location.href);
    for(const env of ['online','irl'])window.MetaState?.setFormat?.(env,url.searchParams.get(env+'Format'));
    const hash = String(url.hash || '').replace(/^#/, '').toLowerCase();
    if (hash === 'detail' && url.searchParams.get('deck')) {
      return {
        view: 'detail',
        detail: {
          deckName: url.searchParams.get('deck'),
          source: url.searchParams.get('source') === 'irl' ? 'irl' : 'online',
          origin: cleanOrigin(url.searchParams.get('from')),
          fieldContext: url.searchParams.get('fieldContext') || null,
          observedScope:url.searchParams.get('scope') || null,
        },
      };
    }
    if (hash === 'what-should-i-play' || hash === 'play') return { view: 'prep', detail: null, fieldContext:url.searchParams.get('fieldContext') || null };
    const currentSource = ['online','irl','blend'].includes(url.searchParams.get('currentSource')) ? url.searchParams.get('currentSource') : null;
    if (hash === 'overview' || hash === 'meta') return { view: 'current', detail: null, currentSource, fieldContext:url.searchParams.get('fieldContext') || null };
    return { view: CHILD_VIEWS.has(hash) ? hash : 'current', detail: null, currentSource, fieldContext:url.searchParams.get('fieldContext') || null };
  }

  function urlFor(next) {
    const url = new URL(BASE_URL.href);
    for(const env of ['online','irl']) {const selected=window.MetaState?.get?.()[env+'Format'];if(selected)url.searchParams.set(env+'Format',selected);}
    const fieldContext=next.detail?.fieldContext || next.fieldContext;
    if(fieldContext)url.searchParams.set('fieldContext',fieldContext);
    if (next.view === 'detail' && next.detail?.deckName) {
      url.searchParams.set('deck', next.detail.deckName);
      url.searchParams.set('source', next.detail.source === 'irl' ? 'irl' : 'online');
      url.searchParams.set('from', cleanOrigin(next.detail.origin));
      if(next.detail.observedScope)url.searchParams.set('scope',next.detail.observedScope);
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
    if (route.view === 'prep') window.MetaPrep?.activate?.();
    if (route.view === 'matchups') window.MetaExplore?.renderMatchups?.();
    if (route.view === 'decks') window.MetaExplore?.renderDeckExplorer?.();
    if (route.view === 'accuracy') window.MetaAccuracy?.activate?.();
    if (route.view === 'detail' && route.detail) window.MetaExplore?.showDetail?.(route.detail);
    window.MetaControls?.sync?.();
    window.MetaContext?.render?.();
  }

  function apply(next, { scroll = true } = {}) {
    const view = cleanView(next?.view);
    route = {
      view,
      fieldContext:next.fieldContext || null,
      detail: view === 'detail' ? {
        deckName: String(next?.detail?.deckName || ''),
        source: next?.detail?.source === 'irl' ? 'irl' : 'online',
        origin: cleanOrigin(next?.detail?.origin),
        fieldContext:next?.detail?.fieldContext || null,
        observedScope:next?.detail?.observedScope || null,
      } : null,
    };
    if (route.view === 'detail' && !route.detail.deckName) route = { view: 'current', detail: null };
    if (route.view === 'current' && next.currentSource) window.MetaHome?.setSource?.(next.currentSource);
    setExclusiveView(route.view);
    if(route.view==='prep' && route.fieldContext && restoredFieldContext!==route.fieldContext) {restoredFieldContext=route.fieldContext;window.MetaDetailField?.restore?.(route.fieldContext);}
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
    const next = { view: cleanView(view), detail: null, fieldContext:options.fieldContext || null };
    apply(next, options);
    if (options.history !== false) writeRoute(next, options.replace ? 'replace' : 'push');
  }

  function openDetail(deckName, source = 'online', origin = route.view, fieldContext = null) {
    if (!fieldContext && window.MetaDetailField) {
      const landing=window.MetaHome?.selection?.();
      fieldContext=origin==='prep'?window.MetaDetailField.capture():route.view==='detail'?route.detail.fieldContext:window.MetaDetailField.create(origin==='current'&&landing?.source==='blend'?'blend':source,origin==='current'&&landing?.source==='blend'?window.MetaBlendedField?.selected?.()?.format:window.MetaData?.sourceFormat?.(source));
    }
    const next = {
      view: 'detail',
      detail: { deckName, source: source === 'irl' ? 'irl' : 'online', origin: cleanOrigin(origin), fieldContext },
    };
    apply(next);
    writeRoute(next, 'push');
  }

  function closeDetail() {
    navigate(route.detail?.origin || 'current', { replace: true, fieldContext:route.detail?.origin==='prep'?route.detail.fieldContext:null });
  }

  // Source selection remains evidence state. Updating its serialized value
  // replaces the current route projection without creating a navigation entry.
  function replaceDetailSource(source) {
    if (route.view !== 'detail' || !route.detail) return;
    route = { ...route, detail: { ...route.detail, source: source === 'irl' ? 'irl' : 'online', observedScope:null } };
    writeRoute(route, 'replace');
    window.MetaControls?.sync?.();
  }

  function replaceDetailScope(observedScope) {
    if(route.view!=='detail')return;
    route={...route,detail:{...route.detail,observedScope}};writeRoute(route,'replace');
  }
  function setFieldContext(fieldContext) {
    if(route.view!=='detail')return;
    apply({...route,detail:{...route.detail,fieldContext}},{scroll:false});
    writeRoute(route,'replace');
  }
  function detailToWSIP() {
    if(route.view==='detail')navigate('prep',{fieldContext:route.detail.fieldContext});
  }
  function get() {
    return {
      view: route.view,
      fieldContext:route.fieldContext || null,
      detail: route.detail ? { ...route.detail } : null,
    };
  }

  document.querySelectorAll('[data-meta-route]').forEach(control => {
    control.addEventListener('click', () => navigate(control.dataset.metaRoute));
  });

  function applyExternal(input, options) {
    const next=parse(input);
    apply(next, options);
    // currentSource is a one-use entry instruction. Clean it after use so a
    // later warm return does not overwrite the source the user chose in Meta.
    if(next.currentSource)writeRoute(route,'replace');
  }

  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== window.parent || event.data?.type !== 'ptcg:shell-apply-route') return;
    applyExternal(event.data.url);
  });

  if (!embedded()) {
    const applyLocation = () => applyExternal(location.href);
    window.addEventListener('popstate', applyLocation);
    window.addEventListener('hashchange', applyLocation);
  }

  window.MetaRouter = { syncEvidenceRoute:()=>writeRoute(route,'replace'), get, parse, urlFor, apply, navigate, replaceDetailScope, setFieldContext, detailToWSIP, openDetail, closeDetail, replaceDetailSource };
  applyExternal(location.href, { scroll: false });
})();
