# PTCG Tools — Exact Card Image Presentation

**Status:** Shared presentation architecture  
**Date:** 4 September 2026  
**Companion to:** `PTCG_TOOLS_MASTER.md`, `PLAYTEST_ARCHITECTURE.md`, `PERFORMANCE_ARCHITECTURE.md`

## Purpose

PTCG Tools may display Pokémon TCG card artwork anywhere an exact parsed card is already known. Artwork is presentation only and must never create or alter Deck, DeckVersion, Collection or card identity.

## Shared resolver

The single shared browser artwork resolver is:

`v2-preview/apps/_shared/card-images.js`

Feature code must not construct card-art URLs or choose artwork providers independently. Deck lists, saved versions, Card Search, Mobile Playtest and future Collection presentation should all delegate artwork resolution to this helper.

The resolver uses the following source order:

1. **Exact Limitless-hosted TPCI artwork** when the exact PTCGL/Limitless set code + card number can be resolved.
2. **TCGdex artwork fallback** when an exact Limitless/TPCI presentation URL cannot be resolved or fails to load.
3. Stable no-art fallback when neither source is available.

TCGdex remains a card metadata/search dependency. Its image field is not a separate presentation architecture; it is an input/fallback consumed by the shared artwork resolver.

The resolver owns:

- exact `SET + card number` Limitless/TPCI URL construction;
- TCGdex artwork fallback URL construction;
- async resolution from TCGdex card identity to the existing exact Deck printing identity where possible;
- provider fallback registration and failed-image handling;
- reusable thumbnail markup.

## Identity boundary

Canonical identity continues to come from the existing Deck parser/store model:

- Deck working list: `Deck.rawText` + canonical `listHash`;
- saved exact list: `DeckVersion.rawText` + immutable `listHash`;
- exact card printing where available: parsed `set` + `number`.

Card Search may use TCGdex IDs and metadata to discover a printing, but presentation must resolve back through the shared exact-print identity path before choosing the primary artwork source.

Image availability, URL resolution or failed loading must never affect those identities.

## Decks presentation

The primary mutable Deck list displays small lazy-loaded thumbnails alongside existing editable rows.

Saved DeckVersions expose an inline read-only exact-list viewer using the same parser and shared card-image helper. Viewing a version does not load or mutate the working list; the existing “Use as working list” action remains explicit.

Card Search uses the same shared resolver. Search metadata comes from TCGdex, but exact-print Limitless/TPCI artwork is preferred whenever the printing can be mapped. TCGdex artwork is only the fallback presentation source.

No separate card-list representation is introduced.

## Performance and caching

- Deck/list thumbnails are secondary imagery and use native lazy loading.
- Card artwork keeps ordinary browser/service-worker caching behavior.
- No card-image cache-busting tokens are added to image URLs.
- Resolver JavaScript assets may be versioned when implementation changes.
- Broken primary images retry the registered fallback provider without changing card identity.
- Broken/unresolved images preserve thumbnail dimensions and fall back without destabilising the row.
- Mobile Playtest retains eager loading for immediately visible tabletop art and lazy loading for secondary/search imagery as defined in `PLAYTEST_ARCHITECTURE.md`.

## Future Collection boundary

Future Collection must reuse this presentation helper to show exact artwork consistently. This architecture does not define or store owned quantities, allocations, missing cards, shopping lists or Collection persistence.
