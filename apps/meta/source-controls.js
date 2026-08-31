(() => {
  'use strict';
  const $ = id => document.getElementById(id);

  function syncSelect(from, to) {
    if (!from || !to) return;
    to.value = from.value;
  }

  function updateSummary() {
    const field = $('metaFieldSource');
    const matchup = $('metaMatchupSource');
    const grouping = $('archetypeGrouping');
    const summary = $('metaSourceSummary');
    if (!summary) return;
    const fieldLabels = { online: 'Online field', irl: 'IRL field', blend: 'Blended field', custom: 'Custom field' };
    const matchupLabels = { online: 'Online matchups', irl: 'IRL matchups', combined: 'Combined matchups' };
    summary.textContent = `${fieldLabels[field?.value] || 'Field'} · ${matchupLabels[matchup?.value] || 'Matchups'} · ${grouping?.value === 'variants' ? 'Variants separate' : 'Families grouped'}`;
  }

  function bindPair(topId, advancedId) {
    const top = $(topId);
    const advanced = $(advancedId);
    if (!top || !advanced) return;
    top.value = advanced.value;
    top.addEventListener('change', () => {
      advanced.value = top.value;
      advanced.dispatchEvent(new Event('change', { bubbles: true }));
      updateSummary();
    });
    advanced.addEventListener('change', () => {
      top.value = advanced.value;
      updateSummary();
    });
  }

  bindPair('metaFieldSource', 'fieldSource');
  bindPair('metaMatchupSource', 'matchupSource');
  $('archetypeGrouping')?.addEventListener('change', () => {
    window.dispatchEvent(new CustomEvent('archetype-grouping:changed'));
    updateSummary();
  });
  updateSummary();
})();
