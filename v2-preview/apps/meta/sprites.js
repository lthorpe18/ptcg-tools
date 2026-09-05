(() => {
  const BASE = 'https://r2.limitlesstcg.net/pokemon/gen9';
  const LEGACY_OVERRIDE_KEY = 'ptcg.deckSpriteOverrides.v1';
  const ROOT_KEY = 'ptcg-tools-v2';
  const PREF_KEY = 'deckSpriteOverrides';

  const EXACT = {
    'Mega Excadrill': ['excadrill-mega'], 'Dragapult': ['dragapult'], 'Festival Lead': ['dipplin'],
    'Dragapult Blaziken': ['dragapult', 'blaziken'], 'Slowking': ['slowking'], 'Alakazam Dudunsparce': ['alakazam', 'dudunsparce'],
    'Dragapult Dusknoir': ['dragapult', 'dusknoir'], "N's Zoroark": ['zoroark'], 'Grimmsnarl Froslass': ['grimmsnarl', 'froslass'],
    'Dhelmise': ['dhelmise'], 'Toucannon': ['toucannon'], 'Raging Bolt Ogerpon': ['raging-bolt'], 'Mega Lucario': ['lucario-mega'],
    'Lucario Hariyama': ['lucario', 'hariyama'], 'Mega Greninja': ['greninja-mega'], 'Basic Box': ['ogerpon'],
    'Ogerpon Meganium Hydrapple': ['meganium', 'hydrapple'], "Rocket's Honchkrow": ['honchkrow'], "Cynthia's Garchomp": ['garchomp'],
    'Mega Chandelure': ['chandelure-mega'], 'Beedrill': ['beedrill'], 'Mega Absol Box': ['absol'],
    'Kangaskhan Bouffalant': ['kangaskhan', 'bouffalant'], 'Manectric Eelektrik': ['manectric', 'eelektrik'], 'Crustle': ['crustle'],
    "Ethan's Typhlosion": ['typhlosion'], 'Greninja': ['greninja'], "Rocket's Mewtwo": ['mewtwo'], "Hop's Trevenant": ['trevenant'],
    'Toxtricity Box': ['toxtricity'], 'Ceruledge': ['ceruledge'], 'Starmie Froslass': ['starmie', 'froslass'], 'Mega Venusaur': ['venusaur-mega'],
    'Ogerpon Meganium Arboliva': ['meganium', 'arboliva'], 'Dragapult Dudunsparce': ['dragapult', 'dudunsparce'],
    'Lopunny Dudunsparce': ['lopunny', 'dudunsparce'], 'Lopunny Dusknoir': ['lopunny', 'dusknoir'], 'Mega Starmie': ['starmie'],
    'Mega Darkrai': ['darkrai'], 'Starmie Dusknoir': ['starmie', 'dusknoir'], 'Cinccino': ['cinccino'], 'Toxtricity': ['toxtricity'],
    'Blaziken Zoroark': ['blaziken', 'zoroark'], "Steven's Metagross": ['metagross'], 'Miraidon ex': ['miraidon'],
  };

  const TOKENS = [
    ['mega excadrill', 'excadrill-mega'], ['cynthia', 'garchomp'], ['festival lead', 'dipplin'], ['dragapult', 'dragapult'],
    ['slowking', 'slowking'], ['garchomp', 'garchomp'], ['excadrill', 'excadrill'], ['blaziken', 'blaziken'], ['dusknoir', 'dusknoir'],
    ['dudunsparce', 'dudunsparce'], ['alakazam', 'alakazam'], ['zoroark', 'zoroark'], ['grimmsnarl', 'grimmsnarl'],
    ['froslass', 'froslass'], ['dhelmise', 'dhelmise'], ['toucannon', 'toucannon'], ['raging bolt', 'raging-bolt'], ['lucario', 'lucario'],
    ['greninja', 'greninja'], ['ogerpon', 'ogerpon'], ['meganium', 'meganium'], ['hydrapple', 'hydrapple'], ['honchkrow', 'honchkrow'],
    ['chandelure', 'chandelure'], ['beedrill', 'beedrill'], ['absol', 'absol'], ['kangaskhan', 'kangaskhan'], ['bouffalant', 'bouffalant'],
    ['manectric', 'manectric'], ['eelektrik', 'eelektrik'], ['crustle', 'crustle'], ['typhlosion', 'typhlosion'], ['mewtwo', 'mewtwo'],
    ['trevenant', 'trevenant'], ['toxtricity', 'toxtricity'], ['ceruledge', 'ceruledge'], ['starmie', 'starmie'], ['venusaur', 'venusaur'],
    ['arboliva', 'arboliva'], ['lopunny', 'lopunny'], ['darkrai', 'darkrai'], ['cinccino', 'cinccino'], ['metagross', 'metagross'],
    ['miraidon', 'miraidon'], ['gardevoir', 'gardevoir'], ['charizard', 'charizard'],
  ];

  function safeObject(raw) {
    try { const parsed=JSON.parse(raw||'{}'); return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{}; }
    catch (_) { return {}; }
  }

  function loadOverrides() {
    const root=safeObject(localStorage.getItem(ROOT_KEY));
    const prefs=root.preferences&&typeof root.preferences==='object'?root.preferences:{};
    const shared=prefs[PREF_KEY];
    if(shared&&typeof shared==='object'&&!Array.isArray(shared))return shared;
    return safeObject(localStorage.getItem(LEGACY_OVERRIDE_KEY));
  }

  function saveOverrides(overrides) {
    const clean=overrides&&typeof overrides==='object'&&!Array.isArray(overrides)?overrides:{};
    try {
      const root=safeObject(localStorage.getItem(ROOT_KEY));
      root.schemaVersion=Math.max(Number(root.schemaVersion)||0,3);
      root.eventParticipations=Array.isArray(root.eventParticipations)?root.eventParticipations:[];
      root.favouriteVenues=Array.isArray(root.favouriteVenues)?root.favouriteVenues:[];
      root.matches=Array.isArray(root.matches)?root.matches:[];
      root.recent=root.recent&&typeof root.recent==='object'?root.recent:{};
      root.preferences=root.preferences&&typeof root.preferences==='object'?root.preferences:{};
      root.preferences[PREF_KEY]=clean;
      localStorage.setItem(ROOT_KEY,JSON.stringify(root));
      localStorage.setItem(LEGACY_OVERRIDE_KEY,JSON.stringify(clean));
      window.dispatchEvent(new CustomEvent('ptcg:local-change',{detail:{source:'deck-icons'}}));
    } catch (_) {}
  }

  function normalizeSlug(value) {
    const raw=String(value||'').trim();
    if(!raw)return '';
    const lower=raw.toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
    const special={
      'green ogerpon':'ogerpon','teal mask ogerpon':'ogerpon','ogerpon teal mask':'ogerpon',
      'mega excadrill':'excadrill-mega','mega lucario':'lucario-mega','mega greninja':'greninja-mega',
      'mega chandelure':'chandelure-mega','mega venusaur':'venusaur-mega'
    };
    return special[lower]||lower.replace(/\s+/g,'-');
  }

  function knownSlugs() {
    const set=new Set();
    Object.values(EXACT).forEach(rows=>rows.forEach(slug=>slug&&set.add(slug)));
    TOKENS.forEach(([,slug])=>slug&&set.add(slug));
    Object.values(loadOverrides()).forEach(rows=>Array.isArray(rows)&&rows.forEach(slug=>slug&&set.add(slug)));
    return [...set].sort((a,b)=>a.localeCompare(b));
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

  function clearOverride(name) { setOverride(name, []); }
  function url(slug) { return `${BASE}/${encodeURIComponent(slug)}.png`; }

  function html(name, options = {}) {
    const size = Number(options.size || 36);
    const className = options.className ? ` ${options.className}` : '';
    const found = slugs(name);
    if (!found.length) {
      const initial = String(name || '?').trim().charAt(0).toUpperCase() || '?';
      return `<span class="deck-sprite deck-sprite-fallback${className}" style="--sprite-size:${size}px;width:${size}px;height:${size}px" aria-hidden="true">${initial}</span>`;
    }
    const gap = found.length > 1 ? Math.max(2, Math.round(size * 0.08)) : 0;
    return `<span class="deck-sprite-stack${className}" style="--sprite-size:${size}px;display:inline-flex!important;align-items:center;gap:${gap}px;width:auto!important;height:${size}px;position:relative" aria-hidden="true">${found.map((slug, i) => `<img class="deck-sprite-img sprite-${i + 1}" src="${url(slug)}" alt="" loading="lazy" decoding="async" style="position:static!important;inset:auto!important;display:block;width:${size}px!important;height:${size}px!important;object-fit:contain" onerror="this.style.display='none'">`).join('')}</span>`;
  }

  window.DeckSprites = { slugs, url, html, normalizeSlug, knownSlugs, setOverride, clearOverride, overrides: loadOverrides, defaults: EXACT };
})();