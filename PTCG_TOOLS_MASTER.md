# PTCG Tools — Master Product & Design Document

**Status:** Current product source of truth  
**Date:** 4 September 2026  
**Repository:** `lthorpe18/ptcg-tools`  
**Public app:** `https://lthorpe18.github.io/ptcg-tools/`  
**Companion architecture docs:** `PERFORMANCE_ARCHITECTURE.md`, `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md`, `PLAYTEST_ARCHITECTURE.md`, `TOURNAMENT_DAY_ARCHITECTURE.md`

## 1. Product vision

PTCG Tools is a **personal-first, public-ready** competitive Pokémon TCG companion covering the full competitive loop:

**Analyse → Build & Test → Prepare → Compete → Learn**

It should feel like one coherent native-style mobile application rather than a collection of unrelated utilities. The primary experience is an iPhone home-screen web app, with desktop treated as an adaptive expansion of that mobile experience.

The app should help answer the recurring competitive questions:

1. **What should I play?** — understand the current field and identify exact deck variants positioned well into it.
2. **How should I build and test it?** — manage decklists, versions, consistency and mobile playtesting.
3. **What do I need physically?** — understand owned cards, allocations, missing cards and deck readiness.
4. **Where and when can I play?** — discover relevant local and major events and track attendance intent.
5. **How should I prepare?** — connect event, expected meta, deck choice, testing and final list.
6. **What should I do during a tournament?** — track results and make informed cut / ID decisions.
7. **What did I learn?** — retain results, testing and matchup evidence for future decisions.

PTCG Tools is not intended to replace Pokémon TCG Live with a fully rules-enforced client. Mobile Playtest is a fast, flexible, touch-first tabletop.

The long-term product opportunity is the connected layer for one player:

**Meta → deck choice → deck development/testing → physical readiness → event preparation → tournament-day decisions → review/learning.**

Account-backed persistence makes that workflow longitudinal and device-independent.

---

## 2. Product principles

### 2.1 Decision first, methodology second

Surface the useful answer before exposing detailed methodology.

Examples:

- “This exact variant is best positioned into your expected field.”
- “These matchups are driving that recommendation.”
- “ID is safe / unsafe because this many players can still finish above you.”
- “You are missing these cards to build this exact list.”

Evidence, assumptions and advanced controls remain available through progressive disclosure.

### 2.2 Mobile first

Primary design width is approximately **390 CSS px**.

Rules:

- no desktop-first horizontal tables on iPhone;
- compact information density;
- comfortably tappable controls;
- form/search inputs at 16 px or larger on iPhone;
- safe-area handling for home-screen use;
- no workflow should depend on hover or precise drag-and-drop.

### 2.3 One product, one design system, one shared engine per shared concern

All areas should share:

- app shell/navigation;
- typography/colour tokens;
- cards/surfaces;
- forms/segmented controls;
- loading/empty/error states;
- searchable-list patterns;
- persistence conventions;
- Pokémon sprite treatment.

A concern that is conceptually shared across features should have **one canonical engine**.

The September 2026 sprite regression established this as an explicit architecture lock: Settings/Meta already owned the `DeckSprites` archetype→sprite mapping, while Tournament Day had independently inferred Pokémon from names. That duplication caused inconsistent output.

Rule:

> **If a shared engine exists, feature pages consume it. They do not recreate a second primary implementation.**

Feature-local inference is allowed only as a genuine fallback for unsupported data.

### 2.4 Pokémon character without clutter

Sprites are identity, not decoration.

Representative deck sprites:

- identify archetypes/variants/decks;
- may contain one or two Pokémon;
- have built-in defaults;
- may be overridden in **Settings → Deck icons**;
- never alter deck identity, family grouping, field share or matchup data.

The canonical sprite mapping/render source is `window.DeckSprites` from the shared Meta sprite module until/unless that functionality is moved into an even more neutral shared module.

### 2.5 Fast defaults, explicit evidence

The app should work immediately without configuration, but analytical pages must make evidence scope understandable.

