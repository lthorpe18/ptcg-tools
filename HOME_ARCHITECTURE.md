# PTCG Tools — Home Architecture

**Status:** Current accepted Home/dashboard source of truth  
**Date:** 13 September 2026  
**Scope:** `v2-preview/` Home/dashboard only

## 1. Role

Home is a **derived competitive dashboard**, not a directory and not a business-logic owner.

It should answer at a glance:

- what the current field looks like;
- what deck the user is currently working on;
- what tournament is next;
- how to jump to Card Search, Cut / ID, Playtest and Tournament Manager;
- how to enter What Should I Play.

Home should remain compact enough for the primary iPhone portrait viewport without routine scrolling.

Home does not own Meta, Deck, Event, Season, Playtest, Card Search, Tournament Manager, Cut / ID, format-calendar or sprite-mapping state. It consumes shared state and routes into the owning feature.

---

## 2. Locked information hierarchy

Current order:

1. **Blended Meta** hero;
2. **Decks | Events** side-by-side personal row;
3. **Card Search | Cut / ID | Playtest | Tournament** quick actions;
4. **What should I play?** full-width entry;
5. persistent bottom navigation: **Home · Meta · Decks · Compete · Tools**.

The app-level header retains account/settings and current-format context.

Do not reintroduce broad directory cards for areas already represented in the persistent shell.

---

## 3. Blended Meta hero

Home gives a compact read of PTCG Tools' best estimate of the current competitive field rather than duplicating Meta.

It shows the top field entries as a proportional chart with canonical sprite identity and share percentages.

The **hero card opens Meta main**. Embedded controls such as Variant grouping must not trigger that navigation.

### Shared blend model

Home consumes the same canonical Blended prediction as Meta.

Settled-format weighting remains:

`IRL = max(30%, 70% - 2 percentage points × days since latest compatible IRL major weekend)`

`Online = 100% - IRL`

A Blended prediction requires at least one compatible Online tournament with 50+ players.

During Online/IRL legality splits, format-labelled predictions may coexist. Home defaults to the prediction for the **current Online format**.

Home must not implement a second blend formula.

### Variant grouping

Variant grouping is presentation-only:

- Off = exact variants;
- On = canonical Meta family grouping.

**Families describe the meta; variants play games.**

---

## 4. Current-format context and shared calendar

The Home format pill identifies the current Online format, such as `TEF-PBL`.

Settings → Maintenance → Formats & Sets maintains one published shared format calendar. Home is now wired through the shared format runtime and resolves current Online context from that published source, with validated last-known-good / checked-in fallback behaviour for interactive availability.

Home must continue to:

1. load/refresh shared calendar state through `PTCGFormatCalendar`;
2. resolve current Online context through the canonical `PTCGFormat` resolver;
3. refresh derived format context on warm Home activation where appropriate;
4. avoid any Home-local date/format inference.

The remaining end-to-end calendar risk is production Meta generation, not Home's browser consumer wiring. That production status is tracked in `CURRENT_STATE.md` and the shared-calendar handoff.

Home may legitimately use the user's current local date for the current-format pill. Event-specific consumers must continue to use the actual event date instead.

---

## 5. Canonical sprite presentation

There is one app-wide deck/archetype renderer:

`v2-preview/apps/_shared/deck-sprites.js` → `window.DeckSprites.html()`

Home must consume it exactly like Meta, Decks and Compete.

The shared renderer owns:

- archetype defaults;
- Settings overrides;
- source/slug resolution;
- primary + circular-secondary composition;
- pixel-art rendering behaviour.

Home may size/place the returned whole stack but must not compose raw primary/secondary images locally.

---

## 6. Decks card

Home reads `PTCGDeckStore` and currently uses the most recently edited saved Deck as the v1 relevance rule.

Display includes:

- canonical deck/archetype sprites;
- deck name;
- recent-edit context.

Navigation remains intentionally two-level:

- Decks card/background → Decks main;
- recently edited deck preview → that exact stable Deck ID.

Do not collapse those into one ambiguous route.

---

## 7. Events card

Home derives the next attended event from `UserEventParticipation` state.

Primary rule:

- attendance = `attending`;
- incomplete current/future participation;
- nearest eligible event first.

If there is no suitable next event, Home may show compact Season context.

Navigation:

- Events card/background → My Events/My Tournaments;
- exact tournament preview → canonical Tournament Day route for that `participation` ID.

Online tournament participations are valid event records and may surface here if they are the next attending participation.

Home does not own event lifecycle state.

---

## 8. Quick actions

Locked quick actions:

- **Card Search** → Decks-owned Card Search;
- **Cut / ID** → Tools-owned calculator;
- **Playtest** → Deck picker then Decks-owned Mobile Playtest;
- **Tournament** → standalone Tools Tournament Manager.

These are contextual deep links only. Home owns no duplicate workflow state.

---

## 9. What Should I Play

The full-width lower card launches the existing Meta What Should I Play flow.

Home performs no recommendation calculations and stores no separate recommendation state.

---

## 10. Shell and routing constraints

Home runs inside the persistent five-area shell.

There must be one global bottom navigation bar only, owned by the shell.

Child links to shell-owned areas route through the parent shell rather than recursively loading a new shell inside Home.

Feature-specific deep links preserve stable identity, including exact Deck IDs and tournament participation IDs.

Home viewport calculations must not reserve shell navigation height twice.

---

## 11. Performance/state rules

Reuse:

- shared Meta release/blend runtime;
- shared format-calendar store/resolver;
- `PTCGDeckStore`;
- root participation state;
- shared Season engine;
- canonical `DeckSprites.html()`;
- existing feature entry contracts.

Avoid:

- duplicate Meta fetches;
- Home-specific stores;
- Home-owned Expected Fields;
- duplicate format/blend/grouping engines;
- duplicate sprite rendering;
- full-page reloads merely to refresh mounted state.

The persistent shell may send lightweight activation messages so an already-mounted Home can refresh derived release/calendar state without document reload.

---

## 12. Acceptance state

Current accepted Home surface includes:

- compact single-screen dashboard;
- shared Blended hero and format context;
- Variant grouping presentation control;
- canonical shared sprites;
- Decks exact-preview navigation;
- Events exact-participation navigation;
- Card Search, Cut / ID, Playtest and Tournament quick actions;
- What Should I Play entry;
- one persistent bottom navigation layer.

Further Home work is bugfix/polish unless the roadmap deliberately reopens the product surface. End-to-end format acceptance still depends on a successful production Meta regeneration from the published calendar, but Home must not grow a second format implementation to solve that.

General Collection / physical readiness remains deferred. The standalone Kanto 151 direct-link spin-off is not a Home/main-navigation feature and does not reopen that roadmap item.
