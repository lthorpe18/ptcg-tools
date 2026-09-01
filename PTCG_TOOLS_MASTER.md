# PTCG Tools — Master Product & Design Document

**Status:** Current product source of truth  
**Date:** 1 September 2026  
**Repository:** `lthorpe18/ptcg-tools`  
**Public app:** `https://lthorpe18.github.io/ptcg-tools/`

## 1. Product vision

PTCG Tools is a personal-first competitive Pokémon TCG companion covering the full competitive loop:

**Analyse → Build & Test → Prepare → Compete → Learn**

It should feel like one coherent native-style mobile application rather than a collection of unrelated utilities. The primary experience is an iPhone home-screen web app, with desktop treated as an adaptive expansion of that mobile experience.

The product should help answer the recurring competitive questions:

1. **What should I play?** — understand the current field and identify exact deck variants positioned well into it.
2. **How should I build and test it?** — manage decklists, versions, consistency and mobile playtesting.
3. **What do I need physically?** — understand owned cards, allocations, missing cards and deck readiness.
4. **Where and when can I play?** — discover relevant local and major events and track attendance intent.
5. **How should I prepare?** — connect event, expected meta, deck choice, testing and final list.
6. **What should I do during a tournament?** — track tournament state and make informed cut / ID decisions.
7. **What did I learn?** — retain results, testing and matchup evidence for future decisions.

PTCG Tools is not intended to replace Pokémon TCG Live with a fully rules-enforced client. Its playtest experience should instead be a fast, flexible, touch-first competitive tabletop.

---

## 2. Product principles

### 2.1 Decision first, methodology second

The app should surface the useful competitive answer before exposing detailed methodology.

Examples:

- “This exact variant is best positioned into your expected field.”
- “These are the matchups driving that recommendation.”
- “ID is safe / unsafe because this many players can still finish above you.”
- “You are missing these four physical cards to build this deck.”

Evidence, assumptions and advanced controls remain available through progressive disclosure.

### 2.2 Mobile first

The primary design width is approximately 390 CSS pixels.

Rules:

- no desktop-first tables that overflow horizontally on iPhone;
- compact information density rather than oversized marketing cards;
- controls must remain comfortably tappable;
- form and search inputs should render at **16 px or larger on iPhone** so Safari does not focus-zoom the page;
- safe-area handling is mandatory for home-screen use;
- important workflows should not depend on hover, keyboard shortcuts or precise drag-and-drop.

### 2.3 One product, one design system

All areas should share:

- app shell and navigation;
- typography and colour tokens;
- cards and surfaces;
- form controls and segmented controls;
- search/filter treatment;
- loading, empty and error states;
- disclosure panels;
- Pokémon sprite treatment;
- persistence conventions.

Domain-specific components are encouraged, but each feature must not reinvent the visual system.

### 2.4 Pokémon character without clutter

Pokémon sprites are primarily **identity**, not decoration.

They should identify deck archetypes, exact variants and saved decks. Sprite selection is a presentation concern only and must never alter analytical grouping or data identity.

Representative deck sprites have sensible built-in defaults, but users can override them in **Settings → Deck icons**. Overrides may use one or two Pokémon and should be resettable to the default. Basic Box currently defaults to **Teal Mask Ogerpon** rather than Mewtwo.

### 2.5 Fast defaults, explicit evidence

The app should work immediately without configuration, but analytical pages must make their evidence scope understandable.

Never hide a materially different evidence source behind a vague label. In particular, Online and IRL Meta evidence are distinct datasets and selected scope must actually change the underlying evidence, not only the text shown to the user.

### 2.6 Correctness before polish

Data semantics matter more than decorative UI. A number shown on a deck page must describe that deck unless clearly labelled otherwise. Global dataset counts must not be presented as though they are deck-specific samples.

---

## 3. Current V2 application state

V2 is now the active product direction and the public GitHub Pages root routes users into it. The old launcher should be treated as legacy rather than the product source of truth.

Current V2 implementation lives under:

`v2-preview/`

Current application areas include:

- `v2-preview/apps/meta`
- `v2-preview/apps/decklists`
- `v2-preview/apps/events`
- `v2-preview/apps/swiss`
- `v2-preview/apps/tools`
- `v2-preview/apps/settings`
- `v2-preview/apps/_shared`

The public root URL remains:

`https://lthorpe18.github.io/ptcg-tools/`

The root should remain the canonical user-facing entry point even while internal implementation paths still contain the `v2-preview` name.

### 3.1 Source-of-truth rule

For redesign work, inspect and modify the V2 implementation first. Legacy `apps/*` code should not silently drive new architectural decisions.