Online and IRL Meta evidence are distinct datasets. Source/scope selectors must genuinely change the underlying evidence.

### 2.6 Correctness before polish

Data semantics matter more than decorative UI.

A deck page must not present global dataset counts as though they are deck-specific samples. Planned deck and played deck must not be conflated. A cached older document must not be mistaken for current user state.

### 2.7 Personal-first, public-ready

Build the strongest product for the primary user while preserving future community/public viability:

- account-scoped user state;
- cross-device restoration;
- shared/public data separated from private personal data;
- retained source provenance;
- no silent dependence on unauthorized scraping as a permanent public contract;
- independent PTCG Tools branding.

---

## 3. Current V2 application state

V2 is the active product direction and the public GitHub Pages root routes into it.

Implementation lives under:

`v2-preview/`

Top-level product areas:

**Home · Meta · Decks · Compete · Tools**

Settings is app-level rather than a sixth competitive domain.

### Source-of-truth rule

For new work, inspect current GitHub V2 implementation first. Legacy `apps/*` code must not silently drive new architecture.

Feature chats are focused workspaces, not independent architecture authorities. Durable changes to ownership, identity, persistence or cross-feature relationships must be promoted into this document or the relevant companion architecture document.

### Validation rule

Before claiming a significant change is complete:

1. inspect current GitHub state;
2. explain the implementation approach for substantial changes;
3. modify V2 rather than legacy code;
4. run relevant validation workflows where applicable;
5. verify GitHub Pages deploys the exact intended SHA;
6. do not claim mobile visual acceptance until it has actually been tested.

---

## 4. Feature ownership

### Home

Personal competitive dashboard and contextual shortcuts.

### Meta

Public competitive evidence, exact-variant analysis and Expected Fields.

### Decks

Saved decks, working lists, immutable checkpoints/versions, deck maths, Mobile Playtest and eventual physical readiness integration.

### Compete

Events, attendance, Event Prep, Tournament Day, real tournament results and Competitive Record / Season.

### Tools

Small standalone competitive utilities only.

### Settings

Account, app preferences, deck-icon overrides and future storage/import/export controls.

### Ownership locks

- **Mobile Playtest belongs to Decks.**
- **Event finder belongs to Compete.**
- **Meta modelling belongs to Meta.**
- **Expected Fields belong to Meta as one reusable account-owned model; Compete selects/adjusts/snapshots them for Prep.**
- **Deck and DeckVersion identity belongs to Decks.**
- **Real tournament result entry belongs to Compete and writes the shared Match/Game contract.**
- **Solo/goldfish Playtest never creates competitive W/L.**
- **Cut / ID engine/standalone utility belongs to Tools and is contextually exposed in Tournament Day.**
- **Collection is cross-cutting, connected to Decks, Prep and Home.**
- **Competitive seasons / CP / BFL belong to Compete.**

---

## 5. Global shell, caching and performance

### 5.1 Persistent five-area shell

The production shell keeps the five core areas mounted after first load:

**Home · Meta · Decks · Compete · Tools**

Routine section switching changes the active view instead of rebuilding the application from scratch.

This is a production performance requirement.

### 5.2 OAuth exception

Google OAuth deliberately escapes child views and navigates at the top level, then returns to PTCG Tools.

Do not trap third-party OAuth inside the persistent child iframe.

### 5.3 Service worker

Static/versioned assets and generated data may use stale-while-revalidate caching where appropriate.

**Navigation/document HTML is network-first as of 4 September 2026.**

Reason: the previous stale-first navigation strategy could reopen an older cached Tournament Day page after the user had already seen a newer deployment. That appeared as saved-state/UI regression even though the underlying user state had not reverted.

Current rule:

- online document navigation → network first;
- successful response updates cache;
- cached document is offline/error fallback;
- static JS/CSS/images remain cacheable/versioned.

Service-worker generation was bumped to `ptcg-tools-v18` for this transition.

### 5.4 No scattered dated navigation pins

Development-era links such as `?build=20260903-...` must not remain distributed across feature entry points.

