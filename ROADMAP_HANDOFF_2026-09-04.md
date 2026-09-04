# PTCG Tools — Roadmap Handoff — 4 September 2026

**Purpose:** central coordination handoff after substantial implementation of Tournament Day / My Tournaments and the associated cache/shared-engine cleanup.

Read first:

- `PTCG_TOOLS_MASTER.md`
- `TOURNAMENT_DAY_ARCHITECTURE.md`
- `PERFORMANCE_ARCHITECTURE.md`
- `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md`
- `PLAYTEST_ARCHITECTURE.md`

## Current programme state

The previous 3 September handoff made Tournament Day the active milestone after Mobile Playtest v1.

As of 4 September 2026:

> **Tournament Day v1 is substantially implemented and should now be treated as an acceptance/cleanup milestone rather than an open-ended feature build.**

The primary end-to-end loop now has working structural coverage through:

**Analyse → Build & Test → Prepare → Compete**

with **Learn** and physical readiness/Collection still incomplete.

## What Tournament Day / My Tournaments now includes

### Events / My Tournaments

- My Tournaments is a true third in-page Events tab beside Nearby and Majors;
- the same Events header/shell remains visible across all three views;
- filters are Current / Upcoming / Completed / Archived;
- no All filter;
- Current means **literally tournaments dated today**;
- if none are today, My Tournaments defaults to Upcoming;
- Upcoming is future-dated only;
- Current/Upcoming sort nearest first;
- Completed/Archived sort most recent first;
- cards show event identity, date/type/status, used deck where present, W-L-D and round count;
- archive/delete/remove-deck management exists.

### Tournament Day

- event-linked and ad-hoc tournament entry use the same `UserEventParticipation` model;
- a tournament can start without choosing a deck;
- compact **My Deck** control is the only intended live deck-selection surface;
- selected deck is exact `usedDeckRef` with Deck/DeckVersion/list identity;
- planned deck remains separate and may only preselect/suggest;
- deck can be changed or removed later;
- saved Decks/versions load through the shared Deck store;
- game-by-game W/L/T round entry;
- aggregate Match W/L/D derived from Games;
- intentional draw displayed as ID;
- opponent archetype search;
- current W-L-D derived from canonical participation-linked Matches;
- contextual ID Calc uses the shared Tools engine;
- completion writes back to the same participation.

### Round-history presentation

Current intended row:

**R# · vs · opponent sprite(s) + archetype · game sequence · result badge**

- the user's own deck is not repeated in every row;
- opponent names may wrap to two compact lines;
- Win = green circular W;
- Draw = amber/orange circular D;
- Loss = red circular L;
- ID = neutral/dark circular ID.

### Shared sprite architecture

Tournament Day originally developed a local name-based Pokémon resolver. That was an architectural mistake because Settings/Meta already owned the canonical `DeckSprites` archetype presentation mapping.

Current lock:

- `DeckSprites` is the canonical source for configured archetype sprites and user overrides;
- Tournament Day consumes it first;
- name parsing is fallback only;
- future features must reuse established shared engines instead of independently recreating them.

This should be treated as a general architecture lesson for all future work.

## Cache/navigation regression resolved

During Tournament Day iteration the UI sometimes appeared to revert to an older saved state after navigating around the app.

The underlying causes were not user data rollback:

1. multiple entry routes had historical hard-coded `?build=...` Tournament Day links;
2. the service worker served navigation HTML stale-while-revalidate/cache-first, so an old document could be shown before the current network version.

Current architecture:

- historical dated Tournament Day navigation pins removed;
- canonical routes use `tournament-day.html?participation=<id>`;
- service-worker generation bumped to `ptcg-tools-v18`;
- **online navigation HTML is network-first with cached fallback**;
- static/versioned assets remain cacheable.

Do not reintroduce scattered dated build IDs as the normal solution to stale assets.

## Known cleanup rather than feature expansion

Before declaring Tournament Day accepted/stable, perform a short bounded cleanup pass:

- delete the legacy large `deckSummary` / Playing render path rather than merely hiding it;
- consolidate temporary Tournament Day enhancement layers into core where safe;
- remove dead compatibility code after confirming migrations are no longer needed;
- verify all Tournament Day entry routes use the canonical current URL;
- verify configured one/two-sprite overrides render consistently;
- complete at least one realistic mobile tournament-entry/round-edit/completion test;
- verify no apparent old-state regression after navigating away/back.

Do not add Championship Points, Collection, Learn analytics or broad new Tournament Day features during this cleanup pass.

## Release-hardening milestone added

Before a future stable/public-ready release, the roadmap must include a formal:

**Development Cleanup / Release Hardening**

Repository-wide tasks:

- search/remove dated `?build=` and temporary revision pins;
- remove orphaned/legacy standalone pages no longer used;
- delete hidden obsolete UI/render paths;
- consolidate feature enhancer scripts into core implementations where sensible;
- eliminate duplicated cross-app engines;
- audit service-worker/cache-generation strategy;
- normalize asset versioning;
- verify current deployment SHA and iPhone behavior;
- keep architecture docs synchronized with the code after cleanup.

This is functional hardening, not aesthetic refactoring.

## Recommended next roadmap decision

The central Roadmap should now decide the immediate sequence between:

### A. Short Tournament Day acceptance/cleanup

Recommended first. Keep it strictly bounded and close the milestone.

### B. Competitive Record / Season v1

Recommended next major product milestone after Tournament Day acceptance.

Scope should include:

- completed Championship-event record;
- placement/player count;
- competitive season identity;
- verified season-specific Championship Point rules;
- raw CP vs counting CP;
- Best Finish Limits;
- clear provenance/manual-correction handling;
- no duplicate history entity outside `UserEventParticipation` + Match/Game.

### C. Collection / readiness

Still a later major milestone:

- owned quantities;
- physical allocations;
- missing/shopping list;
- exact DeckVersion/event-plan integration.

### D. Learn loop

Later:

- personal matchup/tournament analytics;
- event/deck/version history;
- practice evidence kept distinct from competitive Match evidence.

## Recommended roadmap order

1. **Tournament Day acceptance / cleanup**
2. **Competitive Record / Season v1**
3. **Collection / physical readiness**
4. **Learn / personal analytics**
5. **Development Cleanup / Release Hardening** before calling the broader app stable/public-ready (or bring forward individual hardening tasks whenever they become blockers)
6. community/public expansion only if useful

The broader loop remains:

**Analyse → Build & Test → Prepare → Compete → Learn**
