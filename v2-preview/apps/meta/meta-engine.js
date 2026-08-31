const MetaEngine = (() => {
  function pct(n, d) { return d ? (100 * n / d) : 0; }
  function archetypeName(standing) { return standing?.deck?.name || 'Unknown'; }
  function ignoredArchetype(name) { return name === 'Unknown' || name === 'Other'; }

  function aggregate(tournaments) {
    const archetypes = new Map();
    const matchups = new Map();
    const results = [];
    let matches = 0;

    for (const tournament of tournaments) {
      const byPlayer = new Map(tournament.standings.map(s => [s.player, s]));

      for (const standing of tournament.standings) {
        const name = archetypeName(standing);
        if (ignoredArchetype(name)) continue;
        const row = archetypes.get(name) || { name, players: 0, wins: 0, losses: 0, ties: 0 };
        row.players += 1;
        row.wins += standing.record?.wins || 0;
        row.losses += standing.record?.losses || 0;
        row.ties += standing.record?.ties || 0;
        archetypes.set(name, row);

        const placing = Number(standing.placing);
        if (standing.placing != null && Number.isFinite(placing) && placing > 0) {
          results.push({
            archetype: name,
            placing,
            player: standing.name || standing.player,
            tournament: tournament.name,
            date: tournament.date,
            players: tournament.players,
            record: standing.record,
          });
        }
      }

      for (const pairing of tournament.pairings) {
        if (!pairing.player1 || !pairing.player2 || pairing.winner === -1) continue;
        const s1 = byPlayer.get(pairing.player1);
        const s2 = byPlayer.get(pairing.player2);
        if (!s1 || !s2) continue;
        const a1 = archetypeName(s1);
        const a2 = archetypeName(s2);
        if (ignoredArchetype(a1) || ignoredArchetype(a2)) continue;

        matches += 1;
        const key = `${a1}|||${a2}`;
        const reverseKey = `${a2}|||${a1}`;
        const forward = matchups.get(key) || { a: a1, b: a2, wins: 0, losses: 0, ties: 0, games: 0 };
        const reverse = matchups.get(reverseKey) || { a: a2, b: a1, wins: 0, losses: 0, ties: 0, games: 0 };
        forward.games += 1;
        reverse.games += 1;

        if (pairing.winner === 0) {
          forward.ties += 1;
          reverse.ties += 1;
        } else if (pairing.winner === pairing.player1) {
          forward.wins += 1;
          reverse.losses += 1;
        } else if (pairing.winner === pairing.player2) {
          forward.losses += 1;
          reverse.wins += 1;
        }

        matchups.set(key, forward);
        matchups.set(reverseKey, reverse);
      }
    }

    const totalPlayers = [...archetypes.values()].reduce((sum, row) => sum + row.players, 0);
    for (const row of archetypes.values()) {
      row.share = pct(row.players, totalPlayers);
      row.games = row.wins + row.losses + row.ties;
      row.winRate = pct(row.wins, row.wins + row.losses);
    }

    return {
      archetypes: [...archetypes.values()].sort((a, b) => b.players - a.players),
      matchups,
      results,
      totalPlayers,
      matches,
      tournamentCount: tournaments.length,
    };
  }

  return { aggregate, pct };
})();