### 3.2 Validation rule

Before claiming a significant change is complete:

1. inspect current GitHub state;
2. explain the implementation approach where the change is substantial;
3. implement against V2;
4. run / inspect **Validate Meta Lab** for Meta changes where relevant;
5. confirm GitHub Pages deployment succeeds;
6. do not claim visual verification unless the deployed UI has actually been viewed/tested.

---

## 4. Information architecture and feature ownership

Top-level product areas:

**Home · Meta · Decks · Compete · Tools**

Settings is an app-level destination rather than a sixth competitive domain.

### Home
Personal competitive dashboard and contextual shortcuts.

### Meta
Public competitive evidence and expected-field analysis.

### Decks
Saved decks, versions, decklists, consistency maths, physical readiness integration and Mobile Playtest.

### Compete
Events, attendance, tournament preparation entry points and tournament-day workflows.

### Tools
Small standalone competitive utilities only.

### Settings
Application preferences such as deck icon overrides and future presentation / app preferences.

### Ownership locks

- **Mobile Playtest belongs to Decks**, not Tools.
- **Event finder belongs to Compete**.
- **Meta modelling belongs to Meta**.
- **Cut / ID Calculator belongs to Tools**, but should also be contextually accessible from Tournament Day.
- **Collection** is a cross-cutting long-term capability connected to Decks, Prep and Home, not a simple “owned” checkbox feature.

---

## 5. Global app shell and visual language

### 5.1 Navigation

Persistent mobile navigation should make the five competitive areas immediately reachable:

**Home · Meta · Decks · Compete · Tools**

Nested objects such as exact deck detail or tournament detail use compact contextual back navigation while preserving the shared shell.

### 5.2 Design tokens

Core visual direction:

- Background: `#F7F8FB`
- Surface: `#FFFFFF`
- Primary text: `#101828`
- Secondary text: `#667085`
- Light muted text: `#98A2B3`
- Border: `#E4E7EC`
- Interaction blue: approximately `#175CD3`
- Positive green: approximately `#079455`
- Warning amber: approximately `#B54708`
- Negative red: approximately `#D92D20`

Use the native/system font stack.

Shape direction:

- main cards around 15–18 px radius;
- controls around 9–12 px radius;
- full-radius pills/chips;
- compact spacing with clear hierarchy.

### 5.3 Search as a standard list capability

Lists containing many decks should be searchable/filterable by default where it materially improves navigation.

Already applied in V2 Meta to:

- Current Meta;
- Deck Explorer;
- standalone Matchups deck/opponent selection;
- exact deck Matchups list.

The same principle should be reused elsewhere rather than implemented independently each time.

### 5.4 PWA behaviour

The app should continue toward a genuine standalone home-screen experience with:

- manifest;
- `display: standalone`;
- app/touch icons;
- `theme-color`;
- `viewport-fit=cover`;
- safe-area CSS;
- stable canonical start URL;
- service worker/static shell caching where useful and safe.

Cache-busting/versioning must be handled deliberately for changed static assets so an iPhone home-screen install does not appear stale after deployment.

---

## 6. Home

Home should behave like a competitive dashboard, not a directory of apps.

Priority content:

- current format/context;
- high-value route into **What should I play?**;
- current Meta snapshot;
- recently used / saved deck context;
- next event or attendance context where available;
- quick access to Decks, Events and Cut / ID.

Only show personal modules where meaningful data exists.

Settings should remain easy to reach from Home without competing with primary competitive navigation.

---

## 7. Meta — locked architecture

Meta is currently the most developed V2 product area and should remain the UX benchmark.

### 7.1 Core principle: sources are evidence, not themes

**Online** and **IRL** are distinct evidence sources.

A source selector must change the underlying dataset. Scope selectors must also be functional everywhere they appear.

### 7.2 Online scopes

Required Online scopes:

- **Last 14 days**
- **Last 30 days**
- **Since last major weekend**
- **All in format**

“Since last major weekend” answers:

> Since the latest major established the IRL meta, what has the online playerbase done with that information?

Its cutoff is derived from the same authoritative latest-major-weekend model used by IRL. Same-weekend majors are merged; the online period begins after that merged competitive weekend.

### 7.3 IRL scopes

Required IRL scopes:

- **Latest IRL majors weekend**
- **All IRL majors this format**
- **Individual event**

When multiple majors occur in the same competitive weekend they merge into the default latest-weekend view.

The IRL scope model must behave consistently across Current Meta, Matchups, Deck Explorer, deck detail and What Should I Play.

### 7.4 Source/scope functionality everywhere

