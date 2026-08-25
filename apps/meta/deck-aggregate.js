(() => {
  const URL = '../../data/meta/decks/TEF-PBL.json';
  let data = null;
  let loaded = false;
  let matchups = new Map();
  let decks = new Map();

  const ignored = name => !name || name === 'Other' || name === 'Unknown';

  function index(payload) {
    matchups = new Map();
    decks = new Map();
    for (const deck of payload?.decks || []) {
      if (!ignored(deck?.name)) decks.set(deck.name, deck);
    }
    for (const row of payload?.matchups || []) {
      if (ignored(row?.a) || ignored(row?.b)) continue;
      matchups.set(`${row.a}|||${row.b}`, row);
    }
  }

  async function load(force = false) {
    try {
      const target = force ? `${URL}?v=${Date.now()}` : URL;
      const response = await fetch(target, { cache: force ? 'no-store' : 'default' });
      if (!response.ok) throw new Error(`Limitless Decks cache ${response.status}`);
      const payload = await response.json();
      if (payload?.format !== 'TEF-PBL' || !Array.isArray(payload.decks) || !Array.isArray(payload.matchups)) {
        throw new Error('invalid Limitless Decks dataset');
      }
      data = payload;
      index(payload);
      loaded = true;
      window.dispatchEvent(new CustomEvent('deckagg:updated'));
      return data;
    } catch (error) {
      console.warn('Limitless Decks aggregate unavailable; falling back to tournament pairings', error);
      data = null;
      index(null);
      loaded = true;
      window.dispatchEvent(new CustomEvent('deckagg:updated'));
      return null;
    }
  }

  function getMatchup(a, b) { return matchups.get(`${a}|||${b}`) || null; }
  function getDeck(name) { return decks.get(name) || null; }
  function getData() { return data; }
  function hasData() { return matchups.size > 0; }
  function isLoaded() { return loaded; }

  window.DeckAggregate = { load, getMatchup, getDeck, getData, hasData, isLoaded };
  load(false);
})();
