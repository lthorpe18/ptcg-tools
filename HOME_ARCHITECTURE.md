# PTCG Tools — Home Architecture

**Status:** Current implemented Home source of truth  
**Date:** 5 September 2026  
**Scope:** `v2-preview/` Home/dashboard only

## 1. Role

Home is a **derived competitive dashboard**, not a directory and not a business-logic owner.

It should answer, at a glance:

- what the current field looks like;
- what deck the user is currently working on;
- what tournament is next;
- how to jump immediately to Card Search, Cut / ID and Playtest;
- how to enter What Should I Play.

Home must stay compact enough to fit the primary iPhone portrait viewport without routine scrolling.

Home does not own Meta, Deck, Event, Season, Playtest, Card Search or Cut / ID domain state. It reads shared state and deep-links into the owning feature.

---

## 2. Locked information hierarchy

The current Home order is:

1. **Blended Meta** hero;
2. **Decks | Events** side-by-side personal row;
3. **Card Search | Cut / ID | Playtest** quick-action strip;
4. **What should I play?** full-width recommendation entry card;
5. persistent bottom navigation: **Home · Meta · Decks · Compete · Tools**.

The existing app-level header remains above the dashboard and retains format/account/settings context.

Do not reintroduce broad Meta/Decks/Compete/Tools directory cards. The persistent shell already provides the five top-level areas.

---

## 3. Blended Meta

### 3.1 Purpose

The Home hero gives a compact current-field read rather than duplicating the full Meta page.

It shows the top five decks as a proportional bar chart with:

- share percentage;
- canonical archetype sprite presentation beneath each bar;
- optional variant grouping presentation control.

Deck names and chart axes are intentionally omitted to keep the hero compact; sprite identity plus percentages carry the presentation.

The **hero card itself opens Meta main**. The Variant grouping control is an embedded interaction and must not trigger navigation when operated.

### 3.2 Canonical blended-field model

Home consumes the shared Meta read model `MetaBlendedField.current()`.

The blend uses:

- **IRL:** latest IRL major weekend;
- **Online:** events with at least 50 players since that major weekend.

The source weighting changes continuously with age of the latest major weekend:

`IRL weight = max(30%, 70% - 2 percentage points × days since major weekend)`

`Online weight = 100% - IRL weight`

Therefore:

- day 0 → 70% IRL / 30% Online;
- day 5 → 60% / 40%;
- day 10 → 50% / 50%;
- day 15 → 40% / 60%;
- day 20+ → 30% IRL / 70% Online.

The age reference is the most recent date in the latest IRL major weekend.

Fallback behavior:

- if Online evidence is unavailable, available IRL evidence becomes 100%;
- if IRL evidence is unavailable, available Online evidence becomes 100%;
- if neither exists, Home shows an empty/loading-safe state rather than fabricated data.

Home must not implement a second blend formula.

### 3.3 Variant grouping

The compact control is labelled **Variant grouping — Off / On**.

- **Off** displays exact variants from the blended field.
- **On** groups the blended rows through the canonical Meta family definitions.

This is a presentation transformation only. It does not alter the underlying evidence blend and does not create family matchup/detail identity.

The existing Meta architecture rule still applies:

**Families describe the meta; variants play games.**

### 3.4 Bar geometry

Bars must be genuinely proportional to the largest displayed share.

Do not impose a visual percentage-height floor that materially distorts comparison.

A very small CSS pixel minimum may exist only for rendering stability/readability.

Percentage-label behavior:

- normal/tall bars: percentage sits inside near the top;
- short bars around 5–8%: percentage is vertically adjusted inside the bar for readability;
- below 5%: percentage is rendered outside/above the bar.

### 3.5 Sprite presentation

Canonical identity and overrides still come from `DeckSprites`.

For the Home hero, presentation may use `DeckSprites.slugs()` and `DeckSprites.url()` directly rather than `DeckSprites.html()` because the hero has a purpose-built layered layout.

For two-sprite variants:

- primary sprite remains the dominant centred sprite;
- secondary sprite overlaps as a smaller circular badge;
- the badge uses a subtle filled background/edge so it remains distinguishable from the primary sprite.

This is presentation only and must continue to respect canonical sprite mappings and Settings overrides.

---

## 4. Decks card

Home reads `PTCGDeckStore` and currently uses the most recently edited deck as the v1 relevance rule.

Display includes:

- canonical deck/archetype sprites;
- deck name;
- recently edited context.

The card deliberately has **two navigation levels**:

- tapping the **Decks heading/card background** opens Decks main;
- tapping the **Recently edited deck preview** opens that exact saved Deck by stable Deck ID.

Do not collapse these two targets into one whole-card route and do not add redundant `Open deck` buttons.

Home does not own Deck state.

---

## 5. Events card

Home derives the next attended event from existing `UserEventParticipation` state.

Primary behavior:

- attendance status must be `attending`;
- incomplete/current-or-future participation;
- nearest eligible event first;
- show date, event identity and compact relative/location context.

If there is no suitable next event, Home may fall back to a compact Season summary using the shared Season engine.

The card deliberately has **two navigation levels** when a next tournament exists:

- tapping the **Events heading/card background** opens **My Tournaments**;
- tapping the **Next tournament preview** opens that exact tournament by `participation` ID through the canonical Tournament Day route.

When the preview is showing a Season fallback, its own route may open the Season view instead.

Do not collapse the Events card and exact-tournament preview into one route and do not add redundant `View event` buttons.

Home does not own event lifecycle state.

---

## 6. Quick actions

The locked Home quick-action strip is:

- **Card Search** → direct entry to Decks-owned Card Search;
- **Cut / ID** → direct entry to the Tools-owned Cut / ID calculator;
- **Playtest** → Decks-owned deck picker, then launch Mobile Playtest using the selected Deck working list through the existing Playtest launch contract.

The Playtest picker is an entry affordance only. Home does not own Deck selection state or Playtest state.

These are contextual deep-links and do not change feature ownership or the five-area shell.

Do not add My Decks or Events to this strip merely as broad navigation duplicates.

---

## 7. What Should I Play

The lower full-width card is a high-value entry into the existing Meta recommendation flow.

It contains minimal copy and a decorative full-width analysis graphic.

Home owns no recommendation calculations.

The card routes into the existing Meta/What Should I Play flow, which continues to analyse exact variants according to Meta architecture.

---

## 8. Shell and routing constraints

Home runs as a child view inside the persistent five-area shell.

There must be **one bottom navigation bar only**, owned by the persistent shell.

Home child links that target a shell-owned section must be intercepted/routed through the parent persistent shell rather than loading the full app shell recursively inside the Home iframe.

The shell includes self-healing behavior so returning to Home restores the canonical Home child document if that iframe has navigated away.

Feature-specific deep links should preserve semantic route identity, including exact Deck IDs and exact tournament participation IDs.

Do not reintroduce nested shells or duplicate bottom navs.

Home viewport calculations must not reserve bottom-navigation height twice. The dashboard should use the actual child viewport supplied above the parent shell navigation.

---

## 9. Performance and state rules

Home is derived state only.

Reuse:

- locally cached Meta release core;
- shared `PTCGMetaBlend` / `MetaBlendedField` calculation;
- `PTCGDeckStore`;
- root `PTCGStorage` / `UserEventParticipation`;
- shared Season engine;
- canonical `DeckSprites`;
- existing Decks/Compete/Tools feature entry contracts.

Avoid:

- duplicate Meta fetches;
- Home-specific deck/event stores;
- Home-owned Expected Fields;
- duplicate blend/grouping engines;
- Home-owned Playtest launch state;
- reload/cache hacks to update state;
- full-shell navigation inside child frames.

Home should respond to existing local/storage/shared-runtime update events where practical.

---

## 10. Current acceptance state

The current Home redesign and navigation semantics are accepted for the present product stage after iterative iPhone testing.

Accepted product surface:

- single-screen dashboard on the target iPhone portrait experience;
- Blended Meta hero with live shared data and whole-card route to Meta main;
- dynamic IRL/Online source weighting;
- Variant grouping Off/On presentation control that does not trigger hero navigation;
- proportional top-five bars and adaptive percentage labels;
- canonical sprite identity with Home-specific two-sprite layering;
- **Decks** card background → Decks main;
- **Recently edited** preview → exact Deck;
- **Events** card background → My Tournaments;
- **Next tournament** preview → exact tournament;
- Card Search → direct Card Search entry;
- Cut / ID → direct calculator entry;
- Playtest → Deck picker → selected Deck working-list Playtest;
- What Should I Play entry card;
- one persistent bottom navigation layer.

The Home navigation regression/consistency pass was accepted on iPhone against implementation baseline `62854a094feece32fe2d1756bd8896fe1d73dd6b`.

Further Home work is polish/bugfix only unless the roadmap deliberately reopens the product surface.

The next major roadmap milestone remains **Collection / physical readiness v1**, subject to the current bounded Settings/Tools review sequence.
