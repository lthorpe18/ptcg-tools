# PTCG Tools — Roadmap Handoff — 5 September 2026

**Status:** Current coordination handoff after accepted Meta architecture and bounded Navigation / Home deep-link regression pass  
**Companion to:** `PTCG_TOOLS_MASTER.md`, `v2-preview/apps/meta/ARCHITECTURE.md`, `PERFORMANCE_ARCHITECTURE.md`, `HOME_ARCHITECTURE.md`, `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md`

## 1. What has just closed

The September 2026 Meta navigation and data-ingest/delivery architecture rework is **accepted and closed for the current product stage** after successful real-iPhone testing.

The accepted current Meta architecture is:

`Limitless sources → scheduled repository ingestion → canonical data/meta archives → validated browser release → Home/Meta`

Key locks:

- normal browsers do not ingest Limitless tournament data directly;
- scheduled GitHub Actions own shared Meta ingestion/refresh;
- `scripts/build-meta-release.mjs` publishes a content-addressed, purpose-split release under `v2-preview/data/meta/release/`;
- Home and ordinary Current Meta consume the small `core.json` payload;
- history, matchup and result payloads load on demand;
- `meta-release-loader.js` owns release discovery, checksum validation and last-known-good Cache Storage;
- a new release is activated only after core validation;
- current/previous validated releases provide local fallback resilience;
- `meta-router.js` is the single Meta navigation owner;
- `MetaState`, `MetaData` and `MetaControls` remain the single evidence-state/control contract;
- `PTCGMetaBlend` / `MetaBlendedField` remains the shared current-field blend logic used by Home and Meta;
- fixed background warming of every top-level area on app launch has been removed; unopened areas load on demand while already-opened areas remain mounted;
- Supabase remains private per-account persistence, not a duplicate shared Meta warehouse.

The implementation landed primarily in commit `0bcda945aa5d3fdf9fdcd92b945bb421209a7732` and was followed by a successful scheduled incremental data refresh (`9bf56b537b40f8f8b1072fa12ed6458ea203ddaf`).

### 1.1 Navigation / Home deep-link regression pass

A bounded Navigation / Shell consistency pass was subsequently completed without redesigning the accepted persistent shell.

The shell architecture remains unchanged:

- **Home · Meta · Decks · Compete · Tools** remain the five top-level areas;
- Settings remains app-level;
- the persistent shell remains sole owner of the bottom navigation;
- already-loaded core areas remain mounted;
- navigation HTML remains network-first;
- top-level OAuth remains the deliberate exception to child routing.

The accepted Home navigation semantics are now:

- Blended Meta hero → Meta main, while Variant grouping remains independently interactive;
- Decks heading/card background → Decks main;
- Recently edited deck preview → that exact Deck;
- Events heading/card background → My Tournaments;
- Next tournament preview → that exact tournament;
- Card Search → direct Decks-owned Card Search entry;
- Cut / ID → direct Tools-owned calculator entry;
- Playtest → Decks-owned deck picker, then launch the selected Deck working list through the existing Playtest launch contract.

The preview-link regression was traced to Home CSS suppressing pointer events on the exact-item links, causing taps to fall through to the parent cards. The bounded fix restored independent exact-item tap targets rather than changing shell routing.

This behavior was accepted on iPhone against implementation baseline `62854a094feece32fe2d1756bd8896fe1d73dd6b`.

Navigation / Home is therefore closed again for the current stage unless a new concrete regression appears.

## 2. Accepted/closed product areas

Current-stage accepted or substantially established areas include:

- persistent five-area shell and navigation-performance architecture;
- Home single-screen derived dashboard and accepted contextual deep-link semantics;
- Meta source/scope, exact-variant, Expected Field, navigation and ingest/delivery architecture;
- Deck/DeckVersion/listHash foundation;
- Decks workspace: My Decks / Training Log / Card Search;
- shared Card Catalog / exact-print mapping;
- shared Card Images resolver;
- Mobile Playtest v1;
- Events discovery/attendance/retention;
- Event Prep v1;
- Tournament Day v1;
- shared Match/Game evidence;
- Cut / ID shared engine/contextual Tournament Day use;
- Competitive Record / Season v1 including 2027 CP/BFL rules/config;
- Google authentication and cross-device account snapshot persistence.

