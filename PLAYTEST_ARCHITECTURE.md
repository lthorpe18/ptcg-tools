# PTCG Tools — Mobile Playtest Architecture

**Status:** Current Decks / Mobile Playtest source of truth  
**Date:** 3 September 2026  
**Companion to:** `PTCG_TOOLS_MASTER.md`, `PERFORMANCE_ARCHITECTURE.md`, `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md`

## Purpose

This document records the completed Mobile Playtest v1 product, interaction, state, performance and ownership decisions established during the September 2026 Decks / Playtest implementation pass.

It is the authoritative companion for future Playtest work. Future changes should inspect the current GitHub implementation and this document before altering interaction semantics, persistence, caching, zone behaviour or Deck/DeckVersion identity.

The product position is:

> **Mobile Playtest is a fast, flexible, touch-first solo competitive tabletop for exact saved or working decklists. It is not a Pokémon TCG rules engine and it is not a second match-history system.**

---

## 1. Product ownership and milestone status

Mobile Playtest belongs to **Decks**.

It does not belong to Tools, Meta or Compete.

Event Prep may launch Playtest using the exact planned/candidate decklist selected for an event, but Prep does not own or duplicate tabletop state.

### Current milestone status

As of 3 September 2026, **Mobile Playtest v1 is considered feature-complete pending acceptance/cleanup testing**.

Do not add another large Playtest feature before Roadmap review unless testing exposes a genuine blocker.

The remaining Playtest work is deliberately small:

- run several full iPhone goldfish games;
- fix real bugs/regressions discovered in use;
- verify Undo across all ordinary actions;
- confirm setup/Turn 0, prizes, Deck search, multi-select, evolution/attachments and zone movement remain coherent;
- remove obsolete compatibility code only where doing so is low-risk;
- avoid redesigning the settled layout without a concrete usability problem.

After that, development should return to the central Master / Roadmap milestone sequence.

---

## 2. Core product scope

Mobile Playtest v1 is **solo / goldfish**.

Primary goals:

- test opening hands and setup quickly;
- play through turns manually on an iPhone;
- search and manipulate an exact decklist without fighting a desktop UI;
- support normal tabletop operations without enforcing the complete Pokémon TCG ruleset;
- make common actions tap-driven and reversible.

Explicitly out of scope for v1:

- opponent AI;
- multiplayer/network play;
- automatic rules enforcement;
- attack/effect resolution engine;
- legality enforcement after setup;
- automatic status-condition resolution;
- automatic damage/effect calculation;
- W/L recording from goldfish sessions;
- replacing PTCG Live.

The correct mental model is **a smart mobile tabletop, not a simulator engine**.

---

## 3. Exact deck identity and launch contract

### 3.1 Deck identity

Playtest reuses the existing Decks identity model.

- **Deck** = durable personal project.
- **Working list** = mutable `Deck.rawText` plus current canonical `listHash`.
- **DeckVersion** = immutable exact checkpoint with stable ID and `listHash`.

Exact Playtest identity uses:

- `deckId`;
- `listHash`;
- `deckVersionId` when a saved checkpoint was selected.

Do not introduce another deck identity or card-list store for Playtest.

### 3.2 Launch sources

Playtest can launch from:

- the mutable Deck working list;
- an immutable saved DeckVersion;
- Event Prep's exact planned/candidate list reference.

A working list can be Playtested without forcing checkpoint creation.

Event Prep uses the existing exact planned reference rather than copying the list into a Prep-owned Playtest model.

### 3.3 Shared launcher

Current launcher:

`v2-preview/apps/_shared/playtest-launch.js`

The launcher resolves the existing DeckStore/parser identity and passes a short-lived launch payload including the exact raw list and return location.

The handoff was hardened beyond sessionStorage-only behaviour because iPhone/persistent-child navigation could lose the handoff. Current behaviour includes a short-lived local fallback and URL identity fallback.

This is a transport mechanism only. It is not a second persistent deck store.

---

## 4. Core zones and tabletop model

The Playtest tabletop supports:

