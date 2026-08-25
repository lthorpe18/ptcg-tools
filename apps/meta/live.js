(() => {
  const CURRENT = { id: 'TEF-PBL', label: 'TEF–PBL', start: '2026-07-17T00:00:00Z' };
  const PREVIOUS = { id: 'TEF-CRI', label: 'TEF–CRI', file: 'formats/TEF-CRI.json' };
  const MIN_PLAYERS = 50;
  const CONCURRENCY = 10;

  async function mapConcurrent(items, limit, fn) {
    const out = new Array(items.length);
    let cursor = 0;
    async function worker() {
      while (true) {
        const i = cursor++;
        if (i >= items.length) return;
        out[i] = await fn(items[i], i);
      }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return out;
  }

  async function currentTournamentIndex(force = false) {
    const cutoff = new Date(CURRENT.start).getTime();
    const rows = [];
    for (let page = 0; page < 5; page++) {
      const batch = await LimitlessAPI.tournaments({ limit: 100, page, format: 'STANDARD', force });
      if (!Array.isArray(batch) || !batch.length) break;
      rows.push(...batch);
      const dates = batch.map(t => new Date(t.date).getTime()).filter(Number.isFinite);
      if ((dates.length && Math.min(...dates) < cutoff) || batch.length < 100) break;
    }
    const unique = new Map();
    for (const t of rows) unique.set(String(t.id), t);
    return [...unique.values()].filter(t => {
      const ts = new Date(t.date).getTime();
      return Number.isFinite(ts) && ts >= cutoff && Number(t.players || 0) >= MIN_PLAYERS;
    });
  }

  async function loadCurrentLive(force = false) {
    setBusy(true);
    try {
      setStatus(force ? 'Refreshing current meta from Limitless…' : 'Loading current meta from Limitless…');
      if (force) LimitlessAPI.clearCache();
      const tournaments = await currentTournamentIndex(force);
      setStatus(`Found ${tournaments.length} qualifying tournaments • loading results…`);

      const loaded = await mapConcurrent(tournaments, CONCURRENCY, async t => {
        try {
          const [standings, pairings] = await Promise.all([
            LimitlessAPI.standings(t.id, { force }),
            LimitlessAPI.pairings(t.id, { force }),
          ]);
          return { ...t, standings, pairings };
        } catch (error) {
          console.warn('Could not load tournament', t.id, error);
          return null;
        }
      });

      const good = loaded.filter(Boolean).sort((a, b) => new Date(b.date) - new Date(a.date));
      CACHE = {
        schemaVersion: 3,
        generatedAt: new Date().toISOString(),
        source: 'live-limitless',
        game: 'PTCG',
        apiFormat: 'STANDARD',
        format: CURRENT.id,
        label: CURRENT.label,
        formatStart: CURRENT.start,
        formatEnd: null,
        minTournamentSize: MIN_PLAYERS,
        tournamentCount: good.length,
        tournaments: good,
      };
      FORMAT_CACHES.set(CURRENT.id, CACHE);
      if (!MANIFEST) {
        MANIFEST = {
          current: CURRENT.id,
          previous: PREVIOUS.id,
          activeComparison: [CURRENT.id, PREVIOUS.id],
          formats: [
            { id: CURRENT.id, label: CURRENT.label, formatStart: CURRENT.start, role: 'current' },
            { id: PREVIOUS.id, label: PREVIOUS.label, file: PREVIOUS.file, role: 'previous' },
          ],
        };
      }
      $('format').innerHTML = `<option value="${CURRENT.id}">${CURRENT.label} (current · live)</option><option value="${PREVIOUS.id}">${PREVIOUS.label} (previous · archive)</option>`;
      $('format').value = CURRENT.id;
      applyFilters();
      setStatus(`${CURRENT.label} • ${DATA.tournamentCount} tournaments • live from Limitless`);
      loadPreviousArchive(false);
    } catch (error) {
      console.error(error);
      setStatus(`Live load failed: ${error.message} • trying cached copy…`);
      try {
        await loadManifest(false);
        await loadSelectedFormat(false);
        if (CACHE?.tournaments?.length) applyFilters();
      } catch (fallbackError) {
        console.error(fallbackError);
        setStatus(`Error: ${error.message}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function loadPreviousArchive(force = false) {
    try {
      let manifest = MANIFEST;
      if (!manifest?.formats?.some(f => f.id === PREVIOUS.id && f.file)) {
        manifest = await fetchJson(INDEX_URL, force);
        MANIFEST = manifest;
      }
      const meta = manifest?.formats?.find(f => f.id === PREVIOUS.id);
      if (!meta?.file) return;
      const payload = await fetchJson(`../../data/meta/${meta.file}`, force);
      if (payload?.tournaments?.length) {
        FORMAT_CACHES.set(PREVIOUS.id, payload);
        renderComparison();
      }
    } catch (error) {
      console.info('Previous-format archive is not available yet.', error);
    }
  }

  $('refresh').textContent = 'Refresh live data';
  $('refresh').onclick = () => loadCurrentLive(true);
  $('format').onchange = async () => {
    if ($('format').value === CURRENT.id) {
      CACHE = FORMAT_CACHES.get(CURRENT.id) || CACHE;
      applyFilters();
      return;
    }
    setBusy(true);
    try {
      setStatus(`Loading ${PREVIOUS.label} archive…`);
      await loadPreviousArchive(false);
      CACHE = FORMAT_CACHES.get(PREVIOUS.id);
      if (!CACHE) throw new Error('Previous-format archive is not available yet');
      applyFilters();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  };

  loadCurrentLive(false);
})();
