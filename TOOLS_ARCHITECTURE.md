# PTCG Tools — Tools Architecture

**Status:** Accepted current-stage source of truth  
**Date:** 5 September 2026  
**Area:** `v2-preview/apps/tools`

## 1. Purpose and ownership

Tools is the home for **small standalone competitive utilities that do not belong to Meta, Decks or Compete**.

Current accepted top-of-area navigation:

**Cut / ID · Tournament · Odds**

The segmented control is local to Tools and sits inside the persistent five-area app shell. It must not create a second shell or bottom-navigation layer.

Ownership boundaries remain:

- Mobile Playtest → Decks;
- Card Search/Add Card → Decks;
- Event discovery, Event Prep, Tournament Day, real tournament records and Season → Compete;
- Meta modelling / Expected Fields → Meta;
- Collection/readiness → Collection;
- standalone Cut / ID engine/tool → Tools;
- standalone organiser Tournament Manager → Tools;
- generic card probability helpers → Tools.

Tools must not become a dumping ground for unrelated product features.

---

## 2. Cut / ID

Cut / ID is a core Tools utility and the shared calculation source for contextual Tournament Day ID support.

Canonical shared engine:

`v2-preview/apps/_shared/cut-id-engine.js`

The standalone Tools UI and Tournament Day must consume the same engine rather than implementing competing calculations.

Current principles:

- Pokémon Swiss records include W/L/D;
- points use 3/1/0 semantics;
- deterministic reasoning comes first;
- Top N cuts are supported;
- known pairings and known IDs may constrain the deterministic ceiling;
- output should distinguish guaranteed, unsafe and tiebreak/resistance-dependent outcomes;
- no hidden empirical tie-rate assumptions;
- simulation is not the default and should only be added when deterministic information genuinely cannot answer the user’s question clearly.

Home’s Cut / ID quick action continues to deep-link directly to this Tools-owned utility.

---

## 3. Tournament Manager

### 3.1 Product role

Tournament Manager is a **standalone organiser utility** for running an independent local tournament/group event.

It is deliberately separate from Compete/Tournament Day.

**Tools → Tournament Manager** means:

> Run a tournament for a group.

**Compete → Tournament Day** means:

> Play in and record my tournament.

Tournament Manager must not create or synchronize:

- Compete Events;
- `UserEventParticipation`;
- Tournament Day records;
- canonical Match/Game evidence;
- Season/CP/BFL records.

Organiser tournaments remain local to Tournament Manager.

### 3.2 Storage

The native V2 Tournament Manager continues to use the existing local IndexedDB `tournaments` store in `ptcg-tools-db` so older locally-created organiser tournaments are not stranded.

Database opening must use the current database version rather than hard-coding an obsolete IndexedDB version. If the organiser store is genuinely absent, a safe version bump may create it.

### 3.3 Current native workflow

Tournament Manager is natively rendered inside Tools; the old Swiss manager must not be exposed as an iframe/legacy screen.

Current in-tournament subnavigation:

**Run · Players · Standings**

The accepted workflow supports:

- create/open/delete local organiser tournaments;
- Casual, Cup, Challenge, League and Other tournament labels;
- Best of 1 / Best of 3;
- configurable Swiss rounds;
- No top cut / Top 4 / Top 8 / Top 16;
- player add/remove before Swiss starts;
- saved-player suggestions for the active authenticated user;
- Swiss pairing generation with repeat-opponent avoidance where possible;
- byes;
- W/L/D result entry;
- live standings;
- records shown in pairing rows as the record entering that round;
- resistance-style standings/tiebreak display;
- native Top Cut flow;
- round timer and full-screen round-clock mode.

### 3.4 Pairing/result interaction

Mobile result entry is answer-first and one-thumb friendly.

For Swiss, each pairing is represented by three clear choices using player names themselves as result buttons:

**Player 1 · vs · Player 2 · Tie**

The two players have equal visual prominence. The selected result is visually filled/active.

Top Cut matches are single-elimination and therefore expose only the two player win choices; there is no Tie option.

Each player button shows the W-L-D record **entering that round**. Historical rounds must not be relabelled later with a player’s final record.

### 3.5 Round action

The primary round action remains above the round list.

State semantics:

- current round incomplete → disabled `Complete Round N`;
- current non-final Swiss round complete → enabled `Generate Round N+1`;
- final planned Swiss round complete with no cut → `Swiss complete`;
- final planned Swiss round complete with configured cut → `Start Top N`;
- incomplete cut stage → disabled `Complete <stage>`;
- completed cut stage with another stage remaining → `Generate <next stage>`;
- completed final → `Tournament complete`.

