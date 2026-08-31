(() => {
  'use strict';

  const ONLINE_SCOPES = [
    { value: '14', label: 'Last 14 days' },
    { value: '30', label: 'Last 30 days' },
    { value: 'all', label: 'All in format' },
  ];
  const state = { onlineScope: '30', irlScope: 'latest-weekend' };
  const ignored = name => !name || name === 'Other' || name === 'Unknown';
  const copy = value => JSON.parse(JSON.stringify(value ?? null));

  const rawDeckAggregate = window.DeckAggregate ? {
    getData: window.DeckAggregate.getData?.bind(window.DeckAggregate),
    getMatchup: window.DeckAggregate.getMatchup?.bind(window.DeckAggregate),
    getDeck: window.DeckAggregate.getDeck?.bind(window.DeckAggregate),
    hasData: window.DeckAggregate.hasData?.bind(window.DeckAggregate),
  } : null;
  const rawIrlGetData = window.IRLLabs?.getData?.bind(window.IRLLabs);

  let onlineHistory = null;
  let liveCacheMeta = null;
  const compactCache = new Map();
  const legacyCache = new Map();

  function emit(reason = 'state') {
    window.dispatchEvent(new CustomEvent('meta:data-changed', { detail: { ...state, reason } }));
  }

  function prepVisible() {
    return !!document.getElementById('prep') && !document.getElementById('prep').classList.contains('hidden');
  }

  function aggregateConsumerVisible() {
    return ['decks', 'matchups', 'deckDetail'].some(id => {
      const el = document.getElementById(id);
      return el && !el.classList.contains('hidden');
    });
  }

  function newestOnlineDate() {
    const dates = (onlineHistory?.tournaments || []).map(t => new Date(t.date).getTime()).filter(Number.isFinite);
    return dates.length ? Math.max(...dates) : Date.now();
  }

  function selectedOnlineEvents(scope = state.onlineScope, minPlayers = 50) {
    const rows = (onlineHistory?.tournaments || []).filter(t => Number(t.players || 0) >= Number(minPlayers || 0));
    if (scope === 'all') return rows;
    const cutoff = newestOnlineDate() - Number(scope || 30) * 86400000;
    return rows.filter(t => {
      const ts = new Date(t.date).getTime();
      return Number.isFinite(ts) && ts >= cutoff;
    });
  }

  function compactOnline(scope = state.onlineScope, minPlayers = 50) {
    const key = `${scope}|${minPlayers}`;
    if (compactCache.has(key)) return compactCache.get(key);
    const events = selectedOnlineEvents(scope, minPlayers);
    const decks = new Map();
    for (const event of events) {
      for (const d of event.archetypes || []) {
        if (ignored(d?.name)) continue;
        const row = decks.get(d.name) || { name:d.name, entries:0, wins:0, losses:0, ties:0 };
        row.entries += Number(d.entries || 0);
        row.wins += Number(d.wins || 0);
        row.losses += Number(d.losses || 0);
        row.ties += Number(d.ties || 0);
        decks.set(d.name, row);
      }
    }
    const list = [...decks.values()].sort((a,b) => b.entries - a.entries);
    const entries = list.reduce((sum,d) => sum + d.entries, 0);
    for (const d of list) {
      d.share = entries ? 100 * d.entries / entries : 0;
      const decisive = d.wins + d.losses;
      d.winRate = decisive ? 100 * d.wins / decisive : null;
      d.games = d.wins + d.losses + d.ties;
    }
    const value = { events, decks:list, overview:{ events:events.length, entries } };
    compactCache.set(key, value);
    return value;
  }

  function scopedOnlineMatchups(scope = state.onlineScope) {
    const scoped = onlineHistory?.matchupScopes?.[scope];
    if (Array.isArray(scoped?.matchups)) return { rows:scoped.matchups, actualScope:scope, scoped:true, overview:scoped.overview || {} };
    const aggregate = rawDeckAggregate?.getData?.();
    return {
      rows: Array.isArray(aggregate?.matchups) ? aggregate.matchups : [],
      actualScope: 'all',
      scoped: false,
      overview: aggregate?.overview || {},
    };
  }

  function onlineData(scope = state.onlineScope, minPlayers = 50) {
    const field = compactOnline(scope, minPlayers);
    const matchup = scopedOnlineMatchups(scope);
    const liveResults = (typeof DATA !== 'undefined' && Array.isArray(DATA?.results)) ? DATA.results : [];
    return {
      source:'online', scope,
      events:field.events,
      decks:field.decks,
      matchups:matchup.rows,
      matchupScope:matchup.actualScope,
      matchupScoped:matchup.scoped,
      results:liveResults,
      overview:{ ...field.overview, matches:Number(matchup.overview?.matches || 0) },
      generatedAt:onlineHistory?.generatedAt || liveCacheMeta?.generatedAt || null,
    };
  }

  function syntheticStanding(eventId, deck, index) {
    return {
      player:`scope:${eventId}:${deck.name}:${index}`,
      name:'',
      deck:{ name:deck.name },
      record:index === 0
        ? { wins:Number(deck.wins || 0), losses:Number(deck.losses || 0), ties:Number(deck.ties || 0) }
        : { wins:0, losses:0, ties:0 },
    };
  }

  function legacyOnlineEvents(scope = state.onlineScope) {
    if (legacyCache.has(scope)) return legacyCache.get(scope);
    const events = selectedOnlineEvents(scope, 50).map(event => ({
      id:event.id,
      name:event.name,
      date:event.date,
      players:event.players,
      standings:(event.archetypes || []).flatMap(deck => Array.from({ length:Number(deck.entries || 0) }, (_,i) => syntheticStanding(event.id, deck, i))),
      pairings:[],
    }));
    legacyCache.set(scope, events);
    return events;
  }

  function applyLegacyScope() {
    if (typeof CACHE === 'undefined' || !onlineHistory) return;
    if (!liveCacheMeta && CACHE) liveCacheMeta = { ...CACHE, tournaments:undefined };
    if (!CACHE) CACHE = {};
    const base = liveCacheMeta || {};
    const events = legacyOnlineEvents(state.onlineScope);
    Object.assign(CACHE, base, {
      format:'TEF-PBL',
      label:'TEF–PBL',
      generatedAt:onlineHistory.generatedAt || base.generatedAt,
      minTournamentSize:50,
      tournaments:events,
      tournamentCount:events.length,
    });
  }

  function refreshPrepField() {
    if (!prepVisible()) return;
    const source = document.getElementById('fieldSource')?.value || 'online';
    if (source !== 'custom') window.PrepField?.reset?.();
  }

  function notifyVisibleOnlineConsumer() {
    refreshPrepField();
    if (aggregateConsumerVisible()) window.dispatchEvent(new CustomEvent('deckagg:updated'));
  }

  function setOnlineScope(value, reason = 'online-scope') {
    const next = ONLINE_SCOPES.some(x => x.value === value) ? value : '30';
    if (state.onlineScope === next && reason === 'online-scope') return;
    state.onlineScope = next;
    applyLegacyScope();
    emit(reason);
    notifyVisibleOnlineConsumer();
  }

  function isoWeekKey(value) {
    const d = new Date(value);
    const u = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = u.getUTCDay() || 7;
    u.setUTCDate(u.getUTCDate() + 4 - day);
    const year = u.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year,0,1));
    const week = Math.ceil((((u - yearStart) / 86400000) + 1) / 7);
    return `${year}-W${String(week).padStart(2,'0')}`;
  }

  function rawIrl() { return rawIrlGetData?.() || { events:[], decks:[], matchups:[] }; }
  function validIrlEvents(raw = rawIrl()) {
    return [...(raw?.events || [])]
      .filter(e => Array.isArray(e.decks) && e.decks.length && Number.isFinite(new Date(e.date).getTime()))
      .sort((a,b) => new Date(b.date) - new Date(a.date));
  }
  function irlScopeOptions(raw = rawIrl()) {
    return [
      { value:'latest-weekend', label:'Latest IRL majors weekend' },
      { value:'all-irl', label:'All IRL majors this format' },
      ...validIrlEvents(raw).map(e => ({ value:`event:${e.id}`, label:`${e.name || 'IRL tournament'} · ${new Date(e.date).toLocaleDateString([], {day:'numeric',month:'short'})}`, event:true })),
    ];
  }
  function selectedIrlEvents(scope = state.irlScope, raw = rawIrl()) {
    const events = validIrlEvents(raw);
    if (!events.length) return [];
    if (scope === 'all-irl') return events;
    if (String(scope).startsWith('event:')) return events.filter(e => String(e.id) === String(scope).slice(6));
    const latestWeek = isoWeekKey(events[0].date);
    return events.filter(e => isoWeekKey(e.date) === latestWeek);
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
        const row = deckMap.get(d.name) || { name:d.name, entries:0, wins:0, losses:0, ties:0, url:d.url || '' };
        row.entries += Number(d.entries || 0); row.wins += Number(d.wins || 0); row.losses += Number(d.losses || 0); row.ties += Number(d.ties || 0);
        if (!row.url && d.url) row.url = d.url;
        deckMap.set(d.name,row);
      }
      for (const m of event.matchups || []) {
        if (ignored(m?.a) || ignored(m?.b)) continue;
        foundEventMatchups = true;
        const key = `${m.a}|||${m.b}`;
        const row = matchupMap.get(key) || { a:m.a, b:m.b, games:0, wins:0, losses:0, ties:0 };
        row.games += Number(m.games || 0); row.wins += Number(m.wins || 0); row.losses += Number(m.losses || 0); row.ties += Number(m.ties || 0);
        matchupMap.set(key,row);
      }
    }
    const decks = [...deckMap.values()].sort((a,b)=>b.entries-a.entries);
    const totalEntries = decks.reduce((sum,d)=>sum+d.entries,0);
    for (const d of decks) {
      d.share = totalEntries ? 100*d.entries/totalEntries : 0;
      const decisive=d.wins+d.losses;
      d.winRate=decisive?100*d.wins/decisive:null;
    }
    let matchups=[...matchupMap.values()];
    if (!foundEventMatchups && (scope==='all-irl' || validIrlEvents(raw).length===1)) matchups=raw?.matchups || [];
    return { ...copy(raw), source:'irl', scope, events, decks, matchups, overview:{events:events.length,entries:totalEntries} };
  }

  function setIrlScope(value, reason='irl-scope') {
    const allowed=new Set(irlScopeOptions().map(x=>x.value));
    const next=allowed.has(value)?value:'latest-weekend';
    if (state.irlScope===next && reason==='irl-scope') return;
    state.irlScope=next;
    emit(reason);
    refreshPrepField();
    if (aggregateConsumerVisible()) window.dispatchEvent(new CustomEvent('irl:updated'));
  }

  function data(source, options={}) {
    return source==='irl' ? irlData(options.scope || state.irlScope) : onlineData(options.scope || state.onlineScope, options.minPlayers || 50);
  }
  function fieldRows(source, options={}) {
    if (source==='irl') {
      const decks=irlData(options.scope || state.irlScope).decks;
      const total=decks.reduce((sum,d)=>sum+Number(d.entries||0),0);
      return decks.map(d=>({name:d.name,share:total?Number(d.entries||0)/total:0,source:'irl'}));
    }
    const events=selectedOnlineEvents(options.scope || state.onlineScope, options.minPlayers || 50);
    if (!events.length) return [];
    const mode=options.recency || 'balanced';
    const newest=Math.max(...events.map(t=>new Date(t.date).getTime()).filter(Number.isFinite));
    const halfLife=mode==='high'?7:mode==='balanced'?18:Infinity;
    const counts=new Map(); let total=0;
    for (const t of events) {
      const age=Math.max(0,(newest-new Date(t.date).getTime())/86400000);
      const weight=Number.isFinite(halfLife)?Math.pow(.5,age/halfLife):1;
      for (const d of t.archetypes || []) {
        if (ignored(d?.name)) continue;
        const value=Number(d.entries || 0)*weight;
        counts.set(d.name,(counts.get(d.name)||0)+value); total+=value;
      }
    }
    return [...counts.entries()].map(([name,value])=>({name,share:total?value/total:0,source:'online'})).sort((a,b)=>b.share-a.share);
  }
  function matchup(source,a,b,options={}) { return data(source,options).matchups.find(m=>m.a===a&&m.b===b)||null; }
  function context(source,options={}) {
    const d=data(source,options);
    if (source==='online') {
      const scope=options.scope || state.onlineScope;
      const label=ONLINE_SCOPES.find(x=>x.value===scope)?.label || 'Last 30 days';
      const fallback=!d.matchupScoped && scope!=='all';
      return { source,scope,events:Number(d.overview?.events||0),entries:Number(d.overview?.entries||0),label:`${label} online data`,detail:fallback?'Field scoped · matchups currently all-format':(d.generatedAt?`Updated ${new Date(d.generatedAt).toLocaleDateString([],{day:'numeric',month:'short'})}`:'50+ online tournaments') };
    }
    const scope=options.scope || state.irlScope, events=d.events || [];
    let label='Latest IRL majors weekend';
    if(scope==='all-irl')label='All IRL majors this format';
    if(String(scope).startsWith('event:')&&events[0])label=events[0].name||'IRL tournament';
    if(scope==='latest-weekend'&&events.length===1)label=events[0].name||label;
    return {source,scope,events:Number(events.length||0),entries:Number(d.overview?.entries||0),label,detail:events.length?events.map(e=>new Date(e.date).toLocaleDateString([],{day:'numeric',month:'short'})).join(' · '):'No IRL events in this scope'};
  }

  window.MetaState={ get:()=>({...state}), onlineScopes:()=>ONLINE_SCOPES.map(x=>({...x})), irlScopes:()=>irlScopeOptions().map(x=>({...x})), setOnlineScope,setIrlScope };
  window.MetaData={ data,onlineData,irlData,fieldRows,matchup,context,onlineTournaments:selectedOnlineEvents,irlEvents:selectedIrlEvents };

  if (window.DeckAggregate && rawDeckAggregate?.getData) {
    window.DeckAggregate.getData=()=>onlineData();
    window.DeckAggregate.getMatchup=(a,b)=>matchup('online',a,b);
    window.DeckAggregate.getDeck=name=>onlineData().decks.find(d=>d.name===name)||null;
    window.DeckAggregate.hasData=()=>onlineData().matchups.length>0;
  }
  if (window.IRLLabs && rawIrlGetData) {
    window.IRLLabs.getRawData=rawIrlGetData;
    window.IRLLabs.getData=()=>irlData();
  }
  window.MetaIRLScope={ get:()=>state.irlScope,set:value=>setIrlScope(value),options:()=>irlScopeOptions(),selectedEvents:()=>selectedIrlEvents(),selectedDecks:()=>irlData().decks,selectedMatchups:()=>irlData().matchups,raw:rawIrl };

  async function loadOnlineHistory() {
    try {
      const response=await fetch('../../data/meta/current-field.json',{cache:'no-store'});
      if(!response.ok)throw new Error(`Online history ${response.status}`);
      const payload=await response.json();
      if(!Array.isArray(payload?.tournaments))throw new Error('Invalid online history');
      onlineHistory=payload;
      compactCache.clear(); legacyCache.clear();
      applyLegacyScope();
      emit('online-history');
      notifyVisibleOnlineConsumer();
    } catch(error) {
      console.warn('Full online history unavailable; using aggregate fallback.',error);
    }
  }

  window.addEventListener('meta:updated',()=>{
    if (typeof CACHE!=='undefined' && CACHE && Array.isArray(CACHE.tournaments) && CACHE.tournaments.some(t=>Array.isArray(t.standings))) {
      liveCacheMeta={...CACHE,tournaments:undefined};
    }
    applyLegacyScope();
    emit('online-live');
  });
  window.addEventListener('irl:updated',()=>emit('irl-data'));
  loadOnlineHistory();
})();