Do not reopen these as broad feature programmes without a concrete regression or a genuine dependency for the active milestone.

## 3. Small technical debt — defer unless blocking

Known cleanup remains, but none should interrupt the near-term roadmap without a real defect:

- Card Search bootstrap currently routed through enhancement-layer code;
- GLC legality still needs eventual consolidation into shared card legality/catalog infrastructure;
- Mobile Playtest should eventually converge any remaining local card-art resolver helpers onto `PTCGCardImages`;
- modern set-name → PTCGL code fallbacks need ongoing maintainability;
- legacy/enhancer/compatibility layers should be removed during bounded cleanup or formal Development Cleanup / Release Hardening;
- routine Meta upstream refreshes and release generation are maintenance, not a feature milestone.

## 4. Correct near-term sequence

`Collection / physical readiness v1` remains the **next major product milestone**, but two deliberately bounded product-surface reviews are scheduled before Collection implementation.

Sequence:

1. **Settings review** — bounded product-surface/ownership cleanup.
2. **Tools review** — bounded utility-suite review/polish.
3. **Collection / physical readiness v1** — next major implementation milestone.
4. **Learn / personal analytics**.
5. **Development Cleanup / Release Hardening**.
6. Community/public expansion when useful and justified by actual usage.

Home, Meta and Navigation/Shell are not active roadmap threads now.

## 5. Settings review boundary

The Settings review should inspect and rationalise the current app-level controls without turning Settings into a new domain.

Expected topics:

- Google account/session presentation;
- account-owned preferences;
- Deck icon overrides through canonical `DeckSprites`;
- import/export/backup/interoperability affordances where appropriate;
- storage/sync visibility only where genuinely useful;
- removal or consolidation of duplicated/awkward settings controls.

Settings remains app-level, not a sixth top-level competitive area.

Do not expand the Settings pass into Collection implementation, broad account architecture redesign or release-hardening.

## 6. Tools review boundary

Tools remains the home for **small standalone competitive utilities that do not belong to Meta, Decks or Compete**.

The review should preserve Cut / ID as the established shared core and decide the smallest coherent utility set, potentially including compact probability/record helpers where they genuinely earn a place.

Do not move these into Tools:

- Mobile Playtest;
- Card Search;
- deck version comparison;
- Event discovery;
- Expected Fields;
- Tournament/Season records;
- Collection/readiness;
- Learn/personal analytics.

Do not let Tools become a dumping ground.

## 7. Collection remains the next major milestone

After Settings and Tools are closed, begin **Collection / physical readiness v1** in a dedicated workspace.

Collection must build on existing foundations rather than inventing another card/deck model:

- Deck / DeckVersion / `listHash` remain Decks-owned;
- exact card identity remains card name + set code + card number;
- `PTCGCardCatalog` supplies shared metadata/search;
- `PTCGCardImages` supplies artwork presentation;
- Collection owns physical inventory and allocations;
- readiness is derived from an exact immutable list/reference;
- exact printing ownership and gameplay equivalence are separate concepts;
- multiple built decks compete for the same physical copies;
- loose vs allocated copies must be explicit;
- required / owned / allocated / available / missing state is derived;
- shopping requirements are derived, not separately edited truth;
- Collection is private account-owned state and should initially fit the existing snapshot architecture unless a concrete technical need justifies normalization.

Explicitly defer scanning/OCR, pricing, marketplace/trading, binder/collector polish, social Collection and Learn analytics from Collection v1.

## 8. Master/Roadmap operating rule

Use this Master/Roadmap workspace to manage programme status, architecture locks, milestone order and handoffs.

Use one dedicated implementation chat per bounded workstream.

Current handoff:

> **Meta + Navigation/Home accepted/closed → Settings review → Tools review → Collection / physical readiness v1.**
