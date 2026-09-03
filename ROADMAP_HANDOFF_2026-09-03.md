# PTCG Tools — Roadmap Handoff — 3 September 2026

**Purpose:** central coordination handoff after completion of the Decks / Mobile Playtest implementation milestone.

Read alongside:

- `PTCG_TOOLS_MASTER.md`
- `PLAYTEST_ARCHITECTURE.md`
- `PERFORMANCE_ARCHITECTURE.md`
- `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md`

## Supersession note

The existing `PTCG_TOOLS_MASTER.md` section 9.4 / near-term roadmap text still describes **Mobile Playtest v1 as the current programme milestone**.

That status is now superseded by this handoff and `PLAYTEST_ARCHITECTURE.md`.

As of 3 September 2026:

> **Mobile Playtest v1 is feature-complete pending a short acceptance/cleanup pass. It should not remain the current programme milestone.**

The accepted remaining work is only:

- play several complete iPhone goldfish games;
- fix genuine bugs/regressions found in use;
- verify Undo and the principal interactions;
- optionally remove obsolete compatibility code when safe.

Do not keep expanding Playtest before central Roadmap review unless testing uncovers a blocker.

## What Mobile Playtest v1 now includes

- Decks-owned solo/goldfish tabletop;
- exact launch from working list, DeckVersion or Event Prep exact planned/candidate list;
- stable `deckId + listHash` identity, plus `deckVersionId` when selected;
- automatic hidden mulligans with limited setup-specific eligibility awareness;
- Turn 0 setup semantics;
- Start Turn 1 draws the first turn card;
- automatic draw at the start of each subsequent turn;
- Deck, Hand, Active, 5+3 Bench, Discard, Lost Zone, Prizes and Stadium;
- actual Prize-card inspection and manual prize taking;
- tap source → tap destination interaction;
- Deck search where selecting a card waits for a destination rather than auto-moving to Hand;
- explicit Hand destination for Deck search;
- Deck List / Random visual views without random view changing deck order;
- Hand multi-select with grouped moves in one Undo step;
- grouped multiple-Energy attachment to one Pokémon;
- evolution stacks retained logically without the previous large shadow presentation;
- compact colour/type Energy attachment badges, no emoji;
- manual damage, rotation, status markers and attachment/evolution management;
- correct Stadium replacement;
- selected card → Discard always discards rather than opening the pile;
- core in-place mutation/render/Undo path with normal full-page reloads removed;
- eager loading for immediately visible tabletop/Hand art and lazy loading for secondary search/list thumbnails;
- `_pt` launch-token cache-busting for local Playtest assets with service-worker bypass;
- persistent-shell boundary fixed so Playtest does not reserve a duplicate bottom-nav height;
- larger persistent Hand and clearer Hand controls in the final usability pass.

## Product/architecture locks carried forward

1. **Mobile Playtest belongs to Decks.**
2. Playtest is manual/flexible after setup; do not turn it into a partial rules engine.
3. Exact Deck/DeckVersion identity is reused; never create a second Playtest deck store.
4. Event Prep may launch an exact list but does not own Playtest state.
5. Goldfish Playtest never creates competitive W/L or alters matchup statistics.
6. Active transient tabletop state is local browser state; durable Deck identity remains account-backed.
7. A future saved Playtest/practice-evidence domain should be explicit rather than silently syncing every transient board mutation.
8. Ordinary tabletop actions must update in place; do not reintroduce `location.reload()` interaction flows.
9. The outer persistent shell owns the five-item global navigation; Playtest does not reserve/duplicate it.
10. The current measured iPhone layout is considered good enough; future visual changes require a concrete usability reason.

## Roadmap implication

The central Roadmap should now choose the next milestone from the downstream product loop rather than continuing Mobile Playtest implementation.

The older master ordering already identifies likely candidates:

- Tournament Day + event-linked results completion;
- Competitive Record / Season v1;
- Collection / physical readiness;
- Learning loop / personal analytics;
- Cut / ID work in step with Tournament Day.

The exact next milestone should be decided centrally against current repo state, dependencies and the broader loop:

**Analyse → Build & Test → Prepare → Compete → Learn**

Mobile Playtest now makes the **Build & Test** stage materially usable and should be treated as an established foundation.
