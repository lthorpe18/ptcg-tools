# PTCG Tools — Mobile Playtest Architecture

**Status:** Accepted current-stage Decks / Mobile Playtest source of truth  
**Date:** 13 September 2026  
**Companion to:** `PTCG_TOOLS_MASTER.md`, `PERFORMANCE_ARCHITECTURE.md`, `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md`

## Purpose

Mobile Playtest is a **fast, flexible, touch-first solo competitive tabletop for exact saved or working decklists**. It is not a Pokémon TCG rules engine and it is not a second Match/Game history system.

Mobile Playtest v1 is accepted/current-stage complete. Future work is bounded bugfix, consolidation and real-use polish unless the roadmap explicitly reopens Playtest scope.

---

## 1. Ownership and identity

Mobile Playtest belongs to **Decks**.

It reuses existing Deck identity:

- `deckId`;
- mutable working list / canonical `listHash`;
- immutable `DeckVersion` / `deckVersionId` where selected.

Do not introduce a Playtest-specific deck/card identity or persistent deck store.

Playtest can launch from:

- a Deck working list;
- an immutable DeckVersion;
- Event Prep's exact planned/candidate list reference.

The shared launcher remains `v2-preview/apps/_shared/playtest-launch.js`. Its launch payload/fallbacks are transport only, not a second source of truth.

---

## 2. Product scope

Mobile Playtest is solo/goldfish.

Primary goals:

- test opening hands/setup quickly;
- manually play through turns on iPhone;
- search/manipulate an exact decklist;
- make common tabletop actions tap-driven and reversible.

Explicitly outside current scope:

- opponent AI;
- multiplayer;
- full rules enforcement;
- automated attack/effect resolution;
- automatic status/damage resolution;
- automatic competitive W/L recording;
- replacing Pokémon TCG Live.

The correct mental model is **smart mobile tabletop, not rules simulator**.

---

## 3. Tabletop state

Core zones:

- Deck;
- Hand;
- Active;
- Bench;
- Discard;
- Lost Zone;
- Prizes;
- Stadium.

Additional state includes attachments, evolution stack, damage, markers/statuses, rotation, turn number, coin result and Undo history.

The full 5+3 Bench arrangement remains supported by the current implementation.

---

## 4. Interaction model

Primary rule: **tap source → tap destination**.

Examples:

- Hand Pokémon → Active/Bench;
- evolution Pokémon → Pokémon in play;
- Energy → Pokémon in play;
- Active → Bench target;
- selected card → Discard/Lost/Deck/Prizes where supported.

After setup the tabletop intentionally permits manual movement rather than trying to become a partial rules engine.

Selected cards and valid destinations must remain visually clear without adding large layout rows.

---

## 5. Hand and multi-select

Hand remains a persistent primary zone with large, horizontally scrollable cards and a strong Draw action.

Current bulk actions include shuffle-to-deck variants, Discard all and Draw.

Hand supports true multi-select. Group actions apply to the selected set as **one logical mutation / one Undo step**.

Do not make automatic Hand hiding the default.

---

## 6. Deck search

Searching the Deck does not automatically move a selected card to Hand.

Flow:

1. open Deck/search;
2. select a specific remaining card/copy;
3. close into a selected-source state;
4. tap the destination.

List/Random search presentation must not silently mutate actual Deck order. Only explicit shuffle/manipulation actions change order.

Search may include explicit Shuffle and Draw-top controls.

---

## 7. Setup, mulligans and turns

A fresh session begins at **Turn 0 — Setup**.

Opening hand is seven cards. Hidden mulligan redraws continue until an eligible setup Pokémon is available; failed hands are not shown and only the mulligan count is surfaced.

Setup eligibility may use authoritative metadata for genuine setup exceptions but must not expand into a broad rules engine.

Starting Turn 1 increments to Turn 1 and draws exactly one card. Subsequent turn advancement draws at the **start of the new turn**.

Turn advancement plus its draw is one undoable mutation.

---

## 8. Prizes, evolution, attachments and markers

Prize inspection shows the actual cards in the Prize zone. Taking a Prize moves that exact card through the same state model.

Evolution keeps the underlying logical stack while presentation remains subtle. Attachments remain individual card objects and follow the evolved Pokémon coherently.

Energy is represented with compact type/count badges; individual attachments remain inspectable/manageable.

Damage, rotation and statuses/markers are manual state. Playtest does not resolve them automatically according to game rules.

When field cards leave play, stacks/attachments must be handled coherently without orphaned hidden state.

---

## 9. Undo and rendering lock

Ordinary Playtest interaction follows:

**mutate → push Undo snapshot → change state → persist → clear selection → render in place**

Do not use full-page reload for normal tabletop mutations.

One logical action should generally equal one Undo step, including grouped Hand moves, turn advance + draw, Stadium replacement, evolution and prize taking.

This in-place rendering contract fixed the earlier iPhone card-art blink/pop regression and remains an architecture lock.

---

## 10. Card images and caching

Immediately visible tabletop art may load eagerly; secondary/search imagery may remain lazy.

The accepted presentation direction is to consume shared `PTCGCardImages` rather than feature-local provider/set-code URL logic. Any remaining Playtest-local artwork helpers are Release Hardening debt, not a second accepted image architecture.

Playtest's `_pt=<timestamp>` launch/cache-busting mechanism remains bounded to Playtest code/assets; card artwork remains normally cacheable.

Do not spread dated build tokens across normal application navigation.

---

## 11. Persistent-shell boundary

The outer persistent shell owns the one global bottom navigation bar.

Playtest must not reserve or render a second app-nav layer. Its Hand tray anchors to the bottom of its own child viewport supplied above shell navigation.

---

## 12. Persistence and evidence boundary

Active tabletop state remains transient/local browser state.

Exact Deck/DeckVersion identity is durable/account-owned; live tabletop position is not silently uploaded as competitive history.

Locked evidence boundary:

- real PTCGL/in-person results use canonical Match/Game evidence;
- Game Log reads that canonical real evidence;
- goldfish Playtest does **not** create Match/Game records, W/L or personal matchup statistics automatically.

A future explicit saved-practice/consistency feature would require a deliberate model rather than silently reusing competitive evidence.

---

## 13. Current implementation direction

Important current assets remain under `v2-preview/apps/decklists/` plus shared `playtest-launch.js`, DeckStore and parser infrastructure.

Historical similarly named Playtest files may exist. Always inspect what the active Playtest HTML currently loads before changing behaviour.

---

## 14. Acceptance and roadmap relationship

Mobile Playtest v1 is accepted. Reopen only for:

- genuine usability/correctness regressions;
- bounded shared-card-image consolidation;
- Release Hardening cleanup;
- an explicit future product decision to add a new practice-evidence capability.

Current central roadmap is **shared format-calendar consumer wiring → Personal Matchup Analysis → Practice Priorities → Event Prep v2 → Deck Version Intelligence → Prediction Accuracy maturation → Release Hardening → Collection later**.

Do not let Playtest expansion displace that sequence without a new product decision.
