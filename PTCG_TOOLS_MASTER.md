# PTCG Tools — Master Product & Design Document

**Status:** Current product source of truth  
**Date:** 12 September 2026  
**Repository:** `lthorpe18/ptcg-tools`  
**Public app:** `https://lthorpe18.github.io/ptcg-tools/`  
**Current roadmap handoff:** `ROADMAP_HANDOFF_2026-09-07.md`  
**Companion architecture docs:** `PERFORMANCE_ARCHITECTURE.md`, `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md`, `PLAYTEST_ARCHITECTURE.md`, `TOURNAMENT_DAY_ARCHITECTURE.md`, `SEASON_ARCHITECTURE.md`, `CARD_IMAGE_ARCHITECTURE.md`, `CARD_SEARCH_ARCHITECTURE.md`, `HOME_ARCHITECTURE.md`, `TOOLS_ARCHITECTURE.md`, `WHAT_SHOULD_I_PLAY_ARCHITECTURE.md`

## 12 September 2026 current-state update

The September bounded UI/results work materially changed the current baseline and supersedes older notes below where they conflict.

### Deck Results and personal evidence

PRs #36–#40 established **Deck Results v1** and the personal-results evidence contract:

- every saved Deck now has a top-level **Results** page beside Overview and List; Deck-specific Odds is no longer a primary deck tab;
- analysis can be viewed at **Archetype → Deck → Version** level;
- Deck scope combines all linked versions/exact lists for that saved Deck;
- Version scope isolates one exact immutable DeckVersion/list identity;
- Archetype scope combines saved Decks explicitly classified as that archetype and does not guess from deck names;
- result attribution remains strict: a Match/Game counts for a Deck only when canonical deck identity proves the link;
- personal matchup/deck/version analytics are **game-level**;
- tournament record, completion, standings and Season remain **match-level**;
- tournament Games still contribute to personal game-level deck/matchup learning;
- Training Log is game-level and excludes Tournament Day records from the Training workspace;
- PTCGL and in-person Training remain distinguishable;
- recent evidence is newest-first, including deterministic same-day creation-time ordering;
- personal evidence never overwrites or contaminates public/global H2H evidence.

The Results UI is now deliberately sprite-led and compact: summary → scope → Matchups → Decks/Versions → Recent games. Large repeated metric cards and unnecessary explanatory copy were removed.

### One canonical deck/archetype sprite renderer

PRs #41–#44 closed the repeated sprite-drift problem. There is now exactly one deck/archetype identity renderer:

`v2-preview/apps/_shared/deck-sprites.js` → `window.DeckSprites.html()`

It owns:

- archetype→sprite defaults;
- account-owned Settings overrides;
- sprite source/slug resolution;
- one- and two-Pokémon composition;
- the accepted double-sprite visual: dominant primary + smaller circular secondary badge;
- contextual sizing hooks;
- pixel-art rendering behavior.

Home, Meta, Decks, Training, Results, My Tournaments and Tournament Day consume this renderer. Feature pages may size/align the returned whole stack, but must not compose raw primary/secondary images locally or maintain a second resolver. The old Meta sprite entrypoint is compatibility plumbing only.

### Format/set maintenance UX decision

`data/formats/maintained-calendar.json` remains the current canonical manually maintained format/set calendar and continues to drive the shared format resolver. Scraping is not required for these infrequent authoritative changes.

However, direct GitHub JSON editing is no longer considered an acceptable normal user workflow. **Settings → Formats & Sets is now an explicit required app-level maintenance feature.** It must edit the same canonical shared format-calendar model rather than create a Settings-specific copy. The intended fields include set code/name, physical release date, Online legality date, IRL legality date, regulation marks, status and optional rotation metadata.

Format/set maintenance is **shared application data**, not an account preference. A future Settings UI must therefore write through an authorised shared persistence path (or equivalent controlled maintenance path), with the checked-in JSON retained as bootstrap/fallback as appropriate. Do not place the shared format calendar inside ordinary per-user snapshot preferences.

### Validation note

The repository suite currently has one known unrelated failing prediction-snapshot consistency assertion (`assert.ok(publication)`) after the automated Meta data flow changed. All bounded Deck Results, Training and sprite contracts added in this work pass. This existing Meta test debt must not be misrepresented as a failure of the personal-results/sprite work, but should be repaired during the appropriate Meta/release-hardening pass.

