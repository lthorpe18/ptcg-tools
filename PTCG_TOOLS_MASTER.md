# PTCG Tools — Master Product & Design Document

**Status:** Current product source of truth / PTCG Tools V2 implementation specification  
**Date:** 30 August 2026  
**Repository:** `lthorpe18/ptcg-tools`

## 1. Product vision

PTCG Tools is a personal-first competitive Pokémon TCG companion for tournament preparation, deck development, playtesting and tournament-day decision support.

It should feel like one native mobile application rather than a collection of unrelated web utilities. The primary target experience is an iPhone home-screen web app, while retaining good desktop usability.

The product should help answer five recurring competitive questions:

1. **What should I play?** — understand the current field and identify decks well positioned into it.
2. **How should I build/test it?** — manage decklists, inspect deck consistency and rapidly playtest opening turns or full solitaire games.
3. **Where and when can I play?** — discover relevant upcoming events.
4. **What should I do during a tournament?** — run or track Swiss, understand standings, and make informed ID / cut decisions.
5. **What are my odds?** — use small, trustworthy tournament and deck-math utilities without leaving the app.

The app is not intended to replace Pokémon TCG Live as a fully rules-enforced game client. It should instead be a fast, flexible competitive practice and analysis toolkit.

The core product loop is:

```text
Analyse → Build & Test → Prepare → Compete → Learn
```

- **Analyse:** understand the field and what is well positioned.
- **Build & Test:** manage exact deck versions, deck maths and mobile playtesting.
- **Prepare:** attach a chosen list, expected field, testing plan and matchup notes to a real event.
- **Compete:** use tournament-day logging, matchup notes and Cut/ID decision support.
- **Learn:** feed playtest and tournament history back into future deck and event decisions.

---

## 2. Product principles

### 2.1 Decision first, methodology second

The strongest existing page is **Meta Lab → What Should I Play?**. It should become the design and UX benchmark for the entire product.

Pages should surface the useful decision first, for example:

- “Gardevoir is best positioned into your expected field.”
- “ID gives an estimated 91% Top 4 chance.”
- “You have a 73% chance to open one of these outs.”

Detailed assumptions, evidence, calculations and advanced settings should remain available underneath through progressive disclosure.

### 2.2 Mobile first

The primary design width is approximately 390 CSS pixels. Desktop is an adaptive expansion of the mobile experience, not the other way around.

Important controls should be thumb-friendly, at least approximately 44 px high, and text inputs must remain at 16 px or above to avoid iOS Safari focus zoom.

### 2.3 One product, one design system

All major areas should share:

- global navigation;
- typography;
- surface styles;
- form controls;
- cards;
- segmented controls;
- loading / empty / error states;
- modals or bottom sheets;
- toast styling;
- icons and Pokémon sprite treatment.

Individual areas may have specialised components, but they should not each define a separate visual identity.

### 2.4 Pokémon character, without visual clutter

Pokémon sprites are highly effective identifiers for archetypes and saved decks. They should provide most of the app’s personality.

Avoid excessive gradients, glassmorphism, neon treatments or decorative Pokémon branding. The app should feel like a polished analytical companion rather than a fan site.

### 2.5 Fast defaults, powerful advanced controls

The app should work well without configuration. Advanced users can reveal additional settings when needed.

Examples:

- What Should I Play defaults to useful field and matchup assumptions.
- Cut Calculator defaults to an empirically sensible BO3 tie rate.
- Playtest should start a shuffled game in one or two taps.

---

## 3. Current application state

The repository currently contains the following principal applications:

- `apps/meta` — Meta Lab, including What Should I Play, meta overview, matchup analysis and deck/archetype analysis.
- `apps/decklists` — saved deck management, text lists, sprites, statistics and opening-hand probability functionality.
- `apps/events` — upcoming tournament listing and map.
- `apps/swiss` — Swiss Tournament Manager with tournament library, participants, rounds, pairings, standings, timer and top cut.
- root `index.html` — current launcher page.

There is also an `apps/_shared` area that should become the foundation for shared application infrastructure.

### 3.1 Current strongest area

Meta Lab has evolved furthest. In particular, What Should I Play already demonstrates the desired PTCG Tools 2.0 visual language:

- light `#f7f8fb` page background;
- white surfaces;
- subtle borders and shadows;
- 15–18 px card radii;
- compact pills and chips;
- restrained blue and green status colour;
- strong typographic hierarchy;
- Pokémon sprites as identity markers;
- progressive disclosure through expandable “Why?” and Advanced Settings sections.

### 3.2 Current inconsistencies to remove