Wherever Meta lets the user choose Online vs IRL, it should expose the corresponding detailed scope and the choice must actually drive data.

This applies to:

- Current Meta;
- Matchups;
- Deck Explorer;
- exact deck detail where source switching exists;
- What Should I Play field source;
- What Should I Play matchup source.

For blended What Should I Play modes, Online and IRL scopes must be independently configurable.

### 7.5 Evidence context

A selected source/scope should expose enough context to understand what is being analysed, including as appropriate:

- event count;
- entry count;
- source description;
- date/update context;
- matchup game sample;
- matchup event sample when available.

Field evidence and matchup evidence must be described separately because they may have different coverage.

### 7.6 Variant and family model

Variant grouping is only a **Current Meta field-share presentation layer**.

Rules:

- no separate family pages;
- grouped families expand inline to exact variants;
- grouped family share has one source of truth;
- matchup data belongs to exact variants;
- win rate and result analysis belongs to exact variants;
- exact Deck Detail belongs to exact variants;
- What Should I Play analyses exact variants;
- exact variants should interlink between Current Meta, Deck Explorer, Deck Detail and Matchups.

Short form:

**Families describe the meta; variants play games.**

### 7.7 Current Meta

Current Meta should remain compact and answer “what is being played?” quickly.

It should support:

- Online / IRL source switching;
- full corresponding scope control;
- optional family grouping for field-share presentation only;
- inline expansion to exact variants;
- deck search/filter;
- event/entry/update context;
- navigation to exact deck detail.

### 7.8 What Should I Play

This is the reference interaction model for analytical UX.

Preserve:

- expected field;
- exact-variant recommendations;
- matchup-weighted positioning;
- confidence/evidence indication;
- “check a deck” flow;
- expandable methodology;
- custom/saved meta modelling.

Field source and matchup source are independent.

**Custom / saved meta** is one editable expected-field model with presets, not a separate incompatible data model.

Data-source controls should live in a compact collapsible **Data sources** panel and only show scope controls relevant to the source currently selected.

### 7.9 Matchups

Matchups are exact-variant to exact-variant evidence.

Requirements:

- Online and IRL must genuinely use different evidence;
- selected scope must drive the matchup dataset;
- opponent lists should be searchable/filterable;
- game counts are deck-specific on an exact deck page;
- insufficient evidence should be shown explicitly rather than filled with overall WR or inferred data.

### 7.10 Exact deck detail

The deck detail page should answer “where is this deck now?” first, then expose evidence.

Header:

- exact variant name and sprite;
- family context where relevant;
- one stable **Current share** callout.

Reference scope for the header share:

- Online → **Since last major weekend**;
- IRL → **Latest IRL majors weekend**.

Everything between the header and matchup list is grouped into a collapsible **Data & performance** panel.

Field performance should use one three-metric row:

- Deck entries
- Field share
- Win rate

Do not show the old Record metric in that summary row.

Evidence semantics must be deck-specific:

- **Field sample** = this exact variant’s entries across selected field events;
- **Matchup sample** = head-to-head games involving this exact variant.

A whole-tournament match count must never be displayed as though the deck itself played that many games.

### 7.11 Recent results on deck detail

Recent results belong at the bottom of exact deck detail.

**Online:**

- only tournaments inside the currently selected Online scope;
- filtered to the exact variant;
- sorted by placement, best first.

**IRL:**

- only events inside the selected IRL scope;
- filtered to the exact variant;
- sorted by placement, best first;
- individual result rows should link directly to the player’s Limitless Labs decklist where available.

The IRL data pipeline now retains individual results and decklist URLs so this is source data rather than a guessed link.

### 7.12 Meta data architecture

Shared runtime direction:

- **MetaState** — single source of truth for Online/IRL scopes;
- **MetaData** — shared evidence/data access layer;
- **MetaControls** — shared UI scope/source behaviour.

Avoid rebuilding overlapping page-specific scope systems.

Online field scope changes should use compact precomputed/cached history rather than rerunning expensive aggregation on every interaction.

Detailed matchup coverage may be narrower than field coverage. The UI must reflect this honestly. The rolling detailed online matchup archive should continue accumulating event pairings over time while full field standings remain independently comprehensive.

### 7.13 Meta data sources

Current direction:

- `play.limitlesstcg.com` / Limitless API for online tournament data;
- compact generated online field history for fast scope switching;
- rolling detailed pairing archive for scoped online matchup evidence;
- broader aggregate matchup history for all-format evidence;
- `labs.limitlesstcg.com` for IRL majors, deck field data, matchups and individual results/decklist links.

