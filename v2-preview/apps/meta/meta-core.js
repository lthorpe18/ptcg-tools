(() => {
  'use strict';

  const ONLINE_SCOPES = [
    { value:'14', label:'Last 14 days' },
    { value:'30', label:'Last 30 days' },
    { value:'since-major', label:'Since last major weekend' },
    { value:'all', label:'All in format' },
  ];
  const state = { onlineScope:'30', irlScope:'latest-weekend' };
  const lazy = { onlineHistory:null, onlineMatchups:null, onlineResults:null, irlMatchups:null, irlResults:null };
  const loading = new Map();
  let core = null;
  let release = '';
  const ignored = name => !name || name === 'Other' || name === 'Unknown';

  function emit(reason = 'state') {
    window.dispatchEvent(new CustomEvent('meta:data-changed', { detail:{ ...state, reason, release } }));
  }

  function applyCore(payload, reason = 'core') {
    if (!payload) return;
    if (core === payload) return;
    if (release && release !== payload.release) {
      for (const key of Object.keys(lazy)) lazy[key] = null;
      loading.clear();
    }
    core = payload;
    release = payload.release;
    const allowed = new Set(irlScopeOptions().map(option => option.value));
    if (!allowed.has(state.irlScope)) state.irlScope = 'latest-weekend';
    emit(reason);
  }

  function prepVisible() {
    const prep = document.getElementById('prep');
    return !!prep && !prep.classList.contains('hidden');
  }

  function refreshPrepField() {
    if (!prepVisible()) return;
    const source = document.getElementById('fieldSource')?.value || 'online';
    if (source !== 'custom') window.PrepField?.reset?.();
  }

  function setOnlineScope(value, reason = 'online-scope') {
    const next = ONLINE_SCOPES.some(option => option.value === value) ? value : '30';
    if (state.onlineScope === next && reason === 'online-scope') return;
    state.onlineScope = next;
    emit(reason);
    refreshPrepField();
  }

  function isoWeekKey(value) {
    const date = new Date(value);
    const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() + 4 - day);
    const year = utc.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const week = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
    return `${year}-W${String(week).padStart(2, '0')}`;
  }

  function validIrlEvents() {
    return [...(core?.irl?.events || [])]
      .filter(event => Array.isArray(event.decks) && event.decks.length && Number.isFinite(new Date(event.date).getTime()))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  function irlScopeOptions() {
    return [
      { value:'latest-weekend', label:'Latest IRL majors weekend' },
      { value:'all-irl', label:'All IRL majors this format' },
      ...validIrlEvents().map(event => ({ value:`event:${event.id}`, label:`${event.name || 'IRL tournament'} · ${new Date(event.date).toLocaleDateString([], { day:'numeric', month:'short' })}`, event:true })),
    ];
  }

  function selectedIrlEvents(scope = state.irlScope) {
    const events = validIrlEvents();
    if (!events.length) return [];
    if (scope === 'all-irl') return events;
    if (String(scope).startsWith('event:')) return events.filter(event => String(event.id) === String(scope).slice(6));
    const latestWeek = isoWeekKey(events[0].date);
    return events.filter(event => isoWeekKey(event.date) === latestWeek);
  }

  function setIrlScope(value, reason = 'irl-scope') {
    const allowed = new Set(irlScopeOptions().map(option => option.value));
    const next = allowed.has(value) ? value : 'latest-weekend';
    if (state.irlScope === next && reason === 'irl-scope') return;
    state.irlScope = next;
    emit(reason);
    refreshPrepField();
  }

  function aggregateDecks(events) {
    const map = new Map();
    for (const event of events || []) {
      for (const deck of event.archetypes || event.decks || []) {
        if (ignored(deck?.name)) continue;
        const row = map.get(deck.name) || { name:deck.name, entries:0, wins:0, losses:0, ties:0, url:deck.url || '' };
        row.entries += Number(deck.entries || 0);
        row.wins += Number(deck.wins || 0);
        row.losses += Number(deck.losses || 0);
        row.ties += Number(deck.ties || 0);
        if (!row.url && deck.url) row.url = deck.url;
        map.set(deck.name, row);
      }
    }
    const decks = [...map.values()].sort((a, b) => b.entries - a.entries || a.name.localeCompare(b.name));
    const entries = decks.reduce((sum, deck) => sum + deck.entries, 0);
    for (const deck of decks) {
      deck.share = entries ? 100 * deck.entries / entries : 0;
      const decisive = deck.wins + deck.losses;
      deck.winRate = decisive ? 100 * deck.wins / decisive : null;
      deck.games = deck.wins + deck.losses + deck.ties;
    }
    return { decks, overview:{ events:(events || []).length, entries } };
  }

  function selectedOnlineEvents(scope = state.onlineScope, minPlayers = 50) {
    const history = lazy.onlineHistory?.tournaments;
    if (!Array.isArray(history)) return core?.online?.scopes?.[scope]?.events || [];
    const events = history.filter(event => Number(event.players || 0) >= Number(minPlayers || 0));
    if (scope === 'all') return events;
    if (scope === 'since-major') {
      const cutoff = new Date(core?.online?.majorWeekend?.cutoff).getTime();
      return Number.isFinite(cutoff) ? events.filter(event => new Date(event.date).getTime() >= cutoff) : [];
    }
    const newest = Math.max(0, ...events.map(event => new Date(event.date).getTime()).filter(Number.isFinite));
    const cutoff = newest - Number(scope || 30) * 86400000;
    return events.filter(event => new Date(event.date).getTime() >= cutoff);
  }

  function onlineData(scope = state.onlineScope, minPlayers = 50) {
    const standard = core?.online?.scopes?.[scope] || { events:[], decks:[], overview:{ events:0, entries:0 } };
    const selected = Number(minPlayers) === 50 || !lazy.onlineHistory ? standard : selectedOnlineEvents(scope, minPlayers);
    const field = Array.isArray(selected) ? { ...aggregateDecks(selected), events:selected } : selected;
    const matchup = lazy.onlineMatchups?.scopes?.[scope] || { overview:{}, matchups:[] };
    const ids = new Set((field.events || []).map(event => String(event.id)));
    const results = (lazy.onlineResults?.results || []).filter(result => !ids.size || ids.has(String(result.eventId)));
    return {
      source:'online', scope, events:field.events || [], decks:field.decks || [], matchups:matchup.matchups || [], results,
      matchupScope:scope, matchupScoped:!!lazy.onlineMatchups,
      overview:{ ...(field.overview || {}), matches:Number(matchup.overview?.matches || 0) },
      generatedAt:core?.online?.generatedAt || null,
    };
  }

  function irlData(scope = state.irlScope) {
    const events = selectedIrlEvents(scope);
    const field = aggregateDecks(events);
    const useRootMatchups = scope === 'all-irl' || validIrlEvents().length === 1;
    const matchups = useRootMatchups ? (lazy.irlMatchups?.matchups || []) : [];
    const ids = new Set(events.map(event => String(event.id)));
    const results = (lazy.irlResults?.results || []).filter(result => !ids.size || ids.has(String(result.eventId)));
    return { source:'irl', scope, events, decks:field.decks, matchups, results, overview:field.overview, generatedAt:core?.irl?.generatedAt || null, sourceUrl:core?.irl?.sourceUrl || '', note:core?.irl?.note || '' };
  }

  function data(source, options = {}) {
    return source === 'irl' ? irlData(options.scope || state.irlScope) : onlineData(options.scope || state.onlineScope, options.minPlayers || 50);
  }

  function fieldRows(source, options = {}) {
    if (source === 'irl') return irlData(options.scope || state.irlScope).decks.map(deck => ({ name:deck.name, share:Number(deck.share || 0) / 100, source:'irl' }));
    const scope = options.scope || state.onlineScope;
    const mode = options.recency || 'balanced';
    const events = selectedOnlineEvents(scope, options.minPlayers || 50);
    if (!lazy.onlineHistory || mode === 'equal') return onlineData(scope, options.minPlayers || 50).decks.map(deck => ({ name:deck.name, share:Number(deck.share || 0) / 100, source:'online' }));
    if (!events.length) return [];
    const newest = Math.max(...events.map(event => new Date(event.date).getTime()).filter(Number.isFinite));
    const halfLife = mode === 'high' ? 7 : mode === 'balanced' ? 18 : Infinity;
    const counts = new Map();
    let total = 0;
    for (const event of events) {
      const age = Math.max(0, (newest - new Date(event.date).getTime()) / 86400000);
      const weight = Number.isFinite(halfLife) ? Math.pow(0.5, age / halfLife) : 1;
      for (const deck of event.archetypes || []) {
        if (ignored(deck?.name)) continue;
        const value = Number(deck.entries || 0) * weight;
        counts.set(deck.name, (counts.get(deck.name) || 0) + value);
        total += value;
      }
    }
    return [...counts.entries()].map(([name, value]) => ({ name, share:total ? value / total : 0, source:'online' })).sort((a, b) => b.share - a.share || a.name.localeCompare(b.name));
  }

  function matchup(source, a, b, options = {}) {
    return data(source, options).matchups.find(row => row.a === a && row.b === b) || null;
  }

  function context(source, options = {}) {
    const scoped = data(source, options);
    if (source === 'online') {
      const scope = options.scope || state.onlineScope;
      const label = ONLINE_SCOPES.find(option => option.value === scope)?.label || 'Last 30 days';
      let detail = scoped.generatedAt ? `Updated ${new Date(scoped.generatedAt).toLocaleDateString([], { day:'numeric', month:'short' })}` : 'Loading online data';
      if (scope === 'since-major' && core?.online?.majorWeekend?.events?.length) detail = `After ${core.online.majorWeekend.events.map(event => event.name).join(' + ')}`;
      return { source, scope, events:Number(scoped.overview.events || 0), entries:Number(scoped.overview.entries || 0), label:`${label} online data · 50+ player tournaments`, detail };
    }
    const events = scoped.events || [];
    let label = 'Latest IRL majors weekend';
    if (scoped.scope === 'all-irl') label = 'All IRL majors this format';
    if (String(scoped.scope).startsWith('event:') && events[0]) label = events[0].name || 'IRL tournament';
    if (scoped.scope === 'latest-weekend' && events.length === 1) label = events[0].name || label;
    return { source, scope:scoped.scope, events:events.length, entries:Number(scoped.overview.entries || 0), label, detail:events.length ? events.map(event => new Date(event.date).toLocaleDateString([], { day:'numeric', month:'short' })).join(' · ') : 'No IRL events in this scope' };
  }

  async function ensure(keys) {
    const requested = Array.isArray(keys) ? keys : [keys];
    await Promise.all(requested.map(key => {
      if (!Object.prototype.hasOwnProperty.call(lazy, key)) throw new Error(`Unknown Meta evidence: ${key}`);
      if (lazy[key]) return lazy[key];
      if (!loading.has(key)) loading.set(key, window.MetaRelease.load(key).then(payload => { lazy[key] = payload; loading.delete(key); emit(`loaded:${key}`); return payload; }).catch(error => { loading.delete(key); throw error; }));
      return loading.get(key);
    }));
  }

  function recordsUrl(name) {
    const records = core?.online?.records;
    const deck = records?.decks?.find(item => item.name === name);
    if (!deck?.slug) return '';
    return `https://play.limitlesstcg.com/decks/${encodeURIComponent(deck.slug)}?format=standard&rotation=${encodeURIComponent(records.rotation || 2026)}&set=${encodeURIComponent(records.set || 'PBL')}`;
  }

  window.MetaState = { get:() => ({ ...state }), onlineScopes:() => ONLINE_SCOPES.map(option => ({ ...option })), irlScopes:() => irlScopeOptions().map(option => ({ ...option })), setOnlineScope, setIrlScope };
  window.MetaData = { ready:() => window.MetaRelease.ready(), ensure, isLoaded:key => !!lazy[key], refresh:() => window.MetaRelease.refresh(), data, onlineData, irlData, fieldRows, matchup, context, onlineTournaments:selectedOnlineEvents, irlEvents:selectedIrlEvents, recordsUrl, release:() => release };
  window.MetaIRLScope = { get:() => state.irlScope, set:value => setIrlScope(value), options:irlScopeOptions, selectedEvents:selectedIrlEvents, selectedDecks:() => irlData().decks, selectedMatchups:() => irlData().matchups };

  window.addEventListener('meta:release-core', event => applyCore(window.MetaRelease.core(), event.detail?.source || 'core'));
  applyCore(window.MetaRelease.core(), 'cached-core');
  window.MetaRelease.ready().then(payload => applyCore(payload, 'ready-core'));

  const refresh = document.getElementById('refresh');
  if (refresh) refresh.addEventListener('click', async () => {
    refresh.disabled = true;
    try { await window.MetaRelease.refresh(); }
    finally { refresh.disabled = false; }
  });
})();
