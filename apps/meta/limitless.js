const LimitlessAPI = (() => {
  const BASE = 'https://play.limitlesstcg.com/api';

  async function get(path) {
    const response = await fetch(BASE + path, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Limitless API ${response.status}: ${path}`);
    return response.json();
  }

  async function tournaments({ limit = 100, page = 0 } = {}) {
    return get(`/tournaments?game=PTCG&format=STANDARD&limit=${limit}&page=${page}`);
  }

  const standings = id => get(`/tournaments/${encodeURIComponent(id)}/standings`);
  const pairings = id => get(`/tournaments/${encodeURIComponent(id)}/pairings`);
  const details = id => get(`/tournaments/${encodeURIComponent(id)}/details`);

  return { tournaments, standings, pairings, details };
})();
