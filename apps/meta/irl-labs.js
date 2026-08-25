(() => {
  const URL = '../../data/meta/irl/TEF-PBL.json';
  let data = null;
  let loaded = false;

  async function load(force = false) {
    try {
      const target = force ? `${URL}?v=${Date.now()}` : URL;
      const response = await fetch(target, { cache: force ? 'no-store' : 'default' });
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
    if (events) el.textContent = `Limitless Labs • ${events} current-format IRL event${events === 1 ? '' : 's'}`;
    else el.textContent = 'Limitless Labs • no completed TEF–PBL IRL major yet';
  }

  function getData() { return data || { events: [], decks: [], matchups: [] }; }
  function isLoaded() { return loaded; }

  window.IRLLabs = { load, getData, isLoaded };
  load(false);
})();