---

## 1. Product vision

PTCG Tools is a **personal-first, public-ready** competitive Pokémon TCG companion covering the full loop:

**Analyse → Build & Test → Prepare → Compete → Learn**

It should feel like one coherent native-style mobile application rather than a collection of utilities. The primary experience is an iPhone home-screen web app around 390 CSS px, with desktop as an adaptive expansion.

The product should answer:

1. **What should I play?** — understand the current field and exact variants positioned well into it.
2. **How should I build and test it?** — manage exact decklists, versions, maths and Mobile Playtest.
3. **How am I actually performing?** — understand personal results by archetype, Deck, exact version and matchup without confusing games with tournament Matches.
4. **What do I need physically?** — understand owned cards, allocations, missing cards and readiness when Collection is eventually reopened.
5. **Where and when can I play?** — discover events and track intent.
6. **How should I prepare?** — connect event, expected meta, deck choice, testing and final list.
7. **What should I do during a tournament?** — track real results and make cut / ID decisions.
8. **What did I learn?** — retain tournament/testing evidence for later analysis and practice planning.

Long-term connected loop:

**Meta → deck choice → deck development/testing → Event Prep → Tournament Day → Season → personal learning → next deck/practice decision.**

Collection / physical readiness will later join that loop, but remains deliberately deferred.

PTCG Tools is not intended to replace Pokémon TCG Live with a full rules engine. Mobile Playtest is a fast, flexible, touch-first tabletop.

---

## 2. Product principles

### 2.1 Decision first, methodology second

Surface the useful answer before methodology. Evidence, assumptions and advanced controls remain available through progressive disclosure.

### 2.2 Mobile first

- no desktop-first wide tables on iPhone;
- compact information density;
- comfortably tappable controls;
- mobile-safe 16 px form/search inputs;
- safe-area handling;
- no workflow depends on hover or precise drag-and-drop.

### 2.3 One product, one design system, one shared engine per shared concern

All areas share shell/navigation, tokens, cards, forms, loading/empty/error states, persistence conventions and sprite treatment.

> **If a shared engine exists, feature pages consume it. They do not recreate a second primary implementation.**

This now explicitly applies to deck/archetype sprite composition as well as Meta/field/recommendation engines.

Feature-local inference is allowed only as a genuine fallback where the shared concern has no canonical answer.

### 2.4 Pokémon character without clutter

Sprites are identity, not decoration. Representative deck/archetype sprites may show one or two Pokémon, have built-in defaults and may be overridden in **Settings → Deck icons**.

The one canonical renderer is:

`v2-preview/apps/_shared/deck-sprites.js` → `window.DeckSprites.html()`

All feature surfaces use that renderer. A two-sprite identity is always a dominant primary sprite with a smaller circular secondary badge. Feature-specific CSS may size/position the whole stack but must not recreate the composition.

Card artwork is also presentation only. Exact-print artwork resolves through shared `PTCGCardImages` and must never alter canonical Deck/card identity.

### 2.5 Fast defaults, explicit evidence

The app should work immediately, while analytical pages clearly expose evidence source/scope. Online and IRL Meta evidence are distinct datasets.

Personal evidence must also make its unit explicit: Games for personal matchup/deck learning; Matches for tournament record/standings/Season.

### 2.6 Correctness before polish

Data semantics matter more than decorative UI. Planned deck and played deck must not be conflated. Global samples must not be presented as deck-specific evidence. Games must not be silently substituted for tournament Matches or vice versa. Cached older documents must not masquerade as current state.

### 2.7 Personal-first, public-ready

- account-scoped private state;
- cross-device restoration;
- shared/public data separated from personal data;
- retained provenance;
- no silent permanent dependency on unauthorized scraping;
- independent PTCG Tools branding.

---

## 3. Current V2 application state

V2 is the active direction and public root. Implementation lives under `v2-preview/`.

Top-level product areas:

**Home · Meta · Decks · Compete · Tools**

Settings is app-level rather than a sixth competitive domain.

### Source-of-truth rule

For new work, inspect current GitHub V2 implementation first. Legacy `apps/*` code must not silently drive new architecture.

Feature chats are focused workspaces, not independent authorities. Durable ownership, identity, persistence or cross-feature changes must be promoted into this document or a companion architecture doc.