- **Deck**
- **Hand**
- **Active**
- **Bench**
- **Discard**
- **Lost Zone**
- **Prizes**
- **Stadium**

Additional logical zones/state:

- attachments;
- evolution stack / cards underneath;
- damage;
- manual markers/statuses;
- rotated/tapped state;
- turn number;
- coin result;
- Undo history.

The Bench supports the full **5 + 3** visual arrangement used by the current implementation.

The current board is intentionally compact and card-first. Active must not become visually dominant and empty slots should remain low-weight.

---

## 5. Mobile interaction model

### 5.1 Primary rule: tap source, tap destination

Normal Playtest movement uses a two-tap model:

1. tap the source card;
2. valid destinations/targets become visually clear;
3. tap the destination/target to perform the action.

Examples:

- Hand Pokémon → empty Bench = bench it;
- Hand Pokémon → empty Active = make Active;
- Hand evolution Pokémon → Pokémon in play = evolve onto it;
- Hand Energy → Pokémon in play = attach;
- Active → Bench Pokémon = switch;
- selected card → Discard = discard it;
- selected card → Lost Zone = move it to Lost Zone;
- selected card → Deck = move it to Deck where supported.

Tapping the selected card again / using More opens its manual detail sheet.

### 5.2 Manual freedom after setup

The tabletop intentionally allows manual manipulation even where a real game might not permit the action at that moment.

This prevents the app becoming a fragile partial rules engine.

The only deliberate rules-aware area is opening setup/mulligan eligibility.

### 5.3 Selection feedback

Selected source cards must be unmistakable.

Valid card targets and valid zone targets use separate visual treatments.

Selection feedback is contextual chrome; it must not create a large new layout row or distort the measured board composition.

---

## 6. Hand behaviour

The Hand is a **persistent primary zone** and should remain visible during ordinary Playtest use.

It must not be hidden merely to make room for controls.

Current direction after iPhone testing:

- a deliberately larger Hand tray than the early prototype;
- larger Hand cards than the field cards;
- horizontally scrollable card row;
- strong `+ Draw` action;
- clear dedicated Hand actions;
- multi-select support.

Current Hand actions include:

- **Shuffle into deck**;
- **Shuffle + bottom**;
- **Discard all**;
- **+ Draw**.

If a future explicit Hide Hand mode is added, hidden state must preserve a one-tap `Show hand · N` affordance. Do not make automatic hiding the default.

---

## 7. Hand multi-select

Hand supports true multi-select.

Behaviour:

- tapping a Hand card selects it;
- tapping additional Hand cards adds them to the same selection;
- tapping a selected Hand card removes it from the selection;
- all selected cards remain visibly highlighted;
- the selection banner shows the selected count;
- one destination action applies to the whole group in a single Undo step.

Supported grouped actions include, where valid:

- move selected cards to Discard;
- move selected cards to Deck;
- move selected cards to Lost Zone;
- move selected cards to Prizes;
- Bench multiple selected Pokémon if sufficient Bench space exists;
- attach multiple selected Energy cards to one field Pokémon.

Do not force nonsensical mixed-card grouped actions. Group behaviour should remain explicit and predictable rather than becoming an automatic legality engine.

---

## 8. Deck search and destination selection

### 8.1 Search semantics

Searching the Deck does **not** automatically move a selected card to Hand.

Correct behaviour:

1. open Deck/search;
2. tap a specific remaining card/copy;
3. close the search sheet into a selection state;
4. tap where that card should go.

Supported destinations include as appropriate:

- Hand;
- empty Active;
- empty Bench;
- existing Pokémon to evolve onto;
- existing Pokémon to attach Energy to;
- Discard;
- Prizes;
- Stadium;
- Lost Zone.

Cancel leaves the card in the Deck.

An explicit **Hand** destination control is provided so adding a searched card to Hand does not rely on hitting a narrow empty area of the Hand tray.

### 8.2 List / Random view

Deck search supports:

- **List** — grouped/alphabetical remaining-deck view;
- **Random** — remaining physical copies displayed in randomized visual order.

