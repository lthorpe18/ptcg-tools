# PTCG Tools — Tournament Day / Results Architecture

**Status:** Accepted Tournament Day v1 source of truth; September personal-results and sprite contracts incorporated  
**Date:** 12 September 2026  
**Companion to:** `PTCG_TOOLS_MASTER.md`, `PERFORMANCE_ARCHITECTURE.md`, `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md`

## Purpose

This document records the accepted architecture established by the Tournament Day + event-linked results implementation and the subsequent September personal-results work.

The canonical account-owned record throughout is one `UserEventParticipation` in the V2 root state. Tournament Day is not a second tournament/history model layered on top of Events.

## Ownership locks

- Compete owns Events, attendance, Event Prep, Tournament Day, real tournament results and Competitive Record / Season.
- Deck and DeckVersion identity remain Decks-owned.
- Cut / ID remains Tools-owned at engine/standalone-tool level, while Tournament Day owns the lightweight contextual decision workflow.
- Real tournament rounds use the shared Match/Game contract in `v2-preview/apps/_shared/match-store.js`.
- Tournament Day does not create a second match-history/result store.
- Tournament standings/Season records are **match-level**; personal deck/matchup learning consumes the **Games underneath those Matches** as individual game evidence.
- Training Log excludes Tournament Day records even though both domains share the same canonical Match/Game store.
- Solo/goldfish Mobile Playtest remains outside competitive W/L evidence.
- Cross-app archetype/deck sprite presentation is owned by the one shared `DeckSprites.html()` renderer in `v2-preview/apps/_shared/deck-sprites.js`. Tournament Day must not maintain a competing archetype→sprite mapping or local two-sprite renderer.

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
- real Matches/Games;
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

**Optional catalogue attendance / Prep → Tournament Day → Completion → Season**

or:

**Record tournament → Tournament Day → Completion → Season**

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

Opening Tournament Day for an uncompleted participation starts the Tournament Day workspace immediately by creating lightweight `tournamentDay` timestamps if required. **Deck selection is not a start gate.**

## My Tournaments surface

My Tournaments is an in-page Compete / Events view alongside Nearby, Majors and Season.

The Events header and page shell remain identical across all views. My Tournaments must not navigate to a separate top-level page or duplicate the Events title/header.

Primary lifecycle filters are:

- **Current** — tournaments whose event date is literally today;
- **Upcoming** — future-dated uncompleted tournaments;
- **Incomplete** — past/undated tournament records without completion;
- **Completed** — completed tournament records.

Archived is secondary recovery/cleanup state rather than an equal primary lifecycle tab.

Default behaviour:

- open Current when at least one tournament is dated today;
- otherwise open Upcoming.

Ordering:

- Current / Upcoming: nearest date first;
- Incomplete / Completed / Archived: most recent first.

Tournament cards show event identity, date/type/status, used deck where present, W-L-D, round count and compact management actions. `usedDeckRef` is the only deck reference that may be presented as the deck actually played.

My Tournaments uses the same shared `DeckSprites.html()` renderer as Home, Meta, Decks, Settings and Tournament Day. A two-Pokémon identity is always composed by that renderer as one dominant primary sprite with a smaller circular secondary badge. Compete may request a contextual size but must not compose the images itself.

## Planned list vs used list

`plannedDeckRef` and `usedDeckRef` are deliberately separate concepts.

Event Prep may write `plannedDeckRef` with exact Deck identity:

- `deckId`
- `deckVersionId`
- `listHash`

Tournament Day does **not** require a deck before rounds can begin.

The user can open Tournament Day and record rounds with no deck selected. At any time they may attach, change or remove the exact deck actually played. Saving that selection writes `usedDeckRef`.

The compact Tournament Day deck control is the only live deck-selection UI:

- no deck → compact **My Deck** control;
- selected deck → canonical shared sprite visual in that same compact control;
- tapping either state opens the deck/version picker;
- selecting a deck/version updates existing participation-linked Match records with the same exact deck reference;
- removing the tournament deck clears `usedDeckRef` and the corresponding deck fields on those Matches.

