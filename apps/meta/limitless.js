const LimitlessAPI = (() => {
  const BASE = 'https://play.limitlesstcg.com/api';
  const CACHE_TTL_MS = 5 * 60 * 1000;
  const cache = new Map();

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function get(path, { force = false } = {}) {
    const cached = cache.get(path);
    if (!force && cached && (Date.now() - cached.savedAt) < CACHE_TTL_MS) {
      return cached.data;
    }

    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch(BASE + path, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      if (response.ok) {
        const data = await response.json();
        cache.set(path, { savedAt: Date.now(), data });
        return data;
      }

      if (response.status === 429) {
        lastError = new Error(`Limitless is rate-limiting requests. Please wait a moment and try again.`);
        const retryAfter = Number(response.headers.get('Retry-After'));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 1500 * Math.pow(2, attempt);
        if (attempt < 2) await sleep(waitMs);
        continue;
      }

      throw new Error(`Limitless API ${response.status}: ${path}`);
    }

    throw lastError || new Error(`Limitless API error: ${path}`);
  }

  async function tournaments({ limit = 100, page = 0, format = 'STANDARD', force = false } = {}) {
    return get(`/tournaments?game=PTCG&format=${encodeURIComponent(format)}&limit=${limit}&page=${page}`, { force });
  }

  const standings = (id, options) => get(`/tournaments/${encodeURIComponent(id)}/standings`, options);
  const pairings = (id, options) => get(`/tournaments/${encodeURIComponent(id)}/pairings`, options);
  const details = (id, options) => get(`/tournaments/${encodeURIComponent(id)}/details`, options);

  function clearCache() {
    cache.clear();
  }

  return { tournaments, standings, pairings, details, clearCache };
})();
