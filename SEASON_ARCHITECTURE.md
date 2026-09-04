# PTCG Tools — Competitive Record / Season Architecture

**Status:** Competitive Record / Season v1 implementation source of truth  
**Date:** 4 September 2026  
**Companion to:** `PTCG_TOOLS_MASTER.md`, `TOURNAMENT_DAY_ARCHITECTURE.md`, `PERFORMANCE_ARCHITECTURE.md`, `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md`

## Purpose

Competitive Record / Season is the Compete-owned continuation of the existing tournament lifecycle:

**attendance → Prep → Tournament Day → completion → Season**

It turns completed `UserEventParticipation` records into a useful season view without creating a second tournament-history database.

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

## Current implementation

Implemented on 4 September 2026:

- `v2-preview/apps/_shared/season-engine.js` — canonical CP/BFL/summary engine;
- `v2-preview/apps/_shared/season-rules-2027.js` — official 2027 TCG CP tables and BFL configuration;
- `v2-preview/apps/_shared/season-config-2027.js` — first-class 2027 season identity and start boundary;
- `v2-preview/apps/_shared/season-participation.js` — bounded per-user season correction helpers;
- `v2-preview/apps/events/season.html` / `season.js` / `season.css` — Compete Season surface;
- `tests/season-engine.test.js` — deterministic placement/kicker/BFL checks;
- Compete view navigation now links to Season.

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

`v2-preview/apps/_shared/storage.js` includes nullable `seasonId` on normalized `UserEventParticipation` records. No duplicate tournament entity is required.

## CompetitiveSeason

A `CompetitiveSeason` is shared/public configuration with a stable identity independent of calendar year.

Current 2027 configuration:

```js
{
  id: 'pokemon-2027',
  label: '2027 Championship Series',
  startDate: '2026-09-01',
  endDate: null,
  rulesetId: 'pokemon-tcg-2027-cp',
  boundaryStatus: 'start-verified-end-pending'
}
```

The season start is verified. The whole-season end boundary remains deliberately unset until directly verified from an official source. Do not infer it from calendar year or a local-play period.

## ChampionshipPointRuleset

Rules are injected into the shared Season engine rather than hard-coded into UI pages.

Current ruleset identity:

- `id`: `pokemon-tcg-2027-cp`
- `version`: `2027.1`
- game: TCG
- season: `pokemon-2027`

Authoritative official Pokémon Championship Series sources approved for the 2027 TCG numbers:

1. `https://championships.pokemon.com/en-gb/about/league-challenges-and-league-cup`
2. `https://championships.pokemon.com/en-gb/about/pokemon-regional-and-special-championships?pillar=tcg`
3. `https://championships.pokemon.com/en-gb/about/international-championships?pillar=tcg`

The versioned ruleset contains:

- League Challenge placement awards + player-count kickers;
- League Cup placement awards + player-count kickers;
- Regional placement awards + player-count kickers;
- Special Championship placement awards + player-count kickers;
- International Championship placement awards + player-count kickers;
- League Challenge BFL = 4;
- League Cup BFL = 4;
- shared Regional/Special/International BFL = 5.

The engine supports age-division/rating-zone constraints if a future official ruleset requires them.

## Shared engine

`window.PTCGSeasonEngine` owns:

- event-type normalization;
- season-date resolution;
- effective participation facts;
- per-event CP calculation from injected rules;
- dynamic Best Finish Limit application;
- raw CP vs counting CP derivation;
- derived `SeasonSummary` construction.

Feature pages consume this engine rather than implementing CP/BFL logic independently.

## Manual corrections

Corrections are participation-local and do not mutate shared event data.

Current correction envelope:

```js
participation.seasonCorrection = {
  fields: {
    eventType: 'league-cup',
    placement: 3,
    playerCount: 24,
    seasonId: 'pokemon-2027'
  },
  source: 'user',
  correctedAt: 'ISO timestamp',
  note: 'optional explanation'
}
```

The Season result sheet currently exposes bounded corrections for event type, placement and player count, plus an optional note. Corrected results are visibly labelled. Clearing corrections restores recorded participation facts.

## SeasonSummary

A `SeasonSummary` is a read model derived at render/query time from:

- completed participations;
- effective/corrected participation facts;
- the applicable season;
- the applicable versioned ruleset;
- optional player context required by official rules.

Current UI exposes:

- counting CP;
- raw CP;
- eligible/completed Championship Series event counts;
- BFL bucket summaries;
- per-event CP;
- counting/excluded state;
- W-L-D;
- placement/player count;
- exact used-deck reference label where available;
- visible correction state.

It is not separately persisted as editable truth.

## BFL semantics

BFL is calculated dynamically over eligible results.

For each official BFL bucket:

1. collect all positive-CP results in the bucket;
2. rank by CP earned, not merely placement;
3. retain the top `limit` results;
4. mark lower results as excluded;
5. recalculate whenever a completion/correction/ruleset input changes.

This supports the official shared BFL across Regionals, Specials and Internationals with different CP scales.

## UI direction and current surface

Season belongs inside Compete and remains iPhone-first.

Current answer-first hierarchy:

1. current season label;
2. counting CP;
3. raw CP;
4. eligible/completed event counts;
5. BFL bucket state;
6. recent results;
7. result detail/corrections.

The current surface is intentionally card/list based rather than a wide desktop table.

## Acceptance state — 4 September 2026

Completed:

- official numerical 2027 rules configuration committed with provenance;
- deterministic rules/BFL test file committed;
- 2027 season identity/start definition committed;
- Season page implemented;
- Season linked from Compete navigation;
- previous rules/test commit successfully deployed through GitHub Pages.

Still required before Season v1 can be called fully accepted:

1. execute the deterministic test suite in a real JS runtime and record the result;
2. verify the latest Season UI/navigation SHA completes GitHub Pages deployment;
3. perform completion → Season integration using real account data;
4. verify a known Challenge/Cup result produces the correct CP and BFL state;
5. verify a correction syncs across devices/account persistence;
6. verify the whole-season end boundary from an official source;
7. perform a real iPhone visual/interaction smoke test before claiming mobile acceptance.

## Next implementation sequence

1. **Acceptance / integration**
   - execute tests;
   - verify deployed SHA;
   - run completion → Season smoke test.
2. **Season identity persistence**
   - stamp season/ruleset identity at completion or a deliberate migration point so historical recalculation cannot drift.
3. **Result detail depth**
   - link exact DeckVersion/list and participation-linked Matches cleanly from Season detail.
4. **Season quality pass**
   - improve empty/error/provenance context only where real use exposes a need.
5. **Acceptance**
   - cross-device and iPhone checks.

## Explicitly deferred

- Collection / physical readiness;
- Learn / personal analytics;
- Playtest expansion;
- Tournament Day redesign;
- broad repository cleanup;
- community/public release work;
- speculative qualification/ranking logic not backed by official data.