### Validation rule

Before claiming a significant change complete:

1. inspect current GitHub state;
2. explain substantial implementation approach;
3. modify V2 rather than legacy code;
4. run relevant validation where available;
5. distinguish unrelated baseline failures from feature regressions;
6. verify GitHub Pages deploys the intended SHA where deployment matters;
7. do not claim mobile visual acceptance until actually tested.

---

## 4. Feature ownership

### Home
Personal competitive dashboard and contextual shortcuts.

### Meta
Public competitive evidence, exact-variant analysis, Blended prediction, Prediction Accuracy and Expected Fields.

### Decks
Saved decks, working lists, immutable versions, **personal Results**, Training Log, Mobile Playtest, Card Search/Add Card and future physical-readiness integration.

### Compete
Events, attendance, Event Prep, Tournament Day, real tournament Match/Game capture and Competitive Record / Season.

### Tools
Small standalone competitive utilities: Cut / ID, the local organiser Tournament Manager and generic exact probability tools.

### Settings
App-level account, preferences, deck-icon overrides, data controls and the planned **Formats & Sets maintenance UI** for authorised shared calendar maintenance.

### Ownership locks

- Mobile Playtest belongs to Decks.
- Card Search/Add Card belongs to Decks and is not a sixth top-level area or generic Tools utility.
- Event finder belongs to Compete.
- Meta modelling belongs to Meta.
- Expected Fields belong to Meta as one reusable account-owned model; Compete selects/adjusts/snapshots them for Prep.
- Deck and DeckVersion identity belongs to Decks.
- Deck Results / personal matchup analysis belongs to Decks and consumes shared Match/Game evidence.
- TCGdex is shared card metadata/search infrastructure, not a new card identity model.
- Exact card identity remains the existing card name + set code + card number path used by Decks.
- Card artwork is presentation only and resolves through `PTCGCardImages`.
- Real tournament result entry belongs to Compete and writes shared Match/Game evidence.
- **Tournament record/standings/completion/Season are Match-level.**
- **Personal deck/matchup/version analysis is Game-level**, including Games recorded beneath Tournament Day Matches.
- **Training Log is Game-level** but excludes Tournament Day records from the Training workspace.
- Personal evidence never alters public H2H evidence.
- Solo/goldfish Playtest never creates competitive W/L evidence.
- Cut / ID engine/standalone utility belongs to Tools and is contextually exposed in Tournament Day.
- Tournament Manager is a standalone organiser utility. Its local tournaments never create Compete Events, `UserEventParticipation`, Tournament Day, canonical Match/Game or Season records.
- Generic Draw / Outs, Opening and Prize probability helpers belong to Tools; deck-specific consistency analysis remains Decks-owned.
- `DeckSprites.html()` is the one app-wide deck/archetype visual renderer; feature pages do not compose raw double sprites independently.
- The maintained format/set calendar is shared application data. Settings may provide its maintenance UI, but it is not ordinary account preference state.
- Collection is cross-cutting, connected to Decks, Prep and Home, and must reuse existing exact-card/Card Catalog/Card Images foundations. It remains deferred until explicitly reopened.
- Competitive seasons / CP / BFL belong to Compete.
- Home owns no competitive business logic; it consumes shared Meta, Deck, Event, Season and Tools state and routes into the owning feature.

---

## 5. Global shell, caching and performance

### 5.1 Persistent five-area shell

The production shell keeps the five core areas mounted after first load. Routine section switching changes the active view instead of rebuilding the application.

Home is a child view of this shell. The persistent shell owns the single bottom navigation layer; child Home links route through the shell rather than recursively loading the full shell inside Home.

The accepted shell boundary remains **Home · Meta · Decks · Compete · Tools**, with Settings app-level. Already-loaded areas remain mounted and unopened areas load on demand.

### 5.2 OAuth exception

Google OAuth deliberately escapes child views and navigates top-level, then returns to PTCG Tools.

### 5.3 Service worker

Navigation/document HTML is network-first. Successful responses update cache; cached documents are fallback only. Static/versioned JS/CSS/images remain cacheable.

### 5.4 No scattered dated navigation pins

Internal routes use current semantic URLs, e.g. `tournament-day.html?participation=<id>`, not feature-specific historical `?build=` pins.

