# PTCG Tools — Roadmap Handoff — 4 September 2026

**Purpose:** central coordination handoff after acceptance and cleanup of Tournament Day / My Tournaments v1.

Read first:

- `PTCG_TOOLS_MASTER.md`
- `TOURNAMENT_DAY_ARCHITECTURE.md`
- `PERFORMANCE_ARCHITECTURE.md`
- `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md`
- `PLAYTEST_ARCHITECTURE.md`

## Current programme state

As of 4 September 2026:

> **Tournament Day v1 is accepted/complete for the current product stage. The bounded cleanup pass is closed.**

The primary loop now has working structural coverage through:

**Analyse → Build & Test → Prepare → Compete**

with **Learn** and physical readiness/Collection still incomplete.

Tournament Day should not remain an open-ended implementation programme. Future changes should be genuine bug fixes, evidence from real tournament use, or work explicitly scheduled by the central Roadmap.

## Accepted Tournament Day / My Tournaments scope

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
- archive/delete/remove-deck management exists;
- deck sprites use the shared `DeckSprites` engine and account-owned one/two-sprite overrides.

### Tournament Day

- event-linked and ad-hoc tournament entry use the same `UserEventParticipation` model;
- opening an uncompleted Tournament Day creates/updates the lightweight tournament workspace immediately;
- there is no deck-selection start gate;
- compact **My Deck** is the only live deck-selection surface;
- the legacy large Playing/deck summary and pre-round deck-selection card have been deleted rather than merely hidden;
- selected deck is exact `usedDeckRef` with Deck/DeckVersion/list identity;
- planned deck remains separate and may only preselect/suggest;
- deck can be selected, changed or removed later;
- changing/removing the played deck reconciles the deck fields on existing participation-linked Matches;
- saved Decks/versions load through the shared Deck store;
- game-by-game W/L/T round entry;
- aggregate Match W/L/D derived from Games;
- intentional draw displayed distinctly as ID;
- opponent archetype search;
- current W-L-D derived from canonical participation-linked Matches;
- contextual ID Calc uses the shared Tools engine;
- completion writes placement/player count/final record/used deck back to the same participation.

### Round-history presentation

Accepted row:

**R# · vs · opponent sprite(s) + archetype · game sequence · result badge**

- the user's own deck is not repeated in every row;
- opponent names may wrap to two compact lines;
- Win = green circular W;
- Draw = amber/orange circular D;
- Loss = red circular L;
- ID = neutral/dark circular ID.

### Shared sprite architecture

`DeckSprites` is the canonical source for configured archetype sprites and user overrides across Settings / Meta / Compete.

Tournament Day round rows consume it first, with Pokémon-name parsing only as fallback for genuinely unmapped archetypes. The compact My Deck control and My Tournaments cards now also use `DeckSprites` directly rather than maintaining separate primary name parsers.

General architecture lock:

> If a shared engine already owns a cross-feature concern, feature pages consume it rather than creating a second primary implementation.

## Acceptance / cleanup completed

The bounded closure pass:

- deleted the legacy `deckSummary` / Playing render path;
- deleted the old mandatory pre-round deck picker/start gate;
- removed the dead deck-summary history enhancer and associated CSS;
- retained the compact optional-deck helper as a bounded module rather than risking a broad core merge;
- removed duplicate sprite inference from the compact deck slot and My Tournaments cards;
- fixed a stale in-memory participation issue by refreshing shared participation state before deck-sensitive round saves and completion;
- verified all four Tournament Day entry routes use `tournament-day.html?participation=<id>`;
- retained service-worker v18 network-first navigation HTML behavior;
- fixed the small My Tournaments date validity check while touching that code;
- kept only compatibility paths still used by the game-by-game entry contract.

A deterministic Match/participation acceptance harness covered:

- start with no used deck;
- deck select/change/remove/reattach;
- Win, Loss, played Draw and ID;
- editing a stable Match without increasing Match count;
- derived W-L-D;
- same-participation completion with placement/player count and final used-deck snapshot.

The example acceptance state finished `2-0-2` across four linked Matches after editing one existing round; the Match count remained four.

The service-worker and route inspection verifies the prior stale-document regression class is removed architecturally. As always, future cache/layout changes still require real iPhone smoke testing before claiming visual acceptance.

## Non-blocking technical debt left deliberately

- `tournament-day-history-v2.js` and `tournament-day-optional-deck.js` remain separate bounded helper modules; fully folding them into core is deferred to release hardening unless real use exposes a problem.
- ID still uses the accepted `[ID]` note compatibility marker with canonical draw result.
- hidden result/score fields remain because the visible game-by-game entry layer still deliberately feeds the core Match save contract through them.
- broader orphaned pages, historical compatibility code and repository-wide build/version cleanup remain part of the formal Development Cleanup / Release Hardening milestone.

None of these block Tournament Day v1 acceptance.

## Cache/navigation contract carried forward

The previous apparent UI regressions were caused by old hard-coded build routes plus stale-first navigation HTML, not user data rollback.

Current architecture remains:

- canonical Tournament Day routes with semantic participation ID only;
- service-worker generation `ptcg-tools-v18`;
- online navigation HTML network-first with cached fallback;
- suitable versioned/static assets remain cacheable;
- do not reintroduce scattered dated `?build=` navigation pins.

## Recommended next roadmap decision

Tournament Day is no longer the active milestone.

The next major product milestone should now be reviewed centrally as:

**Competitive Record / Season v1**

Expected scope remains:

- completed Championship-event record using the existing `UserEventParticipation` history;
- placement/player count;
- competitive season identity;
- verified season-specific Championship Point rules;
- raw CP vs counting CP;
- Best Finish Limits;
- provenance/manual-correction handling;
- no duplicate history entity outside `UserEventParticipation` + Match/Game.

Do not start Season implementation from this handoff without central Roadmap review.

Later candidates remain:

- Collection / physical readiness;
- Learn / personal analytics;
- broader Cut / ID sophistication only where real tournament use demonstrates value.

## Release-hardening milestone

Before a future stable/public-ready release, perform formal **Development Cleanup / Release Hardening**:

- repository-wide search/remove dated build/revision pins;
- remove orphaned/legacy standalone pages no longer used;
- delete hidden obsolete UI/render paths;
- consolidate helper/enhancer modules into core where it reduces real complexity without introducing regression risk;
- eliminate duplicated cross-app engines;
- audit service-worker/cache generations and asset versioning;
- verify current deployment SHA and iPhone behavior;
- keep architecture docs synchronized.

This is functional hardening rather than aesthetic refactoring.

## Recommended roadmap order

1. **Competitive Record / Season v1** — subject to central Roadmap confirmation
2. **Collection / physical readiness**
3. **Learn / personal analytics**
4. **Development Cleanup / Release Hardening** before calling the broader app stable/public-ready, with individual hardening fixes brought forward whenever they become blockers
5. community/public expansion only if useful

The broader loop remains:

**Analyse → Build & Test → Prepare → Compete → Learn**
