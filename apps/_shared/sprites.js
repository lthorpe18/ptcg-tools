// Shared Pokémon sprite search/fetch (PokéAPI) for PTCG Tools
// - Caches name list (with numeric ids) in localStorage for fast suggestions.
// - Fetches exact sprite URL for selected Pokémon on demand.
(function () {
  const LS_KEY = "ptcg_pokenames_v2";
  const LS_TIME = "ptcg_pokenames_v2_time";
  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  let namesCache = null;           // array of {name, id}
  let nameToId = null;            // Map nameLower -> id
  const spriteCache = new Map();  // nameLower -> {name, spriteUrl}

  function parseIdFromUrl(url) {
    const m = String(url || "").match(/\/pokemon\/(\d+)\/?$/);
    return m ? parseInt(m[1], 10) : null;
  }

  function spriteUrlFromId(id) {
    if (!id) return null;
    // Classic pixel sprite (matches TrainingCourt-style look)
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
  }

  async function fetchPokemonIndex() {
    // Try localStorage cache first
    try {
      const raw = localStorage.getItem(LS_KEY);
      const t = parseInt(localStorage.getItem(LS_TIME) || "0", 10);
      if (raw && t && (Date.now() - t) < ONE_WEEK_MS) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length && arr[0].name) return arr;
      }
    } catch (_) {}

    const url = "https://pokeapi.co/api/v2/pokemon?limit=100000&offset=0";
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) throw new Error("Failed to fetch Pokémon list");
    const data = await res.json();
    const arr = (data.results || [])
      .map(r => {
        const name = (r.name || "").toLowerCase();
        const id = parseIdFromUrl(r.url);
        return name ? { name, id } : null;
      })
      .filter(Boolean);

    try {
      localStorage.setItem(LS_KEY, JSON.stringify(arr));
      localStorage.setItem(LS_TIME, String(Date.now()));
    } catch (_) {}

    return arr;
  }

  async function getIndex() {
    if (namesCache) return namesCache;
    namesCache = await fetchPokemonIndex();
    nameToId = new Map(namesCache.map(x => [x.name, x.id]));
    return namesCache;
  }

  function searchNamesSync(query, limit = 12) {
    const q = (query || "").toLowerCase().trim();
    if (!q || !namesCache) return [];
    const prefix = [];
    const contains = [];
    for (const obj of namesCache) {
      const n = obj.name;
      if (n.startsWith(q)) prefix.push(obj);
      else if (n.includes(q)) contains.push(obj);
      if (prefix.length >= limit) break;
    }
    return prefix.concat(contains).slice(0, limit);
  }

  function getQuickSpriteUrl(name) {
    if (!nameToId) return null;
    const id = nameToId.get((name || "").toLowerCase());
    return spriteUrlFromId(id);
  }

  async function fetchSprite(name) {
    const key = (name || "").toLowerCase().trim();
    if (!key) return null;
    if (spriteCache.has(key)) return spriteCache.get(key);

    // Use cached id if available for instant URL
    const quick = getQuickSpriteUrl(key);
    if (quick) {
      const out = { name: key, spriteUrl: quick };
      spriteCache.set(key, out);
      return out;
    }

    // Fallback to PokéAPI lookup (in case list isn't loaded)
    const url = `https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(key)}`;
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    const data = await res.json();
    const spriteUrl =
      (data.sprites && data.sprites.front_default) ||
      (data.sprites && data.sprites.other && data.sprites.other["official-artwork"] && data.sprites.other["official-artwork"].front_default) ||
      null;

    const out = { name: key, spriteUrl };
    spriteCache.set(key, out);
    return out;
  }

  window.PTCGSprites = { getIndex, searchNamesSync, fetchSprite, getQuickSpriteUrl };
})();