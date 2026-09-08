(() => {
  'use strict';

  const DAY = 86400000;
  const VERSION = 'blended-v2.1';
  const IRL_MAX = 0.70;
  const IRL_MIN = 0.30;
  const IRL_DECAY_PER_DAY = 0.02;
  const MIN_ONLINE_PLAYERS = 50;
  const clamp = (min, max, value) => Math.min(max, Math.max(min, value));
  const isoDay = value => {
    const text = String(value || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) && Number.isFinite(Date.parse(text + 'T00:00:00Z')) ? text : null;
  };
  const dayNumber = value => {
    const day = isoDay(value);
    return day ? Date.parse(day + 'T00:00:00Z') : null;
  };
  const daysBetween = (from, through) => {
    const a = dayNumber(from), b = dayNumber(through);
    return a == null || b == null ? null : Math.max(0, Math.floor((b - a) / DAY));
  };
  const addDays = (value, amount) => {
    const day = dayNumber(value);
    return day == null ? null : new Date(day + amount * DAY).toISOString().slice(0, 10);
  };
  const isoWeekKey = value => {
    const time = dayNumber(value);
    if (time == null) return '';
    const utc = new Date(time), day = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() + 4 - day);
    const start = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((utc - start) / DAY) + 1) / 7);
    return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  };
  const endOfIsoWeek = value => {
    const time = dayNumber(value);
    if (time == null) return null;
    const date = new Date(time), day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + (7 - day));
    return date.toISOString().slice(0, 10);
  };
  const contextLabel = value => typeof value === 'string' ? value : value?.label || null;
  const sourceMap = value => value instanceof Map ? value : new Map(Object.entries(value || {}));
  const eventRows = value => Array.isArray(value) ? value : [];
  const ignored = name => !name || name === 'Other' || name === 'Unknown';

  function weightsForDays(value) {
    const days = Math.max(0, Number(value || 0));
    const irl = clamp(IRL_MIN, IRL_MAX, IRL_MAX - IRL_DECAY_PER_DAY * days);
    return { irl, online:1 - irl };
  }

  function normaliseRows(rows, source) {
    if (globalThis.PTCGMetaField?.normalizeRows) return globalThis.PTCGMetaField.normalizeRows(rows, { source });
    const map = new Map();
    for (const row of Array.isArray(rows) ? rows : []) {
      const name = String(row?.name || '').trim();
      const share = Math.max(0, Number(row?.share || 0));
      if (!ignored(name) && share > 0) map.set(name, (map.get(name) || 0) + share);
    }
    const total = [...map.values()].reduce((sum, value) => sum + value, 0);
    return total ? [...map].map(([name, share]) => ({ name, share:share / total, source })) : [];
  }

  function mergeRows(irlRows, onlineRows, configuredWeights) {
    const irl = normaliseRows(irlRows, 'irl'), online = normaliseRows(onlineRows, 'online');
    if (!online.length) return { rows:[], weights:{ irl:0, online:0 } };
    const weights = !irl.length ? { irl:0, online:1 } : configuredWeights || { irl:0.5, online:0.5 };
    const map = new Map();
    for (const row of irl) map.set(row.name, (map.get(row.name) || 0) + row.share * weights.irl);
    for (const row of online) map.set(row.name, (map.get(row.name) || 0) + row.share * weights.online);
    const total = [...map.values()].reduce((sum, value) => sum + value, 0);
    const rows = [...map].map(([name, value]) => ({ name, share:total ? value / total : 0, source:'blend' }))
      .filter(row => row.share > 0).sort((a, b) => b.share - a.share || a.name.localeCompare(b.name));
    return { rows, weights };
  }

  function aggregateDecks(events) {
    const counts = new Map();
    for (const event of eventRows(events)) for (const deck of event.decks || event.archetypes || []) {
      const name = String(deck?.name || '').trim();
      if (ignored(name)) continue;
      counts.set(name, (counts.get(name) || 0) + Number(deck.entries || 0));
    }
    const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
    return total ? [...counts].map(([name, entries]) => ({ name, share:entries / total })) : [];
  }

  function latestWeekend(events) {
    const usable = eventRows(events).filter(event => dayNumber(event.date) != null && (event.decks || event.archetypes)?.length)
      .sort((a, b) => dayNumber(b.date) - dayNumber(a.date));
    if (!usable.length) return { events:[], rows:[], finalDay:null };
    const week = isoWeekKey(usable[0].date);
    const selected = usable.filter(event => isoWeekKey(event.date) === week);
    const latest = selected.map(event => isoDay(event.endDate || event.date)).sort().at(-1);
    return { events:selected, rows:aggregateDecks(selected), finalDay:endOfIsoWeek(latest) };
  }

  function onlineBucket(core, mode) {
    if (!core || core.unavailable) return { events:[], rows:[], overview:{ events:0, entries:0 }, scope:mode };
    const bucket = core.scopes?.[mode] || core.scopes?.all || {};
    const events = eventRows(bucket.events || core.events || core.tournaments).filter(event => event.players == null || Number(event.players) >= MIN_ONLINE_PLAYERS);
    const rows = bucket.decks || core.decks || aggregateDecks(events);
    return { events, rows, overview:bucket.overview || { events:events.length, entries:0 }, scope:mode };
  }

  function sameMarks(a, b) {
    const left = [...(a?.regulationMarks || [])].sort().join(','), right = [...(b?.regulationMarks || [])].sort().join(',');
    return !!left && left === right && a?.earliestSet === b?.earliestSet && !a?.rotation && !b?.rotation;
  }

  function immediatePrior(target, candidates) {
    const additions = target?.addedSetIds || [];
    return candidates.filter(candidate => sameMarks(target, candidate.context) && contextLabel(candidate.context) !== contextLabel(target))
      .filter(candidate => {
        const prior = candidate.context?.addedSetIds || [];
        return prior.length < additions.length && prior.every(id => additions.includes(id));
      }).sort((a, b) => (b.context?.addedSetIds?.length || 0) - (a.context?.addedSetIds?.length || 0))[0] || null;
  }

  function sourceSummary(kind, format, events, rows, core, extra = {}) {
    const dates = eventRows(events).map(event => isoDay(event.date)).filter(Boolean).sort();
    const classifiedEntries = eventRows(events).reduce((sum, event) => sum + (event.decks || event.archetypes || []).reduce((subtotal, deck) => subtotal + Number(deck.entries || 0), 0), 0);
    const entries = Number(extra.entries || 0) || classifiedEntries || eventRows(events).reduce((sum, event) => sum + Number(event.players || 0), 0);
    return {
      source:kind, format, eventCount:eventRows(events).length, entries,
      from:dates[0] || extra.from || null, through:dates.at(-1) || extra.through || null,
      events:eventRows(events).map(event => ({ id:String(event.id || ''), name:event.name || 'Tournament', date:isoDay(event.date), players:Number(event.players || 0) })),
      generatedAt:core?.generatedAt || null, rowCount:normaliseRows(rows, kind).length, ...extra,
    };
  }

  function unavailable(format, reason, online, asOf, rule = 'minimum-online-evidence') {
    return {
      version:VERSION, format, available:false, reason, rows:[], weights:{ irl:0, online:0 }, configuredWeights:null,
      status:'Unavailable', rule, frozen:false, asOf, evidence:{ online, irl:null },
    };
  }

  function predictions(evidence, options = {}) {
    const asOf = isoDay(options.now || evidence?.asOf || new Date().toISOString()) || isoDay(evidence?.asOf);
    const currentOnline = evidence?.currentFormats?.online || null;
    const currentIrl = evidence?.currentFormats?.irl || null;
    const onlineFormat = contextLabel(currentOnline), irlFormat = contextLabel(currentIrl);
    const targets = [...new Set([onlineFormat, irlFormat].filter(Boolean))];
    const online = sourceMap(evidence?.online), irl = sourceMap(evidence?.irl);
    const split = !!onlineFormat && !!irlFormat && onlineFormat !== irlFormat;
    const irlCandidates = [...irl].map(([format, core]) => ({ format, core, context:core?.formatContext || (format === irlFormat ? currentIrl : null), weekend:latestWeekend(core?.events) }));
    const splitDate = split ? currentOnline?.effectiveDate || evidence?.splitDate || null : null;

    return targets.map(format => {
      const targetContext = format === onlineFormat ? currentOnline : currentIrl;
      const onlineCore = online.get(format), sameIrlCore = irl.get(format);
      const weekend = latestWeekend(sameIrlCore?.events);
      const oldTarget = split && format === irlFormat;
      const currentTarget = format === onlineFormat;
      const mode = weekend.events.length ? 'since-major' : 'all';
      const onlineField = onlineBucket(onlineCore, mode);
      const onlineSummary = sourceSummary('online', format, onlineField.events, onlineField.rows, onlineCore, {
        scope:mode, frozen:oldTarget, frozenAt:oldTarget ? splitDate : null, entries:onlineField.overview?.entries,
      });
      if (!onlineField.events.length || !normaliseRows(onlineField.rows, 'online').length) {
        const reason = weekend.events.length ? 'Waiting for a qualifying 50+ player Online tournament after the latest major.' : 'Waiting for a qualifying 50+ player Online tournament in this format.';
        return unavailable(format, reason, onlineSummary, asOf, weekend.events.length ? 'post-major-online-required' : 'minimum-online-evidence');
      }

      let irlRows = weekend.rows, selectedWeekend = weekend, configuredWeights, rule, status, frozen = false, irlCore = sameIrlCore;
      if (weekend.events.length) {
        const sourceMajorIds = new Set((onlineCore?.majorWeekend?.events || []).map(event => String(event.id)));
        const newerOldMajor = oldTarget && weekend.events.some(event => !sourceMajorIds.has(String(event.id)));
        if (newerOldMajor) {
          configuredWeights = { irl:0.70, online:0.30 }; rule = 'new-old-format-major'; status = 'Online evidence frozen · weights reset 70/30'; frozen = true;
        } else {
          const clockDay = oldTarget && splitDate ? splitDate : asOf;
          const days = daysBetween(weekend.finalDay, clockDay);
          configuredWeights = weightsForDays(days == null ? 0 : days); rule = oldTarget ? 'frozen-old-format' : 'settled-format';
          status = oldTarget ? 'Online evidence and weights frozen' : 'Current blended prediction'; frozen = oldTarget;
        }
      } else {
        const prior = currentTarget ? immediatePrior(targetContext, irlCandidates.filter(candidate => candidate.weekend.events.length)) : null;
        if (prior) {
          irlRows = prior.weekend.rows; selectedWeekend = prior.weekend; irlCore = prior.core;
          configuredWeights = { irl:0.25, online:0.75 }; rule = 'ordinary-set-transition-prior'; status = 'Early format · previous-format IRL prior';
        } else {
          irlRows = []; selectedWeekend = { events:[], rows:[], finalDay:null }; irlCore = null;
          configuredWeights = { irl:0, online:1 }; rule = targetContext?.rotation ? 'rotation-online-only' : 'online-only';
          status = targetContext?.rotation ? 'Early rotated format · Online evidence only' : 'Online evidence only';
        }
      }

      const blended = mergeRows(irlRows, onlineField.rows, configuredWeights);
      const irlSummary = sourceSummary('irl', irlCore?.format || format, selectedWeekend.events, irlRows, irlCore, { finalDay:selectedWeekend.finalDay, priorFormat:(irlCore?.format || format) !== format });
      const daysSinceMajor = selectedWeekend.finalDay ? daysBetween(selectedWeekend.finalDay, oldTarget && splitDate ? splitDate : asOf) : null;
      return {
        version:VERSION, format, available:true, reason:null, rows:blended.rows, weights:blended.weights, configuredWeights,
        status, rule, frozen, asOf, daysSinceMajor, majorDate:selectedWeekend.finalDay,
        irlScope:'latest-weekend', onlineScope:onlineField.scope, minOnlinePlayers:MIN_ONLINE_PLAYERS,
        evidence:{ online:onlineSummary, irl:irlSummary },
        revision:[onlineCore?.generatedAt, irlCore?.generatedAt, evidence?.calendarRevision].filter(Boolean).join('|'),
      };
    });
  }

  function onlineTarget(evidence, options = {}) {
    const format=contextLabel(evidence?.currentFormats?.online);
    const rows=predictions(evidence,options);
    return rows.find(row=>row.format===format) || unavailable(format,format?'A prediction for the current Online format is unavailable.':'Format information is unavailable.',null,isoDay(options.now || evidence?.asOf || new Date().toISOString()),'format-unavailable');
  }

  // Compatibility for Home and consumers migrated in later checkpoints.
  function result(irlRows, onlineRows, events, options = {}) {
    const dates=eventRows(events).map(event=>isoDay(event?.date)).filter(Boolean).sort().reverse();
    const majorDate=dates[0] || null,days=daysBetween(majorDate,isoDay(options.now || new Date().toISOString()));
    const configuredWeights = weightsForDays(days == null ? 0 : days), blended = mergeRows(irlRows, onlineRows, configuredWeights);
    return { rows:blended.rows, weights:blended.weights, configuredWeights, daysSinceMajor:days, majorDate,
      irlScope:'latest-weekend', onlineScope:'since-major', minOnlinePlayers:MIN_ONLINE_PLAYERS };
  }
  function currentFromMeta(meta, options = {}) {
    if (!meta?.fieldRows || !meta?.irlEvents) return result([], [], [], options);
    const events = meta.irlEvents('latest-weekend') || [];
    return result(meta.fieldRows('irl', { scope:'latest-weekend' }), meta.fieldRows('online', { scope:'since-major', minPlayers:50, recency:'equal' }), events, options);
  }
  function currentFromCore(core, options = {}) {
    const events = core?.irl?.events || [];
    const onlineRows = (core?.online?.scopes?.['since-major']?.decks || []).map(deck => ({ name:deck.name, share:Number(deck.share || 0) / 100 }));
    return result(aggregateDecks(latestWeekend(events).events), onlineRows, events, options);
  }

  window.PTCGMetaBlend = {
    predictions, onlineTarget, currentFromMeta, currentFromCore, mergeRows, weightsForDays,
    policy:{ version:VERSION, irlMax:IRL_MAX, irlMin:IRL_MIN, irlDecayPerDay:IRL_DECAY_PER_DAY, minOnlinePlayers:MIN_ONLINE_PLAYERS },
  };
})();