They caused different routes to target different application generations and interacted poorly with service-worker navigation caching.

Canonical internal routes should point to the current document plus semantic identifiers only, e.g.:

`tournament-day.html?participation=<id>`

Any temporary development revision mechanism must have one explicit owner and be removed in release hardening.

See `PERFORMANCE_ARCHITECTURE.md` for the complete cache/performance contract.

---

## 6. Home

Home is a competitive dashboard, not a directory.

Priority content:

- current format/context;
- high-value route into What Should I Play;
- current Meta snapshot;
- recently used/edited deck context;
- next-event/attendance context;
- eventual current-season/CP context;
- compact shortcuts to Decks, Events and Cut / ID.

Only show personal modules when meaningful data exists.

---

## 7. Meta — locked architecture

### 7.1 Sources are evidence, not themes

Online and IRL are distinct evidence sources.

Source and scope selections must actually drive the data.

### 7.2 Online scopes

Required scopes:

- Last 14 days;
- Last 30 days;
- Since last major weekend;
- All in format.

Same-weekend IRL majors merge when defining the latest major weekend.

### 7.3 IRL scopes

Required scopes:

- Latest IRL majors weekend;
- All IRL majors this format;
- Individual event.

The scope model must behave consistently across Current Meta, Matchups, Deck Explorer, Deck Detail and What Should I Play.

### 7.4 Exact variants vs families

Variant grouping is only a Current Meta field-share presentation layer.

Rules:

- no family pages;
- grouped families expand inline to exact variants;
- matchup/WR/results/deck detail belong to exact variants;
- What Should I Play analyses exact variants.

Short form:

**Families describe the meta; variants play games.**

### 7.5 Expected Fields

An Expected Field is a named, reusable, account-owned prediction of what will be played.

It may be created from:

- current Online scope;
- current IRL scope;
- individual IRL event/weekend;
- transparent blend preset;
- another Expected Field;
- blank/custom starting point where useful.

Saving copies the current evidence into an editable prediction with provenance. It is not a silent live link to future Meta changes.

Compete/Prep uses the same records, may make event-specific adjustments, and preserves an immutable Event Expected Field snapshot when finalised.

### 7.6 Matchups and exact deck detail

Matchups are exact-variant to exact-variant evidence.

Deck detail must distinguish:

- field sample = exact variant’s entries across selected field events;
- matchup sample = head-to-head games involving that exact variant.

Do not substitute overall tournament sample counts for deck-specific samples.

### 7.7 Shared Meta runtime

Direction:

- **MetaState** — source/scope state;
- **MetaData** — evidence/data access;
- **MetaControls** — shared source/scope behavior;
- **DeckSprites** — canonical archetype presentation mapping/rendering.

Avoid page-specific reimplementations of those concerns.

---

## 8. Accounts, persistence and Settings

### 8.1 Authentication

Google sign-in through Supabase Auth is implemented and proven across devices.

Google is the only provider for now.

No Gmail/Drive/Contacts access is requested. OAuth secrets remain server-side.

### 8.2 Cloud persistence

Current per-account persistence uses one schema-versioned `user_snapshots` row per user protected by Supabase RLS.

Durable personal state includes:

- Decks and embedded DeckVersions;
- root V2 state including `eventParticipations`;
- real Match/Game history;
- preferences/deck icon overrides;
- saved Expected Fields.

Local changes auto-sync; cross-device restore has been tested successfully.

The sync controller belongs to the top-level shell.

### 8.3 Snapshot vs normalized future tables

The whole-account snapshot remains pragmatic while the product model evolves.

Normalize domains only when concrete query/conflict/history/scale/collaboration needs justify it.

### 8.4 Settings → Deck icons

Deck icon overrides are account-owned presentation preferences.

The shared `DeckSprites` engine owns:

- built-in defaults;
- one/two-Pokémon overrides;
- sprite slugs/URLs/rendering.

Every feature displaying archetype sprites should consume this mapping first.

---

## 9. Decks

### 9.1 Deck identity

A Deck is the long-lived personal project/identity.

It contains:

