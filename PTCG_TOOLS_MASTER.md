# PTCG Tools — Master Product & Design Document

**Status:** Current product source of truth  
**Date:** 1 September 2026  
**Repository:** `lthorpe18/ptcg-tools`  
**Public app:** `https://lthorpe18.github.io/ptcg-tools/`  
**Companion architecture docs:** `PERFORMANCE_ARCHITECTURE.md`, `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md`

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
6. **What should I do during a tournament?** — track tournament state and make informed cut / ID decisions.
7. **What did I learn?** — retain results, testing and matchup evidence for future decisions.

PTCG Tools is not intended to replace Pokémon TCG Live with a fully rules-enforced client. Its playtest experience should instead be a fast, flexible, touch-first competitive tabletop.

The long-term product opportunity is not simply presenting Limitless, RK9, Pokémon or Pokédata information. It is the **connected layer for one player**:

**Meta → deck choice → deck development/testing → physical readiness → event preparation → tournament-day decisions → review/learning.**

Account-backed persistence makes that workflow longitudinal and device-independent.

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

Never hide a materially different evidence source behind a vague label. Online and IRL Meta evidence are distinct datasets and selected scope must actually change the underlying evidence, not only the text shown to the user.

### 2.6 Correctness before polish

Data semantics matter more than decorative UI. A number shown on a deck page must describe that deck unless clearly labelled otherwise. Global dataset counts must not be presented as though they are deck-specific samples.

### 2.7 Personal-first, public-ready

Build the best possible competitive app for the primary user, but avoid choices that unnecessarily make later community/public use impossible.

This does **not** mean designing prematurely for millions of users. It means preserving a few durable foundations:

- user-owned state is clearly account-scoped;
- personal data can restore across devices;
- shared public competitive data is conceptually distinct from private user data;
- source provenance is retained;
- upstream scraping is not silently treated as a permanent public integration contract;
- the PTCG Tools brand remains independent rather than presenting as an official Pokémon product.

---

## 3. Current V2 application state

V2 is the active product direction and the public GitHub Pages root routes users into it. The old launcher is legacy rather than product source of truth.

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

### 3.3 Current account foundation

PTCG Tools now has an implemented account layer using **Google sign-in via Supabase Auth**.

Google is the only supported provider for now. Apple and Discord were deliberately removed after Google proved sufficient for the current stage.

The account milestone is not theoretical: authentication and cross-device persistence have been tested successfully on multiple devices.

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
Account, application preferences, deck icon overrides and future storage/import/export controls.

### Ownership locks

- **Mobile Playtest belongs to Decks**, not Tools.
- **Event finder belongs to Compete**.
- **Meta modelling belongs to Meta**.
- **Cut / ID Calculator belongs to Tools**, but should also be contextually accessible from Tournament Day.
- **Collection** is a cross-cutting long-term capability connected to Decks, Prep and Home, not a simple “owned” checkbox feature.

---

## 5. Global app shell and visual language

### 5.1 Navigation

Persistent mobile navigation makes the five competitive areas immediately reachable:

**Home · Meta · Decks · Compete · Tools**

This is a production architectural requirement, not only a visual preference.

The public root owns a persistent five-area shell. Home, Meta, Decks, Compete and Tools remain mounted after first load and section switching changes the active view rather than performing a fresh top-level document navigation. This architecture was promoted on 1 September 2026 after direct iPhone testing showed a substantial improvement in perceived navigation performance.

Nested objects such as exact deck detail or tournament detail use compact contextual back navigation while preserving the shared shell.

**Architecture lock:** future feature work must not casually restore full-page reloads as the default navigation mechanism between the five core areas. Any replacement shell/navigation implementation must retain the same key behaviour: already-loaded areas remain available immediately and routine cross-area navigation should not rebuild the application from scratch.

Current implementation uses persistent child views as a pragmatic bridge over the existing plain-HTML feature pages. A future move to a true shared-DOM shell is allowed, but only if it preserves or improves measured/perceived performance and does not require a framework rewrite solely for architectural neatness.

### 5.2 OAuth exception to persistent child navigation

Third-party authentication pages such as Google must **not** be loaded inside the persistent child iframe that contains Settings.

