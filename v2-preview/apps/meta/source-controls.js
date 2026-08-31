(() => {
  'use strict';
  const $ = id => document.getElementById(id);

  function updateSummary() {
    const field = $('metaFieldSource');
    const matchup = $('metaMatchupSource');
    const grouping = $('archetypeGrouping');
    const summary = $('metaSourceSummary');
    const fieldLabels = { online: 'Online field', irl: 'IRL field', blend: 'Blended field', custom: 'Custom field' };
    const matchupLabels = { online: 'Online matchups', irl: 'IRL matchups', combined: 'Combined matchups' };
    const fieldLabel = fieldLabels[field?.value] || 'Field';
    const matchupLabel = matchupLabels[matchup?.value] || 'Matchups';
    const groupingLabel = grouping?.value === 'variants' ? 'Variants separate' : 'Families grouped';
    if (summary) summary.textContent = `${fieldLabel} · ${matchupLabel} · ${groupingLabel}`;
    const pill = document.querySelector('.play-data-pill span:last-child');
    if (pill) pill.textContent = `${fieldLabel} · ${matchupLabel}`;
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
  window.addEventListener('irl:updated', updateSummary);
  window.addEventListener('deckagg:updated', updateSummary);
  updateSummary();
})();