The root launcher and Decklists still use an older dark/glass design. Events and Swiss have separate header/navigation patterns. The result feels like several individual tools rather than one application.

Decklists also contains overlapping/legacy UI structures and duplicate concepts, including multiple deck/stat views and repeated deck-text editing surfaces. This should be rationalised as part of the redesign rather than merely restyled.

---

## 4. Target information architecture

The application should have five persistent top-level areas on iPhone, presented through a native-style bottom tab bar.

### Home
Personal competitive dashboard and high-value shortcuts.

### Meta
Competitive field analysis and deck-positioning tools.

Subsections:
- Play — What Should I Play?
- Field — current meta composition and shifts
- Matchups — head-to-head evidence
- Decks — archetype detail, trends, results and decklists

### Decks
Personal saved deck library, deck editing, consistency analysis and playtesting entry points.

### Compete
Tournament discovery and tournament-day workflows.

Subsections:
- Events
- My Tournaments / Swiss manager

### Tools
Focused small utilities that deserve quick access but do not justify their own primary navigation item.

Initial tools:
- Cut / ID Calculator
- Tournament Structure Calculator
- Draw / Outs Calculator
- Prize Calculator

---

## 5. Global app shell

### 5.1 Bottom navigation

Persistent tabs:

**Home · Meta · Decks · Compete · Tools**

Use simple line icons plus short labels. The selected tab uses the app action accent; unselected tabs are muted.

The bar must account for `env(safe-area-inset-bottom)` when launched from an iPhone home screen.

### 5.2 Contextual navigation

Nested objects such as a deck or active tournament may use a compact contextual back affordance such as `‹ Decks` or `‹ Tournaments`, but the global product shell should remain visually consistent.

Avoid repeated browser-style `← PTCG Tools` links across separate mini-sites.

### 5.3 PWA / home-screen behaviour

The app should be configured as a genuine standalone web app:

- `manifest.webmanifest`;
- `display: standalone`;
- proper app icon sizes including Apple touch icon;
- `theme-color`;
- `viewport-fit=cover`;
- safe-area CSS;
- consistent status-bar background;
- start URL and app name;
- service worker for static application shell/assets where practical.

The intention is that launching from the iPhone home screen feels much closer to opening a native app than opening a bookmarked website.

---

## 6. Global design language

### Core palette

- Background: `#F7F8FB`
- Surface: `#FFFFFF`
- Primary text: `#101828`
- Secondary text: `#667085`
- Light muted text: `#98A2B3`
- Border: `#E4E7EC`
- Interaction blue: approximately `#175CD3`
- Positive / recommended green: approximately `#079455`
- Warning amber: approximately `#B54708`
- Negative red: approximately `#D92D20`

### Shape

- Main cards: 15–18 px radius
- Form controls: 9–12 px radius
- Pills/chips: full rounded radius
- Touch target: approximately 44 px minimum

### Typography

Use the native/system font stack for maximum iOS-native feel and performance.

Hierarchy should follow the Meta Lab pattern:

- occasional small uppercase eyebrow labels;
- strong compact page titles;
- muted short explanations;
- bold numeric decision outputs;
- detailed methodology kept visually subordinate.

### Pokémon sprites

Use sprites consistently for:

- deck/archetype identity;
- saved deck cards;
- recommendation cards;
- meta summaries;
- recent items.

Sprites should not be used as unnecessary decorative background imagery.

---

## 7. Home

The existing launcher should be replaced completely.

Home should feel like a competitive dashboard, not a menu.

### 7.1 Header

Compact brand mark + **PTCG Tools**.

Right-side contextual indicator such as the current legality/format (`PBL · Standard`) and eventually settings/profile.

### 7.2 Main hero

Default hero should promote the app’s strongest decision feature:

**TOURNAMENT PREP**  
**What should I play?**

Show a concise current recommendation/field summary and 2–3 relevant Pokémon sprites, with a clear route into full analysis.

### 7.3 Quick actions

Compact native-style cards/rows for:

- My Decks
- Find Events
- Cut Calculator
- Run Tournament

These should not be oversized app-launcher tiles.

### 7.4 Competitive snapshot

Show a compact current meta summary with leading archetypes and shares, linked to Meta → Field.

### 7.5 Personal/recent context

Potential modules:

- recently edited deck;
- next event;
- active tournament;
- last playtested deck;
- recent recommendation.

Only show modules where useful data exists.

---

## 8. Meta

Meta Lab remains the benchmark and requires evolution rather than a major rewrite.

### 8.1 Subnavigation

Use:

**Play · Field · Matchups · Decks**

