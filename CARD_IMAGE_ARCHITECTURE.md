# PTCG Tools — Exact Card Image Presentation

**Status:** Shared presentation architecture  
**Date:** 4 September 2026  
**Companion to:** `PTCG_TOOLS_MASTER.md`, `PLAYTEST_ARCHITECTURE.md`, `PERFORMANCE_ARCHITECTURE.md`

## Purpose

PTCG Tools may display Pokémon TCG card artwork anywhere an exact parsed card is already known. Artwork is presentation only and must never create or alter Deck, DeckVersion, Collection or card identity.

## Shared resolver

The shared browser helper is:

`v2-preview/apps/_shared/card-images.js`

It accepts the existing parsed exact-card fields (`set`, `number`, `name`) and resolves the same Limitless-hosted TPCI artwork convention already proven by Mobile Playtest:

`SET + card number -> exact English card artwork URL`

The helper also owns reusable thumbnail markup and a stable failed-image fallback.

## Identity boundary

Canonical identity continues to come from the existing Deck parser/store model:

- Deck working list: `Deck.rawText` + canonical `listHash`;
- saved exact list: `DeckVersion.rawText` + immutable `listHash`;
- exact card printing where available: parsed `set` + `number`.

Image availability, URL resolution or failed loading must never affect those identities.

## Decks v1 presentation

The primary mutable Deck list displays small lazy-loaded thumbnails alongside existing editable rows.

Saved DeckVersions expose an inline read-only exact-list viewer using the same parser and shared card-image helper. Viewing a version does not load or mutate the working list; the existing “Use as working list” action remains explicit.

No separate card-list representation is introduced.

## Performance and caching

- Deck/list thumbnails are secondary imagery and use native lazy loading.
- Card artwork keeps ordinary browser/service-worker caching behavior.
- No card-image cache-busting tokens are added.
- Broken/unresolved images preserve thumbnail dimensions and fall back without destabilising the row.
- Mobile Playtest retains eager loading for immediately visible tabletop art and lazy loading for secondary/search imagery as defined in `PLAYTEST_ARCHITECTURE.md`.

## Future Collection boundary

Future Collection may reuse this presentation helper to show exact artwork consistently. This architecture does not define or store owned quantities, allocations, missing cards, shopping lists or Collection persistence.
