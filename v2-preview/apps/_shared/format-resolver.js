/* Checkpoint 1: opt-in, DOM-free. No network, clock, storage or UI initialisation. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PTCGFormat = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 1;
  const ENVIRONMENTS = ['online', 'irl'];
  const clone = value => JSON.parse(JSON.stringify(value));
  function freeze(value) {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  }
  function dateOnly(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const time = Date.parse(value + 'T00:00:00Z');
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? value : null;
  }
  const confirmed = fact => fact && fact.status === 'confirmed' && fact.value != null;
  const inCoverage = (coverage, day) => !!(coverage && coverage.complete &&
    day >= coverage.from && day <= coverage.through);
  const effective = (fact, day) => confirmed(fact) && fact.value <= day;

  // Invalid registries are programming/data errors; incomplete facts are valid data.
  function validate(registry) {
    const errors = [];
    const check = (condition, message) => { if (!condition) errors.push(message); };
    if (!registry || typeof registry !== 'object') return ['Registry must be an object'];
    check(registry.schemaVersion === VERSION, 'Unsupported schemaVersion');
    check(['verified-seed', 'synthetic'].includes(registry.kind), 'Missing fixture kind');
    check(typeof registry.revision === 'string' && !!registry.revision, 'Missing revision');
    check(typeof registry.scope === 'string' && !!registry.scope, 'Missing scope');
    const sources = registry.sources || {};
    function fact(f, path, isDate = false) {
      check(!!f && ['confirmed', 'announced', 'unknown'].includes(f.status), path + ': invalid status');
      if (!f) return;
      check(Array.isArray(f.sources) && f.sources.every(id => sources[id]), path + ': unresolved sources');
      if (f.status === 'confirmed') {
        check(f.value != null && f.sources?.length > 0, path + ': unsourced confirmation');
        if (registry.kind === 'verified-seed') check(f.sources?.every(id => /^https:\/\//.test(sources[id]?.url || '')), path + ': verified facts need source URLs');
      }
      if (isDate) {
        check(f.value == null || !!dateOnly(f.value), path + ': invalid date');
        check(f.convention === 'calendar-day-inclusive', path + ': missing date convention');
      }
    }
    function coverage(c, path) {
      check(!!c && typeof c.complete === 'boolean' && typeof c.note === 'string', path + ': missing coverage');
      if (c?.complete) check(!!dateOnly(c.from) && !!dateOnly(c.through) && c.from <= c.through, path + ': invalid coverage range');
    }
    coverage(registry.coverage?.catalog, 'catalog');
    check(Array.isArray(registry.sets), 'Missing sets');
    const ids = new Set();
    for (const set of registry.sets || []) {
      check(typeof set.id === 'string' && !!set.id && !ids.has(set.id), 'Invalid/duplicate set id');
      ids.add(set.id);
      fact(set.release, set.id + '.release', true);
      fact(set.marks, set.id + '.marks');
      if (confirmed(set.marks)) check(Array.isArray(set.marks.value) && set.marks.value.length > 0 && set.marks.value.every(m => /^[A-Z]$/.test(m)), set.id + ': invalid marks');
      for (const env of ENVIRONMENTS) fact(set.legality?.[env], set.id + '.' + env, true);
    }
    for (const env of ENVIRONMENTS) {
      coverage(registry.coverage?.[env], env);
      const rows = registry.rotations?.[env];
      check(Array.isArray(rows), env + ': missing rotation timeline');
      const days = new Set(), ruleIds = new Set();
      for (const rule of rows || []) {
        check(typeof rule.id === 'string' && !!rule.id && !ruleIds.has(rule.id), env + ': invalid/duplicate rule id');
        ruleIds.add(rule.id);
        fact(rule.effective, rule.id + '.effective', true);
        fact(rule.boundary, rule.id + '.boundary');
        fact(rule.exceptions, rule.id + '.exceptions');
        if (confirmed(rule.boundary)) {
          const b = rule.boundary.value;
          check(b && (b.lowestMark || b.setIds?.length), rule.id + ': empty lower boundary');
          if (b.lowestMark) check(/^[A-Z]$/.test(b.lowestMark), rule.id + ': invalid lower mark');
          if (b.setIds) check(Array.isArray(b.setIds) && b.setIds.every(id => ids.has(id)), rule.id + ': unknown boundary set');
        }
        if (confirmed(rule.exceptions)) check(Array.isArray(rule.exceptions.value) && rule.exceptions.value.every(v => typeof v === 'string'), rule.id + ': invalid exception identities');
        if (confirmed(rule.effective)) {
          check(!days.has(rule.effective.value), env + ': conflicting same-day rotations');
          days.add(rule.effective.value);
        }
      }
    }
    return errors;
  }

  function create(input) {
    const errors = validate(input);
    if (errors.length) throw new TypeError(errors.join('\n'));
    const registry = freeze(clone(input));
    function resolve(day) {
      if (!dateOnly(day)) return freeze({status: 'unknown', date: null, reason: 'A valid YYYY-MM-DD event/calendar date is required; today is never substituted.'});
      const events = [];
      function change(type, id, environment, fact) {
        if (confirmed(fact) && fact.value > day) events.push({type, id, environment, date: fact.value, fact});
      }
      const sets = registry.sets.map(set => {
        change('release', set.id, null, set.release);
        return {id: set.id, name: set.name, release: effective(set.release, day) ? 'released' :
          confirmed(set.release) ? 'unreleased' : set.release.status === 'announced' ? 'announced' : 'unknown',
        facts: {release: set.release, marks: set.marks, legality: set.legality}};
      });
      const environments = {};
      for (const env of ENVIRONMENTS) {
        const timeline = registry.rotations[env];
        const active = timeline.filter(row => effective(row.effective, day))
          .sort((a, b) => b.effective.value.localeCompare(a.effective.value))[0] || null;
        const issues = [];
        const covered = inCoverage(registry.coverage[env], day);
        if (!covered) issues.push('environment-history-or-future-coverage-incomplete');
        if (!inCoverage(registry.coverage.catalog, day)) issues.push('set-catalog-incomplete');
        // A known lower boundary survives catalog gaps, but never a timeline coverage gap.
        const boundary = covered && confirmed(active?.boundary) ? active.boundary.value : null;
        if (!boundary) issues.push('lower-boundary-unknown');
        if (!confirmed(active?.exceptions)) issues.push('exceptions-incomplete');
        const undated = [];
        for (const row of timeline) {
          change('rotation', row.id, env, row.effective);
          if (!confirmed(row.effective)) undated.push({type: 'rotation', id: row.id, fact: row.effective});
        }
        const legalSets = [], illegalSets = [], unknownSets = [], pool = [];
        for (const set of registry.sets) {
          const admission = set.legality[env];
          change('legality', set.id, env, admission);
          if (!confirmed(admission)) undated.push({type: 'legality', id: set.id, fact: admission});
          let state, reason, legalMarks = [];
          if (!confirmed(admission)) { state = 'unknown'; reason = 'legality-date-unknown'; }
          else if (admission.value > day) { state = 'illegal'; reason = 'before-legality-date'; }
          else if (!boundary) { state = 'unknown'; reason = 'rotation-boundary-unknown'; }
          else if (boundary.lowestMark && confirmed(set.marks)) {
            legalMarks = set.marks.value.filter(mark => mark >= boundary.lowestMark).sort();
            state = legalMarks.length ? 'legal' : 'illegal'; reason = legalMarks.length ? 'admitted-under-rotation' : 'rotated-out';
          } else if (!boundary.lowestMark && boundary.setIds) {
            // Explicit pool membership, never an ordering inferred from registry rows.
            state = boundary.setIds.includes(set.id) ? 'legal' : 'illegal'; reason = 'verified-set-pool-boundary';
          } else { state = 'unknown'; reason = 'set-regulation-marks-unknown'; }
          const row = {id: set.id, status: state, reason, admission: effective(admission, day) ? 'admitted' : confirmed(admission) ? 'not-yet-admitted' : 'unknown', legalMarks};
          (state === 'legal' ? legalSets : state === 'illegal' ? illegalSets : unknownSets).push(row);
          if (state === 'legal') pool.push({id: set.id, marks: legalMarks});
        }
        if (unknownSets.length) issues.push('set-legality-incomplete');
        if (undated.some(row => row.type === 'rotation')) issues.push('unconfirmed-rotation-change');
        // Future/undated announcements do not erase established present facts when
        // coverage explicitly confirms the present pool. They do qualify next-change certainty.
        const unresolvedPresent = unknownSets.filter(row => {
          const s = registry.sets.find(set => set.id === row.id);
          return !(confirmed(s.release) && s.release.value > day) && s.release.status !== 'announced';
        });
        const complete = covered && inCoverage(registry.coverage.catalog, day) && boundary &&
          confirmed(active?.exceptions) && !unresolvedPresent.length && !undated.some(row => row.type === 'rotation');
        pool.sort((a, b) => a.id.localeCompare(b.id));
        const identityBoundary = boundary ? {...boundary} : null;
        if (identityBoundary?.setIds) identityBoundary.setIds = [...identityBoundary.setIds].sort();
        const identity = complete ? 'pool-v1:' + JSON.stringify({scope: registry.scope, boundary: identityBoundary,
          sets: pool, exceptions: [...active.exceptions.value].sort()}) : null;
        environments[env] = {status: complete ? 'known' : 'incomplete', rotation: active,
          boundary, legalSets, illegalSets, unknownSets,
          format: {id: identity, boundary, sets: pool, exceptions: active?.exceptions || null},
          issues, undatedChanges: undated};
      }
      events.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type) || a.id.localeCompare(b.id));
      function next(rows, blockers) {
        const first = rows[0]?.date || null;
        return {date: first, changes: rows.filter(row => row.date === first),
          certainty: blockers.length ? 'ordering-unknown' : first ? 'confirmed' : 'none-known', blockers};
      }
      for (const env of ENVIRONMENTS) {
        const blockers = [...environments[env].undatedChanges];
        const upcoming = events.filter(row => row.environment === env);
        const horizon = upcoming[0]?.date || day;
        if (!inCoverage(registry.coverage.catalog, day) || !inCoverage(registry.coverage[env], day) ||
            !inCoverage(registry.coverage.catalog, horizon) || !inCoverage(registry.coverage[env], horizon)) {
          blockers.push({type: 'coverage', reason: 'Schedule may omit an earlier change'});
        }
        environments[env].nextChange = next(upcoming, blockers);
      }
      const releaseBlockers = registry.sets.filter(s => !confirmed(s.release)).map(s => ({type: 'release', id: s.id, fact: s.release}));
      if (!inCoverage(registry.coverage.catalog, day)) releaseBlockers.push({type: 'coverage'});
      const result = {status: Object.values(environments).every(e => e.status === 'known') ? 'known' : 'incomplete',
        date: day, convention: 'calendar-day-inclusive', registryRevision: registry.revision, fixtureKind: registry.kind,
        scope: registry.scope, coverage: registry.coverage, sources: registry.sources, sets,
        releasedSets: sets.filter(s => s.release === 'released').map(s => s.id),
        environments, nextRelease: next(events.filter(row => row.type === 'release'), releaseBlockers)};
      return freeze(result);
    }
    function resolveEvent(event) {
      if (!ENVIRONMENTS.includes(event?.environment)) return freeze({status: 'unknown', reason: 'Explicit online or irl environment required'});
      const result = resolve(event.date);
      return result.date ? freeze({date: result.date, environment: event.environment,
        registryRevision: result.registryRevision, fixtureKind: result.fixtureKind, ...result.environments[event.environment]}) : result;
    }
    return Object.freeze({resolve, resolveEvent, revision: registry.revision});
  }
  return Object.freeze({VERSION, validate, create, dateOnly});
});
