# PTCG Tools — Master Product & Design Document

**Status:** Current product source of truth  
**Date:** 4 September 2026  
**Repository:** `lthorpe18/ptcg-tools`  
**Public app:** `https://lthorpe18.github.io/ptcg-tools/`  
**Companion architecture docs:** `PERFORMANCE_ARCHITECTURE.md`, `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md`, `PLAYTEST_ARCHITECTURE.md`, `TOURNAMENT_DAY_ARCHITECTURE.md`, `SEASON_ARCHITECTURE.md`

## 1. Product vision

PTCG Tools is a **personal-first, public-ready** competitive Pokémon TCG companion covering the full loop:

**Analyse → Build & Test → Prepare → Compete → Learn**

It should feel like one coherent native-style mobile application rather than a collection of utilities. The primary experience is an iPhone home-screen web app around 390 CSS px, with desktop as an adaptive expansion.

The product should answer:

1. **What should I play?** — understand the current field and exact variants positioned well into it.
2. **How should I build and test it?** — manage exact decklists, versions, maths and Mobile Playtest.
3. **What do I need physically?** — understand owned cards, allocations, missing cards and readiness.
4. **Where and when can I play?** — discover events and track intent.
5. **How should I prepare?** — connect event, expected meta, deck choice, testing and final list.
6. **What should I do during a tournament?** — track real results and make cut / ID decisions.
7. **What did I learn?** — retain tournament/testing evidence for later analysis.

Long-term connected loop:

**Meta → deck choice → deck development/testing → physical readiness → event preparation → tournament-day decisions → season record → review/learning.**

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

Feature-local inference is allowed only as a genuine fallback.

### 2.4 Pokémon character without clutter

Sprites are identity, not decoration. Representative deck sprites may show one or two Pokémon, have built-in defaults and may be overridden in **Settings → Deck icons**.

The canonical current archetype sprite mapping/render source is `window.DeckSprites` from the shared Meta sprite module.

### 2.5 Fast defaults, explicit evidence

The app should work immediately, while analytical pages clearly expose evidence source/scope. Online and IRL Meta evidence are distinct datasets.

### 2.6 Correctness before polish

Data semantics matter more than decorative UI. Planned deck and played deck must not be conflated. Global samples must not be presented as deck-specific evidence. Cached older documents must not masquerade as current state.

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
5. verify GitHub Pages deploys the intended SHA;
6. do not claim mobile visual acceptance until actually tested.

---

## 4. Feature ownership

### Home
Personal competitive dashboard and contextual shortcuts.

### Meta
Public competitive evidence, exact-variant analysis and Expected Fields.

### Decks
Saved decks, working lists, immutable checkpoints/versions, deck maths, Mobile Playtest and future physical-readiness integration.

### Compete
Events, attendance, Event Prep, Tournament Day, real tournament results and Competitive Record / Season.

### Tools
Small standalone competitive utilities only.

### Settings
Account, preferences, deck-icon overrides and future storage/import/export controls.

### Ownership locks

- Mobile Playtest belongs to Decks.
- Event finder belongs to Compete.
- Meta modelling belongs to Meta.
- Expected Fields belong to Meta as one reusable account-owned model; Compete selects/adjusts/snapshots them for Prep.
- Deck and DeckVersion identity belongs to Decks.
- Real tournament result entry belongs to Compete and writes shared Match/Game evidence.
- Solo/goldfish Playtest never creates competitive W/L evidence.
- Cut / ID engine/standalone utility belongs to Tools and is contextually exposed in Tournament Day.
- Collection is cross-cutting, connected to Decks, Prep and Home.
- Competitive seasons / CP / BFL belong to Compete.

---

## 5. Global shell, caching and performance

### 5.1 Persistent five-area shell

The production shell keeps the five core areas mounted after first load. Routine section switching changes the active view instead of rebuilding the application.

### 5.2 OAuth exception

Google OAuth deliberately escapes child views and navigates top-level, then returns to PTCG Tools.

### 5.3 Service worker

Navigation/document HTML is **network-first** as of 4 September 2026. Successful responses update cache; cached documents are fallback only. Static/versioned JS/CSS/images remain cacheable.