“Field” is clearer than nesting a “Meta” tab inside a Meta area.

### 8.2 What Should I Play

Preserve:

- expected-field chips;
- ranked recommendation cards;
- Pokémon sprites;
- matchup-weighted score;
- confidence/evidence indication;
- expandable reasoning;
- check-a-deck flow;
- advanced assumptions.

### 8.3 Filter simplification

Current format/window/minimum-player/minimum-match controls should not dominate the mobile screen.

Default view should show a compact context pill such as:

`PBL Standard · all format · 50+ events  ⚙`

Tapping opens a bottom-sheet/settings panel.

### 8.4 Data sources

Current architecture uses:

- `play.limitlesstcg.com` for online events, field shares and tournament results;
- broader Limitless aggregate data for matchup evidence where available;
- `labs.limitlesstcg.com` for IRL major-event data.

Field composition and matchup evidence should remain conceptually separate so missing matchup evidence is never silently replaced by unrelated overall win rate.

---

## 9. Decks

Decklists needs the largest UX simplification.

### 9.1 Deck library

Top-level screen:

**Decks** with a compact `+` action and search.

Each saved deck should display:

- deck name;
- one or two Pokémon sprites;
- format;
- last updated;
- concise useful metadata such as 60 cards or pinned odds.

### 9.2 Deck detail navigation

Use three clear sections:

**Overview · List · Odds**

#### Overview
- deck identity and sprites;
- quick deck statistics;
- pinned cards/odds;
- duplicate/delete/export actions placed behind sensible menus;
- prominent **Playtest** action.

#### List
One authoritative list editor only.

Support PTCGL and Limitless-style text imports and exports.

Optional later toggle between Text and Visual display, but do not maintain multiple simultaneous deck-text editors.

#### Odds
Deck-aware probability calculations that automatically know deck size and card counts.

This can surface pinned checks such as:

- at least one Buddy-Buddy Poffin in opening seven;
- at least one of several outs by a specified number of cards seen;
- prize probabilities.

The standalone Tools calculators remain useful for ad-hoc calculations without opening a saved deck.

---

## 10. Mobile Playtest — major new feature

### 10.1 Product opportunity

Limitless currently exposes a **Playtest** action from its Deck Builder. Its Tabletop tool is designed for practising opening hands/turns or even complete self-played games. Limitless explicitly states that its older tabletop workflow is built around mouse + keyboard, keyboard shortcuts and drag-and-drop, and does not support mobile well.

PTCG Tools should target this gap directly: **a fast mobile-first Pokémon TCG tabletop for goldfishing decks**.

### 10.2 Intended use

Primary use cases:

1. repeatedly test opening hands;
2. practise the first 1–3 turns of a deck;
3. test sequencing lines;
4. inspect prize/deck-state implications;
5. play out a complete solitaire game;
6. optionally control two decks manually for matchup testing.

It is not initially intended to validate card text or enforce every Pokémon TCG rule.

### 10.3 Entry points

From a saved deck:

**Playtest**

Options in a lightweight setup sheet:

- Quick opening hand
- New solo game
- Two-deck test (later phase)

The default should be one-tap **New solo game**.

### 10.4 Mobile table layout

Portrait iPhone layout should prioritise current information rather than attempting to reproduce a physical table at full scale.

Suggested vertical composition:

1. compact turn/status strip;
2. Active Pokémon zone;
3. horizontally scrollable Bench;
4. Stadium/shared zone;
5. Hand as the dominant bottom area;
6. persistent bottom action bar;
7. Deck / Discard / Lost Zone / Prizes as tappable stack buttons with counts.

Landscape can optionally provide a wider tabletop layout but must not be required.

### 10.5 Interaction model

Avoid drag-and-drop as the primary interaction.

**Tap a card → action sheet.**

Example actions based on zone:

- Move to Active
- Move to Bench
- Attach to…
- Discard
- Lost Zone
- Return to hand
- Put on top/bottom of deck
- Shuffle into deck
- Add damage counters
- Mark status

Bulk actions should exist for common deck mechanics:

- Search deck
- Look at top N
- Draw N
- Shuffle hand into deck
- Shuffle deck
- Discard selected cards
- Reveal prizes

Cards can optionally support drag gestures later, but every important action must remain tap-operable.

### 10.6 Game setup automation

**New Game** should:

1. shuffle deck;
2. draw seven;
3. identify whether at least one Basic Pokémon is available where card metadata supports it;
4. allow fast mulligan/redraw;
5. let user choose Active and Bench from hand;
6. set six face-down prizes automatically;
7. select going first/second;
8. begin Turn 1.