Google OAuth therefore deliberately escapes to a **top-level navigation**, then returns to the top-level PTCG Tools app after authentication.

This behaviour was required to fix an iPhone failure where Google returned a 403 page while PTCG Tools' bottom navigation remained visible underneath it.

Future auth/external flows that prohibit embedding must follow the same rule.

### 5.3 Design tokens

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

### 5.4 Search as a standard list capability

Lists containing many decks should be searchable/filterable by default where it materially improves navigation.

Already applied in V2 Meta to:

- Current Meta;
- Deck Explorer;
- standalone Matchups deck/opponent selection;
- exact deck Matchups list.

The same principle should be reused elsewhere rather than implemented independently each time.

### 5.5 PWA behaviour

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

### 5.6 Performance architecture — current production baseline

A dedicated performance pass on 1 September 2026 established the production baseline:

- a service worker caches the app shell, static assets and generated JSON with stale-while-revalidate behaviour where appropriate;
- routine Home preview data no longer deliberately bypasses browser caching;
- duplicate Home Meta-index requests were removed/shared;
- the five core areas are progressively warmed after app launch;
- once loaded, core areas stay alive inside the persistent shell and switching between them is effectively immediate in normal use;
- feature state is preserved across routine section switching because the feature page is not destroyed and recreated;
- explicit/manual refresh paths may still bypass caches where fresh source data is genuinely required.

The original intermittent navigation hangs were primarily caused by full-document navigation repeatedly rebuilding pages, scripts and data state. Cache tuning alone did not remove the issue; promoting the persistent shell did.

The remaining occasional first-initialisation pause is accepted for now. **Performance is considered good enough and the navigation-performance milestone is complete.** Do not prioritise further optimisation ahead of product work unless a measurable/user-visible regression appears.

See `PERFORMANCE_ARCHITECTURE.md` before changing global navigation, caching, shell-owned sync or OAuth routing.

---

## 6. Home

Home should behave like a competitive dashboard, not a directory of apps.

Priority content:

- current format/context;
- high-value route into **What should I play?**;
- current Meta snapshot;
- recently used / saved deck context;
- next event or attendance context where available;
- quick access to Decks, Events and Cut / ID;
- compact account state without allowing account chrome to dominate the competitive dashboard.

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

**Online:** only tournaments inside the currently selected Online scope, filtered to the exact variant, sorted by placement best first.

**IRL:** only events inside the selected IRL scope, filtered to the exact variant, sorted by placement best first. Individual result rows should link directly to the player’s Limitless Labs decklist where available.

### 7.12 Meta data architecture

Shared runtime direction:

- **MetaState** — single source of truth for Online/IRL scopes;
- **MetaData** — shared evidence/data access layer;
- **MetaControls** — shared UI scope/source behaviour.

Avoid rebuilding overlapping page-specific scope systems.

Online field scope changes should use compact precomputed/cached history rather than rerunning expensive aggregation on every interaction.

Detailed matchup coverage may be narrower than field coverage. The UI must reflect this honestly.

### 7.13 Meta data sources

Current direction:

- `play.limitlesstcg.com` / documented Limitless APIs for online tournament data where available;
- compact generated online field history for fast scope switching;
- rolling detailed pairing archive for scoped online matchup evidence;
- broader aggregate matchup history for all-format evidence;
- `labs.limitlesstcg.com` for current IRL evidence while the integration remains appropriate.

Do not silently substitute one source for another when the UI claims otherwise.

For any future community/public release, documented/authorized data access should replace essential scraping wherever possible. See Section 18 and `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md`.

---

## 8. Settings and accounts

Settings is an implemented app-level area.

### 8.1 Account

Google sign-in is now the supported account mechanism.

Requirements/principles:

- Google only for now;
- request only basic identity information needed for the account;
- no Gmail/Drive/Contacts access;
- never receive/store Google passwords;
- OAuth provider secrets remain server-side and never enter the public repo;
- name/email are personal data and must be treated accordingly;
- account state should be compact and understandable.

The current Supabase account backend is **PTCG Tools V2 Auth**, project reference `naylqcyrnhjvqodjpjsg`, hosted in `eu-west-2` on the free tier at the current stage.

