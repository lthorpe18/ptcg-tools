(() => {
  'use strict';

  const DAY = 86400000;
  const IRL_MAX = 0.70;
  const IRL_MIN = 0.30;
  const IRL_DECAY_PER_DAY = 0.02;

  const clamp = (min, max, value) => Math.min(max, Math.max(min, value));

  function startOfLocalDay(value) {
    const d = value instanceof Date ? new Date(value) : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function latestMajorDate(events) {
    const dates = (Array.isArray(events) ? events : [])
      .map(event => startOfLocalDay(event?.date))
      .filter(Boolean)
      .sort((a, b) => b - a);
    return dates[0] || null;
  }

  function weightsForDays(daysSinceMajor) {
    const days = Math.max(0, Number(daysSinceMajor || 0));
    const irl = clamp(IRL_MIN, IRL_MAX, IRL_MAX - IRL_DECAY_PER_DAY * days);
    return { irl, online: 1 - irl };
  }

  function normaliseRows(rows, source) {
    const clean = (Array.isArray(rows) ? rows : [])
      .map(row => ({ name: String(row?.name || '').trim(), share: Math.max(0, Number(row?.share || 0)), source }))
      .filter(row => row.name && row.share > 0);
    const total = clean.reduce((sum, row) => sum + row.share, 0);
    if (!total) return [];
    return clean.map(row => ({ ...row, share: row.share / total }));
  }

  function mergeRows(irlRows, onlineRows, configuredWeights) {
    const irl = normaliseRows(irlRows, 'irl');
    const online = normaliseRows(onlineRows, 'online');

    if (!irl.length && !online.length) return { rows: [], weights: { irl: 0, online: 0 } };
    if (!irl.length) return { rows: online.map(row => ({ ...row, source: 'blend' })), weights: { irl: 0, online: 1 } };
    if (!online.length) return { rows: irl.map(row => ({ ...row, source: 'blend' })), weights: { irl: 1, online: 0 } };

    const weights = configuredWeights || { irl: 0.5, online: 0.5 };
    const map = new Map();
    for (const row of irl) map.set(row.name, (map.get(row.name) || 0) + row.share * weights.irl);
    for (const row of online) map.set(row.name, (map.get(row.name) || 0) + row.share * weights.online);

    const total = [...map.values()].reduce((sum, value) => sum + value, 0);
    const rows = [...map.entries()]
      .map(([name, value]) => ({ name, share: total ? value / total : 0, source: 'blend' }))
      .filter(row => row.share > 0)
      .sort((a, b) => b.share - a.share || a.name.localeCompare(b.name));

    return { rows, weights };
  }

  function current(options = {}) {
    const meta = window.MetaData;
    if (!meta?.fieldRows || !meta?.irlEvents) {
      return {
        rows: [],
        weights: { irl: 0, online: 0 },
        configuredWeights: null,
        daysSinceMajor: null,
        majorDate: null,
        irlScope: 'latest-weekend',
        onlineScope: 'since-major',
        minOnlinePlayers: 50,
      };
    }

    const irlEvents = meta.irlEvents('latest-weekend') || [];
    const majorDate = latestMajorDate(irlEvents);
    const now = startOfLocalDay(options.now || new Date());
    const daysSinceMajor = majorDate && now ? Math.max(0, Math.floor((now - majorDate) / DAY)) : null;
    const configuredWeights = daysSinceMajor == null ? { irl: 0.5, online: 0.5 } : weightsForDays(daysSinceMajor);

    const irlRows = meta.fieldRows('irl', { scope: 'latest-weekend' });
    const onlineRows = meta.fieldRows('online', {
      scope: 'since-major',
      minPlayers: 50,
      recency: 'equal',
    });
    const blended = mergeRows(irlRows, onlineRows, configuredWeights);

    return {
      rows: blended.rows,
      weights: blended.weights,
      configuredWeights,
      daysSinceMajor,
      majorDate: majorDate ? majorDate.toISOString().slice(0, 10) : null,
      irlScope: 'latest-weekend',
      onlineScope: 'since-major',
      minOnlinePlayers: 50,
    };
  }

  window.MetaBlendedField = {
    current,
    mergeRows,
    weightsForDays,
    policy: {
      irlMax: IRL_MAX,
      irlMin: IRL_MIN,
      irlDecayPerDay: IRL_DECAY_PER_DAY,
    },
  };
})();
