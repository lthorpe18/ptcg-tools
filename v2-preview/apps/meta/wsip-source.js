(() => {
  'use strict';
  const selected = { blend:null, online:null, irl:null };
  const source = () => document.getElementById('playFieldSource')?.value || 'blend';
  const predictions = () => window.MetaBlendedField?.predictions?.() || [];
  function formats(value = source()) {
    if (value === 'blend') return predictions().map(row => ({ format:row.format, available:row.available, reason:row.reason }));
    if (value === 'online' || value === 'irl') return (window.MetaState?.formatOptions?.(value) || []).map(format => ({ format, available:true }));
    return [];
  }
  function target(value = source()) {
    if (selected[value]) return selected[value];
    if (value === 'blend') return window.MetaBlendedField?.selected?.()?.format || null;
    return window.MetaData?.sourceFormat?.(value) || null;
  }
  function select(format) {
    if (!formats().some(row => row.format === format && row.available)) return false;
    selected[source()] = format;
    return true;
  }
  function resolve(options = {}) {
    const value = options.source || source();
    if (value === 'expected' || value === 'custom') {
      const result = window.PTCGMetaField.resolve(options);
      const format = options.expectedField?.provenance?.targetFormat || options.expectedField?.provenance?.format || options.expectedField?.format || null;
      return { ...result, format, available:!!result.rows.length, reason:format ? '' : 'This saved field has no recorded format; compatible H2H is unknown.', provenance:{ ...result.provenance, targetFormat:format, label:`${options.expectedField?.name || 'Saved field'} · ${format || 'Unknown format'}` } };
    }
    const format = options.format || target(value);
    if (value === 'blend') {
      const result = predictions().find(row => row.format === format);
      return {
        source:value, format, available:!!result?.available, reason:result?.reason || (!result ? 'Prediction is unavailable for this format.' : ''),
        rows:result?.available ? window.PTCGMetaField.normalizeRows(result.rows) : [],
        provenance:{ ...result, rows:undefined, targetFormat:format, type:'meta-field', identity:'exact-variant', source:value, label:`Blended · ${format || 'Unknown format'}` },
      };
    }
    const state = window.MetaState?.get?.() || {};
    const scope = value === 'irl' ? state.irlScope || 'latest-weekend' : state.onlineScope || '30';
    const data = window.MetaData?.dataForFormat?.(value, format, { scope }) || {};
    const rows = window.PTCGMetaField.normalizeRows((data.decks || []).map(row => ({ name:row.name, share:Number(row.share || 0) / 100 })));
    return { source:value, format, available:rows.length > 0, rows, reason:rows.length ? '' : 'No field evidence is available for this format and scope.', provenance:{ type:'meta-field', identity:'exact-variant', source:value, targetFormat:format, scope, label:`${value === 'irl' ? 'IRL' : 'Online'} · ${format || 'Unknown format'}`, evidenceRevision:window.MetaData?.release?.(), evidence:{ [value]:{ format, events:(data.events || []).map(event=>({id:event.id || event.tournamentId || null,name:event.name || null,date:event.date || event.startDate || null})), scope } } } };
  }
  function inputs(definition, matchupSource = 'combined') {
    const evidence = { online:[], irl:[] }, candidates = new Map();
    const format = definition?.format || definition?.provenance?.targetFormat;
    if (!format || definition?.available === false) return { evidence, candidates:[] };
    const current = window.MetaState?.get?.() || {};
    for (const env of ['online','irl']) {
      const data = window.MetaData?.dataForFormat?.(env, format, { scope:env === 'irl' ? 'all-irl' : definition?.onlineScope || current.onlineScope || '30' });
      if (data?.format !== format || data.unavailable) continue;
      if (matchupSource === 'combined' || matchupSource === env) evidence[env] = (data.matchups || []).filter(row => !row.format || row.format === format);
      for (const row of data.decks || []) {
        if (!window.PTCGMetaField.isUsableName(row.name)) continue;
        const entry = candidates.get(row.name) || { name:row.name, entries:0, onlineEntries:0, irlEntries:0 };
        entry.entries += Number(row.entries || 0);
        entry[env + 'Entries'] += Number(row.entries || 0);
        candidates.set(row.name, entry);
      }
    }
    return { evidence, candidates:[...candidates.values()] };
  }
  window.MetaWSIPSource = { source, formats, target, select, resolve, inputs };
})();
