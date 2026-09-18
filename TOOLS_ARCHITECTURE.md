# PTCG Tools — Tools Architecture

**Status:** Accepted current-stage source of truth  
**Date:** 13 September 2026  
**Area:** `v2-preview/apps/tools`

## 1. Purpose and ownership

Tools is the home for **small standalone competitive utilities that do not belong to Meta, Decks or Compete**.

Current accepted local navigation:

**Cut / ID · Tournament · Odds**

The Tools segmented control lives inside the persistent five-area shell and must not create a second shell or bottom navigation layer.

Ownership boundaries:

- Mobile Playtest → Decks;
- Card Search/Add Card → Decks;
- Game Log / Deck Results → Decks;
- event discovery, Online tournaments, Event Prep, Tournament Day and Season → Compete;
- Meta modelling / Expected Fields / WSIP → Meta;
- standalone Cut / ID engine/tool → Tools;
- standalone organiser Tournament Manager → Tools;
- generic card-probability helpers → Tools;
- Collection/readiness → future Collection, currently deferred.

Tools must not become a dumping ground for unrelated features.

---

## 2. Cut / ID

Cut / ID is a core Tools utility and the shared calculation source for contextual Tournament Day ID support.

Canonical engine:

`v2-preview/apps/_shared/cut-id-engine.js`

The standalone Tools UI and Tournament Day consume the same engine.

Current principles:

- Pokémon Swiss records use W/L/D;
- 3/1/0 points semantics;
- deterministic reasoning first;
- Top N cuts supported;
- known pairings/IDs may tighten deterministic bounds;
- distinguish guaranteed, unsafe and resistance/tiebreak-dependent outcomes;
- no hidden empirical tie-rate assumptions;
- simulation is not the default.

Home's Cut / ID quick action deep-links to this Tools-owned utility.

---

## 3. Tournament Manager

Tournament Manager is a **standalone organiser utility** for running an independent local tournament.

It remains deliberately separate from Compete/Tournament Day:

**Tools → Tournament Manager** = run a tournament for a group.  
**Compete → Tournament Day** = play in and record my tournament.

Tournament Manager must not create/sync:

- Compete Events;
- `UserEventParticipation`;
- Tournament Day records;
- canonical personal Match/Game evidence;
- Season/CP/BFL records.

### Storage and workflow

The native V2 manager keeps its local organiser tournament store so historical local manager events are not stranded.

Current workflow supports tournament create/open/delete, common local labels, BO1/BO3, configurable Swiss rounds, optional Top Cut, player management, pairings/byes, W/L/D entry, live standings, resistance/tiebreak display, Top Cut and round timer/clock.

The old Swiss manager is not the visible product surface; remaining legacy cleanup belongs to Release Hardening.

### Round clock

The full-screen round clock is a bounded presentation mode over the same tournament timer, not a second timer or navigation architecture. The persistent shell temporarily yields viewport chrome and restores it on exit.

---

## 4. Odds

Odds is the generic standalone card-maths area.

Current modes:

**Draw / Outs · Opening · Prizes**

All use shared exact combinatorics:

`v2-preview/apps/_shared/probability.js`

Use exact hypergeometric probability rather than simulation for these bounded questions.

Deck-specific consistency analysis remains Decks-owned rather than expanding Odds into a second Deck analysis workspace.

---

## 5. UX and shell rules

Tools is iPhone-first and answer-first:

**inputs → headline answer/action → compact detail**

Avoid desktop-first tables and large methodology blocks in routine use.

The persistent shell remains sole owner of bottom navigation and application-level auth/sync.

Navigation/document HTML remains network-first; versioned static assets may be cache-busted deliberately when behaviour changes.

---

## 6. Explicit boundaries

Do not expand Tools into:

- a second Compete/event database;
- a second Tournament Day/history system;
- personal matchup analysis;
- Deck Version Intelligence;
- Meta/matchup modelling;
- Collection/readiness;
- Season/CP/BFL;
- a full Pokémon rules engine.

Those capabilities have existing or planned owners elsewhere.

---

## 7. Current acceptance and roadmap relationship

The current Tools surface is accepted:

**Cut / ID · Tournament · Odds**

Further Tools work should be bounded bugfix/polish unless a genuinely useful standalone utility clearly earns a place and respects the ownership rules above.

The old statement that Collection is the immediate next roadmap milestone is superseded. Current central sequence is:

**close published-calendar production generation/acceptance → Personal Matchup Analysis → Practice Priorities → Event Prep v2 → Deck Version Intelligence → Prediction Accuracy maturation → Release Hardening → general Collection only when explicitly reopened.**

The standalone Kanto 151 direct-link spin-off is separate from the main Tools surface and does not reopen Collection.