The former large `Playing / Deck not selected / Saved deck · Exact list` summary and the old pre-round deck-selection start card were deleted during the acceptance cleanup. They are no longer hidden compatibility UI.

A planned deck may be used as a picker suggestion, but must never silently become `usedDeckRef` merely because it was planned.

`usedDeckRef` includes the exact Deck/DeckVersion/list identity plus display snapshots such as deck name, version label and archetype where available.

Tournament Day must never rewrite an immutable historical DeckVersion.

## Deck picker architecture

Tournament Day reads saved decks through the shared `PTCGDeckStore` rather than opening/reimplementing IndexedDB independently.

The picker:

- opens immediately on tap;
- may show loading state while deck records resolve;
- lists saved Decks and exact versions;
- preselection tolerates `usedDeckRef === null`;
- enables Save only when a Deck and exact version are selected.

The compact deck slot renders identity through `DeckSprites.html()` and therefore inherits the same one/two-sprite composition and Settings overrides as every other feature surface.

A core acceptance fix refreshes the participation from shared storage before deck-sensitive round-save and completion actions. This prevents a deck selection made by the picker from being missed by an older in-memory participation object.

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
- Win / Loss / Draw **Match result**;
- round label;
- optional notes;
- Games representing entered game-by-game results.

Editing a round reuses the same Match ID and `put()` replaces that record.

Deleting a round removes that Match ID from MatchStore.

This prevents correction flows from creating duplicate competitive evidence.

### Match-level vs game-level evidence

The distinction is now explicit and app-wide:

- **Tournament record, standings, completion and Season** use the Match result. A 2–1 round is one tournament Match win.
- **Personal deck/matchup analysis** uses the individual Games beneath the Match. A 2–1 round contributes three game observations to personal deck/matchup evidence.
- **Training Log** is also game-level for its summaries/analytics, but it deliberately excludes Tournament Day Matches from the Training workspace.
- Personal game evidence never overwrites or contaminates public/global H2H evidence.

Consumers must not collapse tournament Games into one personal-learning data point merely because they share a parent Match, and must not inflate tournament standings by treating Games as tournament Matches.

### Game entry semantics

Normal round entry is game-by-game:

- Game 1 W/L/T;
- Game 2 W/L/T;
- Game 3 W/L/T where required;
- aggregate Match W/L/D derived from those entered Games.

First/second is not part of the accepted Tournament Day v1 capture requirement.

### ID

An intentional draw is displayed distinctly as **ID** rather than a normal played draw.

The accepted v1 implementation retains the `[ID]` compatibility marker in Match notes while using the canonical Match result as draw. This is deliberately left as a non-blocking compatibility detail. A future central Match-contract change may add an explicit outcome kind such as `played | id | bye | no-show`, but Tournament Day must not invent a private parallel result field.

## Round-history UX

Round rows are compact, iPhone-first records of the opponent and result.

The accepted hierarchy is:

**R# · vs · canonical opponent sprite visual + opponent archetype · game sequence · match-result badge**

The player's own deck sprites are **not repeated in every round row**. The deck is already visible once in the compact My Deck control above the history.

Opponent deck names may wrap to two lines when useful rather than forcing horizontal compression.

Result presentation:

- Win → green circular **W**;
- Draw → amber/orange circular **D**;
- Loss → red circular **L**;
- ID → neutral/dark circular **ID**.

The game sequence remains visible beside the main result, e.g. `W W`, `W L T`, `L L`.

## Canonical archetype/deck sprite presentation

There is exactly one renderer for deck/archetype identity across PTCG Tools:

`v2-preview/apps/_shared/deck-sprites.js` → `window.DeckSprites.html()`

That shared module owns:

- built-in archetype→sprite defaults;
- one/two-sprite user overrides from **Settings → Deck icons**;
- sprite slug/source resolution;
- primary + circular-secondary composition;
- contextual sizing hooks;
- pixel-art rendering behavior.

Tournament Day, My Tournaments and all other Compete surfaces call `DeckSprites.html()`. They must not call `DeckSprites.slugs()` / `DeckSprites.url()` to compose a local identity and must not fall back to a separate `PTCGSprites` renderer for ordinary deck/archetype presentation.

