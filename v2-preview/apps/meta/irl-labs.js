(() => {
  const URL = '../../data/meta/irl/TEF-PBL.json';
  let data = null;
  let loaded = false;

  async function load(force = false) {
    try {
      const target = force ? `${URL}?v=${Date.now()}` : URL;
      const response = await fetch(target, { cache: 'no-store' });
      if (!response.ok) throw new Error(`IRL cache ${response.status}`);
      data = await response.json();
      loaded = true;
      updateStatus();
      window.dispatchEvent(new CustomEvent('irl:updated'));
      return data;
    } catch (error) {
      console.warn('IRL Labs data unavailable', error);
      data = { events: [], decks: [], matchups: [], note: error.message };
      loaded = true;
      updateStatus();
      window.dispatchEvent(new CustomEvent('irl:updated'));
      return data;
    }
  }

  function updateStatus() {
    const el = document.getElementById('irlStatus');
    if (!el) return;
    const events = data?.events?.length || 0;
    const decks = data?.decks?.length || 0;
    if (events && decks) el.textContent = `Limitless Labs • ${events} IRL event${events === 1 ? '' : 's'} • ${decks} archetypes`;
    else if (events) el.textContent = `Limitless Labs • ${events} IRL event${events === 1 ? '' : 's'} • field data unavailable`;
    else el.textContent = 'Limitless Labs • no completed TEF–PBL IRL major yet';
  }

  function getData() { return data || { events: [], decks: [], matchups: [] }; }
  function isLoaded() { return loaded; }

  window.IRLLabs = { load, getData, isLoaded };
  load(false);
})();