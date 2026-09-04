# PTCG Tools — Card Search Architecture

**Status:** Current Decks / shared card-search source of truth  
**Date:** 4 September 2026  
**Companion to:** `PTCG_TOOLS_MASTER.md`, `CARD_IMAGE_ARCHITECTURE.md`, `PLAYTEST_ARCHITECTURE.md`, `PERFORMANCE_ARCHITECTURE.md`, `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md`

## Purpose

Card Search is a reusable Decks capability for discovering exact Pokémon TCG printings and, when launched from a deck, adding that exact printing through the existing authoritative Deck text/parser/store path.

It is not a sixth top-level product area, not a generic Tools utility and not a second card/deck identity system.

## Product ownership and workspace position

The global product area remains **Decks**. Decks currently contains three peer workspace sections:

**My Decks · Training Log · Card Search**

The global area remains named Decks for now because it owns the wider build/train/playtest/card-lookup workflow. Renaming the area is a future product-wide decision only.

My Decks and Training Log no longer require large workspace hero headers; the three peer sections should present with consistent hierarchy. Import / Export is secondary library management and belongs behind the compact library-options `•••` control rather than as a primary full-width action.

## Shared metadata/search source

The current external card metadata/search provider is:

`https://api.tcgdex.net/v2/en`

The shared browser catalog is:

`v2-preview/apps/_shared/card-catalog.js`

`PTCGCardCatalog` owns:

- card-name search;
- full card metadata retrieval;
- set metadata;
- advanced filtering;
- printed-text search;
- mapping discovered TCGdex printings back to the existing Deck exact-print identity.

TCGdex is a metadata/search dependency only. It does not replace the canonical Deck card identity model.

## Exact-print identity

Existing Deck identity remains authoritative:

- card name;
- PTCGL/Limitless-style set code;
- card number.

Card Search may use TCGdex IDs internally for discovery and metadata hydration. Before writing to a Deck working list, a result resolves to the existing exact-print identity through `PTCGCardCatalog.exactDeckIdentity()`.

TCGdex `tcgOnline` may be absent. The catalog therefore contains bounded fallback mappings from modern set names to existing set codes, for example `Twilight Masquerade → TWM`.

These fallback mappings are compatibility data, not a new identity scheme. Their maintainability should be improved over time by centralising/expanding them in the shared catalog rather than scattering set-code inference across features.

## Normal Card Search

Normal Card Search appears inline below the Decks workspace tabs.

Default interaction:

- simple card-name search;
- image-only result grid;
- tap a card to open a large zoomed artwork view;
- tap the zoomed card/background to close it.

The normal surface stays visually minimal. Advanced search opens from the compact filter/sliders control beside the search input.

## Add Card mode

When launched from an exact Deck working list, Add Card is a full-screen picker using the same underlying Card Search surface/state.

Selecting a result:

1. resolves the discovered printing to the existing exact Deck identity;
2. writes through the authoritative `#deckText` representation;
3. lets the existing parser/render/store path update the working list;
4. increments quantity when the exact printing already exists;
5. adds a separate row when the same card name uses a different printing.

Do not create a second card-list or Deck mutation model for Card Search.

## Advanced search

Current advanced filters are:

- card text contains;
- format;
- category;
- set;
- regulation mark;
- Pokémon type;
- stage;
- Trainer type;
- rarity;
- illustrator;
- minimum HP;
- maximum HP.

Printed-text search is real card-text search. It includes effect text, rules, attacks, abilities and Trainer/Energy item/effect fields where provided by TCGdex rather than treating card-name matching as a substitute.

## Format filters

Current format choices are:

- All cards;
- Standard;
- GLC.

### Standard

Standard delegates to current card-level legality metadata from the shared catalog/provider.

### GLC

GLC is intended to represent actual card-level Gym Leader Challenge eligibility rather than aliasing Expanded.

Current bounded implementation checks:

- Black & White era onward;
- no Rule Box Pokémon;
- no ACE SPEC;
- current explicit GLC ban-list exclusions represented by the implementation.

Current technical debt: GLC legality is implemented in `v2-preview/apps/decklists/deck-card-search-glc-fix.js`, which monkey-patches the shared catalog at runtime. The accepted architectural destination is to move reusable GLC legality/filter behavior into the shared Card Catalog (or another shared legality module) and remove the Decks-local patch when safe.

Any future GLC update must verify the current authoritative ban list/rules before changing legality logic.

## Shared artwork resolver

Card Search does not own artwork-provider choice.

All card artwork should use:

`v2-preview/apps/_shared/card-images.js` → `window.PTCGCardImages`

Intended source order:

1. exact Limitless-hosted TPCI artwork when exact set + number resolves;
2. TCGdex artwork fallback;
3. stable no-art fallback.

This same resolver is the intended presentation source for:

- Deck working lists;
- saved DeckVersions;
- Card Search;
- Add Card;
- zoomed card view;
- Mobile Playtest;
- future Collection.

Artwork is presentation only and never affects identity.

See `CARD_IMAGE_ARCHITECTURE.md`.

## Mobile UX

Primary target remains iPhone portrait around 390 CSS px.

Requirements:

- search/filter inputs remain at least 16 px on mobile to avoid iOS Safari focus zoom;
- normal Card Search remains inline in the Decks workspace;
- Add Card remains a visually opaque full-screen picker above the application shell;
- sticky headers must not allow underlying app navigation/results to bleed through;
- result grids and zoom controls remain tap-first.

## Runtime and release considerations

TCGdex is currently called from the browser at runtime.

Consequences to preserve in future planning:

- provider/API availability can affect search and metadata hydration;
- CORS/browser access is therefore a runtime dependency;
- provider schema/field changes can affect filtering and exact-print mapping;
- repeated metadata requests should use the catalog's caches rather than feature-local duplicate fetches;
- a future public/release-hardening pass may choose to proxy/cache/normalise shared card metadata upstream through PTCG Tools if reliability, rate, terms or operational needs justify it.

Do not prematurely introduce a second backend/card database merely to modernise the current working personal product.

## Current implementation vs cleanup debt

Implemented and usable:

- My Decks / Training Log / Card Search peer workspace model;
- inline normal search;
- full-screen Add Card;
- exact-print add/increment semantics through `#deckText` → parser → DeckStore;
- advanced filters and printed-text search;
- Standard filter;
- bounded GLC legality behavior;
- TCGdex metadata/search integration;
- modern-set fallback mapping for missing `tcgOnline` values;
- shared artwork-resolver use in Card Search results via the current enhancement path;
- iPhone input-size/full-screen picker fixes.

Small cleanup debt, not a new feature milestone:

1. `deck-card-images.js` dynamically bootstraps Card Search CSS/scripts; move Card Search loading to a clearer Decks entry/bootstrap path when convenient.
2. `deck-card-search-glc-fix.js` monkey-patches shared catalog behavior; consolidate reusable GLC legality and artwork decoration into shared modules.
3. Audit Mobile Playtest for remaining local set-code/card-number/image URL helpers and migrate them to `PTCGCardImages` if still duplicated.
4. Keep exact-print set-code fallbacks centralised and maintainable; avoid feature-local mappings.
5. Remove obsolete patch/enhancer files only during bounded cleanup or formal Development Cleanup / Release Hardening once equivalent core behavior is proven.

None of these items blocks the next major roadmap milestone unless a real regression is found.

## Future Collection boundary

Collection must reuse:

- existing exact Deck/card printing identity;
- `PTCGCardCatalog` for metadata/search;
- `PTCGCardImages` for artwork presentation.

Collection must not invent a parallel card database or exact-print identity model.

Collection adds ownership/allocation semantics on top of those existing foundations, including owned quantities, gameplay equivalence where appropriate, loose inventory, deck allocations, required/owned/allocated state and missing/shopping requirements.
