(() => {
  const CURRENT = { id: 'TEF-PBL', label: 'TEF–PBL', start: '2026-07-17T00:00:00Z' };
  const PREVIOUS = { id: 'TEF-CRI', label: 'TEF–CRI', file: 'formats/TEF-CRI.json' };
  const MIN_PLAYERS = 50;
  const MAX_LIVE_TOURNAMENTS = 36;
  const MATCHUP_TOURNAMENTS = 12;
  const CONCURRENCY = 8;
  let pairingsLoaded = false;
  let pairingsLoading = false;

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
    const batch = await LimitlessAPI.tournaments({ limit: 500, page: 0, format: 'STANDARD', force });
    const unique = new Map();
    for (const t of Array.isArray(batch) ? batch : []) unique.set(String(t.id), t);
    return [...unique.values()]
      .filter(t => {
        const ts = new Date(t.date).getTime();
        return Number.isFinite(ts) && ts >= cutoff && Number(t.players || 0) >= MIN_PLAYERS;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, MAX_LIVE_TOURNAMENTS);
  }

  async function loadCurrentLive(force = false) {
    if (loading) return;
    setBusy(true);
    pairingsLoaded = false;
    try {
      setStatus(force ? 'Refreshing TEF–PBL from Limitless…' : 'Loading TEF–PBL from Limitless…');
      if (force) LimitlessAPI.clearCache();
      const tournaments = await currentTournamentIndex(force);
      if (!tournaments.length) throw new Error('No qualifying TEF–PBL tournaments found');
      setStatus(`Found ${tournaments.length} tournaments • loading standings…`);

      const loaded = await mapConcurrent(tournaments, CONCURRENCY, async t => {
        try {
          const standings = await LimitlessAPI.standings(t.id, { force });
          return { ...t, standings, pairings: [] };
        } catch (error) {
          console.warn('Could not load standings', t.id, error);
          return null;
        }
      });

      const good = loaded.filter(Boolean);
      if (!good.length) throw new Error('Limitless did not return any tournament standings');

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
      MANIFEST = MANIFEST || {
        current: CURRENT.id,
        previous: PREVIOUS.id,
        activeComparison: [CURRENT.id, PREVIOUS.id],
        formats: [
          { id: CURRENT.id, label: CURRENT.label, formatStart: CURRENT.start, role: 'current' },
          { id: PREVIOUS.id, label: PREVIOUS.label, file: PREVIOUS.file, role: 'previous' },
        ],
      };
      $('format').innerHTML = `<option value="${CURRENT.id}">${CURRENT.label} (current · live)</option><option value="${PREVIOUS.id}">${PREVIOUS.label} (previous · archive)</option>`;
      $('format').value = CURRENT.id;
      applyFilters();
      setStatus(`${CURRENT.label} • ${DATA.tournamentCount} tournaments • live standings loaded`);
      loadPreviousArchive(false);
    } catch (error) {
      console.error(error);
      setStatus(`Live load failed: ${error.message}`);
      FILTERED_TOURNAMENTS = [];
      DATA = MetaEngine.aggregate([]);
      render();
      renderComparison();
    } finally {
      setBusy(false);
    }
  }

  async function loadMatchupPairings() {
    if (pairingsLoaded || pairingsLoading || !CACHE?.tournaments?.length || CACHE.format !== CURRENT.id) return;
    pairingsLoading = true;
    try {
      const selected = [...CACHE.tournaments]
        .filter(t => filteredFor({ tournaments: [t] }, $('days').value, Math.max(50, Number($('minPlayers').value))).length)
        .slice(0, MATCHUP_TOURNAMENTS);
      if (!selected.length) return;
      setStatus(`Loading matchup data from ${selected.length} recent tournaments…`);
      await mapConcurrent(selected, 4, async t => {
        try {
          t.pairings = await LimitlessAPI.pairings(t.id);
        } catch (error) {
          console.warn('Could not load pairings', t.id, error);
          t.pairings = [];
        }
      });
      pairingsLoaded = true;
      applyFilters();
      setStatus(`${CURRENT.label} • ${DATA.tournamentCount} tournaments • matchup sample ${selected.length} events`);
    } finally {
      pairingsLoading = false;
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

  document.querySelector('[data-tab="matchups"]')?.addEventListener('click', loadMatchupPairings);
  document.querySelector('[data-tab="archetype"]')?.addEventListener('click', loadMatchupPairings);

  loadCurrentLive(false);
})();