Feature CSS may size or align the returned whole stack but must not pull its primary/secondary children into a feature-specific composition.

This is a general architecture rule: when a presentation/domain concern already has a shared engine, feature pages consume that engine rather than reimplementing inference locally.

## Current-record derivation

Tournament Day derives W-L-D and rounds completed from participation-linked **Match** records using the shared MatchStore statistics contract.

No second W-L-D counter is persisted in the live Tournament Day workspace.

Separately, Decks personal-results analysis may read the Games beneath those same Matches for game-level learning. That derived personal analysis does not change the tournament Match record.

## Completion contract

Completing an event writes `participation.completion` and changes attendance to `attended`.

Completion captures:

- completion timestamp;
- final placement;
- final player count;
- final W-L-D **Match** snapshot;
- rounds completed;
- exact `usedDeckRef` snapshot;
- optional notes.

The linked Match/Game history remains the authoritative per-round evidence.

Past events in `needs-completion` use the same Tournament Day/completion workspace rather than a separate historical-result form.

The accepted v1 completion flow requires the user to attach the exact deck actually used before completion so the historical completion snapshot can retain exact list identity. This does not block round entry.

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

All accepted routes open the same current:

`tournament-day.html?participation=<id>`

Do not maintain feature-specific historical `?build=YYYY...` pins. Those were development cache workarounds and caused different routes to reopen different generations of Tournament Day.

The service worker must not serve stale HTML before checking the network during normal online navigation. Application HTML/navigation is **network-first with cached fallback**, while suitable static/versioned assets remain cacheable.

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

## Acceptance status — 12 September 2026

**Tournament Day v1 remains accepted/complete for the current product stage.**

The September Deck Results/Training work clarified downstream evidence semantics without changing the canonical tournament model:

- tournament W-L-D / completion / Season remain Match-level;
- the individual Games under tournament Matches are reusable game-level personal learning evidence;
- Training Log stays a separate game-level practice workspace and excludes Tournament Day records;
- exact Deck/DeckVersion/list attribution remains canonical;
- personal results never become public H2H evidence.

The canonical sprite refactor through PR #44 also removed Compete-local deck identity composition. My Tournaments, Tournament Day selected-deck controls and opponent rows now consume the one shared `DeckSprites.html()` renderer.

The existing accepted Tournament Day contracts remain:

- event-linked and ad-hoc tournament records use one participation model;
- Tournament Day opens/starts without a mandatory deck selection;
- compact My Deck is the only deck-selection surface;
- used deck can be selected, changed and removed, with linked Match deck references reconciled;
- game-by-game Win/Loss/played Draw and ID use the canonical Match/Game store;
- editing a round replaces the stable Match rather than creating a duplicate;
- tournament W-L-D is derived from linked Matches;
- completion writes placement/player count/final record/used-deck snapshot to the same `UserEventParticipation`;
- all Tournament Day entry routes are canonical current routes.

The final deployed code still requires ordinary real-device smoke testing whenever future changes touch layout, service-worker behaviour or Safari-specific interaction; acceptance does not make automated tests a substitute for iPhone visual verification.

## Remaining non-blocking technical debt

These items do not block Tournament Day v1 acceptance:

- `tournament-day-history-v2.js` and `tournament-day-optional-deck.js` remain separate bounded helper modules rather than being fully merged into the core script;
- the `[ID]` note marker remains the accepted compatibility representation for intentional draws;
- hidden result/score compatibility inputs remain because the game-by-game entry adapter still feeds the core save contract through them;
- broader repository-wide legacy pages, build pins and enhancer consolidation belong to the later Development Cleanup / Release Hardening milestone.

## Deferred

This milestone does not add:

- further Season expansion beyond the accepted current Season v1;
- Collection readiness;
- practice-priority recommendations;
- public-H2H crossover from personal evidence;
- Playtest evidence crossover;
- probabilistic Cut / ID simulation.

Personal Performance is now expected to build on the canonical game-level evidence contract rather than inventing another results store.