This prevents older cached document HTML from reopening older feature generations after deployment.

### 5.4 No scattered dated navigation pins

Internal routes should use current semantic URLs, e.g. `tournament-day.html?participation=<id>`, not feature-specific historical `?build=` pins.

Temporary external cache-busting links may be used during development verification, but are not product navigation architecture.

See `PERFORMANCE_ARCHITECTURE.md`.

---

## 6. Home

Home is a competitive dashboard, not a directory.

Priority context:

- current format;
- high-value What Should I Play route;
- current Meta snapshot;
- recently edited/used deck;
- next event/attendance;
- current Season/CP context when meaningful;
- compact shortcuts to Decks, Events and Cut / ID.

Only show personal modules when meaningful data exists.

---

## 7. Meta — locked architecture

### 7.1 Sources are evidence, not themes

Online and IRL are distinct evidence sources. Source/scope controls must actually drive underlying evidence.

### 7.2 Online scopes

- Last 14 days;
- Last 30 days;
- Since last major weekend;
- All in format.

Same-weekend IRL majors merge when defining latest major weekend.

### 7.3 IRL scopes

- Latest IRL majors weekend;
- All IRL majors this format;
- Individual event.

Scope behavior must remain consistent across Current Meta, Matchups, Deck Explorer, Deck Detail and What Should I Play.

### 7.4 Exact variants vs families

Variant grouping is only a Current Meta field-share presentation layer.

- no family pages;
- grouped families expand inline to exact variants;
- matchup/WR/results/deck detail belong to exact variants;
- What Should I Play analyses exact variants.

**Families describe the meta; variants play games.**

### 7.5 Expected Fields

An Expected Field is a named reusable account-owned prediction of what will be played.

It may be created from Online, IRL, an individual event/weekend, a transparent blend preset, another Expected Field or a blank/custom starting point.

Saving copies current evidence into an editable prediction with provenance. It is not a silent live link to future Meta changes.

Compete/Prep uses the same records, may make event-specific adjustments, and preserves an immutable Event Expected Field snapshot when finalised.

### 7.6 Matchups and exact deck detail

Matchups are exact-variant to exact-variant evidence.

Deck detail must distinguish field sample from head-to-head matchup sample. Do not substitute overall tournament counts for deck-specific samples.

### 7.7 Shared Meta runtime

Direction:

- MetaState — source/scope state;
- MetaData — evidence/data access;
- MetaControls — shared source/scope behavior;
- DeckSprites — canonical archetype presentation mapping/rendering.

---

## 8. Accounts, persistence and Settings

### 8.1 Authentication

Google sign-in through Supabase Auth is implemented and proven across devices. Google is the only provider for now.

### 8.2 Cloud persistence

Current per-account persistence uses one schema-versioned `user_snapshots` row per user protected by Supabase RLS.

Durable personal state includes:

- Decks and embedded DeckVersions;
- root V2 state including `eventParticipations`;
- real Match/Game history;
- preferences/deck icon overrides;
- saved Expected Fields.

Local changes auto-sync; cross-device restoration has been tested successfully. Sync ownership remains top-level shell.

### 8.3 Snapshot vs normalized future tables

The account snapshot remains pragmatic while the product model evolves. Normalize domains only when concrete query/conflict/history/scale/collaboration needs justify it.

### 8.4 Settings → Deck icons

Deck icon overrides are account-owned presentation preferences. All feature surfaces displaying archetype sprites should consume the shared `DeckSprites` mapping first.

See `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md`.

---

## 9. Decks

### 9.1 Deck identity

A Deck is a long-lived personal project with:

- stable Deck ID;
- user-facing name;
- separate exact archetype classification;
- mutable working list;
- embedded immutable DeckVersion/checkpoint records;
- canonical `listHash` values.

Deck name and archetype are separate concepts.

### 9.2 Version model

- working list may change;
- checkpoints/DeckVersions are immutable exact lists;
- every exact list has canonical `listHash`;
- identical canonical lists reuse the matching checkpoint;
- historical refs use `deckId + listHash`, plus `deckVersionId` where selected;
- historical display snapshots survive later rename/deletion.

