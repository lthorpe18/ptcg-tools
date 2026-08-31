(() => {
  'use strict';

  const FAMILIES = [
    { name: 'Dragapult', variants: ['Dragapult', 'Dragapult Dusknoir', 'Dragapult Blaziken', 'Dragapult Dudunsparce'] },
    { name: 'Alakazam', variants: ['Alakazam Dudunsparce', 'Alakazam Dusknoir'] },
    { name: 'Lopunny', variants: ['Lopunny Dudunsparce', 'Lopunny Dusknoir'] },
    { name: 'Ogerpon Meganium', variants: ['Ogerpon Meganium Hydrapple', 'Ogerpon Meganium Arboliva'] },
  ];

  const variantToFamily = new Map();
  const familyToVariants = new Map();
  for (const family of FAMILIES) {
    familyToVariants.set(family.name, [...family.variants]);
    for (const variant of family.variants) variantToFamily.set(variant, family.name);
  }

  function enabled() {
    const el = document.getElementById('archetypeGrouping');
    return !el || el.value !== 'variants';
  }

  function familyName(name) {
    if (!enabled()) return name;
    return variantToFamily.get(name) || name;
  }

  function variants(name) {
    if (!enabled()) return [name];
    return familyToVariants.get(name) || [name];
  }

  function groupRows(rows, valueKey = 'share') {
    if (!enabled()) return (rows || []).map(row => ({ ...row, variants: [row.name] }));
    const map = new Map();
    for (const row of rows || []) {
      const name = familyName(row.name);
      if (!name) continue;
      let target = map.get(name);
      if (!target) {
        target = { ...row, name, [valueKey]: 0, variants: [] };
        map.set(name, target);
      }
      target[valueKey] += Number(row[valueKey] || 0);
      if (!target.variants.includes(row.name)) target.variants.push(row.name);
    }
    return [...map.values()];
  }

  function aggregateRecords(rows) {
    if (!enabled()) return (rows || []).map(row => ({ ...row, variants: [row.name] }));
    const map = new Map();
    for (const row of rows || []) {
      const name = familyName(row.name);
      let target = map.get(name);
      if (!target) {
        target = { name, entries: 0, wins: 0, losses: 0, ties: 0, variants: [] };
        map.set(name, target);
      }
      target.entries += Number(row.entries || 0);
      target.wins += Number(row.wins || 0);
      target.losses += Number(row.losses || 0);
      target.ties += Number(row.ties || 0);
      if (!target.variants.includes(row.name)) target.variants.push(row.name);
    }
    for (const row of map.values()) {
      const decisive = row.wins + row.losses;
      row.winRate = decisive ? 100 * row.wins / decisive : null;
    }
    return [...map.values()];
  }

  function describe(name) {
    const list = familyToVariants.get(name);
    return list ? `${list.length} variants grouped` : '';
  }

  window.ArchetypeGroups = { FAMILIES, enabled, familyName, variants, groupRows, aggregateRecords, describe };
})();