### 8.2 Deck icon overrides

Users can configure representative Pokémon for deck/archetype presentation.

Requirements:

- searchable archetype/deck list;
- choose one or two representative Pokémon;
- preview current sprite treatment;
- save override;
- reset to built-in default;
- presentation only — no effect on deck identity, family grouping, field shares or matchup data.

Overrides live in shared preferences state, with compatibility handling for older locally stored values where required.

### 8.3 Future Settings direction

Settings should own genuine app preferences, not analytical assumptions that belong contextually inside Meta/Tools/Decks.

Potential future settings:

- appearance/preferences shared across the app;
- default competitive format where useful;
- presentation preferences;
- data/storage/import/export controls;
- account export/delete controls before broad public release.

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

Mobile-first library with search, compact add action, deck name, one or two representative sprites, current/version context and concise useful metadata.

Limitless is the preferred deck-building source for now. PTCG Tools should make bringing a list across quick, then own the personal identity and downstream relationships that a generic builder does not know about.

The import flow is:

1. paste a Limitless/PTCGL-format list or supply a supported Limitless shared-list link;
2. choose **New Deck** or **Update Existing**;
3. confirm a user-facing deck name and the separately stored archetype/variant;
4. create a new immutable version only when the canonical list hash has changed.

A Deck's name is personal context, for example **“Mega Lucario Hariyama — Card Catcher build”**. Its archetype is analytical classification, for example **Mega Lucario / Hariyama**. Multiple Decks may share an archetype when the user wants independent projects or meaningful forks.

Decks should retain useful source provenance and provide low-friction handoffs:

- open the source list in Limitless when a source URL exists;
- copy the exact list in PTCGL/Limitless-compatible text;
- **Create deck image** by copying that text and opening Limitless PNGGen.

Do not depend on an undocumented PNGGen prefill URL. Copy-and-open is the durable initial integration unless Limitless publishes a supported mechanism.

### 9.2 Deck detail

Target structure remains approximately:

**Overview · List · Odds**

with Playtest and physical readiness integrated contextually rather than hidden in unrelated Tools pages.

### 9.3 Deck versions

The durable Deck model is deliberately small:

- a **Deck** is the long-lived personal project/identity, with its own stable ID, user-facing name and separately stored archetype/variant;
- `Deck.rawText` is its mutable, account-synced **working list**;
- a **checkpoint** (`DeckVersion` in the current code) is an immutable exact list with a stable ID, automatic visible sequence such as V1/V2/V3, and optional meaningful name/notes;
- every working list and checkpoint carries a `listHash` derived from the canonical parsed card list.

Canonicalization combines duplicate lines and ignores headings, whitespace and line order. Quantities, card names, set codes and card numbers remain significant. Therefore differently formatted exports of the same exact cards share a hash, while changing one card or printing changes the hash.

The hash answers **“are these exact card lists the same?”**. Stable Deck/checkpoint IDs answer **“which saved project or named milestone did the user select?”**.

Rules:

- ordinary edits save the working list without rewriting historical checkpoints;
- imports and meaningful saves create sequential versions; optional names can record milestones such as “Cup submission” without replacing V1/V2/V3;
- saving an unchanged list reuses the matching checkpoint instead of creating duplicate list data;
- future evidence may refer to `deckId + listHash`, with `deckVersionId` included whenever a saved version was selected;
- working lists remain immediately usable for Odds and testing without forcing checkpoint creation;
- source URL/type and imported-at provenance may be retained on the Deck and exact version where useful, but do not turn source metadata into a second identity system;
- updating an existing Deck means “this is the next revision of the same project”; a strategically independent fork is a new Deck even when it has the same archetype;
- versions remain embedded inside Deck objects and inside the current account snapshot until normalized tables provide a concrete benefit.

Existing/unversioned Deck records are migrated in place to stable model/version IDs and hashes. The legacy Decks page must not remain a second writer to the same IndexedDB store.

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

### 9.5 Match history vs Playtest

Actual competitive evidence and solo Playtest evidence are separate domains:

- **Match History** contains real PTCGL and in-person games with an opponent, result and opponent archetype;
- **Playtest Sessions** contain one-sided goldfish/setup evidence such as opening hands, mulligans and consistency observations;
- both may refer to the same `deckId + listHash`, but Playtest must not create wins/losses or affect matchup statistics.

The durable real-game contract is:

- a **Match** is one real encounter against an opponent and owns the context shared by its games: source, date, exact saved list, opponent archetype, format, event/round and notes;
- a **Game** is a child result inside that Match, including per-game result and first/second state where known;
- a PTCGL battle-log import creates one Game inside one Match; manual in-person entry uses the same contract and may record a multi-game score;
- exact-list attribution stores `deckId + listHash`, plus `deckVersionId` when a named checkpoint was selected, and retains deck/version display snapshots so old evidence stays intelligible after later edits or deletion;
- imported logs carry a canonical import hash for duplicate prevention, parser version and the original user-supplied log so future parser improvements can reprocess it;
- parser suggestions for the user's saved list and the opponent archetype are conveniences, not immutable truth; the user confirms or corrects them before saving.

Match records currently remain embedded in the account snapshot. This is intentional: normalize them into user tables only when concrete query, scale or collaboration needs exceed the snapshot model.

Training Court is the preferred capture experience for real PTCGL and in-person results if a supported personal export or read-only integration can be obtained. PTCG Tools should then ingest the user's records into the Match/Game contract and use them for Deck history, event preparation and personal analytics.

While that route is unresolved:

- retain the current Decks Training Log, PTCGL parser and manual entry as a working native fallback and ingestion-contract proof;
- do not materially expand a duplicate Training Court-style capture/analytics product;
- do not scrape authenticated pages or seek access to another product's private database;
- prefer export/API history with stable external IDs and update timestamps; a webhook is helpful but not required if incremental pull is supported;
- preserve source and external-record identifiers so repeat imports are idempotent and user corrections can be reconciled.

Tournament entry belongs contextually in Compete but must write the same Match/Game contract rather than creating a second store. Raw PTCGL logs and imported Training Court records are private account-owned data and must not become community evidence by default.

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

Event intent has two distinct states:

- **Interested** bookmarks an event without creating preparation work;
- **Attending** creates or opens that event's Prep workspace inside Compete.

Prep is not a sixth top-level area. It is durable event-specific state owned by Compete and connected to Decks, Meta, matches and Collection.

### 11.3 Event Prep

Prep should support the real decision funnel rather than assuming the user already has one finished list:

1. establish an **Expected Field**;
2. compare roughly 2–4 candidate archetypes;
3. choose an archetype, then link or create a personal Deck and iterate its exact versions;
4. mark an exact version **Planned for event**;
5. lock the version actually **Used at event**;
6. retain results and review against that immutable event/list context.

Candidate archetypes may initially point to shared Meta variants before a personal Deck exists. Their statuses are **Considering**, **Leading choice**, **Chosen** and **Dropped**. Comparison should show weighted expected matchup performance, favourable/unfavourable field coverage, weakest important matchups, evidence gaps/confidence and personal notes. Imported real-match evidence may enrich this later without being confused with Playtest evidence.

The Expected Field starts from an evidence-derived baseline, with visible source window, provenance, confidence and short reasoning. Each archetype row supports compact `−` / percentage / `+` controls:

- plus/minus makes a qualitative adjustment and rebalances the other unlocked rows to keep the total at 100%;
- tapping the percentage allows an exact manual override and locks that row;
- unlocked rows absorb subsequent rebalancing;
- **Reset baseline** removes the user's adjustments;
- saving creates an immutable event-specific forecast snapshot including baseline inputs, user adjustments/overrides, source window and model/version metadata.

Prep should be information-before-configuration on iPhone: the current recommendation, leading candidates, major risks and readiness appear before detailed controls.

The event-to-list relationship is not a free-text `usedFor` field on Deck. It is an event-owned reference to `deckId + deckVersionId + listHash`, with a lifecycle such as **planned** then **used**. The same version may be used at multiple events, and Deck detail may render those reverse relationships. Historical events retain display snapshots so they remain intelligible after later renaming or deletion.

### 11.4 Tournament-day workspace

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

## 13. Persistence, accounts and shared state

### 13.1 Current cloud persistence

