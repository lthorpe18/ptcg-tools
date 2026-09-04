# PTCG Tools — Home Architecture

**Status:** Current implemented Home source of truth  
**Date:** 4 September 2026  
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
2. **My Deck | Next Event** side-by-side personal row;
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

## 4. My Deck

Home reads `PTCGDeckStore` and currently uses the most recently edited deck as the v1 relevance rule.

Display includes:

- canonical deck/archetype sprites;
- deck name;
- recently edited context.

The **entire My Deck card is the tap target**. Do not add a separate `Open deck` button/link inside the card.

The card deep-links to the relevant existing Decks route and does not own Deck state.

---

## 5. Next Event

Home derives the next attended event from existing `UserEventParticipation` state.

Primary behavior:

- attendance status must be `attending`;
- incomplete/current-or-future participation;
- nearest eligible event first;
- show date, event identity and compact relative/location context.

If there is no suitable next event, Home may fall back to a compact Season summary using the shared Season engine.

The **entire Next Event card is the tap target**. Do not add a separate `View event` button/link inside the card.

Home does not own event lifecycle state.

---

## 6. Quick actions

The locked Home quick-action strip is:

- **Card Search** → Decks-owned Card Search;
- **Cut / ID** → Tools-owned Cut / ID;
- **Playtest** → Decks-owned Mobile Playtest.

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

Do not reintroduce nested shells or duplicate bottom navs.

Home viewport calculations must not reserve bottom-navigation height twice. The dashboard should use the actual child viewport supplied above the parent shell navigation.

---

## 9. Performance and state rules

Home is derived state only.

Reuse:

- warmed persistent-shell Meta runtime;
- shared `MetaBlendedField` / Meta runtime;
- `PTCGDeckStore`;
- root `PTCGStorage` / `UserEventParticipation`;
- shared Season engine;
- canonical `DeckSprites`.

Avoid:

- duplicate Meta fetches;
- Home-specific deck/event stores;
- Home-owned Expected Fields;
- duplicate blend/grouping engines;
- reload/cache hacks to update state;
- full-shell navigation inside child frames.

Home should respond to existing local/storage/shared-runtime update events where practical.

---

## 10. Current acceptance state

The current Home redesign is accepted for the present product stage after iterative iPhone testing.

Accepted product surface:

- single-screen dashboard on the target iPhone portrait experience;
- Blended Meta hero with live shared data;
- dynamic IRL/Online source weighting;
- Variant grouping Off/On presentation control;
- proportional top-five bars and adaptive percentage labels;
- canonical sprite identity with Home-specific two-sprite layering;
- My Deck / Next Event whole-card navigation;
- Card Search / Cut-ID / Playtest quick actions;
- What Should I Play entry card;
- one persistent bottom navigation layer.

Further Home work is polish/bugfix only unless the roadmap deliberately reopens the product surface.

The next major roadmap milestone remains **Collection / physical readiness v1**.