### 9.3 Mobile Playtest

Mobile Playtest v1 is feature-complete for the current stage.

It is Decks-owned, solo/goldfish, touch-first, iPhone-first and manual/flexible after setup rather than a partial rules engine.

Transient tabletop state is local browser work-in-progress and is not automatically cloud-synced.

See `PLAYTEST_ARCHITECTURE.md`.

### 9.4 Match evidence boundary

Real PTCGL/in-person results use shared Match/Game evidence. Playtest observations are a separate future practice-evidence domain and never alter competitive matchup W/L statistics.

---

## 10. Collection / physical readiness

Long-term requirement:

> Maintain exact owned quantities and allocations so the user can immediately see what must be bought, moved or freed up for a saved exact deck list.

The model must support exact printing/card identity where relevant, gameplay equivalence where appropriate, loose inventory, deck allocations, multiple simultaneously built decks, no accidental double allocation, required vs owned vs allocated, and missing/shopping lists.

Collection connects to Decks, Prep and Home.

---

## 11. Compete / Events

Compete owns:

**Discover → Interested/Attending → Prepare → Play → Complete → Season record**

The same `UserEventParticipation` progresses through the lifecycle.

### 11.1 Event sources

Local discovery primarily uses Pokédata for Cups/Challenges/Prereleases.

Majors use official Pokémon Championship Series data as existence/date authority and may be enriched by RK9 for practical outbound details where appropriate. Provenance is retained.

### 11.2 Events UI

The Events surface has one permanent shared header and four in-page views:

**Nearby · Majors · My Tournaments · Season**

Neither My Tournaments nor Season should navigate to a duplicate top-level Events header during normal use.

My Tournaments primary lifecycle filters are:

- **Current** — tournament dated today;
- **Upcoming** — future-dated uncompleted tournament;
- **Incomplete** — past/undated tournament record without completion;
- **Completed** — completed tournament record.

There is no All filter.

**Archived is secondary**, not an equal lifecycle tab. It is surfaced only when archived records exist and is used for recovery/cleanup.

Default behavior:

- Current when at least one tournament is today;
- otherwise Upcoming.

Ordering:

- Current/Upcoming → nearest first;
- Incomplete/Completed/Archived → most recent first.

A completed or archived tournament may be reopened without deleting its event snapshot, used deck or Match/Game history. Reopening clears completion/archive state and routes the record back to Current, Upcoming or Incomplete according to date.

### 11.3 Event lifecycle and retention

`UserEventParticipation` is the canonical account-owned relationship. It retains:

- attendance/status;
- event snapshot;
- Prep;
- `plannedDeckRef`;
- `usedDeckRef`;
- Tournament Day state;
- Matches via `participationId`;
- completion;
- season identity/ruleset reference when applicable.

Historic shared local-feed rows are not required once a retained participation snapshot exists.

Past attending records without completion become Incomplete/Needs completion rather than silently implying final results were entered.

### 11.4 Event Prep

Event Prep v1 is implemented.

Normal journey:

1. mark event Attending;
2. review suggested Expected Field;
3. consider candidate decks;
4. record lightweight reactions;
5. choose/import exact list;
6. play/record tournament;
7. retain event/list/field evidence for later learning.

Prep orchestrates Meta/Decks/evidence; it does not duplicate their ownership.

### 11.5 Planned deck vs used deck

`plannedDeckRef` and `usedDeckRef` are separate.

Prep may plan exact `deckId + deckVersionId + listHash`. Tournament Day may start without a deck selected. The user can attach/change/remove the exact deck actually played at any point.

A planned deck may be suggested but must never silently become the played deck.

### 11.6 Tournament Day v1 — accepted current state

Tournament Day v1 is accepted for the current product stage.

Implemented behavior includes:

- Event-linked or ad-hoc tournament entry;
- one canonical `UserEventParticipation` lifecycle;
- no mandatory deck gate before rounds;
- compact My Deck control for exact used DeckVersion;
- game-by-game W/L/T capture;
- aggregate Match W/L/D derived from canonical Matches;
- intentional draw capture/display;
- opponent archetype search;
- compact opponent-focused round history with shared DeckSprites;
- contextual ID Calc using shared Tools engine;
- completion into `UserEventParticipation.completion`;
- completion requires exact played deck snapshot;
- manual Top Cut stage tags stored on the canonical Match.

Accepted manual round stages:

- Swiss/default;
- Asym Top 16;
- Asym Top 8;
- Asym Top 4;
- Top 16;
- Top 8;
- Top 4;
- Finals.

The 2026 Pokémon rules update caps TCG asymmetrical top cut at 16 competitors. PTCG Tools does not automate bracket determination in v1; the user tags the stage.

Round history remains canonical Match/Game evidence. Editing replaces the stable Match rather than creating duplicates.

See `TOURNAMENT_DAY_ARCHITECTURE.md`.

### 11.7 Competitive Record / Season v1 — accepted current state

Competitive Record / Season v1 is accepted/complete for the current product stage.

Competitive seasons are first-class entities; calendar year is not an adequate substitute.

Current season identity:

- season: `pokemon-2027` / **2027 Championship Series**;
- verified start: 1 September 2026;
- whole-season end: deliberately unset pending direct official verification;
- ruleset: `pokemon-tcg-2027-cp` version `2027.1`.

Season v1 currently provides:

- official 2027 TCG placement/player-count CP rules for Challenges, Cups, Regionals, Specials and Internationals;
- raw CP;
- counting CP;
- BFL application: best 4 Challenges, best 4 Cups, best 5 combined Regional/Special/International finishes;
- completed-event results from the existing participation history;
- per-user correction of event type, placement and player count;
- exact used-deck/version display snapshots;
- linked Match round evidence including Top Cut tags;
- direct link back to Tournament Day;
- compact in-page `2027 Season` view under the permanent Events header.

Supported Championship Series completions persist historical identity:

```js
participation.seasonId = 'pokemon-2027'
participation.seasonRulesetRef = {
  id: 'pokemon-tcg-2027-cp',
  version: '2027.1',
  assignedAt: 'completion timestamp',
  source: 'tournament-completion'
}
```

Generic locals/prereleases are not stamped as CP events merely because they fall within the season date range.

Older supported completions without explicit identity continue to derive and are safely stamped when next opened in Tournament Day.

`SeasonSummary` remains derived and must never become a second editable tournament-history store.

One manually recorded Cup has been user-smoke-tested and the expected tournament information flowed into Season correctly.

Non-blocking verification/maintenance remains useful for the Season implementation:

- execute deterministic Season engine tests in a real JS runtime;
- exercise BFL overflow/displacement beyond official limits;
- verify Season correction sync across devices;
- additional real iPhone smoke testing;
- directly verify and fill the official 2027 season end boundary when an authoritative source is available.

These checks no longer keep the Season milestone open. A genuine defect found by them may reopen a bounded Season bugfix, but not a broad Season feature programme.

See `SEASON_ARCHITECTURE.md`.

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
- auth/session lifecycle;
- cloud sync;
- design tokens/forms/list patterns;
- persistence/preferences;
- archetype sprite mapping/rendering;
- caching/service worker;
- Match/Game store;
- Deck store;
- Cut/ID engine;
- Season engine/versioned rules/config;
- source/scope runtime where applicable.

Domain logic remains separated among Meta, Decks, Compete, Collection and Tools.

### Shared upstream direction

Prefer:

`external source → PTCG Tools ingestion/cache → normalized shared data → all users`

rather than every browser independently hitting upstream services.

### Source adapters

Long-term normalized entities include Tournament, TournamentResult, Decklist, Match, Event and Card. Adapters retain provenance/access classification.

---

## 14. Current roadmap status — 4 September 2026

### Completed / substantially established