Temporary external cache-busting links may be used during development verification, but are not product navigation architecture.

See `PERFORMANCE_ARCHITECTURE.md`.

---

## 6. Home — accepted current state

Home is a **derived competitive dashboard, not a directory and not a source of truth**.

The accepted single-screen iPhone hierarchy is:

1. **Blended Meta** hero;
2. **Decks | Events** side-by-side personal row;
3. **Card Search | Cut / ID | Playtest | Tournament** quick actions;
4. **What should I play?** full-width entry card;
5. persistent **Home · Meta · Decks · Compete · Tools** bottom navigation.

### 6.1 Blended Meta

Blended Meta is **PTCG Tools' best estimate of the genuine competitive field at a hypothetical major-quality tournament taking place today or tomorrow**. Online and IRL are evidence sources; Blended is the prediction derived from them.

Home consumes the shared Blended prediction rather than implementing its own Meta aggregation. Its default is the prediction for the **current Online format** and the top format chip makes that context explicit.

Settled-format weighting remains:

`IRL weight = max(30%, 70% - 2 percentage points × days since major weekend)`

`Online weight = 100% - IRL weight`

A Blended prediction requires at least one compatible Online tournament with 50+ players. During Online/IRL legality splits, separate format-labelled predictions may exist under the accepted transition rules. Event Prep selects the event-compatible prediction and Saved Expected Fields retain provenance.

Variant grouping remains presentation-only: families describe the meta; exact variants play games.

### 6.2 Home sprite treatment

Home now consumes the exact same `DeckSprites.html()` renderer as every other area. The previous Home-specific composition is retired as architecture.

Home may pass contextual size/class and position the returned whole stack beneath a bar or inside the Decks preview. It must not compose primary/secondary images locally. This rule prevents the regression where secondary badges detached from the intended stack.

### 6.3 Personal row and quick actions

The Decks preview uses the most recently edited saved Deck and routes the preview to that exact stable Deck ID while the card/background routes to Decks main.

The Events preview uses the nearest appropriate attending participation and routes the preview to that exact Tournament Day participation while the parent card routes to My Tournaments.

Quick actions are Card Search, Cut / ID, Playtest and Tournament Manager. They deep-link into their owning domains; Home owns no duplicate workflow state.

See `HOME_ARCHITECTURE.md`.

---

## 7. Meta — locked architecture

### 7.1 Sources are evidence, not themes

Online and IRL are distinct evidence sources. Source/scope controls must actually drive underlying evidence.

### 7.2 Exact variants vs families

Variant grouping is a field-share presentation layer only.

- no family pages;
- grouped families expand to exact variants;
- matchup/WR/results/deck detail belong to exact variants;
- What Should I Play analyses exact variants.

**Families describe the meta; variants play games.**

### 7.3 Expected Fields

An Expected Field is a named reusable account-owned prediction of what will be played. Saving copies current evidence into an editable prediction with provenance; it is not a silent live link to future Meta changes.

Compete/Prep uses the same records, may make event-specific adjustments and preserves an immutable Event Expected Field snapshot when finalised.

### 7.4 What Should I Play

What Should I Play is the accepted exact-variant decision-support flow:

**Field → Recommendations → direct exact-variant inspection**

Shared `PTCGMetaField` owns field semantics and shared `PTCGRecommendation` owns evidence-aware recommendation/ranking/explanation logic. Meta WSIP and Event Prep consume those engines; Home only launches WSIP.

Missing matchups remain unknown. Recommendation evidence coverage is explicit. Compare and Decide remain removed; event-specific deck choice belongs in Event Prep.

### 7.5 Matchups and exact detail

Matchups are exact-variant to exact-variant public evidence. Deck detail distinguishes field sample from H2H sample.

Personal Deck Results are a separate Decks-owned evidence domain and must not be merged into public Meta H2H without a deliberate future model.

### 7.6 Shared Meta runtime

Current shared direction includes:

- `MetaState`;
- `MetaData`;
- `MetaControls`;
- shared `DeckSprites.html()` presentation;
- `MetaBlendedField`;
- `PTCGMetaField`;
- `PTCGRecommendation`.

### 7.7 Format and rotation contract

For any relevant date the shared format foundation answers:

- released sets;
- Online legality;
- IRL legality;
- current Online/IRL format identity;
- rotation state;
- lowest legal regulation mark/set boundary where known;
- next known change.

Online and IRL may differ. Unknown dates/incomplete facts remain explicit.

`data/formats/maintained-calendar.json` is the current canonical manual source for present/upcoming set and legality facts. **Settings → Formats & Sets is now required as the normal maintenance interface**, but it must edit this same shared model through an authorised shared persistence path rather than create per-user copies.

### 7.8 Meta ingestion and delivery

Shared Meta evidence follows one central pipeline:

`Limitless sources → scheduled repository ingestion → canonical archives → validated browser release → Home/Meta`

The browser release is content-addressed and split by purpose. Supabase remains primarily private account persistence at current scale rather than a duplicate public Meta warehouse.

Prediction Accuracy exists and should mature on genuine scored IRL majors. Formula fitting/versioning should not be rushed merely because an old checkpoint number says so; accumulated real scored events should justify the fitting pass unless a clear structural flaw appears earlier.

---

## 8. Accounts, persistence and Settings

### 8.1 Authentication and cloud persistence

Google sign-in through Supabase Auth is implemented. Current per-account persistence uses one schema-versioned `user_snapshots` row per user protected by RLS.

Durable personal state includes:

- Decks and embedded DeckVersions;
- event participations;
- real Match/Game history;
- preferences/deck icon overrides;
- Saved Expected Fields.

Local changes auto-sync; cross-device restoration has been proven.

### 8.2 Snapshot vs normalized future tables

The account snapshot remains pragmatic while the product model evolves. Normalize only when concrete query/conflict/history/scale/collaboration needs justify it.

### 8.3 Settings → Deck icons

Deck icon overrides are account-owned presentation preferences. Every feature surface consumes the same shared `DeckSprites.html()` renderer, so one override propagates across Home, Meta, Decks and Compete.

### 8.4 Settings → Formats & Sets — required next maintenance surface

Settings is the correct app-level place for authorised maintenance of the shared set/format calendar.

The UI should show current context and upcoming changes, then allow maintaining fields such as:

- set code;
- set name;
- physical release date;
- Online legality date;
- IRL legality date;
- regulation mark(s);
- fact status (for example announced/confirmed);
- optional rotation trigger/details such as lowest legal mark, legal marks and earliest legal set.

The UI must write the **same canonical shared format model** consumed by the format resolver. It must not create a separate Settings-only calendar and must not store shared set facts in ordinary per-user preferences.

No automatic scraping is required. Checked-in `maintained-calendar.json` may remain bootstrap/fallback, while the maintainable shared source can move behind an authorised global persistence mechanism when implemented.

### 8.5 Settings current-stage status

The earlier account/preferences Settings review remains accepted. Settings is now deliberately reopened only for the bounded **Formats & Sets** maintenance feature and any directly required shared-persistence plumbing. This is not a general Settings redesign.

See `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md`.

---

## 9. Decks

### 9.1 Deck workspace information architecture

The Decks area contains three peer workspace sections:

**My Decks · Training Log · Card Search**

Inside an individual Deck, the primary tabs are now:

**Overview · List · Results**

Generic Odds remains Tools-owned rather than occupying a high-level Deck tab.

### 9.2 Deck identity

A Deck is a long-lived personal project with:

- stable Deck ID;
- user-facing name;
- separate exact archetype classification;
- mutable working list;
- embedded immutable DeckVersion/checkpoint records;
- canonical `listHash` values.

Deck name and archetype are separate concepts.

### 9.3 Version model

- working list may change;
- checkpoints/DeckVersions are immutable exact lists;
- every exact list has canonical `listHash`;
- identical canonical lists reuse the matching checkpoint;
- historical refs use `deckId + listHash`, plus `deckVersionId` where selected;
- historical display snapshots survive later rename/deletion.

### 9.4 Deck Results v1

Results is the current first slice of the personal performance/learning loop.

Analysis scopes:

- **Archetype** — combine canonically linked evidence from saved Decks explicitly classified as that archetype;
- **Deck** — default; combine all canonically linked versions/lists for the saved Deck;
- **Version** — isolate one exact saved DeckVersion/list identity.

Core outputs:

- Game W-L-D;
- game win rate;
- games played;
- source breakdown where evidence exists;
- Matchups by opponent archetype;
- Deck breakdown at Archetype scope;
- Version breakdown at Deck scope;
- Recent games with canonical own/opponent sprite identity and drill-through where possible;
- secondary tournament Match record where relevant.

Do not infer old/unlinked evidence from deck name/archetype when canonical IDs do not prove attribution.

Small samples must be presented as small samples, not authoritative rates.

### 9.5 Training Log

Training is a practice/testing workspace over the canonical Match/Game store.

Its analytics unit is **Game**, not Match:

- PTCGL imports are naturally individual game evidence;
- an in-person best-of-three entry may retain one editable parent entry/session while contributing its individual Games to analysis;
- Training summaries/history expose game outcomes;
- Training Log excludes Tournament Day Matches from the Training workspace;
- newest-first sorting uses date plus creation-time tie-breaking.

Tournament Games may still contribute to Deck Results/personal matchup learning through the shared evidence layer; they simply do not appear as Training Log entries.

### 9.6 Personal evidence boundary

The app-wide rule is:

- **personal deck/matchup/version learning = Games**;
- **tournament record/standings/Season = Matches**;
- **public Meta H2H = separate global evidence**.

Personal results never overwrite public H2H. Solo Playtest never creates competitive evidence.

This foundation is intended to support later Personal Matchup Analysis and Practice Priorities without creating another store.

### 9.7 Card Search / Add Card

Card Search remains an established reusable Decks capability using the shared TCGdex-backed catalog and exact card identity of card name + set code + card number.

Current format filters include All, Standard and GLC. Artwork resolves through `PTCGCardImages`.

Small cleanup debt remains around Card Search bootstrap and GLC helper layering; treat this as Release Hardening, not an open feature milestone.

### 9.8 Mobile Playtest

Mobile Playtest v1 remains feature-complete for the current stage: Decks-owned, solo/goldfish, touch-first, manual/flexible rather than a rules engine. Transient tabletop state is local and does not automatically create Training or competitive W/L evidence.

See `PLAYTEST_ARCHITECTURE.md`, `CARD_SEARCH_ARCHITECTURE.md` and `CARD_IMAGE_ARCHITECTURE.md`.

---

## 10. Collection / physical readiness — deferred future milestone

Collection / physical readiness remains planned but **not active**.

> Do not start Collection implementation until the user explicitly reopens it after being very happy with the rest of the app.

When eventually implemented, Collection must reuse existing Deck/DeckVersion/listHash identity, exact card identity, `PTCGCardCatalog` and `PTCGCardImages`. It should derive readiness from exact immutable list references rather than copied editable truth.

No current feature should add Collection-specific state merely to prepare for it unless a present-day shared foundation is independently justified.

---

## 11. Compete / Events

Compete owns:

**Discover → Interested/Attending → Prepare → Play → Complete → Season record**

The same `UserEventParticipation` progresses through the lifecycle.

### 11.1 Event sources and UI

Local discovery primarily uses Pokédata for Cups/Challenges/Prereleases. Majors use official Pokémon Championship Series data as authority and may be enriched by RK9 where appropriate.

Current in-page views are:

**Nearby · Majors · My Events · Season**

My Events lifecycle filters are Current, Upcoming, Incomplete and Completed; Archived is secondary recovery state.

### 11.2 Event Prep

Event Prep v1 is implemented/accepted. It integrates event-date format selection, Expected Field review, candidate decks, planned exact list and immutable locks.

Later Event Prep improvement should consume personal Practice Priorities rather than duplicate personal-results analytics.

### 11.3 Planned deck vs used deck

`plannedDeckRef` and `usedDeckRef` remain separate. Prep may plan an exact list; Tournament Day may start without a deck. A planned list must never silently become the played list.

### 11.4 Tournament Day

Tournament Day remains the canonical real-tournament capture surface:

- Event-linked or ad-hoc;
- no mandatory deck gate before rounds;
- exact used DeckVersion control;
- game-by-game W/L/T entry;
- Match W/L/D derived from Games;
- IDs supported;
- opponent archetype search;
- compact canonical sprite round history;
- contextual Cut / ID;
- completion requires exact played-deck snapshot;
- manual Top Cut tags;
- editing replaces stable Match rather than duplicating it.

Tournament W-L-D remains Match-level. The Games beneath those Matches are available to Decks personal-learning analytics.