V2 now has working per-account cloud persistence through Supabase.

The current model keeps one latest `user_snapshots` record per authenticated user, protected by Row Level Security using the authenticated user ID.

Current snapshot-capable personal state includes:

- saved decks and their versions;
- real-game Match/Game history, including PTCGL imports and manual in-person records;
- root V2 state including event attendance and current prep state;
- preferences/deck icon overrides;
- saved/custom expected Meta data.

Future Collection, structured tournament preparation, playtest history and other account-owned data should join this model deliberately as those domains are implemented.

### 13.2 Sync behaviour

The intended behaviour is:

> Sign in with Google once; PTCG Tools data follows the account.

Current behaviour includes:

- if an authenticated user has no cloud snapshot, existing local data is uploaded rather than replaced by an empty account;
- newer cloud data can restore on another device;
- personal local changes mark account state dirty and auto-upload;
- reconnect/focus/foreground events can trigger reconciliation;
- deck deletions restore correctly because the deck library can be replaced rather than only appended;
- offline local use remains possible and sync resumes later.

The sync controller lives at the **top-level persistent shell** so it is not tied to whichever feature page happens to be open.

### 13.3 Proven cross-device behaviour

On 1 September 2026, Google sign-in and cloud sync were tested across devices. Setting an event to **Attending** on one device persisted to the other device using the same Google account.

Therefore **Google account + per-account cloud persistence + cross-device restore/sync is a completed foundation milestone for the current stage**.

### 13.4 Snapshot vs normalized future tables

The current whole-account snapshot is intentionally pragmatic while the product model is still evolving.

Move domains into normalized user tables when there is a concrete reason, such as:

- queryability;
- conflict resolution;
- history/audit needs;
- collaboration;
- large collection datasets;
- tournament/match analytics;
- performance/scale.

Do not normalize solely for architectural purity.

Import/export remains valuable as backup/interoperability even with accounts.

### 13.5 Shared vs per-user data

Maintain a strong conceptual split.

**Shared competitive data:** cards, formats, events, results, public decklists, Meta aggregates, public matchup evidence.

**Per-user data:** saved decks/versions, Collection, attendance, preparation, personal matches/testing, notes and preferences.

Do not duplicate heavyweight shared public datasets inside every user's account snapshot.

---

## 14. Technical architecture direction

Plain HTML/CSS/JavaScript remains acceptable; do not introduce a heavy framework solely to modernise the appearance.

Strengthen shared layers instead.

Shared responsibilities should include:

- persistent app shell;
- navigation;
- application-level auth/session lifecycle;
- cloud reconciliation;
- design tokens;
- forms/segmented controls;
- disclosure behaviour;
- searchable list patterns;
- safe-area/mobile helpers;
- persistence/preferences;
- sprite resolution and overrides;
- caching/service-worker behaviour where appropriate.

Domain logic stays separated:

- Meta evidence/state/controls;
- Deck parsing/playtest state;
- Events normalisation;
- Tournament logic;
- Collection allocation model.

Performance-sensitive analysis should favour generated compact data and caching over recomputing large historical aggregates during routine UI interactions.

The current production shell deliberately prioritises **perceived navigation responsiveness and state retention** over architectural purity. Do not replace it with a cleaner-looking routing abstraction if that would return the app to page-by-page cold starts.

### 14.1 Shared upstream ingestion direction

As usage expands beyond one person, shared source requests should increasingly be centralized:

`Limitless / Pokémon / Pokédata / authorized sources → PTCG Tools ingestion/cache → normalized shared dataset → all users`

rather than every user's browser independently requesting the same upstream data.

This reduces source rate-limit pressure, duplicated traffic and inconsistent user experiences.

### 14.2 Source Adapter direction

Future data architecture should converge toward normalized entities such as:

- Tournament;
- TournamentResult;
- Decklist;
- Match;
- Event;
- Card.

Adapters may include `LimitlessAdapter`, `PokemonAdapter`, `RK9Adapter`, `PokedataAdapter` or successors.

Imported records should preserve provenance where practical: source, source ID, retrieval timestamp, field authority and access classification.

Useful access classifications:

- Official API;
- Explicit permission;
- Public data;
- Scraped;
- User supplied.

