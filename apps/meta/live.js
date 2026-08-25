(() => {
  const CURRENT = { id: 'TEF-PBL', label: 'TEF–PBL', start: '2026-07-17T00:00:00Z' };
  const PREVIOUS = { id: 'TEF-CRI', label: 'TEF–CRI', file: 'formats/TEF-CRI.json' };
  const MIN_PLAYERS = 50;
  const MAX_LIVE_TOURNAMENTS = 36;
  const MATCHUP_TOURNAMENTS = 12;
  const CONCURRENCY = 8;
  const INDEX_PAGE_SIZE = 100;
  const MAX_INDEX_PAGES = 10;
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
    const unique = new Map();

    for (let page = 0; page < MAX_INDEX_PAGES; page++) {
      setStatus(`Scanning TEF–PBL tournaments • page ${page + 1}…`);
      const batch = await LimitlessAPI.tournaments({
        limit: INDEX_PAGE_SIZE,
        page,
        format: 'STANDARD',
        force,
      });
      const rows = Array.isArray(batch) ? batch : [];
      if (!rows.length) break;

      for (const t of rows) unique.set(String(t.id), t);

      const timestamps = rows
        .map(t => new Date(t.date).getTime())
        .filter(Number.isFinite);
      const oldest = timestamps.length ? Math.min(...timestamps) : Infinity;

      if (oldest < cutoff || rows.length < INDEX_PAGE_SIZE) break;
    }

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
      const aggregate = window.DeckAggregate?.getData?.();
      setStatus(aggregate?.overview?.matches
        ? `${CURRENT.label} • ${DATA.tournamentCount} 50+ tournaments • ${Number(aggregate.overview.matches).toLocaleString()} all-event matchup games`
        : `${CURRENT.label} • ${DATA.tournamentCount} tournaments • live standings loaded`);
      window.dispatchEvent(new CustomEvent('meta:updated'));
      loadPreviousArchive(false);
    } catch (error) {
      console.error(error);
      setStatus(`Live load failed: ${error.message}`);
      FILTERED_TOURNAMENTS = [];
      DATA = MetaEngine.aggregate([]);
      render();
      renderComparison();
      window.dispatchEvent(new CustomEvent('meta:updated'));
    } finally {
      setBusy(false);
    }
  }

  async function loadMatchupPairings() {
    if (window.DeckAggregate?.hasData?.()) {
      pairingsLoaded = true;
      const aggregate = window.DeckAggregate.getData();
      const matches = Number(aggregate?.overview?.matches || 0);
      if (CACHE?.format === CURRENT.id && matches) {
        setStatus(`${CURRENT.label} • ${DATA?.tournamentCount || 0} 50+ tournaments • ${matches.toLocaleString()} all-event matchup games`);
      }
      return;
    }
    if (pairingsLoaded || pairingsLoading || !CACHE?.tournaments?.length || CACHE.format !== CURRENT.id) return;
    pairingsLoading = true;
    try {
      const selected = [...CACHE.tournaments]
        .filter(t => filteredFor({ tournaments: [t] }, $('days').value, Math.max(50, Number($('minPlayers').value))).length)
        .slice(0, MATCHUP_TOURNAMENTS);
      if (!selected.length) return;
      setStatus(`Aggregate matchup cache unavailable • loading ${selected.length} recent tournaments as fallback…`);
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
      setStatus(`${CURRENT.label} • ${DATA.tournamentCount} tournaments • fallback matchup sample ${selected.length} events`);
      window.dispatchEvent(new CustomEvent('meta:updated'));
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

  window.MetaLive = { loadCurrentLive, loadMatchupPairings };

  $('refresh').textContent = 'Refresh live data';
  $('refresh').onclick = () => loadCurrentLive(true);
  $('format').onchange = async () => {
    if ($('format').value === CURRENT.id) {
      CACHE = FORMAT_CACHES.get(CURRENT.id) || CACHE;
      applyFilters();
      window.dispatchEvent(new CustomEvent('meta:updated'));
      return;
    }
    setBusy(true);
    try {
      setStatus(`Loading ${PREVIOUS.label} archive…`);
      await loadPreviousArchive(false);
      CACHE = FORMAT_CACHES.get(PREVIOUS.id);
      if (!CACHE) throw new Error('Previous-format archive is not available yet');
      applyFilters();
      window.dispatchEvent(new CustomEvent('meta:updated'));
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  };

  document.querySelector('[data-tab="matchups"]')?.addEventListener('click', loadMatchupPairings);
  document.querySelector('[data-tab="archetype"]')?.addEventListener('click', loadMatchupPairings);
  document.querySelector('[data-tab="prep"]')?.addEventListener('click', loadMatchupPairings);

  loadCurrentLive(false);
})();
