(() => {
  const BASE = 'https://r2.limitlesstcg.net/pokemon/gen9';
  const OVERRIDE_KEY = 'ptcg.deckSpriteOverrides.v1';

  // Representative Pokemon for the current archetype labels used by Limitless.
  // Presentation only: matchup/meta logic never depends on this mapping.
  const EXACT = {
    'Mega Excadrill': ['excadrill-mega'],
    'Dragapult': ['dragapult'],
    'Festival Lead': ['dipplin'],
    'Dragapult Blaziken': ['dragapult', 'blaziken'],
    'Slowking': ['slowking'],
    'Alakazam Dudunsparce': ['alakazam', 'dudunsparce'],
    'Dragapult Dusknoir': ['dragapult', 'dusknoir'],
    "N's Zoroark": ['zoroark'],
    'Grimmsnarl Froslass': ['grimmsnarl', 'froslass'],
    'Dhelmise': ['dhelmise'],
    'Toucannon': ['toucannon'],
    'Raging Bolt Ogerpon': ['raging-bolt'],
    'Mega Lucario': ['lucario-mega'],
    'Lucario Hariyama': ['lucario', 'hariyama'],
    'Mega Greninja': ['greninja-mega'],
    'Basic Box': ['ogerpon'],
    'Ogerpon Meganium Hydrapple': ['meganium', 'hydrapple'],
    "Rocket's Honchkrow": ['honchkrow'],
    "Cynthia's Garchomp": ['garchomp'],
    'Mega Chandelure': ['chandelure-mega'],
    'Beedrill': ['beedrill'],
    'Mega Absol Box': ['absol'],
    'Kangaskhan Bouffalant': ['kangaskhan', 'bouffalant'],
    'Manectric Eelektrik': ['manectric', 'eelektrik'],
    'Crustle': ['crustle'],
    "Ethan's Typhlosion": ['typhlosion'],
    'Greninja': ['greninja'],
    "Rocket's Mewtwo": ['mewtwo'],
    "Hop's Trevenant": ['trevenant'],
    'Toxtricity Box': ['toxtricity'],
    'Ceruledge': ['ceruledge'],
    'Starmie Froslass': ['starmie', 'froslass'],
    'Mega Venusaur': ['venusaur-mega'],
    'Ogerpon Meganium Arboliva': ['meganium', 'arboliva'],
    'Dragapult Dudunsparce': ['dragapult', 'dudunsparce'],
    'Lopunny Dudunsparce': ['lopunny', 'dudunsparce'],
    'Lopunny Dusknoir': ['lopunny', 'dusknoir'],
    'Mega Starmie': ['starmie'],
    'Mega Darkrai': ['darkrai'],
    'Starmie Dusknoir': ['starmie', 'dusknoir'],
    'Cinccino': ['cinccino'],
    'Toxtricity': ['toxtricity'],
    'Blaziken Zoroark': ['blaziken', 'zoroark'],
    "Steven's Metagross": ['metagross'],
    'Miraidon ex': ['miraidon'],
  };

  const TOKENS = [
    ['mega excadrill', 'excadrill-mega'], ['cynthia', 'garchomp'], ['festival lead', 'dipplin'],
    ['dragapult', 'dragapult'], ['slowking', 'slowking'], ['garchomp', 'garchomp'],
    ['excadrill', 'excadrill'], ['blaziken', 'blaziken'], ['dusknoir', 'dusknoir'],
    ['dudunsparce', 'dudunsparce'], ['alakazam', 'alakazam'], ['zoroark', 'zoroark'],
    ['grimmsnarl', 'grimmsnarl'], ['froslass', 'froslass'], ['dhelmise', 'dhelmise'],
    ['toucannon', 'toucannon'], ['raging bolt', 'raging-bolt'], ['lucario', 'lucario'],
    ['greninja', 'greninja'], ['ogerpon', 'ogerpon'], ['meganium', 'meganium'], ['hydrapple', 'hydrapple'],
    ['honchkrow', 'honchkrow'], ['chandelure', 'chandelure'], ['beedrill', 'beedrill'],
    ['absol', 'absol'], ['kangaskhan', 'kangaskhan'], ['bouffalant', 'bouffalant'],
    ['manectric', 'manectric'], ['eelektrik', 'eelektrik'], ['crustle', 'crustle'],
    ['typhlosion', 'typhlosion'], ['mewtwo', 'mewtwo'], ['trevenant', 'trevenant'],
    ['toxtricity', 'toxtricity'], ['ceruledge', 'ceruledge'], ['starmie', 'starmie'],
    ['venusaur', 'venusaur'], ['arboliva', 'arboliva'], ['lopunny', 'lopunny'],
    ['darkrai', 'darkrai'], ['cinccino', 'cinccino'], ['metagross', 'metagross'],
    ['miraidon', 'miraidon'], ['gardevoir', 'gardevoir'], ['charizard', 'charizard'],
  ];

  function loadOverrides() {
    try {
      const parsed = JSON.parse(localStorage.getItem(OVERRIDE_KEY) || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function saveOverrides(overrides) {
    try { localStorage.setItem(OVERRIDE_KEY, JSON.stringify(overrides || {})); } catch (_) {}
  }

  function slugs(name) {
    if (!name) return [];
    const override = loadOverrides()[name];
    if (Array.isArray(override) && override.length) return override.filter(Boolean).slice(0, 2);
    if (EXACT[name]) return EXACT[name].slice(0, 2);
    const lower = String(name).toLowerCase();
    const found = [];
    for (const [token, slug] of TOKENS) {
      if (lower.includes(token) && !found.includes(slug)) found.push(slug);
      if (found.length === 2) break;
    }
    return found;
  }

  function setOverride(name, spriteSlugs) {
    if (!name) return;
    const overrides = loadOverrides();
    const next = Array.isArray(spriteSlugs) ? spriteSlugs.filter(Boolean).slice(0, 2) : [];
    if (next.length) overrides[name] = next;
    else delete overrides[name];
    saveOverrides(overrides);
    window.dispatchEvent(new CustomEvent('decksprites:updated', { detail: { name } }));
  }

  function clearOverride(name) {
    setOverride(name, []);
  }

  function url(slug) { return `${BASE}/${encodeURIComponent(slug)}.png`; }

  function html(name, options = {}) {
    const size = Number(options.size || 36);
    const className = options.className ? ` ${options.className}` : '';
    const found = slugs(name);
    if (!found.length) {
      const initial = String(name || '?').trim().charAt(0).toUpperCase() || '?';
      return `<span class="deck-sprite deck-sprite-fallback${className}" style="--sprite-size:${size}px" aria-hidden="true">${initial}</span>`;
    }
    return `<span class="deck-sprite-stack${className}" style="--sprite-size:${size}px" aria-hidden="true">${found.map((slug, i) => `<img class="deck-sprite-img sprite-${i + 1}" src="${url(slug)}" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'">`).join('')}</span>`;
  }

  window.DeckSprites = { slugs, url, html, setOverride, clearOverride, overrides: loadOverrides, defaults: EXACT };
})();
