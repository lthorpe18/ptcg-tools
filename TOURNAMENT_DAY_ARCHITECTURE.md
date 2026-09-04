# PTCG Tools — Tournament Day / Results Architecture

**Status:** Current Compete implementation source of truth  
**Date:** 4 September 2026  
**Companion to:** `PTCG_TOOLS_MASTER.md`, `PERFORMANCE_ARCHITECTURE.md`, `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md`

## Purpose

This document records the durable architecture established by the Tournament Day + event-linked results implementation.

The canonical account-owned record throughout is one `UserEventParticipation` in the V2 root state. Tournament Day is not a second tournament/history model layered on top of Events.

## Ownership locks

- Compete owns Events, attendance, Event Prep, Tournament Day, real tournament results and eventual Competitive Record / Season.
- Deck and DeckVersion identity remain Decks-owned.
- Cut / ID remains Tools-owned at engine/standalone-tool level, while Tournament Day owns the lightweight contextual decision workflow.
- Real tournament rounds use the shared Match/Game contract in `v2-preview/apps/_shared/match-store.js`.
- Tournament Day does not create a second match-history/result store.
- Solo/goldfish Mobile Playtest remains outside competitive W/L evidence.
- Cross-app archetype sprite presentation is owned by the shared `DeckSprites` mapping. Tournament Day must not maintain a competing archetype→sprite system.

## Tournament recording entry model

A tournament record may begin from either an Event or an ad-hoc record.

### Catalogue/event-linked path

An existing `UserEventParticipation` marked Attending can be opened directly from Events / My Tournaments / Prep and continued through Tournament Day.

The same participation retains:

- catalogue/event identity;
- event snapshot;
- attendance state;
- Prep;
- planned exact list;
- Tournament Day state;
- real Matches;
- completion.

### Ad-hoc path

`Record tournament` can create a participation without requiring an Event catalogue record first.

An ad-hoc tournament has:

- its own stable participation ID;
- `eventId: null`;
- a retained manual event snapshot;
- in-person or online context;
- the same downstream Tournament Day / Match / completion path.

Online tournaments, recurring local league nights and other unlisted events therefore do not need a parallel history model.

The lifecycle is:

**Optional catalogue attendance / Prep → Tournament Day → Completion → future Season**

or:

**Record tournament → Tournament Day → Completion → future Season**

## Event lifecycle contract

`UserEventParticipation` contains the durable relationship fields:

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

## My Tournaments surface

My Tournaments is a third in-page Compete / Events tab alongside:

**Nearby · Majors · My Tournaments**

The Events header and page shell remain identical across all three tabs. My Tournaments must not navigate to a separate top-level page or duplicate the Events title/header.

Filters are:

- **Current** — tournaments whose event date is literally today;
- **Upcoming** — future-dated tournaments;
- **Completed** — completed tournament records;
- **Archived** — explicitly archived records.

There is no All filter.

Default behaviour:

- open Current when at least one tournament is dated today;
- otherwise open Upcoming.

Ordering:

- Current / Upcoming: nearest date first;
- Completed / Archived: most recent first.

Tournament cards show event identity, date/type/status, used deck where present, W-L-D, round count and compact management actions. `usedDeckRef` is the only deck reference that may be presented as the deck actually played.

## Planned list vs used list

`plannedDeckRef` and `usedDeckRef` are deliberately separate concepts.

Event Prep may write `plannedDeckRef` with exact Deck identity:

- `deckId`
- `deckVersionId`
- `listHash`

Tournament Day must **not** require a deck before rounds can begin.

The user can start Tournament Day and record rounds with no deck selected. At any time they may attach, change or remove the exact deck actually played. Saving that selection writes `usedDeckRef`.

The compact Tournament Day deck control is the only intended live deck-selection UI:

- no deck → compact **My Deck** control;
- selected deck → representative sprites in that same compact control;
- tapping either state opens the deck/version picker;
- selecting a deck/version updates existing participation-linked Match records with the same exact deck reference;
- removing the tournament deck clears `usedDeckRef` and the corresponding deck fields on those Matches.

The old large `Playing / Deck not selected / Saved deck · Exact list` summary is legacy UI and should be removed during cleanup rather than retained as a second presentation path.

A planned deck may be used as a picker suggestion, but must never silently become `usedDeckRef` merely because it was planned.

`usedDeckRef` includes the exact Deck/DeckVersion/list identity plus display snapshots such as deck name, version label and archetype where available.

Tournament Day must never rewrite an immutable historical DeckVersion.

## Deck picker architecture

Tournament Day reads saved decks through the shared `PTCGDeckStore` rather than opening/reimplementing IndexedDB independently.

The picker:

- opens immediately on tap;
- may show loading state while deck records resolve;
- lists saved Decks and exact versions;
- preselection must tolerate `usedDeckRef === null`;
- enables Save only when a Deck and exact version are selected.

Do not add browser-specific parallel deck-reading paths to work around a local failure. Fix the shared store contract or picker logic instead.

## Tournament Day state

`participation.tournamentDay` is lightweight lifecycle/workspace state only, currently including timestamps such as:

- `startedAt`
- `lastOpenedAt`
- `lastRoundAt`
- `finishedAt`

It may also contain mutable decision-support workspace state under `tournamentDay.idCalc`, including event setup, current opponent standings snapshots and the user's current matchup-confidence input. These are current-event state, not historical Match facts.

Round results are deliberately not duplicated inside `tournamentDay`.

The current record and round history are derived from shared Matches linked by `participationId`.

## Match / Game contract

Every competitive tournament round is stored through `PTCGMatchStore` with:

- stable Match `id`;
- source/evidence context;
- `participationId`;
- optional catalogue event ID plus event-name snapshot;
- exact `deckId + deckVersionId + listHash` when a played deck is attached;
- deck/version display snapshots;
- opponent archetype;
- Win / Loss / Draw result;
- round label;
- optional notes;
- Games representing entered game-by-game results.

Editing a round reuses the same Match ID and `put()` replaces that record.

Deleting a round removes that Match ID from MatchStore.

This prevents correction flows from creating duplicate competitive evidence.

### Game entry semantics

Normal round entry is game-by-game:

- Game 1 W/L/T;
- Game 2 W/L/T;
- Game 3 W/L/T where required;
- aggregate Match W/L/D derived from those entered Games.

First/second is not part of the current Tournament Day capture requirement.

### ID

An intentional draw is displayed distinctly as **ID** rather than a normal played draw.

The current implementation retains a compatibility marker for ID in Match notes while using the canonical Match result as draw. A future cleanup may introduce an explicit canonical outcome kind such as `played | id | bye | no-show`, but only if done centrally in the Match contract rather than as Tournament Day-only metadata.

## Round-history UX

Round rows are compact, iPhone-first records of the opponent and result.

The intended hierarchy is:

**R# · vs · opponent sprite(s) + opponent archetype · game sequence · match-result badge**

The player's own deck sprites are **not repeated in every round row**. The deck is already visible once in the compact My Deck control above the history.

Opponent deck names may wrap to two lines when useful rather than forcing horizontal compression.

Result presentation:

- Win → green circular **W**;
- Draw → amber/orange circular **D**;
- Loss → red circular **L**;
- ID → neutral/dark circular **ID**.

The game sequence remains visible beside the main result, e.g. `W W`, `W L T`, `L L`.

## Canonical archetype sprite presentation

Tournament Day round rows must use the same archetype presentation engine as Settings / Meta.

Current canonical source:

`v2-preview/apps/meta/sprites.js` → `window.DeckSprites`

`DeckSprites` owns:

- built-in archetype→sprite defaults;
- one/two-sprite user overrides from Settings → Deck icons;
- sprite slugs;
- sprite URL generation / HTML rendering.

Tournament Day must resolve configured `DeckSprites` mappings first. Name parsing via `PTCGSprites` is fallback only for archetypes that genuinely have no configured/shared mapping.

This is a general architecture rule: when a presentation/domain concern already has a shared engine, feature pages consume that engine rather than reimplementing inference locally.

## Current-record derivation

Tournament Day derives W-L-D and rounds completed from participation-linked Match records using the shared MatchStore statistics contract.

No second W-L-D counter is persisted in the live Tournament Day workspace.

## Completion contract

Completing an event writes `participation.completion` and changes attendance to `attended`.

Completion currently captures:

- completion timestamp;
- final placement;
- final player count;
- final W-L-D snapshot;
- rounds completed;
- exact `usedDeckRef` snapshot;
- optional notes.

The linked Match/Game history remains the authoritative per-round evidence.

Past events in `needs-completion` use the same Tournament Day/completion workspace rather than a separate historical-result form.

## Cut / ID boundary

A reusable deterministic/recommendation engine lives at:

`v2-preview/apps/_shared/cut-id-engine.js`

The standalone Tools Cut / ID surface remains available for advanced/manual calculations. Tournament Day exposes the normal in-event workflow through an `ID Calc` action using the same shared engine.

The old `v2-preview/apps/swiss` application is a separate standalone tournament manager backed by its own store and is not an appropriate Tournament Day result store.

### Contextual Tournament Day ID workflow

Tournament Day automatically supplies the user's current W-L-D from canonical Match history. Opening ID Calc asks only for decision-relevant current information:

- tournament player count, cut size and total Swiss rounds;
- current W-L-D records of previous opponents;
- the next opponent's current record;
- a lightweight five-level confidence rating for the next matchup;
- current W-L-D records for players around the cut who could still affect the user's ID outcome.

Previous opponents' current records must not be written into the historical Match record. They change as the event progresses, so they belong in mutable `tournamentDay.idCalc` state keyed by Match ID.

The user may explicitly confirm that the entered near-cut standings include everyone who can still reach the user's ID score. Only then may the tool treat omitted lower-table players as mathematically irrelevant. Without that confirmation, the output is labelled as a recommendation/lean rather than a mathematical lock.

### Resistance and recommendation separation

Opponent Win Percentage is estimated from the current records of all previous opponents and uses the Play! Pokémon Win Percentage concept with the 25% floor.

The result must keep three concepts visibly separate:

1. deterministic points/cut bound;
2. current resistance estimate;
3. subjective next-match confidence.

Matchup confidence may influence the ID vs Play recommendation, but must never change the deterministic cut bound or be presented as measured match-win probability.

Current bounded rule:

- one-round/final-Swiss-round ID decision support;
- Pokémon points including draws;
- Top N cut size;
- deterministic maximum-above / maximum-at-or-above conclusions when the relevant standings set is asserted complete;
- current Op Win % estimate from previous opponents' current records;
- lightweight qualitative ID-vs-Play recommendation;
- standalone pairing-aware conservative calculator remains available under Tools;
- no hidden empirical tie-rate default;
- no probabilistic simulation.

Future Cut / ID expansion should extend the reusable Tools engine rather than embedding competing calculation logic in Tournament Day.

## Navigation and cache architecture

Tournament Day entry points exist from:

- Event cards;
- My Tournaments;
- Record tournament;
- Event Prep.

These routes must all open the same current `tournament-day.html?participation=<id>` implementation.

Do not maintain feature-specific historical `?build=YYYY...` pins. Those were development cache workarounds and caused different routes to reopen different generations of Tournament Day.

The service worker must not serve stale HTML before checking the network during normal online navigation. As of 4 September 2026, application HTML/navigation is **network-first with cached fallback**, while suitable static/versioned assets remain cacheable.

This is important because stale document HTML can reference an older local asset generation even when GitHub Pages itself is current.

## UX / performance locks

Tournament Day is mobile-first around ~390 CSS px and answer-first:

- linking to an Event is optional rather than a prerequisite;
- deck selection is optional before/during rounds;
- current W-L-D is primary;
- next-round action remains prominent;
- `ID Calc` is a lightweight contextual action beside completion;
- compact My Deck control represents the exact used deck once;
- round history is compact, editable and opponent-focused;
- routine entry uses taps and mobile-safe 16 px form inputs;
- nested Tournament Day navigation remains inside the existing Compete child view and does not replace the five-area persistent shell;
- no full-page reload is required after saving/editing/deleting a round.

## Current implementation status — 4 September 2026

Tournament Day v1 is **substantially implemented and in acceptance/cleanup**, including:

- event-linked and ad-hoc tournament records;
- My Tournaments in-page Events tab;
- Current/Upcoming/Completed/Archived lifecycle views;
- exact current-date semantics for Current;
- optional used-deck selection and exact DeckVersion linkage;
- game-by-game W/L/T round entry;
- ID capture/display;
- opponent archetype search;
- shared configured archetype sprites;
- W/L/D/ID round badges;
- derived tournament record;
- contextual ID Calc;
- completion flow;
- canonical Match/Game writes;
- network-first HTML navigation to prevent apparent regression to older cached UI.

Remaining work should be treated as acceptance/cleanup rather than an excuse to expand the feature indefinitely.

## Release-hardening requirement

Before calling the broader app stable, perform a deliberate repository-wide hardening pass that includes:

- remove dated/development navigation query pins;
- delete obsolete legacy Tournament Day deck-summary/render paths rather than only hiding them;
- consolidate temporary enhancer scripts into core implementations where safe;
- remove dead compatibility shims once migrations are no longer needed;
- verify one canonical sprite/presentation engine is used everywhere;
- audit service-worker cache strategy and asset versions;
- search the repo for stale build IDs / old routes;
- verify current GitHub Pages SHA and iPhone behavior before declaring a stable release.

## Deferred

This milestone does not add:

- Championship Point calculations;
- Best Finish Limits;
- full Season dashboard;
- Collection readiness;
- Learning/personal analytics;
- Playtest evidence crossover;
- probabilistic Cut / ID simulation.

Competitive Record / Season remains the intended next major downstream milestone after Tournament Day acceptance/cleanup and central Roadmap review.