- stable Deck ID;
- user-facing name;
- separately stored exact archetype classification;
- mutable working list;
- embedded immutable DeckVersion/checkpoint records;
- canonical `listHash` values.

Deck name and archetype are separate concepts.

### 9.2 Version model

- working list may change;
- checkpoints/DeckVersions are immutable exact lists;
- every exact list has canonical `listHash`;
- same canonical list reuses the matching checkpoint instead of creating duplicates;
- historical references use `deckId + listHash`, plus `deckVersionId` where a saved checkpoint was selected;
- historical display snapshots survive later rename/deletion.

### 9.3 Mobile Playtest

Mobile Playtest v1 is feature-complete pending ordinary acceptance/cleanup.

It is:

- Decks-owned;
- solo/goldfish;
- touch-first;
- iPhone-first;
- manual/flexible after setup rather than a partial rules engine.

Ordinary actions render in place and use the core Undo path. No normal `location.reload()` interaction flow.

Transient tabletop state is local browser work-in-progress and is not automatically cloud-synced.

See `PLAYTEST_ARCHITECTURE.md`.

### 9.4 Match evidence boundary

Real PTCGL/in-person results use the shared Match/Game contract.

Playtest observations are a separate future practice-evidence domain and never alter competitive matchup W/L statistics.

---

## 10. Collection / physical readiness

Long-term requirement:

> Maintain exact owned quantities and allocations so the user can immediately see what must be bought, moved or freed up for a saved exact deck list.

The model must support:

- exact printing/card identity where relevant;
- gameplay equivalence where appropriate;
- loose inventory;
- deck allocations;
- multiple simultaneously built decks;
- prevention of accidental double-allocation;
- required vs owned vs allocated;
- missing/shopping lists.

Collection connects to Decks, Prep and Home.

---

## 11. Compete / Events

Compete owns:

**Discover → Interested/Attending → Prepare → Play → Complete → Season record**

The same `UserEventParticipation` progresses through that lifecycle.

### 11.1 Event sources

Local discovery primarily uses Pokédata for Cups/Challenges/Prereleases.

Majors use official Pokémon Championship Series data as existence/date authority and may be enriched by RK9 for practical outbound details where appropriate.

Source provenance is retained.

### 11.2 Events UI

The main Events surface has one persistent shared header and three in-page views:

**Nearby · Majors · My Tournaments**

My Tournaments must not navigate to a separate page/header.

Its filters are:

- **Current** — literally tournaments dated today;
- **Upcoming** — future-dated tournaments;
- **Completed** — completed records;
- **Archived** — archived records.

There is no All filter.

Default:

- Current when at least one tournament is today;
- otherwise Upcoming.

Ordering:

- Current/Upcoming → nearest first;
- Completed/Archived → most recent first.

### 11.3 Event lifecycle and retention

`UserEventParticipation` is the canonical account-owned relationship.

It retains:

- attendance intent/status;
- event snapshot;
- Prep;
- `plannedDeckRef`;
- `usedDeckRef`;
- Tournament Day state;
- Matches via `participationId`;
- completion;
- future season identity.

Historic shared local feed rows are not required once a user has a retained participation snapshot.

Past Attending events without completion become Needs completion rather than silently implying results were entered.

### 11.4 Event Prep

Event Prep v1 is implemented.

Normal journey:

1. mark event Attending;
2. review suggested Expected Field;
3. consider a small candidate set;
4. record lightweight reactions;
5. choose/import an exact list;
6. play/record tournament;
7. retain event/list/field snapshot for later learning.

Prep orchestrates Meta/Decks/evidence; it does not duplicate their domain ownership.

### 11.5 Planned deck vs used deck

`plannedDeckRef` and `usedDeckRef` are separate concepts.

Prep may plan an exact `deckId + deckVersionId + listHash`.

Tournament Day may start without any deck selected. The user can attach/change/remove the exact deck actually played at any point.

A planned deck may be suggested in the picker but must never silently become the played deck.

### 11.6 Tournament Day v1 — current state