See `TOURNAMENT_DAY_ARCHITECTURE.md`.

### 11.5 Competitive Record / Season

Season v1 remains accepted for the 2027 Championship Series, with official CP/BFL rules, exact used-deck/version display, linked rounds/Top Cut evidence and user corrections.

Season derives from completed tournament history; it is not a second editable result store.

---

## 12. Tools — accepted current state

Tools contains:

**Cut / ID · Tournament · Odds**

- Cut / ID uses the canonical shared engine and is contextually consumed by Tournament Day.
- Tournament Manager is a standalone organiser utility and remains isolated from personal Compete evidence.
- Odds contains Draw / Outs, Opening and Prizes using shared combinatoric maths.

Generic Odds remains Tools-owned; Decks Results replaced the prior high-level Deck Odds tab.

Further Tools work is bugfix/polish only unless a genuinely useful standalone utility earns a place.

---

## 13. Technical architecture direction

Plain HTML/CSS/JavaScript remains acceptable. Do not introduce a heavy framework merely for modernization.

Strengthen shared layers instead.

Shared responsibilities include:

- persistent shell/navigation;
- auth/session lifecycle;
- cloud sync;
- design tokens/forms/list patterns;
- persistence/preferences;
- **one deck/archetype sprite renderer**;
- exact-card metadata/search catalog;
- exact-card artwork resolution/fallback;
- caching/service worker;
- Match/Game store;
- personal-results aggregation over canonical Match/Game evidence;
- Deck store;
- Cut/ID engine;
- exact probability/combinatorics helper;
- Season engine/versioned rules/config;
- source/scope runtime where applicable;
- shared current-field blend/read model;
- shared format/rotation resolver and maintainable canonical set calendar.

Domain logic remains separated among Meta, Decks, Compete, future Collection and Tools.

### Shared upstream direction

Prefer:

`external source → PTCG Tools ingestion/cache → normalized shared data → all users`

rather than every browser independently hitting upstream services.

The same principle applies to manually maintained global set/format facts: one authorised shared source should feed every user rather than each account maintaining its own calendar.

---

## 14. Current roadmap status — 12 September 2026

### Completed / substantially established

- V2 design language and persistent shell;
- navigation/performance baseline;
- service-worker/static-data caching baseline;
- network-first navigation HTML;
- Google authentication and cross-device account persistence;
- Meta source/scope architecture and exact-variant analysis;
- Format/Rotation and Blended Meta v2 Checkpoints 1–9 accepted;
- What Should I Play accepted flow;
- Expected Fields;
- Prediction Accuracy through current scoring/history UI;
- Home dashboard redesign and contextual navigation;
- Deck working-list/version/hash foundation;
- Decks peer workspace model: My Decks / Training Log / Card Search;
- Card Search/Add Card and shared card-art foundation;
- Mobile Playtest v1;
- shared Match/Game contract;
- **Deck Results v1 with Archetype / Deck / Version scopes**;
- **game-level Training and personal matchup/deck evidence**;
- **strict separation of personal Games from tournament Match record and public H2H**;
- **one canonical app-wide `DeckSprites.html()` renderer consumed across Home, Meta, Decks and Compete**;
- Event discovery/attendance/retention;
- Event Prep v1;
- Tournament Day v1;
- Season v1 with 2027 CP/BFL;
- Tools review with Cut / ID · Tournament · Odds.

### Known bounded debt

- prediction-snapshot consistency test currently has one unrelated failing `publication` assertion;
- Card Search bootstrap/GLC helper layering should be consolidated during Release Hardening;
- audit remaining Playtest local card-art helpers and migrate to `PTCGCardImages` where needed;
- retire obsolete legacy/patch/enhancer surfaces once parity is proven;
- verify service-worker/cache generation and asset-version consistency during Release Hardening.

### Required next bounded feature: Settings → Formats & Sets

The user has explicitly required a normal in-app place to add/edit future set releases and legality/rotation dates. Implement **Settings → Formats & Sets** against the one shared format-calendar model. This should be a bounded app-level maintenance feature, not a general Settings redesign and not per-user set data.

### Subsequent recommended sequence before Collection