Any **Scraped** source that becomes essential to a future public application should be reviewed/replaced/authorized before broad launch.

---

## 15. Near-term roadmap

### Completed / substantially established

- V2 shared visual direction and app shell;
- public GitHub Pages root entering V2;
- **persistent five-area production shell with state-retaining cross-area navigation**;
- **service-worker/static/data caching baseline and progressive section warm-up**;
- **navigation-performance milestone completed; remaining first-initialisation pause accepted for now**;
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
- iPhone input sizing rule to prevent search-field focus zoom;
- **Google account sign-in via Supabase Auth**;
- **top-level OAuth flow compatible with the persistent iPhone shell**;
- **per-account cloud snapshots and automatic reconciliation**;
- **cross-device persistence tested successfully using event Attending state**.

### Next major product milestones

1. **Deck/list foundation — established** — working lists, canonical hashes, named checkpoints and stable relationships.
2. **Match/Game ingestion contract and native fallback — established** — PTCGL parsing, real opponent/result attribution and manual in-person recording remain available while a supported Training Court export/integration is explored.
3. **Limitless-backed Deck intake — established** — import as New Deck or Update Existing, separate personal name from archetype, create V1/V2/V3 only for changed hashes, and add source/copy/PNGGen handoffs.
4. **Event Prep + Expected Field v1 — next** — Interested/Attending flow, evidence-derived editable forecast, candidate archetype comparison and exact planned/used version relationships.
5. **Mobile Playtest v1** — launch the separate solo/goldfish touch-first tabletop from a DeckVersion or the current Prep candidate/final list.
6. **Events / Compete maturity** — reliable local/major discovery and stronger tournament-day context.
7. **Cut / ID Calculator** — deterministic tournament-day utility with optional uncertainty modelling.
8. **Collection / readiness** — owned quantities, allocations, missing cards and shopping connected to the event's exact planned list.
9. **Learning loop** — personal matchup, tournament and Playtest analytics kept semantically distinct.
10. **Community hardening when useful** — privacy/export/delete controls, centralized source ingestion and operational observability before inviting a materially larger cohort.

Performance should be reopened as a dedicated milestone only if future growth creates a material regression in first-load/navigation responsiveness or cloud reconciliation begins competing with active interaction.

Roadmap decisions should preserve the loop:

**Analyse → Build & Test → Prepare → Compete → Learn**

---

## 16. Product success criteria

PTCG Tools is successful when:

- launching the public URL/home-screen icon feels like opening one coherent app;
- routine switching between already-loaded Home, Meta, Decks, Compete and Tools feels immediate rather than like loading separate websites;
- a user can sign in once and their meaningful PTCG Tools state follows them across devices;
- Home surfaces useful competitive context rather than acting as a directory;
- Meta clearly communicates what evidence is being used and never confuses field evidence with matchup evidence;
- exact deck variants are consistently linked across field, matchups, results and recommendations;
- major deck lists are quickly searchable on iPhone;
- saved decks are easy to edit, version, analyse and playtest;
- a Limitless-built list can become a clearly named personal Deck or a new exact version without duplicate checkpoints;
- an attending event can progress from evidence-based field forecast through candidate archetypes to the exact list planned and used;
- a player can goldfish a deck comfortably on an iPhone;
- event, preparation and tournament-day workflows become connected rather than duplicated;
- physical collection state can answer “can I build this?” without double-counting cards;
- Cut / ID answers deterministic questions before resorting to probabilistic simulation;
- advanced analysis remains available without overwhelming routine use;
- every major feature supports a real competitive decision or workflow;
- the architecture can support a local community without every user independently hammering upstream sources.

---

## 17. Features to avoid or defer

### Full automated Pokémon rules engine
High complexity and unnecessary for the core mobile tabletop goal.

### AI opponent as an early Playtest dependency
Potential future research, but must not delay a highly useful manual solo tabletop.

### Social-network/community layer
Not core. “Community release” means multiple independent users can use the same product, not that PTCG Tools needs feeds, followers, chat or social-network mechanics.

### Large quantities of novelty calculators
Tools should remain curated.

### Meta family pages
Explicitly avoid them. Families are Current Meta presentation groupings only; exact variants own gameplay evidence.

