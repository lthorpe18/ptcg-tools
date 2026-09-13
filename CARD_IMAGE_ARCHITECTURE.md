# PTCG Tools — Exact Card Image Presentation

**Status:** Current shared presentation architecture  
**Date:** 13 September 2026  
**Companion to:** `PTCG_TOOLS_MASTER.md`, `CARD_SEARCH_ARCHITECTURE.md`, `PLAYTEST_ARCHITECTURE.md`, `PERFORMANCE_ARCHITECTURE.md`

## Purpose

PTCG Tools may display Pokémon TCG card artwork anywhere an exact printing is already known. Artwork is presentation only and must never create or alter Deck, DeckVersion, Collection, legality or card identity.

---

## 1. Shared resolver

The single intended browser artwork resolver is:

`v2-preview/apps/_shared/card-images.js` → `window.PTCGCardImages`

Feature code should not independently construct card-art URLs or choose providers.

Current source/fallback direction:

1. exact Limitless-hosted TPCI artwork when exact set code + card number resolves;
2. TCGdex artwork fallback;
3. stable no-art fallback.

The resolver owns provider choice, exact-print URL construction, fallback registration and reusable thumbnail presentation.

---

## 2. Identity boundary

Canonical card identity continues to come from the existing Deck/card model:

- exact card name;
- set code;
- card number;
- Deck working-list/listHash identity;
- immutable DeckVersion/listHash identity.

Card Search may use TCGdex IDs/metadata for discovery, but discovered printings resolve back into the existing exact-print identity before Deck mutation/presentation.

Image availability or provider failure must never affect identity.

### Regulation mark / legality boundary

TCGdex card metadata may also supply an individual printing's `regulationMark` for legality resolution. That metadata is **not image identity** and must remain independent from artwork choice.

The shared format resolver, not `PTCGCardImages`, decides legality from the card printing's regulation mark and date/environment context.

---

## 3. Consumers

The shared resolver is the intended artwork source for:

- Deck working lists;
- saved DeckVersions;
- Card Search;
- Add Card;
- zoomed card views;
- Mobile Playtest;
- future Collection.

No consumer should create a separate card-list representation merely to display art.

---

## 4. Card Search presentation

Normal Card Search uses image-led results and a large zoomed exact-card view. Add Card uses the same underlying exact-print artwork path.

TCGdex is the metadata/search provider, but provider-specific image URLs remain an implementation detail of the shared resolver.

See `CARD_SEARCH_ARCHITECTURE.md`.

---

## 5. Mobile Playtest consolidation

Mobile Playtest historically included local Limitless URL helpers.

The architecture lock is that Playtest should consume `PTCGCardImages` like other card-art surfaces. Any equivalent local helpers that still remain are Release Hardening debt, not a second accepted artwork architecture.

Do not change Playtest card identity/state semantics as part of that consolidation.

---

## 6. Performance and caching

- secondary list/search thumbnails may use native lazy loading;
- immediately visible Playtest tabletop art may load eagerly;
- card artwork keeps ordinary browser/service-worker caching;
- no per-session cache-busting token is added to image URLs;
- broken primary images may retry the registered fallback without changing card identity;
- unresolved artwork should preserve layout dimensions.

---

## 7. Current cleanup debt

Small Release Hardening items remain:

- ensure Card Search directly depends on `PTCGCardImages` rather than follow-up monkey-patch/decorator paths;
- remove duplicated Playtest artwork helpers when safe;
- centralise set-code/exact-print fallback knowledge in shared card infrastructure;
- remove obsolete enhancement layers only after equivalent core behaviour is proven.

These are cleanup tasks rather than current feature milestones.

---

## 8. Future Collection boundary

Future Collection must reuse:

- existing exact-print identity;
- `PTCGCardCatalog` for metadata/search;
- `PTCGCardImages` for artwork;
- the shared format/card-legality resolver where legality context is needed.

This architecture does not define owned quantities, allocations, missing cards or Collection persistence.

Collection remains deferred until explicitly reopened.