1. **Settings → Formats & Sets** shared maintenance UI and authorised persistence path.
2. **Personal Matchup Analysis** building on Deck Results/game evidence.
3. **Practice Priorities** derived from expected field × matchup difficulty × personal evidence.
4. **Event Prep v2 integration** so Prep surfaces selected deck/list plus concise practice priorities/readiness.
5. **Deck Version Intelligence** — exact card diffs, evidence by version and version lineage where useful.
6. **Compete → Online tournament discovery** — future Limitless tournaments; defaults to Standard on PTCGL, 17:00–22:00 Europe/London (GMT/BST). Format/platform and time controls include all-format/platform/time overrides. Cards show name/link, UK date/time and format/platform, with format-specific colour accents plus text labels. Users can mark attendance and record results through existing shared participation/tournament-day flows; saved snapshots survive discovery expiry. Online events do not receive IRL Event Prep links. This 12 September 2026 scope supersedes the earlier discovery-only/no-participation restriction.
7. **Prediction Accuracy maturation** as genuine scored majors accumulate; fitting/versioning when evidence justifies it.
8. **Release Hardening / data safety / installed-iPhone regression**.
9. **Collection / physical readiness** only when explicitly reopened.

A broad generic “UI consistency pass” is no longer a roadmap milestone. Continue fixing concrete real-use issues in bounded passes.

---

## 15. Release-hardening milestone before stable release

Before calling the app stable, perform a formal Development Cleanup / Release Hardening pass.

Repository-wide checks include:

- temporary build strings/stale route pins;
- hidden legacy UI/render code;
- enhancement layers that should be merged into core;
- duplicate domain/presentation engines;
- obsolete sprite composition helpers — there should remain only one canonical `DeckSprites.html()` renderer;
- Card Search patch/bootstrap consolidation;
- duplicated feature-local card-art resolvers;
- obsolete compatibility shims;
- old service-worker/cache assumptions;
- asset-version consistency;
- stale standalone pages no longer used by navigation;
- account export/backup/recovery validation;
- sync failure/reconciliation testing;
- installed-iPhone end-to-end regression on the current deployed SHA.

The objective is reducing drift and stale-code regressions, not aesthetic refactoring for its own sake.

---

## 16. Product success criteria

PTCG Tools is successful when:

- it feels like one coherent product;
- repeat navigation between core areas feels immediate;
- account-owned state follows the user across devices;
- Home is useful competitive context, not a launcher;
- the current-field blend has one shared formula and clear evidence semantics;
- Meta communicates evidence scope correctly;
- What Should I Play turns a chosen field into a small evidence-aware exact-variant recommendation list;
- exact variants interlink consistently;
- Decks supports My Decks, Training Log, Card Search, editing/versioning/analysis/playtest without duplicate identities;
- a player can inspect results at Archetype, Deck and exact Version level;
- personal matchup/deck learning correctly treats individual Games as evidence while tournament/Season records remain Match-level;
- old/unlinked evidence is not guessed onto a Deck merely because names look similar;
- personal evidence never contaminates public H2H;
- Training history and recent results are genuinely newest-first;
- configured archetype/deck sprites look the same everywhere because **one shared renderer owns both mapping and composition**;
- two-Pokémon identities use the same primary + circular-secondary treatment across Home, Meta, Decks and Compete;
- current/upcoming set and legality facts can be maintained in-app through Settings without creating per-user divergent calendars;
- Card Search discovers exact printings without introducing a second card/deck identity system;
- exact card artwork is consistent because one shared resolver owns provider/fallback choice;
- an Attending event moves naturally through Prep → Tournament Day → Completion → Season;
- Tournament Day begins without unnecessary setup while retaining exact played-deck identity;
- round capture is fast enough for real tournament use on iPhone;
- Season preserves historical CP/ruleset identity and BFL semantics;
- future Practice Priorities can be derived from existing evidence rather than a new parallel result store;
- future physical readiness can answer “can I build this?” without double counting when Collection is eventually implemented;
- Cut / ID answers deterministic questions before probabilistic ones;
- standalone organiser tournaments remain isolated from personal Compete evidence;
- advanced methodology remains available without dominating routine use;
- future scale does not require every browser to hammer upstream providers independently.

---

Historical checkpoint documents remain useful evidence for how current contracts were reached. Where an older checkpoint/handoff conflicts with this 12 September master state, this document and the updated companion architecture documents take precedence.
