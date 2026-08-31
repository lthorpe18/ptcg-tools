(() => {
  'use strict';

  const ONLINE_SCOPES = [
    { value: '14', label: 'Last 14 days' },
    { value: '30', label: 'Last 30 days' },
    { value: 'all', label: 'All in format' },
  ];
  const state = { onlineScope: '30', irlScope: 'latest-weekend' };

  const rawDeckAggregate = window.DeckAggregate ? {
    getData: window.DeckAggregate.getData?.bind(window.DeckAggregate),
    getMatchup: window.DeckAggregate.getMatchup?.bind(window.DeckAggregate),
    hasData: window.DeckAggregate.hasData?.bind(window.DeckAggregate),
  } : null;
  const rawIrlGetData = window.IRLLabs?.getData?.bind(window.IRLLabs);

  let rawOnlineTournaments = [];
  let rawCacheIdentity = null;
  let appliedOnlineRows = null;

  const ignored = name => !name || name === 'Other' || name === 'Unknown';
  const copy = value => JSON.parse(JSON.stringify(value ?? null));

  function captureOnlineBase() {
    if (typeof CACHE === 'undefined' || !CACHE || !Array.isArray(CACHE.tournaments)) return;
    const identity = `${CACHE.format || ''}|${CACHE.generatedAt || ''}`;
    if (!rawOnlineTournaments.length || identity !== rawCacheIdentity || CACHE.tournaments !== appliedOnlineRows) {
      if (CACHE.tournaments !== appliedOnlineRows) {
        rawOnlineTournaments = [...CACHE.tournaments];
        rawCacheIdentity = identity;
      }
    }
  }

  function scopedOnlineRows(scope = state.onlineScope, minPlayers = 50) {
    captureOnlineBase();
    const eligible = rawOnlineTournaments.filter(t => Number(t.players || 0) >= Number(minPlayers || 0) && Array.isArray(t.standings) && t.standings.length);
    if (scope === 'all') return eligible;
    const dates = eligible.map(t => new Date(t.date).getTime()).filter(Number.isFinite);
    if (!dates.length) return [];
    const newest = Math.max(...dates);
    const cutoff = newest - Number(scope || 30) * 86400000;
    return eligible.filter(t => {
      const ts = new Date(t.date).getTime();
      return Number.isFinite(ts) && ts >= cutoff;
    });
  }

  function applyOnlineScopeToLegacyCache() {
    if (typeof CACHE === 'undefined' || !CACHE || !rawOnlineTournaments.length) return;
    appliedOnlineRows = scopedOnlineRows(state.onlineScope, 0);
    CACHE.tournaments = appliedOnlineRows;
  }

  function refreshLegacyAggregate() {
    if (typeof MetaEngine === 'undefined' || !MetaEngine?.aggregate) return;
    const rows = scopedOnlineRows(state.onlineScope, 50);
    if (typeof FILTERED_TOURNAMENTS !== 'undefined') FILTERED_TOURNAMENTS = rows;
    if (typeof DATA !== 'undefined') DATA = MetaEngine.aggregate(rows);
  }

  function emit(reason = 'state') {
    window.dispatchEvent(new CustomEvent('meta:data-changed', { detail: { ...state, reason } }));
  }

  function setOnlineScope(value, reason = 'online-scope') {
    state.onlineScope = ONLINE_SCOPES.some(x => x.value === value) ? value : '30';
    applyOnlineScopeToLegacyCache();
    refreshLegacyAggregate();
    emit(reason);
    window.dispatchEvent(new CustomEvent('deckagg:updated'));
    window.dispatchEvent(new CustomEvent('field:updated'));
  }

  function isoWeekKey(value) {
    const d = new Date(value);
    const u = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = u.getUTCDay() || 7;
    u.setUTCDate(u.getUTCDate() + 4 - day);
    const year = u.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const week = Math.ceil((((u - yearStart) / 86400000) + 1) / 7);
    return `${year}-W${String(week).padStart(2, '0')}`;
  }

  function rawIrl() {
    return rawIrlGetData?.() || { events: [], decks: [], matchups: [] };
  }

  function validIrlEvents(raw = rawIrl()) {
    return [...(raw?.events || [])]
      .filter(e => Array.isArray(e.decks) && e.decks.length && Number.isFinite(new Date(e.date).getTime()))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  function irlScopeOptions(raw = rawIrl()) {
    return [
      { value: 'latest-weekend', label: 'Latest IRL majors weekend' },
      { value: 'all-irl', label: 'All IRL majors this format' },
      ...validIrlEvents(raw).map(e => ({
        value: `event:${e.id}`,
        label: `${e.name || 'IRL tournament'} · ${new Date(e.date).toLocaleDateString([], { day: 'numeric', month: 'short' })}`,
        event: true,
      })),
    ];
  }

  function setIrlScope(value, reason = 'irl-scope') {
    const allowed = new Set(irlScopeOptions().map(x => x.value));
    state.irlScope = allowed.has(value) ? value : 'latest-weekend';
    emit(reason);
    window.dispatchEvent(new CustomEvent('irl:updated'));
    window.dispatchEvent(new CustomEvent('field:updated'));
  }

  function selectedIrlEvents(scope = state.irlScope, raw = rawIrl()) {
    const events = validIrlEvents(raw);
    if (!events.length) return [];
    if (scope === 'all-irl') return events;
    if (String(scope).startsWith('event:')) return events.filter(e => String(e.id) === String(scope).slice(6));
    const latestWeek = isoWeekKey(events[0].date);
    return events.filter(e => isoWeekKey(e.date) === latestWeek);
  }

  function onlineTournaments(scope = state.onlineScope, minPlayers = 50) {
    return scopedOnlineRows(scope, minPlayers);
  }

  function aggregateOnline(scope = state.onlineScope, minPlayers = 50) {
    if (typeof MetaEngine === 'undefined' || !MetaEngine?.aggregate) return null;
    return MetaEngine.aggregate(onlineTournaments(scope, minPlayers));
  }

  function decksFromAggregate(agg) {
    return (agg?.archetypes || []).filter(d => !ignored(d.name)).map(d => ({
      name: d.name,
      entries: Number(d.players || 0),
      players: Number(d.players || 0),
      wins: Number(d.wins || 0),
      losses: Number(d.losses || 0),
      ties: Number(d.ties || 0),
      games: Number(d.games || 0),
      share: Number(d.share || 0),
      winRate: Number(d.winRate || 0),
    }));
  }

  function onlineData(scope = state.onlineScope, minPlayers = 50) {
    const agg = aggregateOnline(scope, minPlayers);
    if (!agg) return rawDeckAggregate?.getData?.() || { decks: [], matchups: [], results: [] };
    return {
      source: 'online', scope,
      events: onlineTournaments(scope, minPlayers),
      decks: decksFromAggregate(agg),
      matchups: [...(agg.matchups?.values?.() || [])],
      results: agg.results || [],
      overview: { events: Number(agg.tournamentCount || 0), entries: Number(agg.totalPlayers || 0), matches: Number(agg.matches || 0) },
      generatedAt: (typeof CACHE !== 'undefined' ? CACHE?.generatedAt : null) || null,
    };
  }

  function irlData(scope = state.irlScope) {
    const raw = rawIrl();
    const events = selectedIrlEvents(scope, raw);
    const deckMap = new Map();
    const matchupMap = new Map();
    let foundEventMatchups = false;

    for (const event of events) {
      for (const d of event.decks || []) {
        if (ignored(d?.name)) continue;
        const row = deckMap.get(d.name) || { name: d.name, entries: 0, wins: 0, losses: 0, ties: 0, url: d.url || '' };
        row.entries += Number(d.entries || 0);
        row.wins += Number(d.wins || 0);
        row.losses += Number(d.losses || 0);
        row.ties += Number(d.ties || 0);
        if (!row.url && d.url) row.url = d.url;
        deckMap.set(d.name, row);
      }
      for (const m of event.matchups || []) {
        if (ignored(m?.a) || ignored(m?.b)) continue;
        foundEventMatchups = true;
        const key = `${m.a}|||${m.b}`;
        const row = matchupMap.get(key) || { a: m.a, b: m.b, games: 0, wins: 0, losses: 0, ties: 0 };
        row.games += Number(m.games || 0);
        row.wins += Number(m.wins || 0);
        row.losses += Number(m.losses || 0);
        row.ties += Number(m.ties || 0);
        matchupMap.set(key, row);
      }
    }

    const decks = [...deckMap.values()].sort((a, b) => b.entries - a.entries);
    const totalEntries = decks.reduce((sum, d) => sum + d.entries, 0);
    for (const d of decks) {
      d.share = totalEntries ? 100 * d.entries / totalEntries : 0;
      const decisive = d.wins + d.losses;
      d.winRate = decisive ? 100 * d.wins / decisive : null;
    }
    let matchups = [...matchupMap.values()];
    if (!foundEventMatchups && (scope === 'all-irl' || validIrlEvents(raw).length === 1)) matchups = raw?.matchups || [];

    return { ...copy(raw), source: 'irl', scope, events, decks, matchups, overview: { events: events.length, entries: totalEntries } };
  }

  function data(source, options = {}) {
    return source === 'irl'
      ? irlData(options.scope || state.irlScope)
      : onlineData(options.scope || state.onlineScope, options.minPlayers || 50);
  }

  function fieldRows(source, options = {}) {
    if (source === 'irl') {
      const decks = irlData(options.scope || state.irlScope).decks;
      const total = decks.reduce((sum, d) => sum + Number(d.entries || 0), 0);
      return decks.map(d => ({ name: d.name, share: total ? Number(d.entries || 0) / total : 0, source: 'irl' }));
    }

    const tournaments = onlineTournaments(options.scope || state.onlineScope, options.minPlayers || 50);
    if (!tournaments.length) return [];
    const mode = options.recency || 'balanced';
    const newest = Math.max(...tournaments.map(t => new Date(t.date).getTime()).filter(Number.isFinite));
    const halfLife = mode === 'high' ? 7 : mode === 'balanced' ? 18 : Infinity;
    const counts = new Map();
    let total = 0;
    for (const t of tournaments) {
      const age = Math.max(0, (newest - new Date(t.date).getTime()) / 86400000);
      const weight = Number.isFinite(halfLife) ? Math.pow(0.5, age / halfLife) : 1;
      for (const s of t.standings || []) {
        const name = s?.deck?.name;
        if (ignored(name)) continue;
        counts.set(name, (counts.get(name) || 0) + weight);
        total += weight;
      }
    }
    return [...counts.entries()]
      .map(([name, value]) => ({ name, share: total ? value / total : 0, source: 'online' }))
      .sort((a, b) => b.share - a.share);
  }

  function matchup(source, a, b, options = {}) {
    return data(source, options).matchups.find(m => m.a === a && m.b === b) || null;
  }

  function context(source, options = {}) {
    const d = data(source, options);
    if (source === 'online') {
      const scope = options.scope || state.onlineScope;
      const label = ONLINE_SCOPES.find(x => x.value === scope)?.label || 'Last 30 days';
      return {
        source, scope,
        events: Number(d.overview?.events || 0),
        entries: Number(d.overview?.entries || 0),
        label: `${label} online data`,
        detail: d.generatedAt ? `Updated ${new Date(d.generatedAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}` : '50+ online tournaments',
      };
    }

    const scope = options.scope || state.irlScope;
    const events = d.events || [];
    let label = 'Latest IRL majors weekend';
    if (scope === 'all-irl') label = 'All IRL majors this format';
    if (String(scope).startsWith('event:') && events[0]) label = events[0].name || 'IRL tournament';
    if (scope === 'latest-weekend' && events.length === 1) label = events[0].name || label;
    return {
      source, scope,
      events: Number(events.length || 0),
      entries: Number(d.overview?.entries || 0),
      label,
      detail: events.length ? events.map(e => new Date(e.date).toLocaleDateString([], { day: 'numeric', month: 'short' })).join(' · ') : 'No IRL events in this scope',
    };
  }

  window.MetaState = {
    get: () => ({ ...state }),
    onlineScopes: () => ONLINE_SCOPES.map(x => ({ ...x })),
    irlScopes: () => irlScopeOptions().map(x => ({ ...x })),
    setOnlineScope,
    setIrlScope,
  };
  window.MetaData = { data, onlineData, irlData, fieldRows, matchup, context, onlineTournaments, irlEvents: selectedIrlEvents };

  if (window.DeckAggregate && rawDeckAggregate?.getData) {
    window.DeckAggregate.getData = () => onlineData();
    window.DeckAggregate.getMatchup = (a, b) => matchup('online', a, b);
    window.DeckAggregate.getDeck = name => onlineData().decks.find(d => d.name === name) || null;
    window.DeckAggregate.hasData = () => onlineData().matchups.length > 0;
  }
  if (window.IRLLabs && rawIrlGetData) {
    window.IRLLabs.getRawData = rawIrlGetData;
    window.IRLLabs.getData = () => irlData();
  }
  window.MetaIRLScope = {
    get: () => state.irlScope,
    set: value => setIrlScope(value),
    options: () => irlScopeOptions(),
    selectedEvents: () => selectedIrlEvents(),
    selectedDecks: () => irlData().decks,
    selectedMatchups: () => irlData().matchups,
    raw: rawIrl,
  };

  window.addEventListener('meta:updated', () => {
    captureOnlineBase();
    applyOnlineScopeToLegacyCache();
    refreshLegacyAggregate();
    emit('online-data');
  });
  window.addEventListener('irl:updated', () => emit('irl-data'));
  captureOnlineBase();
  applyOnlineScopeToLegacyCache();
  refreshLegacyAggregate();
})();