Random view is observational only. It must **not** shuffle or mutate the real Deck order.

Actual deck order changes only through explicit shuffle/manipulation actions.

### 8.3 Search-sheet utilities

Deck search also exposes explicit:

- Shuffle deck;
- Draw top card.

Search/list thumbnails can remain lazy-loaded because they are secondary content.

---

## 9. Setup, mulligans and turn semantics

### 9.1 Opening hand

The opening hand is seven cards.

Playtest automatically performs hidden mulligan redraws until the opening hand contains an eligible setup Pokémon.

Failed mulligan hands are not shown.

The UI reports the mulligan count only.

### 9.2 Limited setup rules awareness

Opening eligibility normally means **Basic Pokémon**.

A non-Basic/setup-exception Pokémon may be accepted only where authoritative card metadata/text explicitly identifies a setup placement exception.

Metadata hydration currently uses the existing adapter/card metadata path rather than building a broad rules engine.

If setup metadata cannot be resolved reliably, fail clearly rather than hanging indefinitely or guessing.

### 9.3 Turn 0

A fresh Playtest begins at:

**Turn 0 — Setup**

No turn draw occurs during setup.

The first progression is:

**Start Turn 1 → increment to Turn 1 → draw one card.**

Subsequent progression is conceptually:

**finish current turn → increment → start next turn → draw one card.**

Therefore the automatic draw belongs to the **start of the new turn**, not the end of the previous turn.

The opening hand is consequently a true seven-card setup hand rather than an effective eight-card hand.

Turn advancement remains one undoable mutation, including the draw.

If the Deck is empty, the turn may still advance and should simply record that no card was drawn rather than inventing rules-engine behaviour.

---

## 10. Prizes

`View prizes` must show the actual cards currently in the player's Prize zone in this solo/goldfish tool.

The user can inspect Prize identities and manually take a Prize.

Taking a Prize moves that exact card through the same underlying state model; it must not duplicate cards or create a separate Prize store.

A searched Deck card may also be manually moved to Prizes using the standard source → destination model.

---

## 11. Evolution and attachments

### 11.1 Evolution

Evolution uses normal two-tap interaction:

- select evolution Pokémon;
- tap the Pokémon in play to evolve.

Underlying Pokémon remain in the logical evolution stack.

The top evolved Pokémon inherits the relevant current tabletop state such as damage/rotation, and attachments follow the evolved top card.

### 11.2 Evolution presentation

Do not show the old large shadow/card-stack visual underneath evolved Pokémon.

The evolution stack should remain logically present but visually subtle.

The field should remain card-first and uncluttered.

### 11.3 Attachments

Attachments remain individual card objects in state.

They are not flattened into a numeric-only model because individual cards still need to be inspectable and movable.

Energy attachments are represented on the field using compact, obvious type/count badges along the **bottom edge** of the Pokémon.

Requirements:

- no emoji Energy indicators;
- use explicit colour/type treatment;
- group same-type Energy where useful with a count;
- Special Energy uses a clear neutral/name-based treatment;
- individual attached cards remain manageable from the Pokémon detail sheet.

When a field Pokémon leaves play through manual movement, attachment cleanup must be coherent and must never orphan hidden attachment records.

---

## 12. Damage, rotation and markers

Field Pokémon support manual controls for:

- damage `−10 / +10`;
- damage `−50 / +50`;
- Clear Damage;
- rotate/tap;
- manual markers/statuses.

Current manual markers include:

- Ability used;
- Poisoned;
- Burned;
- Asleep;
- Confused;
- Paralyzed.

Markers are manual state only.

Playtest does not automatically resolve or clear status conditions according to game rules.

Visual placement:

- status markers sit along the **top edge** of the Pokémon;
- Energy attachment badges sit along the **bottom edge**;
- damage has its own readable badge.

This separation prevents state indicators from competing for the same card edge.

---

## 13. Stadium and zone behaviour

### Stadium

Playing a new Stadium replaces the existing Stadium.