Where exact card metadata is incomplete, setup must remain usable manually rather than blocking.

### 10.7 Essential zones/state

- Deck
- Hand
- Active
- Bench
- Discard
- Lost Zone
- Prizes
- Stadium
- attached cards/energy
- damage counters
- simple status/markers
- turn number
- going first/second

### 10.8 Critical utility actions

Persistent actions:

- Draw
- Search Deck
- Shuffle
- Coin Flip
- Undo
- End Turn

Secondary menu:

- restart game;
- reveal prizes;
- draw N;
- view full deck state;
- reset damage/markers;
- concede/end test.

### 10.9 Undo / history

Undo is essential on a touch-first tabletop because users will occasionally tap the wrong action.

Maintain a bounded action history sufficient to reverse recent moves, draws, searches, shuffles and counter changes where practical.

### 10.10 Practice analytics

A major advantage over Limitless would be optional test-session tracking.

For each reset/game, record simple user-driven observations:

- mulligan?
- setup succeeded?
- Turn 1 objective achieved?
- Turn 2 objective achieved?
- dead hand?
- notes/tags.

A deck could then show:

**Playtest history**

- 40 opening hands
- 12.5% mulligan rate
- 72% Turn 2 setup success
- common missing pieces

This should remain optional and lightweight; it can become extremely useful for comparing decklist revisions.

### 10.11 Future playtest phases

**Phase A — Solo/goldfish tabletop**  
Core mobile interaction and state management.

**Phase B — Two-deck local testing**  
Load Deck A and Deck B, switch sides manually, hide/show opposing hand as required.

**Phase C — Test scenarios**  
Save/reload a board state such as “going second into Dragapult after Turn 1”.

**Phase D — Assisted practice**  
Potentially provide setup prompts/statistical logging, but avoid pretending to be a full legal-move engine.

### 10.12 Technical principle

Use the existing deck parser and card metadata where possible. A playtest game should store card instances separately from the original saved decklist so shuffling/moving cards cannot mutate the underlying deck.

Recommended conceptual state:

```text
game
  deck[]
  hand[]
  active
  bench[]
  discard[]
  lostZone[]
  prizes[]
  stadium
  attachments{}
  damage{}
  markers{}
  turn
  goingFirst
  history[]
```

---

## 11. Compete

Compete should connect **event discovery → intent to attend → preparation → tournament day → results**. It should not be a generic events list beside an unrelated Swiss utility.

### 11.1 Official event discovery source

The existing Events implementation currently reads a manually maintained Google Sheet. This must be retired as the intended PTCG Tools 2.0 source because a stale sheet can appear live even when nobody is maintaining it.

The canonical upstream source for sanctioned local Pokémon TCG events should be the **official Play! Pokémon Event Locator**. Pokémon directs players to the Event Locator for local sanctioned events, and sanctioned events are intended to be entered in advance so players can discover them there.

Limitless should remain a source for online events, decklists, tournament results and metagame evidence, but should **not** be treated as the authoritative source for every local League Cup, League Challenge, Prerelease or other sanctioned Play! Pokémon event.

### 11.2 Event ingestion architecture

Do not make the mobile client scrape the Event Locator directly on every visit.

Target flow:

```text
Official Play! Pokémon Event Locator
        ↓
Scheduled repository importer
        ↓
Normalise + validate
        ↓
data/events.json
        ↓
PTCG Tools client
```

The importer should run automatically through GitHub Actions on a sensible cadence, initially several times per day.

The generated dataset should contain metadata such as:

```text
source
lastAttemptedUpdate
lastSuccessfulUpdate
eventCount
schemaVersion
```

The app should display a freshness indicator such as **Updated 2 hours ago**. If the importer fails, the last known-good file should remain available and the UI should clearly indicate that data may be stale.

### 11.3 Event-ingestion safety checks

A refresh must not blindly replace the current dataset. Before publication validate at least:

- response is non-empty and structurally recognised;
- event IDs are valid/unique enough to act as stable keys;
- dates parse and are plausible;
- event type/product can be identified;
- location/venue information is present for a sensible proportion of events;
- a sudden catastrophic drop in event count is treated as suspicious;
- malformed data does not overwrite the previous known-good dataset.

Validation failures should fail the workflow rather than publish damaged data.

### 11.4 Events experience

**Compete → Events** should prioritise useful sanctioned TCG events, especially local competitive events.

Mobile page:

- Nearby / Favourites / All views;
- filters for Cups, Challenges, Prereleases and other TCG events;
- date-range filter;
- distance/radius filter where coordinates are available;
- List | Map segmented control;
- compact event cards showing type, venue, date/time, distance and registration state;
- link to the official event record;
- organiser/store registration URL where supplied.

