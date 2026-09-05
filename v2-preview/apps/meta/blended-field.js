(() => {
  'use strict';
  const engine=window.PTCGMetaBlend;
  window.MetaBlendedField={
    current:options=>engine.currentFromMeta(window.MetaData,options),
    mergeRows:engine.mergeRows,
    weightsForDays:engine.weightsForDays,
    policy:engine.policy,
  };
})();