Do not silently substitute one source for another when the UI claims otherwise.

---

## 8. Settings

Settings is now an implemented app-level area.

### 8.1 Deck icon overrides

Users can configure representative Pokémon for deck/archetype presentation.

Requirements:

- searchable archetype/deck list;
- choose one or two representative Pokémon;
- preview current sprite treatment;
- save override;
- reset to built-in default;
- presentation only — no effect on deck identity, family grouping, field shares or matchup data.

Overrides should live in the app’s shared `preferences` state, with compatibility handling for older locally stored values where required.

### 8.2 Future Settings direction

Settings should own genuine app preferences, not analytical assumptions that belong contextually inside Meta/Tools/Decks.

Potential future settings:

- appearance/preferences shared across the app;
- default competitive format where useful;
- presentation preferences;
- data/storage/import/export controls.

---

## 9. Decks

Decks is the home for:

- My Decks;
- saved deck versions;
- decklists;
- deck-aware probability/consistency maths;
- Mobile Playtest;
- eventual physical-card readiness.

### 9.1 Deck library

Mobile-first library with:

- search;
- compact add action;
- deck name;
- one or two representative sprites;
- current/version context;
- concise useful metadata.

### 9.2 Deck detail

Target structure remains approximately:

**Overview · List · Odds**

with Playtest and physical readiness integrated contextually rather than hidden in unrelated Tools pages.

### 9.3 Deck versions

Saved decks should support named revisions so testing conclusions, tournament lists and card-allocation state can refer to a specific version rather than a mutable single list.

### 9.4 Mobile Playtest

Playtest is a Decks feature.

Direction:

- tap-driven tabletop rather than full rules engine;
- solo/goldfish first;
- iPhone portrait must be fully usable;
- no keyboard dependence;
- no requirement for precise drag-and-drop.

Core zones:

- Deck
- Hand
- Active
- Bench
- Discard
- Lost Zone
- Prizes
- Stadium

Support attachments, damage/markers, turn state and undo/history where practical.

Primary actions should include Draw, Search Deck, Shuffle, Coin Flip, Undo and End Turn.

Future phases may include two-deck local testing, scenario saving and lightweight practice analytics.

---

## 10. Collection / physical readiness

Long-term locked requirement:

> Maintain a live record of every physical Pokémon TCG card owned and which decks those cards are currently allocated to, so the user can immediately see what must be bought, moved or freed up.

Do **not** model this as a simple “I own this card” checkbox.

The collection model must support:

- exact owned quantities;
- exact printing/card identity where relevant;
- gameplay interchangeability where appropriate;
- loose/unallocated inventory;
- allocation to saved decks / deck versions;
- multiple decks kept built simultaneously;
- prevention of accidental double-allocation;
- required vs owned vs allocated;
- deck readiness;
- “move these cards from deck A to deck B”;
- missing-card lists;
- shopping/acquisition lists.

Distinguish exact physical printing from gameplay-equivalent cards that can satisfy the same deck requirement.

Collection should eventually connect to Decks, Tournament Prep and Home.

---

## 11. Compete / Events

### 11.1 Event-source authority

Local events primarily come from **Pokédata**:

- Cups;
- Challenges;
- Prereleases.

Pokédata is a discovery/index source, not automatically exact authority for every event detail.

Majors use **official Pokémon Championship Series data** as the existence/date authority, enriched by **RK9** where useful for practical registration, venue and detail information.

Normalised imported event data should preserve source provenance.

### 11.2 Event UX

Compete should support:

- Nearby/local discovery;
- Majors;
- attendance intent / Attending state;
- compact mobile cards;
- useful filters;
- list/map views where location is valuable.

Attendance is not automatically equivalent to Tournament Prep until the Prep milestone explicitly connects them.

### 11.3 Tournament-day workspace

Tournament Day should eventually connect:

- current event;
- current record;
- pairings/opponent notes;
- standings;
- Cut / ID access;
- result logging.

---

## 12. Tools

Tools is for **small standalone competitive utilities that do not belong in Meta, Decks or Compete**.

Known/planned tools include:

- Cut / ID Calculator;
- deck maths / probability utilities;
- odds-style calculations;
- other compact helpers where genuinely useful.

Avoid turning Tools into a dumping ground.

### 12.1 Cut / ID Calculator

Requirements:

- support real Pokémon Swiss records including draws;
- deterministic possible-cutoff calculations first;
- clearly show how many players can finish above/equal to a point total;
- support Top 4 / Top 8 etc.;
- account for known pairings and IDs where supplied;
- use probabilistic simulation only when deterministic information is insufficient;
- empirical tie-rate assumptions are optional uncertainty inputs, never hidden defaults driving deterministic answers.

