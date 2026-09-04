# PTCG Tools — Competitive Record / Season Architecture

**Status:** Competitive Record / Season v1 implementation source of truth  
**Date:** 4 September 2026  
**Companion to:** `PTCG_TOOLS_MASTER.md`, `TOURNAMENT_DAY_ARCHITECTURE.md`, `PERFORMANCE_ARCHITECTURE.md`, `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md`

## Purpose

Competitive Record / Season is the Compete-owned continuation of the existing tournament lifecycle:

**attendance → Prep → Tournament Day → completion → Season**

It must turn completed `UserEventParticipation` records into a useful season view without creating a second tournament-history database.

## Ownership and identity locks

- Compete owns Competitive Record / Season.
- `UserEventParticipation` remains the canonical account-owned event participation/history entity.
- Match/Game remains the canonical per-round competitive evidence contract.
- Deck/DeckVersion identity remains Decks-owned.
- `usedDeckRef` is the exact list actually played and is reused by Season.
- Playtest evidence remains separate from competitive Match evidence.
- Shared season definitions and Championship Point rules are public/shared data.
- User completions, corrections, notes and goals are private account-owned data.
- `SeasonSummary` is always derived. It is never an independently edited history source.

## Existing foundation

Tournament Day v1 already supplies the core history contract required by Season:

- stable participation identity;
- retained event snapshot;
- completion state;
- final placement;
- final player count;
- final W-L-D snapshot;
- exact `usedDeckRef`;
- participation-linked Match/Game evidence;
- completion timestamp/notes.

`v2-preview/apps/_shared/storage.js` already includes a nullable `seasonId` on normalized `UserEventParticipation` records. No duplicate tournament entity is required.

## CompetitiveSeason

A `CompetitiveSeason` is shared/public configuration with a stable identity independent of calendar year.

Required shape:

```js
{
  id: 'pokemon-2027',
  label: '2027 Championship Series',
  startDate: 'YYYY-MM-DD',
  endDate: 'YYYY-MM-DD',
  rulesetId: 'pokemon-tcg-2027-cp',
  provenance: {
    source: 'pokemon.com',
    url: '...',
    verifiedAt: '...'
  }
}
```

Season boundaries must come from an official source. Do not infer the end boundary from calendar year or from the local-play cycle alone.

## ChampionshipPointRuleset

Rules are injected into the shared Season engine rather than hard-coded into UI pages.

Required shape:

```js
{
  id: 'pokemon-tcg-2027-cp',
  version: '2027.1',
  game: 'tcg',
  seasonId: 'pokemon-2027',
  eventRules: [
    {
      eventType: 'league-cup',
      awards: [
        { minPlacement: 1, maxPlacement: 1, minPlayers: 0, cp: 0 }
      ]
    }
  ],
  bestFinishLimits: [
    {
      id: '...',
      eventTypes: ['...'],
      limit: 0
    }
  ],
  provenance: {
    source: 'pokemon.com',
    urls: [],
    verifiedAt: '...'
  }
}
```

The model supports:

- event-type-specific award bands;
- attendance/player-count kickers;
- age division and rating zone constraints when official rules require them;
- BFL buckets shared across one or more event types;
- ruleset versioning so historical results do not silently recalculate under later rules.

No numerical 2027 CP table is to be committed until the official current table is directly verified.

## Shared engine

Current implementation:

`v2-preview/apps/_shared/season-engine.js`

`window.PTCGSeasonEngine` owns:

- event-type normalization;
- season-date resolution;
- effective participation facts;
- per-event CP calculation from injected rules;
- dynamic Best Finish Limit application;
- raw CP vs counting CP derivation;
- derived `SeasonSummary` construction.

Feature pages must consume this engine rather than implementing CP/BFL logic independently.

## Manual corrections

Corrections are participation-local and must not mutate shared event data.

Initial correction envelope:

```js
participation.seasonCorrection = {
  fields: {
    eventType: 'league-cup',
    placement: 3,
    playerCount: 24,
    seasonId: 'pokemon-2027'
  },
  source: 'user',
  correctedAt: 'ISO timestamp'
}
```

The engine resolves corrected values first and reports field-level provenance as `user-correction`; otherwise the value comes from the participation/completion snapshot.

Future UI should display corrected fields visibly rather than making them indistinguishable from imported/shared facts.

## SeasonSummary

A `SeasonSummary` is a read model derived at render/query time from:

- completed participations;
- effective/corrected participation facts;
- the applicable season;
- the applicable versioned ruleset;
- optional player context required by the official rules.

It includes:

- completed event count;
- eligible event count;
- raw CP;
- counting CP;
- excluded CP;
- per-event CP;
- per-event counting/excluded state;
- BFL bucket identity;
- displacement context where applicable.

It is not separately persisted as editable truth.

## BFL semantics

BFL is calculated dynamically over eligible results.

For each official BFL bucket:

1. collect all positive-CP results in the bucket;
2. rank by CP earned, not merely placement;
3. retain the top `limit` results;
4. mark lower results as excluded;
5. recalculate whenever a completion/correction/ruleset input changes.

This supports a shared BFL across event series with different CP scales.

## Provenance

Shared definitions/rules retain official source URLs and verification timestamps.

Participation facts retain their existing event/completion source plus explicit user-correction provenance where used.

A correction changes only the user's effective Season calculation. It does not rewrite the shared event snapshot for every user.

## UI direction

The v1 Season surface belongs inside Compete and remains iPhone-first.

Answer-first hierarchy:

1. current season label;
2. counting CP;
3. raw CP;
4. completed eligible events;
5. recent results;
6. BFL/excluded context;
7. useful event and exact-deck links.

A participation detail should expose:

- event;
- W-L-D;
- placement;
- player count;
- CP earned;
- whether it counts;
- exact DeckVersion/list used;
- correction/provenance indicators where relevant.

Do not build a wide desktop-first history table.

## Official 2027 rules verification status — 4 September 2026

Verified from current official Pokémon sources:

- the 2027 Championship Series begins on **1 September 2026**;
- Championship Points remain event/placement based;
- Best Finish Limits remain part of the official CP model;
- when event series with different CP scales share a BFL, the highest **point totals** count rather than simply the highest placements;
- Worlds qualification is not to be represented as one universal hard-coded CP threshold;
- the 2027 season has current official Championship Series/event content live.

The complete 2027 TCG CP/kicker numerical tables were not reliably exposed through the current searchable official surface during this implementation pass. Secondary sources reproduce plausible tables, but they are intentionally not treated as authority for code.

Therefore the shared engine is implemented now, while the concrete `pokemon-tcg-2027-cp` ruleset data remains blocked pending direct official verification.

## Implementation sequence

1. **Foundation — started**
   - shared Season engine;
   - architecture contract;
   - no duplicate history model.
2. **Official data**
   - verify exact 2027 TCG CP/kicker/BFL tables and official season end boundary;
   - add versioned shared `CompetitiveSeason` + `ChampionshipPointRuleset` data with provenance.
3. **Participation correction contract**
   - add bounded storage helpers for `seasonCorrection` and explicit season/ruleset identity where needed.
4. **Season UI**
   - compact Compete Season surface consuming completed participations and the shared engine.
5. **Participation detail/corrections**
   - event detail with exact used list, CP/counting state and visible corrections.
6. **Acceptance**
   - deterministic rules/BFL tests;
   - completion → Season integration test;
   - GitHub Pages deployment verification;
   - real iPhone visual smoke test before claiming mobile acceptance.

## Explicitly deferred

- Collection / physical readiness;
- Learn / personal analytics;
- Playtest expansion;
- Tournament Day redesign;
- broad repository cleanup;
- community/public release work;
- speculative qualification/ranking logic not backed by official data.