### Premature hyperscale architecture
Do not design for millions of users before real demand exists.

---

## 18. External data, permissions and public-release position

### 18.1 Limitless

Limitless is an important data source and product reference, particularly for competitive results, decklists, matchups and its Tabletop concept.

For personal Deck workflow, prefer lightweight interoperability over rebuilding its mature deck editor: accept compatible list text or supported shared links, retain provenance, and provide open/copy/PNGGen handoffs. PTCG Tools owns personal Deck identity, immutable revisions and relationships to Prep, Playtest, readiness and evidence.

For community/public use, documented Limitless developer APIs should be preferred over undocumented/scraped endpoints wherever possible. Legitimate public projects can seek API access/higher limits where required.

PTCG Tools should not clone Limitless visually or technically.

### 18.2 RK9

RK9's published Terms prohibit automated extraction/screen scraping for commercial **or non-commercial** purposes.

Therefore a free app does not make RK9 scraping acceptable.

Public-ready direction:

- official Pokémon remains major-event existence/date authority;
- RK9 can be linked to for registration/practical details;
- automated RK9 dependence should require permission or an authorized mechanism;
- do not make unauthorized RK9 scraping a core public dependency.

### 18.3 Pokémon IP

A free fan app is not automatically exempt from intellectual-property obligations.

Before broad public/App Store release, review at minimum:

- card artwork/images;
- Pokémon artwork/logos;
- trademarks/naming and official-looking branding;
- energy/game symbols and other protected assets;
- third-party service terms;
- privacy/GDPR obligations;
- app-store IP rules.

PTCG Tools should maintain an independent brand and clearly identify itself as unofficial/community software if released widely.

Facts, calculations and statistics are different from copying protected artwork, but source/database terms still matter.

### 18.4 Privacy

Google identity can provide name, email, stable IDs and profile image where available. Name/email are personal data.

Principles:

- collect the minimum necessary;
- request no unrelated Google scopes;
- protect personal rows with RLS;
- do not expose one user's state to another;
- provide export/delete controls before broad public release;
- create a formal privacy policy before broad distribution.

---

## 19. Community and future native-app direction

### 19.1 Local-community middle ground

A local-community PWA release is a legitimate next step if/when useful:

> no monetisation required, no App Store required, no broad marketing required — simply allow a small competitive community to use the installable web app with their own Google accounts and cloud-backed personal state.

Approximate engineering thresholds:

| Scale | Expected concern |
|---|---|
| One user / a few friends | Essentially none |
| 20–100 regular users | Technically trivial |
| Hundreds active | Watch bandwidth and upstream-source traffic |
| Low thousands | Production hosting/CDN/backend observability sensible |
| Tens of thousands | Genuine scale engineering |

User count does not multiply browser RAM; persistent-shell memory is primarily a per-device concern.

GitHub Pages is acceptable for the current personal/community phase. Reassess hosting before sustained low-thousands usage rather than treating GitHub Pages as the permanent high-scale production platform.

### 19.2 Native iOS/Android feasibility

PTCG Tools is technically convertible into a native-distributed product without rewriting every domain model from scratch.

Potential evolution:

1. mature the responsive PWA and shared backend;
2. keep domain/data logic platform-independent;
3. consider Capacitor/native wrapping if the mature web UI remains the preferred client;
4. consider React Native/Expo or another native client only if native interaction requirements justify it.

The eventual app should provide genuine app functionality rather than being a simple web clipping. Saved decks, Playtest, Collection, preparation, tournament-day tools and cloud accounts naturally support that direction.

### 19.3 Recommended release progression

1. **Personal product** — continue building for the primary user's real competitive workflow.
2. **Public-ready foundations** — maintain accounts, provenance, normalized shared data and durable persistence.
3. **Local community** — validate the app with a small number of real competitive players.
4. **Private beta** — expand to tens of users if useful and observe support/data-source impact.
5. **Provider/IP/privacy review** — resolve source permissions, Pokémon asset use, privacy and store requirements.
6. **Public release** — only if there is real demand and the operational/legal foundations are adequate.

For detailed account/community/source guidance, `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md` is the companion source of truth.