Answer-first mobile UX should show the actionable conclusion before detailed modelling.

---

## 13. Persistence and shared state

V2 should continue toward a coherent shared persistence model.

Personal/shared state includes or will include:

- user preferences;
- deck icon overrides;
- saved decks and versions;
- attendance intent;
- saved/custom expected meta;
- collection/allocation state;
- tournament prep state;
- playtest history where implemented.

Accountless shared persistence through the existing V2 approach is preferred where appropriate.

Use explicit schema/version migration rather than silently breaking older local/shared state.

Import/export remains valuable as a backup and interoperability mechanism.

---

## 14. Technical architecture direction

Plain HTML/CSS/JavaScript remains acceptable; do not introduce a heavy framework solely to modernise the appearance.

Strengthen shared layers instead.

Shared responsibilities should include:

- app shell;
- navigation;
- design tokens;
- forms/segmented controls;
- disclosure behaviour;
- searchable list patterns;
- safe-area/mobile helpers;
- persistence/preferences;
- sprite resolution and overrides.

Domain logic stays separated:

- Meta evidence/state/controls;
- Deck parsing/playtest state;
- Events normalisation;
- Tournament logic;
- Collection allocation model.

Performance-sensitive analysis should favour generated compact data and caching over recomputing large historical aggregates during routine UI interactions.

---

## 15. Near-term roadmap

The product shell/V2 promotion and the major Meta redesign are now substantially further ahead than the original roadmap implied.

### Completed / substantially established

- V2 shared visual direction and app shell;
- public GitHub Pages root entering V2;
- redesigned Home direction;
- major Meta Current Meta / Deck Explorer / Deck Detail / Matchups / What Should I Play redesign;
- shared Meta source/scope architecture;
- Online + IRL evidence separation;
- scoped online field history and rolling matchup archive;
- IRL major data pipeline;
- exact-variant deck detail and deck-specific evidence;
- recent IRL results with Limitless decklist links;
- searchable deck-list surfaces in Meta;
- app Settings area with deck icon overrides;
- iPhone input sizing rule to prevent search-field focus zoom.

### Next major product milestones

1. **Decks consolidation** — simplify saved deck UX and establish deck-version foundations.
2. **Mobile Playtest v1** — solo/goldfish touch-first tabletop.
3. **Events / Compete maturity** — reliable local/major discovery plus attendance context.
4. **Cut / ID Calculator** — deterministic tournament-day utility with optional uncertainty modelling.
5. **Tournament Prep** — connect attending event, expected Meta, chosen deck/version and readiness.
6. **Collection / readiness** — owned quantities, allocations, missing cards and shopping.
7. **Learning loop** — personal results, matchup testing and playtest analytics.

Roadmap decisions should preserve the overall loop:

**Analyse → Build & Test → Prepare → Compete → Learn**

---

## 16. Product success criteria

PTCG Tools is successful when:

- launching the public URL/home-screen icon feels like opening one coherent app;
- Home surfaces useful competitive context rather than acting as a directory;
- Meta clearly communicates what evidence is being used and never confuses field evidence with matchup evidence;
- exact deck variants are consistently linked across field, matchups, results and recommendations;
- major deck lists are quickly searchable on iPhone;
- saved decks are easy to edit, version, analyse and playtest;
- a player can goldfish a deck comfortably on an iPhone;
- event, preparation and tournament-day workflows become connected rather than duplicated;
- physical collection state can answer “can I build this?” without double-counting cards;
- Cut / ID answers deterministic questions before resorting to probabilistic simulation;
- advanced analysis remains available without overwhelming routine use;
- every major feature supports a real competitive decision or workflow.

---

## 17. Features to avoid or defer

### Full automated Pokémon rules engine
High complexity and unnecessary for the core mobile tabletop goal.

### AI opponent as an early Playtest dependency
Potential future research, but must not delay a highly useful manual solo tabletop.

### Social-network/community layer
Not core to the personal competitive-companion vision.

### Large quantities of novelty calculators
Tools should remain curated.

### Meta family pages
Explicitly avoid them. Families are Current Meta presentation groupings only; exact variants own gameplay evidence.

---

## 18. External reference position

Limitless remains an important data source and product reference, particularly for competitive results, decklists, matchups and its existing Tabletop concept.

PTCG Tools should not clone Limitless visually or technically. Its opportunity is to connect high-quality public competitive evidence with personal deck development, mobile playtesting, preparation, tournament-day decisions and physical-card readiness in one coherent mobile workflow.
