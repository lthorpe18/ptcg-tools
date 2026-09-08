(() => {
  'use strict';
  const engine = window.PTCGMetaBlend;
  let selectedFormat = null;

  function list(options = {}) {
    const rows = engine.predictions(window.MetaData?.blendEvidence?.() || {}, options);
    const onlineTarget = window.MetaData?.currentFormat?.('online')?.label;
    if (!selectedFormat || !rows.some(row => row.format === selectedFormat)) selectedFormat = onlineTarget || rows[0]?.format || null;
    return rows;
  }
  function selected(options = {}) {
    const rows = list(options);
    return rows.find(row => row.format === selectedFormat) || rows[0] || {
      version:engine.policy.version, format:null, available:false, status:'Unavailable', reason:'Format information is unavailable.', rows:[], weights:{irl:0,online:0}, evidence:{online:null,irl:null},
    };
  }
  function select(format) {
    if (!list().some(row => row.format === format)) return false;
    if (selectedFormat === format) return true;
    selectedFormat = format;
    window.dispatchEvent(new CustomEvent('meta:blend-target-changed', { detail:{ format } }));
    return true;
  }
  async function ensure() {
    await window.MetaData?.ensureBlendEvidence?.();
    return list();
  }

  window.MetaBlendedField = {
    // Retained until the later WSIP/Home consumer checkpoints deliberately migrate.
    current:options => engine.currentFromMeta(window.MetaData, options),
    predictions:list, selected, select, ensure,
    selectedFormat:() => selectedFormat,
    mergeRows:engine.mergeRows, weightsForDays:engine.weightsForDays, policy:engine.policy,
  };
})();