The app should be better than the upstream locator at prioritising the information a competitive player actually needs, without pretending to own the authoritative event record.

### 11.5 Favourite venues

Users should be able to favourite stores/venues.

Favourites support:

- an Events filter;
- Home-screen upcoming-event summaries;
- higher prominence when several nearby events exist.

### 11.6 Event intent — Interested / Attending / Attended

A discovered event can become a personal object without copying the entire upstream event permanently.

Initial statuses:

```text
interested
attending
attended
skipped
```

The key action on an event is **I'm attending**. This creates a local `PlannedEvent` linked back to the official event ID and automatically creates or links a Tournament Prep workspace.

This action should be more prominent than simply opening an external website.

### 11.7 Tournament Prep workspace

Tournament Prep is a first-class connecting object rather than a loose collection of notes.

For an event the prep workspace can contain:

- chosen deck/version;
- expected field saved from Meta → Play;
- testing goals;
- playtest-session summaries;
- matchup notes / cheat sheets;
- final list;
- practical checklist;
- registration/event links.

Example Home module:

```text
NEXT EVENT · 12 DAYS
Bristol League Cup
Dragapult v8
Prep 65% complete
Continue prep →
```

### 11.8 Tournament-day transition

On the event date, the same planned-event/prep object should be able to transition into Tournament Day rather than creating a disconnected record.

Tournament Day can expose:

- current W-L-T record and match points;
- round-by-round result logging;
- opponent archetype and notes;
- first/second where the user wants to track it;
- quick access to matchup notes;
- standalone or contextual Cut / ID Calculator;
- optional pairing/standings link;
- final Swiss seed and cut result.

### 11.9 My Tournaments / Swiss manager

The Swiss manager is a task-focused workspace and should preserve its existing major capabilities:

- saved tournament library;
- participants;
- Swiss/round-robin mode;
- pairings;
- results;
- standings;
- timer;
- top cut;
- import/export.

An active managed tournament should emphasise:

- tournament title and current round;
- prominent timer;
- tabs: Round · Standings · Players · Cut;
- settings behind a compact overflow action.

If the user is merely **playing in** an event rather than running it, Tournament Day should be much lighter than the full tournament-manager UI.

---

## 12. Cut / ID Calculator

### 12.1 Purpose

Help a player answer, during Swiss:

- Can I intentionally draw and make cut?
- How safe is an ID compared with playing?
- What scores can still overtake me?
- How much does resistance matter?

### 12.2 Simple inputs

- players in division;
- total Swiss rounds;
- rounds completed;
- cut size;
- player W-L-T record;
- opponent record if known;
- optional counts of other players on each W-L-T record;
- optional resistance strength.

A blank record count means unknown. `0` means known to be exactly zero.

### 12.3 BO3 tie-rate assumptions

Suggested presets based on recent major-event BO3 data:

- Low ties — 12%
- Typical BO3 — 16% (default)
- High ties — 20%
- Very high ties — 25%
- Custom

Observed recent major-event examples examined during development clustered around approximately 15–18%, supporting ~16% as a sensible default baseline.

### 12.4 Unknown standings model

Do not independently assign random W-L-T records to unknown players.

Instead:

1. start all simulated players at 0-0-0;
2. simulate actual matches round by round;
3. Round 1 random pairings;
4. later rounds pair primarily by equal/similar match points;
5. float/down-pair between nearby score groups when needed;
6. avoid rematches where possible;
7. track previous opponents and byes;
8. resolve matches using the selected tie rate and otherwise one winner/one loser;
9. retain simulated current standings only when they match the user’s record and every exact record-count constraint;
10. simulate ID/play and the remaining Swiss rounds from those valid states.

This reproduces the documented behaviour of Pokémon/TOM-like Swiss pairings rather than claiming to reproduce TOM’s undisclosed implementation exactly.

### 12.5 Output hierarchy

Headline:

**91% Top 4 if you ID**  
**84% Top 4 if you play**

Recommendation:

**ID favoured**

Then expandable explanation:

- hard cutoff structure;
- players already above the target score;
- bubble players;
- unknown-standings uncertainty band;
- simulation assumptions;
- resistance sensitivity.

### 12.6 Integration with Swiss manager

If the tournament is being run in PTCG Tools, Cut Calculator should eventually receive the complete current standings/pairings automatically. This removes the need to reconstruct the tournament and can produce materially stronger answers.

---

## 13. Tools area