Newest/current rounds are rendered above older rounds.

### 3.6 Top Cut

Top Cut is native Tournament Manager state, not a Compete integration.

Swiss final standings determine seeds.

Standard bracket seeding is used. For Top 8, the initial bracket order is:

**1v8 · 4v5 · 2v7 · 3v6**

The cut then advances through single-elimination stages until a champion is produced.

Swiss standings remain Swiss standings; Top Cut results do not rewrite Swiss records.

Tournament library winner display:

- no Top Cut → final #1 Swiss player, only after all planned Swiss rounds are complete;
- with Top Cut → actual Top Cut champion, only after the final is complete.

### 3.7 Saved players

Saved player names are an authenticated-user convenience only.

Rules:

- names are stored only when an authenticated account is resolved;
- storage is namespaced by authenticated user ID;
- signed-out users do not read or write remembered names;
- another account on the same device must not see another user’s saved-player list;
- selecting a saved player **immediately adds that player** to the current tournament rather than merely populating the text field;
- players already entered in the current tournament are filtered from the picker;
- visible/current tournament names may seed the active user’s saved list.

The Tools child view should reuse the persistent shell’s already-authenticated cloud/session state rather than bootstrapping a duplicate Supabase client.

### 3.8 Round clock

Tapping the compact tournament timer opens a dedicated round-clock mode.

Accepted behavior:

- visually fills the app viewport;
- persistent app header/navigation is hidden while open;
- dark high-contrast presentation;
- very large tabular countdown digits;
- prominent tournament name;
- prominent current round / cut-stage label;
- one simple Pause / Resume control;
- tap elsewhere on the clock to return to pairings;
- timer state is the same underlying tournament timer — never a second countdown;
- best-effort Fullscreen API request may be used where supported;
- on iPhone/PWA, system status indicators may remain because the web app cannot reliably remove them.

The persistent shell owns the temporary full-viewport expansion and must restore its normal state when the clock closes.

---

## 4. Odds

Odds is the generic standalone card-maths area.

Current modes:

**Draw / Outs · Opening · Prizes**

All three use the shared exact combinatorics helper:

`v2-preview/apps/_shared/probability.js`

The helper uses exact hypergeometric probabilities rather than simulation.

### Draw / Outs

Answers questions such as:

> 4 live outs in 40 cards, draw 2 — what is the chance to hit at least one?

### Opening

Answers generic opening-hand copy questions, e.g. the probability of seeing at least one of N copies in a chosen opening-hand size.

### Prizes

Answers Pokémon-specific prize-location questions, such as at least/exactly N copies being among the prizes, under the explicit uniform-distribution assumptions shown in the UI.

Deck-specific consistency modelling should remain Decks-owned rather than expanding Odds into another deck-analysis workspace.

---

## 5. UX and shell rules

Tools is iPhone-first, compact and answer-first.

Preferred interaction pattern:

**inputs → headline answer/action → compact detail**

Avoid desktop-first tables and long methodology blocks in routine use.

The persistent shell remains sole owner of bottom navigation. Tools must not load a duplicate shell or duplicate cloud/auth bootstrap.

The app may temporarily hide shell chrome for the Tournament round clock, but this is a bounded presentation mode and not a second navigation architecture.

Navigation/document HTML remains network-first; versioned static assets may be cache-busted when deployment verification requires it.

---

## 6. Deferred Tools work

Do not expand the current accepted Tools pass into:

- a second Compete/event database;
- a second Tournament Day/history system;
- deck-version comparison;
- Meta/matchup modelling;
- Collection/readiness;
- Season/CP/BFL;
- broad simulation/tie-rate modelling;
- a full Pokémon rules engine.

The legacy `v2-preview/apps/swiss` implementation is no longer the visible product surface. Useful behavior has been brought into the native Tools Tournament Manager; remaining legacy cleanup belongs to Development Cleanup / Release Hardening.

---

## 7. Current acceptance status

The Tools product-surface pass is accepted for the current stage after iterative real-iPhone testing of the native Tournament Manager and round clock.

Accepted current top-level Tools surface:

**Cut / ID · Tournament · Odds**

The active roadmap therefore moves to **Collection / physical readiness v1**. Further Tools work should be bounded bugfix/polish only unless a genuine new utility clearly earns a place and respects the ownership boundaries above.