Tournament Day + event-linked results is now **substantially implemented and in acceptance/cleanup**.

Implemented behavior includes:

- start from an Event-linked participation or create an ad-hoc tournament;
- same canonical `UserEventParticipation` lifecycle;
- no mandatory deck gate before rounds;
- compact **My Deck** control for selecting/changing/removing exact used DeckVersion;
- game-by-game W/L/T capture;
- aggregate Match W/L/D;
- ID capture/display;
- opponent archetype search;
- opponent-only compact round history;
- one/two configured opponent sprites from shared `DeckSprites` mapping;
- opponent names allowed to wrap compactly;
- large circular result badges: Win green, Draw amber/orange, Loss red, ID neutral/dark;
- current W-L-D derived from canonical Matches;
- contextual ID Calc using shared Tools engine;
- completion into `UserEventParticipation.completion`.

Round row hierarchy:

**R# · vs · opponent sprite(s) + name · game sequence · result badge**

The user’s own deck is shown once at the top and is not repeated in every round record.

See `TOURNAMENT_DAY_ARCHITECTURE.md`.

### 11.7 Competitive Record / Season

Competitive seasons are first-class entities; calendar year is not an adequate substitute.

Future Season v1 should derive:

- raw CP;
- counting CP;
- BFL exclusions;
- goal progress;
- event-level CP from verified season-versioned official rules.

Historical seasons must retain the ruleset version used. Do not recalculate old seasons with new rules.

Do not create duplicate tournament histories inside Decks or Analytics.

---

## 12. Tools

Tools is for small standalone competitive utilities that do not belong in Meta, Decks or Compete.

### Cut / ID

Requirements:

- real Pokémon Swiss records including draws;
- deterministic possible-cutoff logic first;
- support Top N cut sizes;
- account for known pairings/IDs where supplied;
- no hidden empirical tie-rate assumptions;
- probabilistic simulation only when deterministic information is insufficient and explicitly justified.

Tournament Day uses the same shared engine contextually.

---

## 13. Technical architecture direction

Plain HTML/CSS/JavaScript remains acceptable. Do not introduce a heavy framework merely for modernization.

Strengthen shared layers instead.

Shared responsibilities include:

- persistent shell/navigation;
- app-level auth/session lifecycle;
- cloud sync;
- design tokens/forms/list patterns;
- persistence/preferences;
- archetype sprite mapping/rendering;
- caching/service worker;
- shared Match/Game store;
- shared Deck store;
- shared Cut/ID engine;
- shared source/scope runtime where applicable.

Domain logic remains separated among Meta, Decks, Compete, Collection and Tools.

### Shared upstream direction

As usage grows, prefer:

`external source → PTCG Tools ingestion/cache → normalized shared data → all users`

rather than every browser independently hitting upstream services.

### Source adapters

Long-term normalized entities include Tournament, TournamentResult, Decklist, Match, Event and Card.

Adapters should retain provenance and access classification such as Official API, Explicit permission, Public data, Scraped or User supplied.

---

## 14. Current roadmap status — 4 September 2026

### Completed / substantially established

- V2 design language and production persistent shell;
- navigation-performance milestone;
- service-worker/static-data caching baseline;
- network-first navigation HTML fix preventing stale-page regressions;
- Google authentication and cross-device account persistence;
- Meta source/scope architecture and exact-variant analysis;
- Expected Fields;
- Deck working-list/version/hash foundation;
- shared Match/Game contract;
- Mobile Playtest v1;
- Event discovery/attendance/retention foundation;
- Event Prep v1;
- My Tournaments in-page lifecycle view;
- Tournament Day v1 core recording/results flow;
- contextual Cut / ID workflow;
- canonical shared archetype sprite mapping now reused by Tournament Day.

### Active status

**Tournament Day v1 is substantially implemented.** Remaining work should be bounded acceptance/cleanup, not uncontrolled feature expansion.

The central Roadmap should now review whether to:

1. finish the short Tournament Day cleanup/acceptance pass;
2. perform any immediate cross-feature architecture cleanup revealed by this implementation;
3. then move to **Competitive Record / Season v1** as the next major product milestone.