Tools should contain genuinely useful quick utilities, not filler.

### 13.1 Tournament Structure

Input attendance/event parameters and return:

- Swiss rounds;
- cut size/structure;
- common score benchmarks;
- record equivalents.

It should be able to launch Cut Calculator with tournament settings already populated.

### 13.2 Draw / Outs Calculator

Support both single-card and grouped outs.

Examples:

- probability of at least one of 4 copies in opening seven;
- probability of Buddy-Buddy Poffin OR Nest Ball by Turn 1;
- probability of finding two required categories by N cards seen.

Saved-deck mode should populate counts automatically.

### 13.3 Prize Calculator

Examples:

- probability at least one of N copies is prized;
- probability all copies are prized;
- probability a combination of important pieces is prized;
- optional six-prize visualisation.

---

## 14. Technical architecture direction

Do not introduce a heavy framework solely for the redesign. Plain HTML/CSS/JavaScript remains suitable.

Strengthen the shared layer instead.

Suggested structure:

```text
apps/_shared/
  app-shell.css
  app-shell.js
  components.css
  icons.js
  deckParser.js
  probability.js
  sprites.js
  storage.js
```

The global shell should own:

- theme tokens;
- bottom navigation;
- page headers;
- common buttons/forms;
- segmented controls;
- modal/bottom-sheet behaviour;
- toast messages;
- safe-area handling;
- common responsive breakpoints.

Specialised apps keep their domain logic separate.

---

## 15. Data model and persistence

The V2 app now contains connected concepts. These relationships should be designed deliberately before features persist significant new data.

### 15.1 Core entities

#### Deck

```text
Deck
- id
- name
- archetype
- sprites[]
- currentVersionId
- createdAt
- updatedAt
```

#### DeckVersion

```text
DeckVersion
- id
- deckId
- versionLabel
- decklist
- cardSnapshot / parsedCards
- notes
- createdAt
```

Deck versions are important because playtesting and tournament results must be attributable to the exact list that was used, not only to a mutable deck name.

#### Event

Upstream/canonical event data, normally from the official Event Locator.

```text
Event
- officialEventId
- name
- type
- product
- venue
- address
- city
- coordinates
- date / startTime
- registrationUrl
- officialUrl
- source
- sourceUpdatedAt
```

#### PlannedEvent

Personal state linked to an official event.

```text
PlannedEvent
- id
- eventId
- status: interested | attending | attended | skipped
- prepId
- createdAt
- updatedAt
```

#### TournamentPrep

```text
TournamentPrep
- id
- plannedEventId
- chosenDeckVersionId
- expectedMetaSnapshot
- testingGoals[]
- matchupNotes[]
- checklist[]
- finalDeckVersionId
- notes
```

#### PlaytestSession

```text
PlaytestSession
- id
- deckVersionId
- opponentArchetype / opponentDeckVersionId
- mode
- wentFirst
- result
- objectives{}
- mulligans
- notes
- createdAt
```

#### TournamentResult

```text
TournamentResult
- id
- plannedEventId / eventId
- deckVersionId
- rounds[]
- finalRecord
- swissSeed
- cutResult
- notes
```

### 15.2 Relationship model

```text
Official Event
     ↓
Planned Event
     ↓
Tournament Prep ─────→ Deck Version
     │                      │
     │                      └──→ Playtest Sessions
     ↓
Tournament Result ────→ Personal Matchup / performance analytics
```

Meta snapshots can be attached to Tournament Prep so future analysis can distinguish **what the field looked like when the decision was made** from whatever the live meta looks like later.

### 15.3 Local persistence strategy

V2 should remain local-first initially. Important personal information includes:

- saved decks and versions;
- deck identity/sprites;
- pinned calculations;
- planned events;
- favourite venues;
- tournament-prep workspaces;
- playtest sessions;
- saved/managed tournaments;
- tournament results;
- user preferences and recent items.

Use a schema/versioned storage wrapper rather than scattered direct `localStorage` reads. Existing data must be migrated rather than silently discarded.

Import/export remains valuable as a backup mechanism even if storage is later centralised or synchronised.

### 15.4 Snapshot rule

Anything that may change externally but matters historically should be snapshotted when attached to personal history. Examples:

- chosen deck list/version;
- expected meta used for an event;
- event details at time of attendance.

Do not rely on current live external data to reconstruct past decisions.

---

## 16. Additional feature candidates

### High-value candidates

#### A. Playtest session analytics
Track opening hands and setup objectives across deck revisions. This is a natural extension of the mobile tabletop and directly supports competitive preparation.

#### B. Deck versioning
Save named snapshots of a deck:

- “Cup list”
- “-1 Pokégear +1 Catcher”
- “post-testing v3”

Compare card changes and optionally compare playtest outcomes between versions.

#### C. Matchup testing log
From a saved deck, record games such as:

`Dragapult vs Gardevoir — W — went second — notes`

Aggregate personal testing records separately from public meta matchup data.

#### D. Tournament prep workspace
Select an upcoming event and attach:

- chosen deck/version;
- expected meta;
- matchup notes;
- testing goals;
- travel/event link;
- final submitted list.

This could connect Events, Meta and Decks into one workflow.

#### E. Matchup notes / cheat sheets
Per deck-versus-deck notes:

- preferred first/second;
- key prizes to check;
- important targets;
- sequencing reminders;
- tech cards.

Useful on tournament morning and during testing.

#### F. Personal results dashboard
Track real tournament results by deck, archetype faced, event type and season.

Potential outputs:

- overall W-L-T;
- record by deck;
- record by opposing archetype;
- Cup/Challenge performance;
- conversion to cut;
- ties by deck.

#### G. Decklist comparer
Compare two lists of the same archetype and show only differences, with sprite/card visuals where useful.

This is particularly valuable when looking at successful Limitless lists.

#### H. Meta-to-deck tech analysis
For a selected saved deck, combine current expected field with card usage across successful versions of that archetype to surface common tech choices relevant to the current meta.

### Medium-value candidates

#### I. Tournament day mode
A single simplified screen containing:

- current record;
- next pairing/opponent notes;
- round timer link;
- Cut Calculator;
- quick match result logging.

#### J. Deck registration/export centre
One place to produce:

- PTCGL text;
- Limitless-compatible text;
- deck image;
- printable list if required.

#### K. Scenario library
Save playtest board states or opening scenarios for repeated practice.

Examples:

- “Going second, bad opener”
- “Need comeback after Iono”
- “Turn 2 prize mapping practice”

#### L. Card package / consistency groups
Define logical deck packages such as:

- Basics
- Ball search
- Draw supporters
- Energy outs

Then calculate package consistency instead of only individual card probabilities.

---

## 17. Features to avoid or defer

### Full automated Pokémon rules engine
Very high complexity and not necessary to achieve the main playtesting goal. The mobile tabletop should prioritise flexible manual state manipulation.

### AI opponent in initial playtest version
Potential future research area, but it should not block a highly useful solitaire/tabletop implementation.

### Social network/community layer
Not currently core to the personal competitive-companion vision.

### Large number of novelty calculators
Tools should remain curated and useful.

---

## 18. PTCG Tools V2 implementation roadmap

Implementation should proceed as a controlled product rebuild. Do not accumulate isolated feature patches without shared foundations. Each milestone must leave the branch in a usable state and be validated before the next one begins.

### V2.0 — Foundation

Outcome: the project visibly becomes one app.

- shared V2 design tokens and common components;
- native-style bottom navigation: Home · Meta · Decks · Compete · Tools;
- safe-area handling and mobile-first responsive shell;
- PWA manifest and home-screen metadata;
- service-worker/static-shell baseline where safe;
- shared versioned storage wrapper;
- completely redesigned Home dashboard;
- existing areas remain reachable during migration.

**Validation gate:**

- no horizontal overflow at ~320/390 px;
- all five navigation destinations work;
- standalone/PWA metadata paths resolve;
- old pages are still reachable;
- existing saved local data is not intentionally overwritten.

### V2.1 — Meta integration

Outcome: the strongest existing area feels native to the new shell.

- retain What Should I Play design and logic;
- adopt shared header/navigation/safe-area system;
- rename Meta Lab internal `Meta` tab to `Field`;
- reduce prominent mobile filter clutter through progressive disclosure;
- keep data-source separation intact.

**Validation gate:** current Meta/Play/Matchups/Decks functions still load and existing DOM IDs used by logic remain valid.

### V2.2 — Decks + version-ready data model

Outcome: one coherent deck workflow.

- restyle library into V2 system;
- remove duplicate/legacy deck-text/stat surfaces;
- Deck detail becomes Overview · List · Odds;
- introduce backward-compatible Deck / DeckVersion representation;
- add prominent Playtest entry point even before full Playtest ships;
- preserve import/export and existing saved lists.

**Validation gate:** existing deck data migrates/loads; create/edit/save/delete/duplicate/import/export still work; only one authoritative deck-list editor exists.

### V2.3 — Official Events + personal event intent

Outcome: reliable event discovery becomes part of the connected product.

