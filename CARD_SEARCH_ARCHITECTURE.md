# PTCG Tools — Card Search Architecture

**Status:** Current Decks / shared card-search source of truth  
**Date:** 13 September 2026  
**Companion to:** `PTCG_TOOLS_MASTER.md`, `CARD_IMAGE_ARCHITECTURE.md`, `PLAYTEST_ARCHITECTURE.md`, `PERFORMANCE_ARCHITECTURE.md`, `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md`

## Purpose

Card Search is a reusable **Decks-owned** capability for discovering exact Pokémon TCG printings and adding an exact printing through the authoritative Deck text/parser/store path.

It is not a sixth top-level area, not a generic Tools utility and not a second card/deck identity system.

---

## 1. Product ownership and workspace position

Decks owns:

- My Decks;
- Game Log;
- Card Search/Add Card;
- Mobile Playtest;
- Deck Results.

The current visible Decks workspace is centred on **My Decks · Game Log**. Card Search remains a reusable Decks capability available from direct navigation and Deck workflows; it need not be a peer high-level tab on every Decks surface.

Do not move Card Search to Tools merely because it can be launched directly.

---

## 2. Shared metadata/search source

Current metadata/search provider:

`https://api.tcgdex.net/v2/en`

Shared browser catalog:

`v2-preview/apps/_shared/card-catalog.js` → `window.PTCGCardCatalog`

The catalog owns:

- card-name search;
- full card metadata;
- set metadata;
- advanced filtering;
- printed-text search;
- mapping discovered TCGdex printings back to existing Deck exact-print identity.

TCGdex is a metadata/search dependency only. It does not replace canonical Deck/card identity.

---

## 3. Exact-print identity

Existing Deck identity remains authoritative:

- card name;
- PTCGL/Limitless-style set code;
- card number.

Card Search may use TCGdex IDs internally. Before writing to a Deck working list, a result resolves through `PTCGCardCatalog.exactDeckIdentity()` into the existing exact-print representation.

Fallback set-code mappings are compatibility data and should stay centralized in shared card infrastructure rather than scattered across features.

---

## 4. Regulation marks and Standard legality

TCGdex exact-card metadata includes the individual printing's `regulationMark` where available.

The format foundation now exposes card-level legality by evaluating that **printing's regulation mark** against the resolved date/environment format.

Architecture rule:

- do not infer legality from the set as a whole;
- do not maintain whole-set regulation-mark claims;
- set boundaries may support readable format labels/grouping only;
- the published shared Formats & Sets calendar + canonical `PTCGFormat` resolver should become the authoritative runtime context for date/environment legality.

### Current integration gap

Card Search's existing Standard filter has historically relied on current catalog/provider legality metadata. The next shared format-calendar consumer package should migrate relevant Standard/card-legality checks to the canonical shared resolver where the required date/environment context exists, without duplicating legality logic inside Card Search.

---

## 5. Normal Card Search

Normal Card Search provides:

- simple card-name search;
- image-led result grid;
- tap-to-zoom exact-card view;
- compact access to advanced filters.

Advanced filters currently include card text, format, category, set, regulation mark, Pokémon type/stage, Trainer type, rarity, illustrator and HP bounds.

Printed-text search must search actual card effect/rules/attack/ability fields where supplied, not substitute card-name matching.

---

## 6. Add Card mode

When launched from a Deck working list, Add Card is a full-screen picker using the same Card Search infrastructure.

Selecting a result:

1. resolves to existing exact Deck identity;
2. writes through the authoritative deck text representation;
3. lets existing parser/render/store logic update the working list;
4. increments quantity for the same exact printing;
5. preserves separate rows for different printings of the same card name.

Do not create a second Deck mutation model for Card Search.

---

## 7. Format filters

Current user-facing choices include:

- All cards;
- Standard;
- GLC.

### Standard

Standard should ultimately consume canonical card-level legality from the shared format/calendar resolver for the applicable current context.

### GLC

GLC remains card-level Gym Leader Challenge eligibility rather than an alias for Expanded.

Current bounded logic covers BW-era onward, no Rule Box Pokémon, no ACE SPEC and represented explicit ban-list exclusions.

Current technical debt: GLC legality remains implemented through a Decks-local enhancement/patch layer. The accepted destination is shared card-legality infrastructure rather than a runtime monkey patch.

Any GLC rule change must verify current authoritative GLC rules/ban list first.

---

## 8. Shared artwork resolver

Card Search does not own artwork-provider choice.

Use:

`v2-preview/apps/_shared/card-images.js` → `window.PTCGCardImages`

Artwork remains presentation only. Provider/source failure must never change card identity or legality.

See `CARD_IMAGE_ARCHITECTURE.md`.

---

## 9. Mobile UX

Primary target remains iPhone portrait.

Requirements:

- 16 px+ search/filter inputs to avoid Safari focus zoom;
- result grids and zoom are tap-first;
- Add Card full-screen picker remains visually opaque above the application shell;
- sticky controls must not reveal underlying app UI;
- avoid unnecessary horizontal overflow.

---

## 10. Runtime and release considerations

TCGdex is currently a browser runtime dependency for card search/metadata hydration.

Preserve catalog caching and avoid duplicate feature-local requests.

A future public/release-hardening pass may normalize/proxy shared card metadata if reliability, rate limits, terms or operational needs justify it. Do not add a second backend/card database solely for modernization.

---

## 11. Current cleanup debt

Release Hardening should address:

1. clearer Card Search bootstrap rather than chained enhancement loading;
2. move reusable GLC legality into shared card infrastructure;
3. make Card Search use `PTCGCardImages` directly;
4. audit Playtest for duplicated exact-print/art helpers;
5. keep set-code fallbacks centralized;
6. remove obsolete patch/enhancer files only after parity is proven.

These are cleanup items, not current roadmap milestones.

---

## 12. Future Collection boundary

Collection must reuse:

- existing exact-print identity;
- `PTCGCardCatalog`;
- `PTCGCardImages`;
- shared format/card-legality resolution.

Collection adds ownership/allocation semantics on top of those foundations and remains deferred until explicitly reopened.
