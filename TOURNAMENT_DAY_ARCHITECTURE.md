# PTCG Tools — Tournament Day / Results Architecture

**Status:** Current Compete implementation source of truth  
**Date:** 3 September 2026  
**Companion to:** `PTCG_TOOLS_MASTER.md`, `ROADMAP_HANDOFF_2026-09-03.md`, `PERFORMANCE_ARCHITECTURE.md`, `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md`

## Purpose

This document records the durable architecture established by the Tournament Day + event-linked results v1 implementation.

The lifecycle is:

**Attending / Prep → Tournament Day → Completion → future Season**

The canonical account-owned record throughout is one `UserEventParticipation` in the V2 root state.

## Ownership locks

- Compete owns Events, Event Prep, Tournament Day, real tournament results and eventual Competitive Record / Season.
- Deck and DeckVersion identity remain Decks-owned.
- Cut / ID remains Tools-owned and is launched contextually from Tournament Day.
- Real tournament rounds use the shared Match/Game contract in `v2-preview/apps/_shared/match-store.js`.
- Tournament Day does not create a second match-history/result store.
- Solo/goldfish Mobile Playtest remains outside competitive W/L evidence.

## Event lifecycle contract

`UserEventParticipation` already contains the durable relationship fields:

- `plannedDeckRef`
- `usedDeckRef`
- `tournamentDay`
- `completion`

Phase remains derived by shared storage:

- attendance / prep → `preparation`
- `tournamentDay` present → `in-progress`
- `completion` present → `completed`
- past attended event without completion → `needs-completion`

Tournament Day updates this existing participation. It does not create a separate tournament-history entity.

## Planned list vs used list

Event Prep writes `plannedDeckRef` using exact Deck identity:

- `deckId`
- `deckVersionId`
- `listHash`

Starting Tournament Day confirms/inherits an exact saved DeckVersion and writes a separate `usedDeckRef`.

The planned reference is not replaced. Where live Deck/DeckVersion records are available, Tournament Day adds display snapshots to retained references so later rename/deletion does not make the historical event unintelligible.

`usedDeckRef` includes the exact Deck/DeckVersion/list identity plus display snapshots such as deck name, version label and archetype where available.

Tournament Day must never rewrite an immutable historical DeckVersion.

## Tournament Day state

`participation.tournamentDay` is lightweight lifecycle/workspace state only, currently including timestamps such as:

- `startedAt`
- `lastOpenedAt`
- `lastRoundAt`
- `finishedAt`

Round results are deliberately not duplicated inside `tournamentDay`.

The current record and round history are derived from shared Matches linked by `participationId`.

## Match / Game contract

Every real tournament round is stored through `PTCGMatchStore` with:

- `source: irl`
- stable Match `id`
- `participationId`
- event ID/name snapshots
- exact `deckId + deckVersionId + listHash`
- deck/version display snapshots
- opponent archetype
- Win / Loss / Draw result
- round label
- optional notes
- Match/Game turn-order data
- Games representing entered game score

Editing a round reuses the same Match ID and `put()` replaces that record.

Deleting a round removes that Match ID from MatchStore.

This prevents correction flows from creating duplicate competitive evidence.

## Current-record derivation

Tournament Day derives W-L-D and rounds completed from the participation-linked Match records using the shared MatchStore statistics contract.

No second W-L-D counter is persisted in the live Tournament Day workspace.

## Completion contract

Completing an event writes `participation.completion` and changes attendance to `attended`.

Completion currently captures:

- completion timestamp
- final placement
- final player count
- final W-L-D snapshot
- rounds completed
- exact `usedDeckRef` snapshot
- optional notes

The linked Match/Game history remains the authoritative per-round evidence.

Past events in `needs-completion` use the same Tournament Day/completion workspace rather than a separate historical-result form.

## Cut / ID boundary

The previous V2 Tools surface only contained a Cut / ID migration placeholder. The old `v2-preview/apps/swiss` application is a full standalone tournament manager backed by its own IndexedDB tournament store and is not an appropriate Tournament Day result store.

A reusable deterministic engine now lives at:

`v2-preview/apps/_shared/cut-id-engine.js`

The Tools Cut / ID surface owns its UI. Tournament Day only launches it with current W-L-D context.

Current bounded v1 rule:

- one-round ID decision support;
- Pokémon points including draws;
- Top N cut size;
- deterministic maximum-above / maximum-at-or-above conclusions;
- pairing-aware bound when complete final-round pairing point totals are supplied;
- conservative bound when pairings are unavailable;
- no probabilistic simulation or empirical tie-rate default.

Future Cut / ID expansion should extend this reusable Tools engine rather than embedding competing logic in Tournament Day.

## UX / performance locks

Tournament Day is mobile-first around ~390 CSS px and answer-first:

- current W-L-D is primary;
- next-round action remains prominent;
- exact used list remains visible;
- round history is compact and editable;
- routine entry uses taps and mobile-safe 16 px form inputs;
- nested Tournament Day navigation remains inside the existing Compete child view and does not replace the five-area persistent shell;
- no full-page reload is required after saving/editing/deleting a round.

## Deferred

This milestone does not add:

- Championship Point calculations;
- Best Finish Limits;
- full Season dashboard;
- Collection readiness;
- Learning/personal analytics;
- Playtest evidence crossover;
- probabilistic Cut / ID simulation.

Competitive Record / Season remains the intended next major downstream milestone after Tournament Day acceptance/cleanup.