### Next major milestones

1. **Tournament Day acceptance / cleanup** — verify normal tournament use, remove legacy/dead UI paths and ensure current shared engines are actually canonical.
2. **Competitive Record / Season v1** — placement/player count, verified season-specific CP rules, BFL and raw vs counting CP.
3. **Collection / readiness** — owned quantities, allocations, missing/shopping connected to exact planned lists.
4. **Learning loop** — personal matchup/tournament/practice analytics with clear evidence provenance.
5. **Community hardening when useful** — privacy/export/delete, centralized ingestion and operational observability.

Performance is not a dedicated next milestone unless a material regression appears.

---

## 15. Release-hardening milestone before stable release

Before calling the app stable, perform a formal **Development Cleanup / Release Hardening** pass.

This must include repository-wide checks for:

- dated `?build=` / temporary development navigation strings;
- stale route pins;
- hidden-but-not-deleted legacy UI/render code;
- feature enhancement layers that should be merged into core;
- duplicate domain/presentation engines;
- obsolete compatibility shims;
- old cache generations/service-worker assumptions;
- asset versioning consistency;
- stale standalone pages no longer used by navigation;
- mobile acceptance on current deployed SHA.

Specific known cleanup candidate from Tournament Day:

- old legacy large deck-summary/render path should be **deleted**, not merely hidden, once the compact My Deck control is fully accepted.

The objective is not aesthetic refactoring. It is to reduce drift, duplicated behavior and stale-code regressions before a stable/public-ready version.

---

## 16. Product success criteria

PTCG Tools is successful when:

- opening the app feels like one coherent product;
- repeat navigation between core areas feels immediate;
- account-owned state follows the user across devices;
- Home is useful competitive context, not a launcher;
- Meta always communicates its evidence scope correctly;
- exact variants interlink consistently across field/matchups/results/recommendations;
- Decks supports editing/versioning/analysis/playtest without duplicate identity systems;
- an Attending event moves naturally through Prep → Tournament Day → Completion;
- Tournament Day can begin without unnecessary setup but still retain exact used-deck identity;
- configured archetype sprites look the same everywhere because one shared mapping owns them;
- round/result capture is fast enough for real tournament use on iPhone;
- physical readiness can eventually answer “can I build this?” without double-counting;
- Cut / ID answers deterministic questions before probabilistic ones;
- advanced methodology remains available without dominating routine use;
- future community scale does not require every browser to hammer upstream providers independently.

---

## 17. Features to avoid / defer

- full automated Pokémon rules engine;
- AI opponent as an early Playtest dependency;
- social-network/community feed layer;
- novelty-calculator sprawl;
- Meta family pages;
- premature hyperscale architecture;
- duplicate cross-feature engines for things already owned centrally.

---

## 18. External data / public-release position

### Limitless

Prefer documented developer APIs/authorized mechanisms for community/public use. Personal Deck workflow should favor lightweight interoperability rather than rebuilding its mature editor.

### RK9

Do not make unauthorized automated extraction a public product dependency. Official Pokémon remains major-event existence/date authority; RK9 may be used as practical outbound destination or authorized enrichment source.

### Pokémon IP / privacy

Before broad public/App Store release, review card art, Pokémon artwork/logos, trademarks, third-party service terms, privacy/GDPR and store requirements.

Collect the minimum account identity necessary, protect per-user data with RLS and provide export/delete/privacy controls before broad distribution.

See `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md`.

---

## 19. Release progression

1. **Personal product** — continue building the primary user's complete competitive workflow.
2. **Development Cleanup / Release Hardening** — remove temporary scaffolding and duplicate implementations before calling a version stable.
3. **Local community** — validate with a small cohort if useful.
4. **Private beta** — expand only if value/support model is proven.
5. **Provider/IP/privacy review** — resolve source and distribution obligations.
6. **Public release** — only when operational/legal foundations are adequate.

The broader product loop remains:

**Analyse → Build & Test → Prepare → Compete → Learn**
