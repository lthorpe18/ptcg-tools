(() => {
  'use strict';

  const IGNORED = new Set(['Other', 'Unknown']);
  const SOURCES = Object.freeze({
    blend: Object.freeze({ value:'blend', label:'Blended current field', shortLabel:'Blended', kind:'observed' }),
    online: Object.freeze({ value:'online', label:'Online field', shortLabel:'Online', kind:'observed' }),
    irl: Object.freeze({ value:'irl', label:'IRL field', shortLabel:'IRL', kind:'observed' }),
    expected: Object.freeze({ value:'expected', label:'Saved Expected Field', shortLabel:'Expected Field', kind:'predicted' }),
    custom: Object.freeze({ value:'custom', label:'Custom Expected Field', shortLabel:'Custom', kind:'predicted' }),
  });
  const FAMILIES = Object.freeze([
    Object.freeze({ name:'Dragapult', variants:Object.freeze(['Dragapult', 'Dragapult Dusknoir', 'Dragapult Blaziken', 'Dragapult Dudunsparce']) }),
    Object.freeze({ name:'Alakazam', variants:Object.freeze(['Alakazam Dudunsparce', 'Alakazam Dusknoir']) }),
    Object.freeze({ name:'Lopunny', variants:Object.freeze(['Lopunny Dudunsparce', 'Lopunny Dusknoir']) }),
    Object.freeze({ name:'Ogerpon Meganium', variants:Object.freeze(['Ogerpon Meganium Hydrapple', 'Ogerpon Meganium Arboliva']) }),
  ]);
  const familyNames = new Set(FAMILIES.map(family => family.name));

  function cleanName(value) { return String(value || '').trim(); }
  function isUsableName(value) { const name=cleanName(value); return !!name && !IGNORED.has(name); }

  function normalizeRows(rows, options = {}) {
    const map = new Map();
    for (const input of Array.isArray(rows) ? rows : []) {
      const name = cleanName(input?.name);
      const share = Math.max(0, Number(input?.share || 0));
      if (!isUsableName(name) || !Number.isFinite(share) || share <= 0) continue;
      const prior = map.get(name);
      if (prior) prior.share += share;
      else map.set(name, { ...input, name, share });
    }
    const total = [...map.values()].reduce((sum, row) => sum + row.share, 0);
    if (!total) return [];
    const source = options.source || null;
    return [...map.values()]
      .map(row => ({ ...row, share:row.share / total, ...(source ? { source } : {}) }))
      .sort((a, b) => b.share - a.share || a.name.localeCompare(b.name));
  }

  function selectCoverage(rows, target = 0.9) {
    const normalized = normalizeRows(rows);
    const boundedTarget = Math.max(0, Math.min(1, Number(target || 0)));
    const selected = [];
    let representedShare = 0;
    for (const row of normalized) {
      if (selected.length && representedShare >= boundedTarget) break;
      selected.push({ ...row, originalShare:row.share });
      representedShare += row.share;
    }
    const modelRows = normalizeRows(selected).map(row => ({ ...row, originalShare:row.originalShare }));
    return { rows:modelRows, representedShare, totalRows:normalized.length };
  }

  function sourceDefinition(value) { return SOURCES[value] || SOURCES.blend; }

  function legacyAmbiguities(rows, provenance) {
    if (provenance?.identity === 'exact-variant') return [];
    return normalizeRows(rows).filter(row => familyNames.has(row.name)).map(row => row.name);
  }

  function resolve(options = {}) {
    const requested = options.source || 'blend';
    const source = sourceDefinition(requested).value;
    const meta = options.meta || globalThis.MetaData;
    const state = options.state || globalThis.MetaState?.get?.() || {};
    let rows = [];
    let context = null;
    let provenance = { type:'meta-field', identity:'exact-variant', source };

    if (source === 'online') {
      const scope = options.onlineScope || state.onlineScope || '30';
      rows = meta?.fieldRows?.('online', { scope, minPlayers:50, recency:'equal' }) || [];
      context = meta?.context?.('online', { scope, minPlayers:50 }) || null;
      provenance = { ...provenance, scope, minPlayers:50, label:context?.label || 'Online · 50+ player tournaments' };
    } else if (source === 'irl') {
      const scope = options.irlScope || state.irlScope || 'latest-weekend';
      rows = meta?.fieldRows?.('irl', { scope }) || [];
      context = meta?.context?.('irl', { scope }) || null;
      provenance = { ...provenance, scope, label:context?.label || 'IRL events' };
    } else if (source === 'expected' || source === 'custom') {
      const expected = options.expectedField || {};
      rows = expected.field || expected.rows || options.rows || [];
      provenance = {
        ...(expected.provenance || {}),
        type:'expected-field', identity:'exact-variant', source,
        expectedFieldId:expected.id || null,
        label:expected.name || sourceDefinition(source).label,
      };
    } else {
      const blended = options.blended || globalThis.MetaBlendedField?.current?.() || globalThis.PTCGMetaBlend?.currentFromMeta?.(meta, options) || { available:false, reason:'Meta data is unavailable.', rows:[], weights:{ irl:0, online:0 } };
      rows = blended.rows || [];
      provenance = {
        ...provenance,
        scope:'shared-current-blend',
        onlineScope:blended.onlineScope || 'since-major',
        irlScope:blended.irlScope || 'latest-weekend',
        weights:blended.weights || { irl:0, online:0 },
        configuredWeights:blended.configuredWeights || blended.weights || { irl:0, online:0 },
        daysSinceMajor:blended.daysSinceMajor ?? null,
        majorDate:blended.majorDate || null,
        majorFinalDate:blended.majorFinalDate || null,
        available:blended.available !== false,
        unavailableReason:blended.available === false ? (blended.reason || 'Blended unavailable') : null,
        formulaVersion:blended.formula?.versionKey || null,
        formula:blended.formula ? { ...blended.formula } : null,
        format:blended.format || null,
        irlFormat:blended.irlFormat || null,
        transitionState:blended.transitionState || null,
        earlyFormat:!!blended.earlyFormat,
        generatedAt:blended.generatedAt || null,
        label:blended.available === false ? `Blended unavailable — ${blended.reason || 'waiting for current-format evidence'}` : 'Blended current field',
      };
    }

    const normalized = normalizeRows(rows, { source });
    return {
      source,
      definition:sourceDefinition(source),
      rows:normalized,
      context,
      provenance,
      ambiguousLegacyRows:(source === 'expected' || source === 'custom') ? legacyAmbiguities(rows, options.expectedField?.provenance) : [],
    };
  }

  globalThis.PTCGMetaField = { SOURCES, FAMILIES, isUsableName, normalizeRows, selectCoverage, sourceDefinition, legacyAmbiguities, resolve };
})();