- retire Google Sheet as intended production source;
- scheduled official Event Locator importer;
- validation + last-known-good `data/events.json`;
- source freshness metadata;
- mobile Events redesign;
- favourites;
- Interested / I'm attending / Attended states;
- planned event and Tournament Prep skeleton;
- Home shows next attended/planned event.

**Validation gate:** importer failure cannot destroy prior data; event JSON validates; UI handles empty/stale/offline cases; attendance state persists.

### V2.4 — Mobile Playtest v1

Outcome: a saved deck can be goldfished comfortably on an iPhone.

- card-instance game state;
- shuffle/draw/mulligan/setup/prizes;
- Hand / Deck / Active / Bench / Discard / Lost Zone / Stadium;
- tap → action sheet as primary interaction;
- draw/search/look-at-top/shuffle actions;
- damage/markers;
- undo/history;
- restart/new game;
- quick opening-hand mode;
- session can reference an exact DeckVersion.

**Validation gate:** state conservation test — every card instance exists in exactly one zone/attachment location; repeated restart/shuffle/draw operations never create or lose cards; primary flow is usable at 390 px without drag gestures.

### V2.5 — Tournament Prep

Outcome: Events, Meta, Decks and Playtest connect around a real event.

- attending event automatically creates prep workspace;
- choose exact deck version;
- save expected-field snapshot from What Should I Play;
- testing goals and session summaries;
- matchup cheat sheets;
- practical checklist;
- final list lock.

**Validation gate:** deleting/changing a deck cannot orphan historical prep data without an explicit migration/snapshot; meta snapshots remain historical.

### V2.6 — Tournament Day + Cut/ID

Outcome: the same event object supports actual competition.

- lightweight player tournament-day mode;
- round results, opponent archetype, first/second and notes;
- current W-L-T / match points;
- Cut / ID Calculator contextual launch;
- complete Cut/ID simulator added to Tools as standalone mode;
- if using the full Swiss manager, feed complete standings directly into the calculator.

**Validation gate:** tournament-point accounting is consistent; Cut calculator constraints preserve exact entered record counts; unknown standings are generated via valid simulated Swiss histories rather than independent W-L-T sampling.

### V2.7 — Remaining Tools

- Tournament Structure;
- Draw / Outs;
- Prize Calculator;
- context-aware versions inside Decks/Compete.

### V2.8 — Personal analytics

- deck-version comparisons;
- playtest analytics;
- personal matchup log;
- tournament history/results dashboard;
- meta-aware tech/list comparison.

### V2.9 — Polish / resilience

- performance pass;
- offline/static-shell behaviour;
- accessible labels/focus states;
- animation/haptic-like visual feedback kept restrained;
- final icon/logo/splash assets;
- migration/backup UX;
- broad mobile regression pass.

### Implementation discipline

For every milestone:

1. preserve the live `main` branch until the V2 branch is validated;
2. make the smallest coherent set of changes that achieves the milestone;
3. run structural/syntax checks on changed HTML/CSS/JS;
4. check all links and referenced local assets;
5. run targeted functional tests for the feature logic;
6. manually reason through mobile edge cases and empty/error states;
7. record any deliberate limitations in this master document rather than silently leaving ambiguous behaviour.

---

## 19. Product success criteria

PTCG Tools 2.0 is successful when:

- launching it from an iPhone home screen feels like opening one coherent application;
- the Home screen immediately surfaces useful competitive context rather than a directory of links;
- the Meta area retains the quality of What Should I Play;
- saved decks are easy to find, edit, analyse and playtest on mobile;
- a player can goldfish a deck on an iPhone without requiring keyboard shortcuts or precise dragging;
- event, tournament and Cut Calculator workflows feel connected;
- advanced analysis remains available without overwhelming routine use;
- every major feature answers a real competitive decision or workflow rather than existing merely because it is technically possible.

---

## 20. External reference notes

Limitless was used as an important reference point for this product direction:

- its Deck Builder exposes a Playtest action;
- its Tabletop supports practising opening hands/turns and complete self-played games;
- Limitless states that the older Tabletop is designed for mouse + keyboard, uses keyboard shortcuts/dragging, and does not support mobile;
- Limitless also exposes useful adjacent tools including Swiss Calculator and Opening Hand Calculator.

The official **Play! Pokémon Event Locator** is the canonical planned source for sanctioned local event discovery. PTCG Tools should ingest and cache that data safely rather than rely on a manually maintained Google Sheet.

PTCG Tools should not clone Limitless visually or technically. The opportunity is to combine the strongest competitive-analysis ideas with a substantially better personal/mobile workflow.