The old Stadium moves to Discard rather than accumulating in the Stadium zone.

The Stadium sheet allows manual removal/movement where needed.

### Discard

A selected card followed by tapping Discard must always discard the selected card.

The Discard pile should only open when no selected source is awaiting a destination.

This rule specifically prevents the earlier bug where selecting Energy then tapping Discard opened the Discard pile instead of discarding the Energy.

### Field Pokémon leaving play

When a field Pokémon moves to another zone, its evolution stack and attachments must be handled coherently.

Do not leave underlying/attached records orphaned in hidden state.

The current manual model keeps the evolution stack together where appropriate and disposes/moves attachments consistently with the chosen action.

---

## 14. Undo and mutation architecture

Ordinary Playtest actions should be **one undoable mutation each**.

There must be one primary mutation/render history path rather than competing per-feature Undo systems.

Examples that should remain single-step Undo operations:

- turn advancement + start-of-turn draw;
- grouped Hand multi-select movement;
- attaching multiple Energy in one grouped action;
- prize taking;
- Stadium replacement;
- damage changes;
- marker changes;
- Deck search destination movement;
- evolution;
- switch;
- shuffle/draw actions.

The core Playtest state owns the active Undo stack.

Avoid reintroducing secondary enhancement-layer Undo/reload mechanisms.

---

## 15. Rendering and performance architecture

### 15.1 No normal full-page reloads

A late Playtest interaction pass introduced `location.reload()` after state mutations. On iPhone this caused card art to disappear/reappear or visibly “pop” as Safari destroyed and recreated the page and image elements.

This was diagnosed and removed.

**Architecture lock:** normal tabletop mutations must use the core in-place mutation → persist → render path. Do not use full-page reload as the ordinary Playtest update mechanism.

The enhancement/completeness layers now call into the core Playtest mutation/render/Undo API.

### 15.2 Image loading

Immediately visible card art should load eagerly:

- Hand;
- Active;
- Bench;
- Stadium;
- visible Prize inspection where appropriate.

Secondary/search/list thumbnails may remain lazy-loaded.

This reduces visible image pop-in on the main tabletop while avoiding unnecessary eager loading of long search sheets.

### 15.3 Card images

Current card-art path uses the existing Limitless-hosted card image URLs derived from set code/card number.

Image loading is presentation only; card identity/state remains derived from the parsed exact decklist.

---

## 16. Cache-busting and Safari/PWA behaviour

Playtest had repeated iPhone cache problems during implementation because several generations of Playtest HTML/JS/CSS existed and Safari/service-worker state could serve stale assets.

Current solution:

- each fresh Playtest launch gets a `_pt=<timestamp>` token;
- `playtest-v2.html` propagates `_pt` to local Playtest CSS/JS assets;
- the service worker explicitly bypasses `_pt` Playtest assets/navigation rather than normalizing the token away;
- card images remain normally cacheable;
- fresh Decks launches naturally create a new token.

Do not return to manual `?v=` iteration as the normal Playtest asset-refresh mechanism.

A `?v=` bump on the containing Decks/shell route may still be used as a one-time outer-cache transition when genuinely needed.

Do not call the system “cache-proof”; verify deployed behaviour on iPhone when cache-sensitive changes are made.

---

## 17. Persistent shell / navigation boundary

The visible five-item bottom navigation belongs to the **outer persistent application shell**.

Playtest itself does not own a duplicate in-document global nav.

Therefore Playtest must **not** reserve an extra app-nav-height inside its own iframe viewport.

This previously caused a blank band between Hand and the outer navigation.

Current rule:

- outer shell bounds the Playtest viewport above the real navigation;
- Playtest Hand is fixed to the bottom of its own viewport;
- no duplicate internal nav reservation;
- Playtest's own hidden zone dock remains hidden on mobile.

---

## 18. Layout and visual locks

The settled Playtest layout is based on measured iPhone portrait composition rather than flexible “fill remaining viewport” rows.

Important locks from testing:

- iPhone portrait first, around 390 CSS px;
- board dimensions are explicit/stable rather than `1fr` filler rows;
- Active is compact, not oversized;
- full 5+3 Bench remains visible;
- empty Bench slots are faint/low-weight;
- Hand is persistent and visually prominent;
- controls sit around gameplay rather than turning the screen into dashboard cards;
- selected-card prompts overlay rather than consuming a flexible board row;
- avoid broad CSS patching without checking the whole-screen composition.

Reference influence:

- Limitless Playtest is a functional reference for manual tabletop behaviour;
- Pokémon TCG Live screenshots were used for spatial proportion/density only;
- do not copy PTCGL's visual style or build a decorative game-board imitation.

The user considers the current Playtest visual direction good enough. Future visual changes should be driven by concrete usability evidence, not aesthetic churn.

---

## 19. Persistence boundary

The active Playtest tabletop session is currently local browser state (`ptcg-tools.playtest.active.v2`).

This is intentionally different from saved Deck/DeckVersion identity, which is account-synced through the existing Deck store/snapshot architecture.

For v1:

- exact Deck identity is durable/account-owned;
- active transient tabletop position is local session/work-in-progress state;
- goldfish Playtest does not write competitive wins/losses;
- Playtest does not alter personal matchup statistics.

A future explicit **saved Playtest session / practice evidence** feature may become account-backed, but it should be designed as a deliberate user-owned domain rather than silently syncing every transient board movement.

---

## 20. Match history boundary

Real competitive evidence and solo Playtest evidence are separate.

- Real PTCGL/in-person results use the shared Match/Game contract.
- Goldfish Playtest state does not create Match/Game records automatically.
- Playtest does not write W/L.
- Playtest does not affect matchup win rates.

Future lightweight Playtest evidence may record consistency observations such as mulligans/opening outcomes, but that remains a separate Decks-owned evidence domain.

---

## 21. Current implementation map

Important current files include:

- `v2-preview/apps/decklists/playtest-v2.html`
- `v2-preview/apps/decklists/playtest-v4.js`
- `v2-preview/apps/decklists/playtest-layout-v3.css`
- `v2-preview/apps/decklists/playtest-enhancements.js`
- `v2-preview/apps/decklists/playtest-completeness.js`
- `v2-preview/apps/decklists/playtest-deck-selection.js`
- `v2-preview/apps/decklists/playtest-hand-multiselect.js`
- `v2-preview/apps/decklists/playtest-metadata-adapter.js`
- `v2-preview/apps/decklists/playtest-entry.js`
- `v2-preview/apps/_shared/playtest-launch.js`
- `v2-preview/apps/_shared/deck-store.js`
- `v2-preview/apps/_shared/deckParser.js`
- Event Prep launch integration under `v2-preview/apps/events/`.

Historical/older Playtest assets may still exist. Do not assume every similarly named file is authoritative. Inspect what `playtest-v2.html` currently loads before changing behaviour.

---

## 22. Acceptance checklist before reopening scope

Before calling for another major Playtest feature, verify at least one complete iPhone goldfish flow covering:

1. fresh setup starts at Turn 0;
2. opening hand is seven and mulligans are hidden correctly;
3. setup Pokémon can move to Active/Bench;
4. Start Turn 1 draws exactly one card;
5. subsequent turns draw exactly one at turn start;
6. Deck search card waits for a destination;
7. List/Random Deck views do not mutate real order merely by viewing;
8. searched card can go to Hand, field, Discard, Lost, Prizes or Stadium as appropriate;
9. Hand multi-select applies grouped actions in one Undo step;
10. evolution retains stack and attachments coherently;
11. Energy badges are readable and individual attached cards remain manageable;
12. View Prizes shows actual Prize cards and Take works;
13. Stadium replacement discards the previous Stadium;
14. selected card → Discard always discards rather than opening the pile;
15. damage/rotation/markers work and Undo correctly;
16. no ordinary action causes a full-page reload or mass card-art blink;
17. Hand remains visible and usable above the persistent shell nav.

If those pass, treat Mobile Playtest v1 as complete and resume the central roadmap.
