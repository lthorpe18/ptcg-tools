# PTCG Tools — Competitive Record / Season Architecture

**Status:** Competitive Record / Season v1 accepted current-stage source of truth  
**Date:** 4 September 2026  
**Companion to:** `PTCG_TOOLS_MASTER.md`, `TOURNAMENT_DAY_ARCHITECTURE.md`, `PERFORMANCE_ARCHITECTURE.md`, `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md`

## Purpose

Competitive Record / Season is the Compete-owned continuation of the tournament lifecycle:

**attendance → Prep → Tournament Day → completion → Season**

It turns completed `UserEventParticipation` records into a season record without creating a second tournament-history database.

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
- `v2-preview/apps/events/season-inline.js` / `season.js` / `season.css` — Season as an in-page Events view;
- `v2-preview/apps/events/tournament-season-stamp.js` — completion-time season/ruleset identity stamping plus safe repair of older completed records when opened;
- `v2-preview/apps/events/tournament-day-topcut.js` — manual canonical Match `roundStage` tags for Swiss / Asym Top 16/8/4 / Top 16/8/4 / Finals;
- `tests/season-engine.test.js` — deterministic placement/kicker/BFL checks.

Tournament Day supplies the history contract required by Season:

- stable participation identity;
- retained event snapshot;
- completion state;
- final placement;
- final player count;
- final W-L-D snapshot;
- exact `usedDeckRef`;
- participation-linked Match/Game evidence;
- optional `roundStage` on canonical Matches;
- completion timestamp/notes;
- persisted season/ruleset identity for supported Championship Series completions.

No duplicate tournament or season-history entity is required.

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

## Completion-time historical identity

Supported Championship Series completions now persist historical season identity on the existing participation:

```js
participation.seasonId = 'pokemon-2027'
participation.seasonRulesetRef = {
  id: 'pokemon-tcg-2027-cp',
  version: '2027.1',
  assignedAt: 'completion timestamp',
  source: 'tournament-completion'
}
```

The stamping hook only applies when:

- the participation is complete;
- the event date resolves inside the configured season;
- the event type is supported by the ruleset.

Generic locals, prereleases and unsupported event types are not stamped as CP events merely because their date falls within the season.

Older completed supported records without explicit identity continue to derive correctly and are stamped when next opened in Tournament Day. Historical records therefore no longer depend solely on future date-based inference.

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

The Season result sheet exposes bounded corrections for event type, placement and player count, plus an optional note. Corrected results are visibly labelled. Clearing corrections restores recorded participation facts.

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
- exact used deck name and saved DeckVersion/list snapshot where available;
- visible correction state;
- participation-linked round history;
- manual Top Cut stage tags where recorded;
- direct link back to the canonical Tournament Day record.

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

## Events / My Tournaments lifecycle

Season is an equal in-page Compete view under the permanent Events header:

**Nearby · Majors · My Tournaments · Season**

Season must not navigate to a separate page/header during normal use.

My Tournaments now presents the primary lifecycle as:

**Current · Upcoming · Incomplete · Completed**

- Current = dated today;
- Upcoming = future-dated, not complete;
- Incomplete = past/un-dated tournament record without completion;
- Completed = completed tournament record.

Archived is deliberately demoted from the primary lifecycle. It is a secondary recovery/cleanup view shown only when archived records exist.

A completed or archived tournament can be reopened without losing event snapshot, used deck or Match/Game evidence. Reopening clears completion/archive state and routes the record back to Current, Upcoming or Incomplete according to date.

## Top Cut round semantics

Top Cut stage is optional metadata on the canonical Match, not a second result model.

Accepted manual tags:

- Swiss (default / no explicit `roundStage`);
- Asym Top 16;
- Asym Top 8;
- Asym Top 4;
- Top 16;
- Top 8;
- Top 4;
- Finals.

The 2026 rules update caps TCG asymmetrical top cut at 16 competitors. PTCG Tools does not attempt to automate bracket determination in v1; the user tags the stage when recording/editing the round.

## UI direction and current surface

Season belongs inside Compete and remains iPhone-first.

Current answer-first hierarchy:

1. compact `2027 Season` heading;
2. counting CP;
3. raw CP;
4. eligible/completed event counts;
5. BFL bucket state;
6. recent results;
7. result evidence/corrections.

The permanent Events shell/header remains visible when switching among Compete views.

## Acceptance state — 4 September 2026

**Season v1 is accepted/complete for the current product stage.**

Established implementation includes:

- official numerical 2027 rules configuration committed with provenance;
- deterministic rules/BFL test file committed;
- 2027 season identity/start definition committed;
- Season implemented as an in-page Events view;
- permanent Events header retained across Season;
- one real manually recorded Cup checked by the user with the expected tournament information flowing through to Season correctly;
- supported completions stamping season/ruleset identity;
- Season detail exposing exact deck/version snapshots, linked rounds and Top Cut stage tags, with a direct Tournament Day link;
- completed/archived tournaments reopening without losing evidence;
- primary My Tournaments lifecycle simplified to Current / Upcoming / Incomplete / Completed.

The following remain useful **non-blocking verification/maintenance checks** and do not keep the Season milestone open:

1. execute the deterministic test suite in a real JS runtime and record the result;
2. exercise BFL overflow/displacement beyond the official limits;
3. verify a Season correction syncs across devices/account persistence;
4. perform additional real iPhone visual/interaction smoke testing;
5. fill the whole-season end boundary only when directly verified from an authoritative official source.

Any genuine defect found by those checks may reopen a bounded Season bugfix, but there is no further planned Season v1 feature-development programme.

## Roadmap handoff

Season v1 is closed. Central roadmap work should move to the next major product milestone while keeping the verification items above as background/non-blocking follow-up.

Current intended sequence after Season:

1. **Collection / physical readiness**;
2. **Learn / personal analytics**;
3. **Development Cleanup / Release Hardening** before calling the broader application stable/public-ready.

## Explicitly deferred

- Collection / physical readiness;
- Learn / personal analytics;
- Playtest expansion;
- Tournament Day redesign;
- broad repository cleanup;
- community/public release work;
- speculative qualification/ranking logic not backed by official data.