- V2 design language and persistent shell;
- navigation-performance milestone;
- service-worker/static-data caching baseline;
- network-first navigation HTML fix;
- Google authentication and cross-device account persistence;
- Meta source/scope architecture and exact-variant analysis;
- Expected Fields;
- Deck working-list/version/hash foundation;
- shared Match/Game contract;
- Mobile Playtest v1;
- Event discovery/attendance/retention foundation;
- Event Prep v1;
- My Tournaments in-page lifecycle view;
- Tournament Day v1 accepted core recording/results flow;
- contextual Cut / ID workflow;
- shared DeckSprites reused by Compete;
- manual canonical Top Cut round tagging;
- tournament reopen lifecycle;
- **Competitive Record / Season v1 accepted/complete for the current product stage**;
- official 2027 Season CP/BFL engine and rules/config;
- completion-time season/ruleset identity persistence;
- Season result detail linked to exact used deck/version and canonical rounds.

### Active status

**Collection / physical readiness is the next major product milestone.**

Tournament Day and Season are closed for the current stage. Remaining acceptance, verification or helper cleanup in those areas is non-blocking and should only interrupt the roadmap for a genuine regression or correctness defect.

### Recommended next major milestones

1. **Collection / physical readiness** — owned quantities, allocations and missing/shopping connected to exact DeckVersions and planned event lists.
2. **Learning loop** — personal tournament/matchup/practice analytics with explicit evidence provenance.
3. **Development Cleanup / Release Hardening** — repository-wide removal of temporary scaffolding, stale routes, duplicate engines and obsolete compatibility layers before calling the broader app stable/public-ready.
4. **Community/public expansion when useful** — privacy/export/delete, centralized ingestion and operational observability as required by actual usage.

Performance is not a dedicated next milestone unless a material regression appears.

---

## 15. Release-hardening milestone before stable release

Before calling the app stable, perform a formal **Development Cleanup / Release Hardening** pass.

Repository-wide checks must include:

- temporary `?build=` development strings;
- stale route pins;
- hidden-but-not-deleted legacy UI/render code;
- enhancement layers that should be merged into core;
- duplicate domain/presentation engines;
- obsolete compatibility shims;
- old cache generations/service-worker assumptions;
- asset version consistency;
- stale standalone pages no longer used by navigation;
- mobile acceptance on the current deployed SHA.

The objective is not aesthetic refactoring. It is reducing drift, duplicate behavior and stale-code regressions before stable/public-ready release.

---

## 16. Product success criteria

PTCG Tools is successful when:

- it feels like one coherent product;
- repeat navigation between core areas feels immediate;
- account-owned state follows the user across devices;
- Home is useful competitive context, not a launcher;
- Meta communicates evidence scope correctly;
- exact variants interlink consistently;
- Decks supports editing/versioning/analysis/playtest without duplicate identities;
- an Attending event moves naturally through Prep → Tournament Day → Completion → Season;
- Tournament Day begins without unnecessary setup while retaining exact played-deck identity;
- round capture is fast enough for real tournament use on iPhone;
- Season correctly preserves historical CP/ruleset identity and BFL semantics;
- configured archetype sprites look the same everywhere because one shared mapping owns them;
- physical readiness can eventually answer “can I build this?” without double counting;
- Cut / ID answers deterministic questions before probabilistic ones;
- advanced methodology remains available without dominating routine use;
- future scale does not require every browser to hammer upstream providers independently.

---

## 17. Features to avoid / defer

- full automated Pokémon rules engine;
- AI opponent as an early Playtest dependency;
- social-network/community feed layer;
- novelty-calculator sprawl;
- Meta family pages;
- premature hyperscale architecture;
- duplicate cross-feature engines for concerns already owned centrally;
- speculative qualification/ranking logic not backed by official data.

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

1. **Personal product** — complete the primary user's competitive workflow.
2. **Development Cleanup / Release Hardening** — remove temporary scaffolding and duplicate implementations before calling a version stable.
3. **Local community** — validate with a small cohort if useful.
4. **Private beta** — expand only if value/support model is proven.
5. **Provider/IP/privacy review** — resolve source and distribution obligations.
6. **Public release** — only when operational/legal foundations are adequate.

The broader product loop remains:

**Analyse → Build & Test → Prepare → Compete → Learn**
