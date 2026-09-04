# PTCG Tools — Exact Card Image Presentation

**Status:** Shared presentation architecture  
**Date:** 4 September 2026  
**Companion to:** `PTCG_TOOLS_MASTER.md`, `CARD_SEARCH_ARCHITECTURE.md`, `PLAYTEST_ARCHITECTURE.md`, `PERFORMANCE_ARCHITECTURE.md`

## Purpose

PTCG Tools may display Pokémon TCG card artwork anywhere an exact parsed card is already known. Artwork is presentation only and must never create or alter Deck, DeckVersion, Collection or card identity.

## Shared resolver

The single intended shared browser artwork resolver is:

`v2-preview/apps/_shared/card-images.js`

Feature code should not construct card-art URLs or choose artwork providers independently. Deck lists, saved versions, Card Search, Add Card, zoomed card views, Mobile Playtest and future Collection presentation should all delegate artwork resolution to this helper.

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

## Decks and Card Search presentation

The primary mutable Deck list displays small lazy-loaded thumbnails alongside existing editable rows.

Saved DeckVersions expose an inline read-only exact-list viewer using the same parser and shared card-image helper. Viewing a version does not load or mutate the working list; the existing “Use as working list” action remains explicit.

Card Search and Add Card use the same shared artwork resolver. Search metadata comes from TCGdex, but exact-print Limitless/TPCI artwork is preferred whenever the printing can be mapped. TCGdex artwork is fallback presentation only.

Normal Card Search shows image-only results and a large zoomed card view. Those surfaces must use the same artwork resolution order rather than choosing provider-specific URLs independently.

No separate card-list representation is introduced.

See `CARD_SEARCH_ARCHITECTURE.md`.

## Mobile Playtest consolidation state

Mobile Playtest historically derived Limitless-hosted TPCI artwork through local set-code/card-number/image URL helpers.

The architecture lock is now that Playtest should consume `PTCGCardImages` like other card-art surfaces. If current Playtest code still contains equivalent local resolver helpers, treat that as small technical debt to remove during a bounded cleanup or Release Hardening pass rather than as a second accepted artwork architecture.

Do not change Playtest card identity/state semantics as part of that cleanup; only presentation resolution should be consolidated.

## Performance and caching

- Deck/list thumbnails are secondary imagery and use native lazy loading.
- Card artwork keeps ordinary browser/service-worker caching behavior.
- No card-image cache-busting tokens are added to image URLs.
- Resolver JavaScript assets may be versioned when implementation changes.
- Broken primary images retry the registered fallback provider without changing card identity.
- Broken/unresolved images preserve thumbnail dimensions and fall back without destabilising the row.
- Mobile Playtest retains eager loading for immediately visible tabletop art and lazy loading for secondary/search imagery as defined in `PLAYTEST_ARCHITECTURE.md`.

## Current implementation notes / small debt

The shared resolver exists and is used by Deck working-list and saved-version presentation. Card Search artwork is currently decorated through the Decks Card Search enhancement path, including a follow-up GLC patch that wraps catalog image behavior.

Accepted cleanup direction:

- make `PTCGCardImages` the direct shared dependency of Card Search rather than relying on follow-up monkey-patching;
- keep provider/source selection out of feature-local code;
- audit and remove duplicated Playtest artwork helpers when safe;
- centralise exact-print/set-code fallback knowledge in the shared card catalog/resolver rather than copying mappings across features.

These are cleanup items, not blockers for Collection unless a real artwork/identity regression appears.

## Future Collection boundary

Future Collection must reuse this presentation helper to show exact artwork consistently. It must also reuse the existing exact-print Deck/card identity and shared Card Catalog rather than creating a new card database.

This architecture does not define or store owned quantities, allocations, missing cards, shopping lists or Collection persistence.
