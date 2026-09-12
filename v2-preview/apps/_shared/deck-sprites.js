(() => {
  'use strict';

  // Single app-wide owner for deck/archetype sprite identity and presentation.
  // Consumers must render deck identities through DeckSprites.html(); they may
  // choose a size/class but must not compose primary/secondary sprites locally.
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

  // THE single deck/archetype identity renderer for PTCG Tools.
  // Double-sprite identities always use primary + circular secondary badge.
  function html(name, options = {}) {
    const size = Math.max(18, Number(options.size || 36));
    const className = options.className ? ` ${options.className}` : '';
    const found = slugs(name);
    if (!found.length) {
      const initial = String(name || '?').trim().charAt(0).toUpperCase() || '?';
      return `<span class="deck-sprite deck-sprite-fallback${className}" style="--sprite-size:${size}px;display:grid;place-items:center;width:${size}px;height:${size}px;border-radius:50%;background:#f2f4f7;color:#475467;font-weight:850" aria-hidden="true">${initial}</span>`;
    }

    const primarySize = Math.max(16, Math.round(size * 0.84));
    const primaryOffset = Math.round((size - primarySize) / 2);
    const badgeSize = Math.max(15, Math.round(size * 0.54));
    const secondarySize = Math.max(11, Math.round(badgeSize * 0.76));
    const border = Math.max(1, Math.round(size * 0.045));
    const badgeOffset = Math.max(1, Math.round(size * 0.04));
    const primary = `<img class="deck-sprite-img deck-sprite-primary sprite-1" src="${url(found[0])}" alt="" loading="lazy" decoding="async" style="position:absolute!important;left:${primaryOffset}px!important;top:${primaryOffset}px!important;display:block;width:${primarySize}px!important;height:${primarySize}px!important;object-fit:contain" onerror="this.style.display='none'">`;
    const secondary = found[1]
      ? `<span class="deck-sprite-secondary-badge" style="position:absolute;right:-${badgeOffset}px;bottom:-${badgeOffset}px;display:grid;place-items:center;width:${badgeSize}px;height:${badgeSize}px;border:${border}px solid rgba(255,255,255,.96);border-radius:50%;background:#dff8e8;box-shadow:0 1px 4px rgba(16,24,40,.15);z-index:2"><img class="deck-sprite-img deck-sprite-secondary sprite-2" src="${url(found[1])}" alt="" loading="lazy" decoding="async" style="display:block;width:${secondarySize}px!important;height:${secondarySize}px!important;object-fit:contain" onerror="this.style.display='none'"></span>`
      : '';
    return `<span class="deck-sprite-stack deck-sprite-visual${className}" style="--sprite-size:${size}px;position:relative;display:inline-block!important;flex:0 0 ${size}px;width:${size}px!important;height:${size}px!important;overflow:visible" aria-hidden="true">${primary}${secondary}</span>`;
  }

  window.DeckSprites = { slugs, url, html, normalizeSlug, knownSlugs, setOverride, clearOverride, overrides: loadOverrides, defaults: EXACT };
})();
