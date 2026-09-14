# PTCG Tools — Master Product & Design Document

> **Operational entry:** read [CURRENT_STATE.md](CURRENT_STATE.md) for baseline, live state and active branch/PR. This document retains its product/design role. Shared-calendar consumer integration is implemented on open [PR #60](https://github.com/lthorpe18/ptcg-tools/pull/60), not yet merged at the 14 September audit. Historical research in `ptcg-meta-analysis` has a separate roadmap.

**Status:** Current product source of truth  
**Date:** 13 September 2026  
**Repository:** `lthorpe18/ptcg-tools`  
**Public app:** `https://lthorpe18.github.io/ptcg-tools/`  
**Current roadmap handoff:** `ROADMAP_HANDOFF_2026-09-13.md`  
**Companion architecture docs:** `PERFORMANCE_ARCHITECTURE.md`, `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md`, `PLAYTEST_ARCHITECTURE.md`, `TOURNAMENT_DAY_ARCHITECTURE.md`, `SEASON_ARCHITECTURE.md`, `CARD_IMAGE_ARCHITECTURE.md`, `CARD_SEARCH_ARCHITECTURE.md`, `HOME_ARCHITECTURE.md`, `TOOLS_ARCHITECTURE.md`, `WHAT_SHOULD_I_PLAY_ARCHITECTURE.md`

## 1. Product vision

PTCG Tools is a **personal-first, public-ready competitive Pokémon TCG companion** covering the full loop:

**Analyse → Build & Test → Prepare → Compete → Learn**

It should feel like one coherent mobile application rather than a collection of utilities. The primary target is an iPhone portrait experience around 390 CSS px, with desktop as an adaptive expansion.

The product should answer:

1. What is the current competitive field?
2. What should I play into it?
3. How should I build, version and test my deck?
4. Where and when can I play?
5. How should I prepare for a specific event?
6. What happened in my actual games and tournaments?
7. What should I practise next?
8. How is my Championship Series season progressing?

Long-term connected loop:

**Meta → deck choice → deck development/testing → Event Prep → Tournament Day → Season → personal learning → next deck/practice decision.**

Collection / physical-card readiness will eventually join that loop, but remains deliberately deferred.

---

## 2. Product principles

### Decision first, methodology second

Show the useful answer first. Evidence, assumptions and advanced controls remain available through progressive disclosure.

### Mobile first

- compact information density;
- comfortably tappable controls;
- 16 px mobile-safe form inputs;
- safe-area handling;
- no workflow depending on hover or precision dragging;
- avoid wide desktop-first tables on iPhone.

### One product, one shared engine per shared concern

If a shared engine exists, feature pages consume it. They do not create a second primary implementation.

This applies to:

- deck/archetype sprites;
- format/date/environment resolution;
- Match/Game evidence;
- field/recommendation logic;
- card metadata/art;
- Season calculations;
- Cut / ID calculations.

### Correctness before polish

Do not conflate:

- planned deck with played deck;
- Games with tournament Matches;
- personal evidence with public H2H;
- set boundaries with individual-card legality;
- cached old application generations with current deployed state.

### Personal-first, public-ready

- private state is account-scoped;
- shared/public data is stored separately from personal snapshots;
- provenance is retained where practical;
- cross-device restoration works;
- no essential public workflow should depend on every browser independently scraping upstream services.

---

## 3. Current V2 application structure

V2 is the active implementation under `v2-preview/`.

Top-level product areas:

**Home · Meta · Decks · Compete · Tools**

Settings is app-level rather than a sixth competitive domain.

### Feature ownership

**Home** — derived competitive dashboard and contextual shortcuts. Owns no competitive business logic.

**Meta** — Online / IRL / Blended competitive evidence, exact-variant analysis, Expected Fields, What Should I Play and Prediction Accuracy.

**Decks** — saved decks, immutable versions, Card Search/Add Card, Mobile Playtest, Results and Game Log.

**Compete** — event discovery, attendance, Online tournaments, Event Prep, Tournament Day and Season.

**Tools** — Cut / ID, standalone Tournament Manager and generic Odds/probability utilities.

**Settings** — Account & Sync, Preferences, Data/backup and authorised Maintenance.

---

## 4. Shared identity and presentation locks

### Deck / DeckVersion identity

A Deck is a long-lived personal project with:

- stable Deck ID;
- user-facing name;
- explicit archetype classification;
- mutable working list;
- immutable DeckVersions/checkpoints;
- canonical `listHash` per exact list.

Historical evidence must use canonical IDs/list references where available. Do not guess old evidence onto a Deck merely because names or archetypes look similar.

### One canonical deck/archetype sprite renderer

The one app-wide renderer is:

`v2-preview/apps/_shared/deck-sprites.js` → `window.DeckSprites.html()`

It owns:

- archetype defaults;
- account-owned Deck icon overrides;
- sprite source/slug resolution;
- one/two-sprite composition;
- dominant primary + smaller circular secondary badge;
- contextual sizing hooks;
- pixel-art rendering behavior.

Home, Meta, Decks, Game Log, Results, My Events and Tournament Day consume it. Feature pages may size/position the whole returned stack but must not recreate the composition locally.

---

## 5. Evidence model — locked

The app-wide rule is:

**Personal deck/matchup/version learning = Games**  
**Tournament record / standings / completion / Season = Matches**  
**Public Meta H2H = separate global evidence**

A best-of-three tournament Match can therefore contribute one tournament Match result and multiple individual Game observations to personal learning.

Personal Game evidence never overwrites or contaminates public/global H2H evidence.

Solo/goldfish Mobile Playtest does not create competitive W/L evidence.

---

## 6. Home — accepted current state

Home is a derived dashboard, not a directory and not a source of truth.

Accepted iPhone hierarchy:

1. **Blended Meta** hero;
2. **Decks | Events** personal row;
3. **Card Search | Cut / ID | Playtest | Tournament** quick actions;
4. **What should I play?** entry;
5. persistent five-area bottom navigation.

The Home format pill shows the current Online format context. Home consumes shared Meta/Deck/Event/Season state and the canonical sprite renderer.

The next format-specific integration package must make the **published shared format calendar** authoritative for that current-format context rather than leaving Home on older checked-in/current-release assumptions.

See `HOME_ARCHITECTURE.md`.

---

## 7. Meta — current architecture

### Sources and exact variants

Online and IRL are distinct evidence sources. Blended is a prediction derived from them.

Variant families are presentation-only:

**Families describe the meta; variants play games.**

Matchups, results and What Should I Play operate on exact variants.

### Blended field

Settled-format weighting remains:

`IRL = max(30%, 70% - 2 percentage points × days since latest compatible IRL major weekend)`

`Online = 100% - IRL`

A Blended prediction requires at least one compatible Online tournament with 50+ players. During Online/IRL set-transition windows, separate format-labelled predictions may exist.

### What Should I Play

Accepted flow:

**Field → Recommendations → direct exact-variant inspection**

Shared `PTCGMetaField` owns field semantics and shared `PTCGRecommendation` owns evidence-aware ranking/explanation.

Missing matchups remain unknown. Evidence coverage is explicit. Event-specific choice belongs in Event Prep rather than a separate Compare and Decide feature.

### Prediction Accuracy

Prediction Accuracy has current scoring/history UI and immutable prediction archive. Formula fitting/versioning should wait for enough genuine scored majors unless a structural flaw appears earlier.

Known baseline validation debt remains documented in the roadmap.

---

## 8. Formats, sets and card legality — current state

The format foundation resolves date/environment independently for Online and IRL.

Settings → Maintenance → **Formats & Sets** is implemented and edits one shared application calendar through an authorised persistence path.

Current user-facing maintenance model:

- set code;
- set name;
- physical release date;
- Online legality date;
- IRL legality date;
- optional rotation metadata;
- blank date = unknown;
- one visible **Save changes** action.

There is no user-facing Announced/Confirmed status workflow and no whole-set regulation-mark claim.

### Card-legality authority

Individual card legality is determined from **that printing's own `regulationMark`** against the resolved environment/date format.

Rotation is defined by the set of legal card regulation marks after rotation. Set boundaries may still be retained for readable format labels and meta grouping, but they are not authority for individual-card legality.

The canonical resolver exposes card-level legality through the shared format foundation rather than feature-local inference.

### Shared-data boundary

Format/set calendar data is shared application data, not account preference state. Ordinary users may read it; only authorised maintainers may edit it.

Checked-in maintained data remains bootstrap/fallback, with validated last-known-good behaviour underneath the shared store.

### Immediate integration gap

The maintenance surface is complete, but the published shared calendar still needs to become the authoritative runtime input for every consumer: Home, Meta/WSIP, Event Prep and relevant card-legality checks.

---

## 9. Accounts, sync and Settings — current state

Google sign-in through Supabase Auth is implemented.

Per-account persistence currently uses a schema-versioned `user_snapshots` row protected by RLS. Durable personal state includes:

- Decks and DeckVersions;
- event participations;
- Match/Game history;
- Deck icon/preferences state;
- Saved Expected Fields;
- Prep/Tournament Day/completion state.

The top-level shell owns sync lifecycle. Cross-device restoration is established.

### Settings organisation

Settings is now a compact hub with focused drill-in pages:

- **Account & Sync** — compact signed-in identity and sync health;
- **Preferences → Deck icons**;
- **Data → App data / backup & export**;
- **Maintenance → Formats & Sets** — maintainer-only.

Substantial editors should continue to live on focused subpages rather than making the Settings landing page an ever-longer form.

Shared format data is separate from user snapshots.

See `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md`.

---

## 10. Decks — current state

### Workspace

The Decks experience is centred on:

**My Decks · Game Log**

Card Search remains a reusable Decks capability available from Deck workflows and direct navigation, but is not required to be a peer high-level tab everywhere.

Inside a saved Deck:

**Overview · List · Results**

### Deck Results

Results supports:

- **Archetype** scope;
- **Deck** scope (default);
- **Version** scope.

Outputs include:

- Game W-L-D;
- game win rate;
- matchup breakdown by opponent archetype;
- Deck or Version breakdown appropriate to scope;
- recent Games;
- tournament Match record as secondary context where relevant.

Small samples must remain visibly small samples.

### Game Log

Game Log is the unified chronological browser over canonical Game evidence. Default **All games** includes:

- PTCGL training;
- manual in-person training;
- Tournament Day Games;
- Online tournament Games.

It uses `PTCGMatchStore`; there is no second log/result store.

Tournament rows open Tournament Day; training rows remain editable through the training workflow.

Current tournament filter hierarchy:

- All games;
- Training;
- Tournaments — all;
- Online;
- Local / League;
- Challenge;
- Cup;
- Majors — all;
- Regional;
- Special Event;
- International;
- Worlds.

Tournament classification uses event/participation metadata, not source labels.

### Mobile Playtest

Mobile Playtest remains Decks-owned, transient/local, touch-first and manual rather than a rules engine. It does not automatically create competitive evidence.

See `PLAYTEST_ARCHITECTURE.md`, `CARD_SEARCH_ARCHITECTURE.md` and `CARD_IMAGE_ARCHITECTURE.md`.

---

## 11. Compete — current state

Compete owns the lifecycle:

**Discover → Interested/Attending → Prepare → Play → Complete → Season**

One `UserEventParticipation` carries that lifecycle.

### Discovery

Current discovery includes local/major event sources and **Online** tournament discovery.

Compete → Online is future-facing Limitless discovery with:

- future tournaments only;
- name and start time as essential fields;
- Standard + PTCGL default;
- UK-time selector default 17:00–22:00;
- format-specific card treatment;
- durable attendance through existing participation state;
- results through the same Tournament Day / Match/Game path;
- saved participation surviving discovery-feed expiry.

### Event Prep

Event Prep v1 is implemented with event-date format selection, Expected Field, selected/planned exact list and immutable lock semantics.

`plannedDeckRef` and `usedDeckRef` remain separate. A planned list must never silently become the played list.

### Tournament Day

Tournament Day:

- may start from event-linked or ad-hoc participation;
- does not require deck selection before rounds;
- records game-by-game W/L/T and derives Match W/L/D;
- supports IDs;
- records opponent archetype;
- uses canonical sprites;
- edits/replaces stable Match records rather than duplicating them;
- requires exact used DeckVersion/list identity before final completion.

Completion now allows:

- **blank placement = Dropped**;
- **blank player count = unknown**;
- later corrections may replace Dropped with a real placement;
- Season must not invent CP without sufficient placement/player-count facts.

See `TOURNAMENT_DAY_ARCHITECTURE.md`.

### Season

Season v1 remains accepted for the 2027 Championship Series, using versioned CP/BFL rules and completed participation history. Season is a derived read model, not a second editable history store.

See `SEASON_ARCHITECTURE.md`.

---

## 12. Tools — current state

Tools contains:

**Cut / ID · Tournament · Odds**

- Cut / ID uses one shared engine and is also exposed contextually in Tournament Day;
- Tournament Manager is a standalone organiser utility and does not create Compete participation/Match/Season evidence;
- Odds owns generic Draw / Outs, Opening and Prize probability helpers.

Further Tools work is bugfix/polish unless a genuinely useful standalone utility earns a place.

---

## 13. Technical architecture direction

Plain HTML/CSS/JavaScript remains acceptable. Do not introduce a framework rewrite merely for modernization.

Shared responsibilities include:

- persistent shell/navigation;
- auth/session lifecycle;
- cloud sync;
- one canonical deck/archetype sprite renderer;
- exact-card metadata/search and artwork resolution;
- Match/Game store;
- personal-results aggregation;
- Deck store/version identity;
- shared format/rotation/card-legality resolver;
- shared maintained format calendar;
- shared Meta field/recommendation engines;
- Season engine;
- Cut / ID engine;
- service-worker/cache strategy.

Prefer:

`external/shared source → one normalized PTCG Tools layer → all users`

rather than every browser independently recreating shared truth.

---

## 14. Current roadmap — 13 September 2026

### Completed / substantially established

- persistent V2 shell and performance baseline;
- Home dashboard;
- Meta Online / IRL / Blended;
- Format/Rotation foundation;
- Expected Fields;
- What Should I Play;
- Prediction Accuracy current UI/archive;
- Deck identity/version/listHash model;
- Card Search/Add Card;
- Mobile Playtest;
- Deck Results v1;
- unified Game Log;
- strict Games-vs-Matches and personal-vs-public evidence boundaries;
- canonical app-wide DeckSprites renderer;
- event discovery/attendance;
- Online tournament discovery;
- Event Prep v1;
- Tournament Day v1;
- Season v1;
- Settings hub reorganisation;
- shared maintainer-editable Formats & Sets;
- Google auth and cross-device persistence;
- Tools review.

### Immediate next sequence

1. **Shared format-calendar consumer wiring** — Home / Meta / WSIP / Event Prep / card legality.
2. **Personal Matchup Analysis** — extend Deck Results over canonical Game evidence, with useful source/environment splits and public-H2H reference kept strictly separate.
3. **Practice Priorities** — expected field share × matchup difficulty × personal evidence.
4. **Event Prep v2** — Expected Field → exact selected deck/list → three practice priorities → readiness → Tournament Day.
5. **Deck Version Intelligence** — exact list diffs, evidence by version, tournament usage and useful lineage.
6. **Prediction Accuracy maturation/fitting** when enough genuine scored majors justify it.
7. **Release Hardening / data safety / installed-iPhone regression**.
8. **Collection / physical readiness** only when explicitly reopened.

A broad generic UI consistency pass is not a roadmap milestone. Continue solving concrete real-use defects in bounded packages.

### Known validation debt

Two unrelated baseline failures are currently known:

- `prediction-snapshots.test.mjs` publication lookup;
- `wsip-formats.test.js` live/current-release expectation drift (`Unknown` expectation vs current strong recommendation).

Do not conflate these with unrelated feature regressions. Repair them in the appropriate Meta/release-hardening work.

---

## 15. Release-hardening milestone

Before calling the app stable/public-ready, perform a deliberate cleanup pass covering:

- stale build/revision pins;
- dead legacy UI/runtime layers;
- duplicate feature-local engines;
- Card Search/GLC helper consolidation;
- Playtest card-art helper audit;
- service-worker/cache generation;
- asset version consistency;
- account export/backup;
- sync failure/recovery;
- deployment SHA verification;
- installed-iPhone end-to-end regression.

The goal is to reduce drift and stale-code regressions, not refactor for aesthetics alone.

---

## 16. Product success criteria

PTCG Tools is successful when:

- it feels like one coherent product;
- repeat navigation is immediate;
- account-owned state follows the user across devices;
- Home is useful competitive context rather than a launcher;
- Meta communicates exact source/format/evidence semantics correctly;
- What Should I Play produces evidence-aware exact-variant decisions;
- Decks preserves exact DeckVersion identity through testing and tournament history;
- Game Log provides one chronological personal Game history without duplicating stores;
- personal matchup learning uses Games while tournament/Season record uses Matches;
- personal data never contaminates public H2H;
- configured deck/archetype sprites are consistent everywhere through one renderer;
- shared format facts can be maintained in-app without per-user divergent calendars;
- card legality follows each printing's regulation mark;
- Event Prep flows naturally into Tournament Day and Season;
- dropped tournaments and unknown player counts are represented honestly;
- future Practice Priorities are derived from existing evidence rather than a parallel store;
- Collection can later answer physical-readiness questions without replacing current identity models;
- advanced methodology remains available without dominating routine mobile use.

Historical checkpoint documents remain useful evidence for how the current contracts were reached. Where an older checkpoint/handoff conflicts with this 13 September 2026 master state, this document, the current roadmap handoff and updated companion architecture documents take precedence.
