# PTCG Tools — Roadmap Handoff — 5 September 2026

**Status:** Current coordination handoff after the bounded What Should I Play rebuild  
**Updated:** 6 September 2026 — final WSIP iPhone acceptance recorded  
**Companion to:** `PTCG_TOOLS_MASTER.md`, `WHAT_SHOULD_I_PLAY_ARCHITECTURE.md`, `TOOLS_ARCHITECTURE.md`, `PERFORMANCE_ARCHITECTURE.md`, `HOME_ARCHITECTURE.md`, `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md`, `TOURNAMENT_DAY_ARCHITECTURE.md`

## 1. Current programme position

The bounded September product-surface sequence preceding Collection is now complete.

Accepted/closed for the current product stage:

- Home / Menu;
- Meta navigation;
- Meta ingest/data-delivery architecture;
- Navigation / Shell regression pass;
- Settings review;
- Tools review;
- What Should I Play review, bounded rebuild and final iPhone polish/acceptance.

The persistent product shell remains:

**Home · Meta · Decks · Compete · Tools**

Settings remains app-level.

The next active major milestone is now:

> **Collection / physical readiness v1**

Do not reopen the recently accepted areas as broad feature programmes unless a concrete regression or genuine Collection dependency appears.

---

## 2. Accepted application foundations

Current-stage accepted or substantially established foundations include:

- persistent five-area shell and navigation-performance architecture;
- already-loaded core areas remain mounted, unopened areas load on demand;
- network-first navigation/document HTML;
- Home single-screen derived dashboard and accepted contextual deep-link semantics;
- Meta source/scope, exact-variant, Expected Field, navigation and ingest/delivery architecture;
- shared exact-variant field vocabulary and What Should I Play recommendation engine used by Meta and Event Prep;
- final WSIP flow of **Field → Recommendations → direct exact-variant inspection**, with Compare and Decide deliberately removed;
- Deck / DeckVersion / `listHash` identity foundation;
- Decks workspace: My Decks / Training Log / Card Search;
- shared Card Catalog / exact-print mapping;
- shared Card Images resolver;
- Mobile Playtest v1;
- Events discovery/attendance/retention;
- Event Prep v1;
- Tournament Day v1;
- shared Match/Game evidence;
- Competitive Record / Season v1 including 2027 CP/BFL rules/config;
- Google authentication and cross-device account snapshot persistence;
- Settings account/preferences/deck-icon surface;
- Tools area: Cut / ID · Tournament · Odds.

### 2.1 What Should I Play — final accepted state

The final bounded WSIP pass is accepted after repeated real-iPhone testing.

Accepted behaviour:

- shared `PTCGMetaField` remains the one field vocabulary/normalisation layer for Home, Meta, WSIP and Event Prep;
- shared `PTCGRecommendation` remains the one exact-variant recommendation engine for Meta WSIP and Event Prep;
- Blended / Online / IRL / Saved Expected Field semantics remain common across the app;
- Saved Expected Fields apply directly when selected and custom-field state is clearly identifiable;
- exact deck detail can evaluate against Blended, Online, IRL or actual named Saved Expected Fields and hand that field into WSIP;
- recommendations show five initially and reveal **five more at a time**;
- recommendation cards are themselves the route to exact deck-variant detail;
- expanded **Why this deck?** shows the three best and three worst evidenced matchups, including field share, decisive-game sample and adjusted H2H rate;
- recommendation evidence wording is explicit, e.g. **“H2H evidence against X% of field”**;
- one- and two-Pokémon sprite identities reserve enough width on iPhone;
- Compare is removed completely;
- the separate Decide stage is removed completely;
- event-specific deck choice remains explicit in Event Prep rather than being silently written by WSIP.

A serious Meta startup regression encountered during this pass was traced to self-triggering WSIP `MutationObserver` feedback loops, not the Meta release/data architecture. The loops were reproduced in browser runtime, removed/fixed, and guarded by integration tests. Presentation enhancement code must not use body-wide self-triggering observers; explicit render lifecycle events such as `wsip:rendered` are preferred.

The relevant Meta/WSIP suite passed **37/37 tests** at final functional acceptance. Real iPhone Home Screen testing then accepted Meta startup, recommendation cards, matchup expansion, incremental paging and final Saved Expected Field selector polish.

See `WHAT_SHOULD_I_PLAY_ARCHITECTURE.md` for the durable source of truth.

---

## 3. Tools review — accepted and closed

The Tools pass is accepted for the current product stage after iterative real-iPhone testing.

Canonical Tools top-of-area navigation:

**Cut / ID · Tournament · Odds**

See `TOOLS_ARCHITECTURE.md` for the durable source of truth.

### 3.1 Cut / ID

Cut / ID remains the core shared competitive utility.

- standalone utility belongs to Tools;
- Tournament Day consumes the same shared `cut-id-engine.js` contextually;
- Pokémon W/L/D and 3/1/0 points semantics remain explicit;
- deterministic cut/ID reasoning comes first;
- known pairings/known IDs may constrain deterministic ceilings;
- guaranteed / unsafe / resistance-dependent outcomes are distinguished;
- no hidden tie-rate assumptions or default simulation.

Home → Cut / ID remains a direct Tools deep-link.

### 3.2 Native Tournament Manager

Tournament Manager is now a native Tools subview rather than the old embedded Swiss screen.

Its product role is explicitly:

> **Run a tournament for a group.**

It is not Compete/Tournament Day and must never create:

- Compete Events;
- `UserEventParticipation`;
- canonical Match/Game history;
- Tournament Day records;
- Season/CP/BFL records.

Organiser tournament state remains local to the Tournament Manager IndexedDB `tournaments` store.

Accepted capabilities include:

- Casual / Cup / Challenge / League / Other labels;
- Best of 1 / Best of 3;
- configurable Swiss rounds;
- No top cut / Top 4 / Top 8 / Top 16;
- native Run · Players · Standings subviews;
- Swiss pairing generation, byes and repeat-opponent avoidance where practical;
- clear name-based W/L/D result picker;
- player records displayed as the record entering each round;
- current/newest round above previous rounds;
- stateful round-generation controls;
- live standings/resistance-style tiebreak display;
- native standard-seeded single-elimination Top Cut;
- completed-event winner/champion displayed in the tournament library;
- authenticated-account-only saved player names, with direct add from the picker;
- native tournament timer;
- dedicated high-contrast full-screen round clock with prominent tournament/round context and Pause/Resume.

The old `v2-preview/apps/swiss` page is no longer the intended visible product surface; its cleanup is deferred to Development Cleanup / Release Hardening.

### 3.3 Odds

Odds is the compact generic card-maths utility.

Current modes:

**Draw / Outs · Opening · Prizes**

All use the shared exact hypergeometric helper in `v2-preview/apps/_shared/probability.js`.

Deck-specific consistency modelling remains Decks-owned.

### 3.4 Tools boundary remains locked

Do not move these into Tools:

- Mobile Playtest;
- Card Search;
- deck version comparison;
- Event discovery;
- Expected Fields;
- personal Tournament Day/Season records;
- Collection/readiness;
- Learn/personal analytics.

Further Tools work is bugfix/polish only unless a genuinely useful small standalone utility clearly earns a place.

---

## 4. Small technical debt — defer unless blocking

Known cleanup remains, but none should interrupt Collection without a real defect:

- Card Search bootstrap still has enhancement-layer debt;
- GLC legality should eventually consolidate into shared card legality/catalog infrastructure;
- Mobile Playtest should converge any remaining local card-art helpers onto `PTCGCardImages`;
- modern set-name → PTCGL code fallbacks require ongoing maintainability;
- legacy/enhancer/compatibility layers should be removed during Development Cleanup / Release Hardening;
- legacy `v2-preview/apps/swiss` should eventually be retired once native Tournament Manager parity is considered sufficient;
- routine Meta upstream refreshes/release generation are maintenance, not roadmap milestones.

WSIP-specific cleanup should also be deferred unless it causes a real defect. Do not reintroduce Compare/Decide or broad observer-based polish during cleanup.

---

## 5. Collection / physical readiness v1 — active next milestone

Begin Collection in a dedicated implementation workspace.

### 5.1 Core product question

Collection v1 should answer:

> **Can I physically build this exact deck, and if not, what must I buy, move or free up?**

### 5.2 Reuse existing identity foundations

Collection must not invent another card/deck model.

Reuse:

- Deck / DeckVersion / `listHash` remain Decks-owned;
- exact card identity remains card name + set code + card number;
- `PTCGCardCatalog` supplies shared metadata/search;
- `PTCGCardImages` supplies artwork presentation;
- exact immutable deck list/reference is the readiness input.

### 5.3 Collection ownership

Collection owns private physical inventory and allocation state.

It must support:

- exact printing ownership;
- gameplay equivalence as a separate concept from exact-print ownership;
- owned quantity;
- loose/unallocated quantity;
- allocation into multiple simultaneously-built decks;
- protection against accidental double allocation;
- required / owned / allocated / available / missing derived state;
- missing/shopping requirements derived from inventory + intended deck builds;
- readiness against exact saved DeckVersion/checkpoint or other immutable exact list reference.

Collection should connect naturally to Decks, Event Prep and Home, but those surfaces should consume Collection state rather than reimplementing it.

### 5.4 Persistence

Collection is private account-owned state.

For v1, prefer the existing snapshot persistence architecture unless a concrete query/conflict/history/scale need justifies normalized tables.

### 5.5 Explicit v1 deferrals

Do not include in Collection v1:

- scanning/OCR;
- card pricing/value tracking;
- marketplace/trading;
- binder/collector showcase polish;
- social/public Collection;
- Learn/personal analytics;
- broad account architecture redesign.

---

## 6. Correct near-term sequence

1. **Collection / physical readiness v1** — active next milestone.
2. **Learn / personal analytics** — tournament/matchup/practice learning loop with explicit evidence provenance.
3. **Development Cleanup / Release Hardening** — remove obsolete compatibility/enhancement layers, stale routes, duplicate engines and legacy surfaces before stable/public-ready release.
4. **Community/public expansion** only when justified by actual usage.

Performance is not a standalone milestone unless a material regression appears.

---

## 7. Collection workspace startup requirements

Before implementing Collection, inspect the latest repository and read:

- `PTCG_TOOLS_MASTER.md`;
- `ROADMAP_HANDOFF_2026-09-05.md`;
- `CARD_SEARCH_ARCHITECTURE.md`;
- `CARD_IMAGE_ARCHITECTURE.md`;
- `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md`;
- relevant Deck / DeckVersion / listHash implementation;
- current Deck working-list and saved-version UI;
- Event Prep exact-list references;
- Home architecture where future readiness summary may surface;
- Settings/account persistence behavior.

Audit current card identity and persistence paths before proposing Collection storage. Preserve one canonical exact-card identity and one canonical Deck/DeckVersion identity.

Start with the smallest coherent v1 data model and user workflow before implementation.

---

## 8. Master/Roadmap operating rule

Use the Master/Roadmap workspace for programme status, architecture locks, milestone order and handoffs.

Use one dedicated implementation chat per bounded workstream.

Current handoff:

> **Home + Meta + What Should I Play + Navigation + Settings + Tools accepted/closed → Collection / physical readiness v1.**
