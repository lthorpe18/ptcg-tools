(() => {
  'use strict';
  const $ = id => document.getElementById(id);

  function bindPair(visibleId, modelId) {
    const visible = $(visibleId);
    const model = $(modelId);
    if (!visible || !model) return;
    visible.value = model.value;
    visible.addEventListener('change', () => {
      model.value = visible.value;
      model.dispatchEvent(new Event('change', { bubbles: true }));
    });
    model.addEventListener('change', () => { visible.value = model.value; });
  }

  bindPair('playFieldSource', 'fieldSource');
  bindPair('playMatchupSource', 'matchupSource');

  // Variant grouping is a presentation choice for Current Meta only.
  // Analytical field, recommendation and matchup models always use real variants.
  const grouping = $('archetypeGrouping');
  if (grouping) grouping.value = 'variants';
})();
