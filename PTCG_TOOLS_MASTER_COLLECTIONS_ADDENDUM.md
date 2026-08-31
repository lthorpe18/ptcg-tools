# PTCG Tools — Master Design Addendum: Collection & Deck Allocation

**Status:** Locked future product direction / source-of-truth addendum  
**Date:** 31 August 2026  
**Parent document:** `PTCG_TOOLS_MASTER.md`

## Physical collection tracking

PTCG Tools should eventually maintain a **live record of the user's physical Pokémon TCG card collection** and connect that inventory directly to saved decks and exact deck versions.

The primary goal is practical competitive deck management, not set-completion collecting.

The app should be able to answer, at any time:

- How many copies of a card do I physically own?
- Which saved decks are those copies currently allocated to?
- How many copies are unallocated / available?
- Does this decklist require cards I do not currently own?
- Which cards need to be moved from another deck to build this one?
- Which cards do I actually need to buy or obtain?
- If I want two or more decks built simultaneously, where are the conflicts?

### Core model

Collection inventory should distinguish **physical copies owned** from **decklist requirements**.

Conceptually:

```text
CardCollectionItem
- cardId / printingId
- canonicalCardId where useful
- quantityOwned
- variant / printing details where relevant
- notes

DeckAllocation
- deckId / deckVersionId
- cardId / printingId
- quantityAllocated
```

A saved deck version provides the required quantities. The allocation layer records where the user's actual physical copies currently are.

### Required calculations

For each card:

```text
owned
allocated across decks
available = owned - allocated
required by selected deck/version
shortfall = max(0, required - available/allocated-as-applicable)
```

When evaluating a deck that is not currently built, PTCG Tools should distinguish:

- **Already in this deck**
- **Available in collection**
- **Available but currently in another deck — move required**
- **Not owned / insufficient copies — buy or obtain**

### Deck-level view

A saved deck should eventually expose a practical **Build / Collection** view showing something like:

```text
60 cards required
52 already allocated here
5 available loose
2 need moving from another deck
1 missing
```

The user should be able to drill into the exact cards responsible.

### Collection-level view

A future Collection screen should support:

- search/filter all owned cards;
- quantity owned;
- quantity currently allocated;
- free copies;
- list of decks containing each card;
- missing-card / shopping list across one or more selected decks;
- cards that are over-allocated because two physical decks claim the same copies;
- bulk adjustment of quantities after purchases/trades;
- easy assignment/movement of copies between decks.

### Multiple simultaneously built decks

The system must support the real physical constraint that one card copy cannot be in two decks at once.

It should therefore be possible to mark decks as **currently built / physically assembled** and use those decks when calculating allocation conflicts.

Deck versions remain important: collection requirements should come from the exact current physical list, not merely an archetype name.

### Printing handling

Initial implementation can prioritise gameplay equivalence while retaining enough printing identity to track what the user actually owns.

Where multiple legal printings are interchangeable for deck construction, PTCG Tools should be able to aggregate them to answer gameplay availability while still retaining the individual physical-printing records underneath.

### Integration points

This capability should integrate with:

- **Decks:** immediately show whether a saved deck can be physically built;
- **Deck versions:** recalculate requirements when a list changes;
- **Tournament Prep:** flag missing cards before locking a tournament list;
- **Home:** optionally surface unresolved build shortages for the next event;
- **future shopping/acquisition workflow:** generate a concise list of genuinely missing cards, excluding copies that merely need moving between existing decks.

### Persistence

Collection and allocation data is personal durable state and should use the same shared Supabase workspace as decks, saved metas, planned events and other personal PTCG Tools state.

It should remain available consistently across devices with no separate account or sync workflow under the current single-shared-workspace model.

### Product priority

Treat this as a **high-value future feature**. It extends Decks from digital decklist management into management of the user's real competitive card pool and directly reduces the practical friction of maintaining several physical decks.
