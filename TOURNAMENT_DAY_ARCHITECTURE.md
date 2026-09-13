# PTCG Tools — Tournament Day / Results Architecture

**Status:** Current accepted Tournament Day source of truth  
**Date:** 13 September 2026  
**Companion to:** `PTCG_TOOLS_MASTER.md`, `PERFORMANCE_ARCHITECTURE.md`, `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md`, `SEASON_ARCHITECTURE.md`

## Purpose

This document records the canonical Tournament Day / tournament-result model and the boundaries between Compete, Decks personal learning, Game Log and Season.

The canonical account-owned event-history entity is one `UserEventParticipation`. Tournament Day does not create a second tournament/history model.

---

## 1. Ownership locks

- Compete owns Events, attendance, Online discovery, Event Prep, Tournament Day, completion and Season.
- Deck/DeckVersion identity remains Decks-owned.
- Real tournament rounds use shared `PTCGMatchStore` / Match/Game evidence.
- Tournament Day does not create a second match-history store.
- Tournament standings/completion/Season are **Match-level**.
- Personal deck/matchup/version learning consumes the **Games beneath those Matches**.
- **Game Log** may show those tournament Games alongside training Games, but remains a derived browser over the same store.
- Solo/goldfish Mobile Playtest remains outside competitive W/L evidence.
- Deck/archetype visuals use the one shared `DeckSprites.html()` renderer.

---

## 2. Tournament entry model

A tournament may begin from:

### Event/catalogue path

An existing attending `UserEventParticipation` is opened from Event discovery, My Events, Online discovery or Event Prep.

The same participation retains:

- event/catalogue identity;
- retained event snapshot;
- attendance state;
- Prep;
- planned exact list;
- Tournament Day state;
- real Matches/Games;
- completion.

### Ad-hoc path

`Record tournament` may create a participation with no catalogue event.

An ad-hoc tournament has:

- stable participation ID;
- `eventId: null`;
- retained manual event snapshot;
- in-person or online context;
- the same downstream Tournament Day / Match / completion path.

Online tournaments and local league nights therefore do not need parallel history models.

---

## 3. Participation lifecycle

`UserEventParticipation` contains durable fields including:

- `plannedDeckRef`;
- `usedDeckRef`;
- `tournamentDay`;
- `completion`.

Phase is derived from participation state:

- attendance/prep → preparation;
- `tournamentDay` present → in progress;
- `completion` present → completed;
- past attended event without completion → needs completion.

Opening Tournament Day for an uncompleted participation may create lightweight Tournament Day timestamps. **Deck selection is not a start gate.**

---

## 4. My Events / tournament lists

Completed/current/upcoming tournament cards use the same participation model and same canonical deck sprites as the rest of the app.

Tournament card identity may include:

- event name/type/date;
- online/local/major context;
- used deck where known;
- Match W-L-D;
- round count;
- placement or **Dropped** when explicitly recorded.

Online discovery source is not itself the classification authority for personal evidence; event/participation metadata is.

---

## 5. Planned deck vs played deck

`plannedDeckRef` and `usedDeckRef` are separate concepts.

Event Prep may write an exact planned list:

- `deckId`;
- `deckVersionId`;
- `listHash`.

Tournament Day does not require a deck before recording rounds.

The compact Tournament Day **My Deck** control is the live played-deck selector. Selecting/changing/removing it updates `usedDeckRef` and reconciles linked Match deck references.

A planned deck may be suggested but must never silently become `usedDeckRef`.

Historical DeckVersions remain immutable.

---

## 6. Match / Game contract

Every competitive tournament round is stored through the shared Match store with:

- stable Match ID;
- `participationId`;
- optional catalogue event ID and event-name snapshot;
- exact deck/list identity when attached;
- opponent archetype;
- Match result W/L/D;
- round label/stage;
- optional notes;
- individual entered Games.

Editing a round reuses the same Match ID and replaces that record. Deleting a round removes that Match.

### Match-level vs Game-level evidence

Locked rule:

- tournament record/standings/completion/Season = Match result;
- personal Deck/matchup/version analysis = individual Games;
- Game Log = chronological view of those individual Games plus training Games;
- public H2H = separate global evidence.

A 2–1 round therefore contributes one Match win and three personal Game observations.

### Game entry

Normal round capture is game-by-game:

- Game 1 W/L/T;
- Game 2 W/L/T;
- Game 3 when required;
- aggregate Match W/L/D is derived.

### Intentional draw

ID is displayed distinctly from a played draw. The current compatibility representation may still use the accepted note marker while the canonical Match result is Draw.

---

## 7. Round-history UX

Round rows remain compact and opponent-focused:

**R# · vs · canonical opponent sprite + archetype · game sequence · Match-result badge**

The player's own deck is shown once in the My Deck control rather than repeated in every row.

Result badges:

- W — green;
- D — amber/orange;
- L — red;
- ID — neutral/dark.

Game sequence remains visible where entered.

---

## 8. Canonical sprite presentation

Tournament Day, My Events and other Compete surfaces consume:

`v2-preview/apps/_shared/deck-sprites.js` → `window.DeckSprites.html()`

The shared renderer owns defaults, Settings overrides, slug/source resolution and primary + circular-secondary composition.

Compete may size/align the whole returned stack but must not compose raw sprite images locally.

---

## 9. Current record derivation

Tournament Day derives current W-L-D and rounds completed from participation-linked **Match** records.

No second W-L-D counter is persisted in the live workspace.

Deck Results/Game Log may read the Games beneath those same Matches without changing the tournament record.

---

## 10. Completion contract — current

Completing an event writes `participation.completion` and changes attendance to `attended`.

Completion captures:

- completion timestamp;
- final placement state;
- final player count where known;
- final Match W-L-D snapshot;
- rounds completed;
- exact `usedDeckRef` snapshot;
- optional notes.

The linked Match/Game history remains the authoritative per-round evidence.

### Placement semantics

**Final placement is optional.**

- a positive placement means the recorded finishing position;
- **blank placement explicitly means Dropped** for current completion flows;
- legacy records with genuinely missing placement must remain distinguishable from an explicit Drop;
- a later correction may replace Dropped with a real placement.

Tournament/My Events/Season surfaces should display **Dropped**, not fabricate a numeric placement.

### Player-count semantics

**Final player count is optional.**

- supplied values must be valid positive counts;
- blank means unknown/unspecified;
- completion must not be blocked merely because player count is unavailable.

Season/CP calculation must remain honest when placement/player-count facts are insufficient. Do not invent CP from missing inputs.

### Exact played deck requirement

The accepted completion flow still requires the exact deck/list actually used before final completion so historical deck evidence remains precise. This does not block round entry.

---

## 11. Season boundary

Season consumes completed participation history; it is not a second editable tournament store.

Season may apply bounded user corrections for event type/placement/player count, but those are explicit correction metadata over the underlying participation facts.

An explicit Drop may later be replaced by a correction with a genuine placement.

See `SEASON_ARCHITECTURE.md`.

---

## 12. Game Log boundary

Game Log is the unified personal Game browser and includes Tournament Day Games.

Tournament Game rows:

- retain participation/event context;
- classify Online/local/Challenge/Cup/Major from event/participation metadata;
- open the relevant Tournament Day record when tapped.

Training Game rows remain editable through the training workflow.

Game Log must not duplicate Tournament Day Match state or persist a second result history.

---

## 13. Cut / ID boundary

A reusable shared Cut / ID engine remains Tools-owned and is exposed contextually from Tournament Day.

Tournament Day supplies current canonical Match W-L-D and event context. Mutable standings/resistance inputs belong to the current Tournament Day decision workspace, not historical Match facts.

Deterministic cut bounds, resistance estimates and subjective matchup confidence remain visibly separate concepts.

Do not embed a competing calculator into Tournament Day.

---

## 14. Navigation and performance

Accepted route:

`tournament-day.html?participation=<id>`

Do not maintain feature-specific historical build pins.

Application HTML navigation is network-first with cached fallback. Routine round saves/edits/deletes render in place and do not require full-page reload.

Tournament Day remains inside the existing Compete child view; it does not create a second shell or bottom navigation layer.

---

## 15. Acceptance state — 13 September 2026

Tournament Day v1 remains accepted for the current product stage.

Current accepted contracts include:

- event-linked and ad-hoc tournament records share one participation model;
- Online tournament participation/results use the same model;
- Tournament Day starts without mandatory deck selection;
- exact played DeckVersion/list identity remains canonical;
- game-by-game entry feeds canonical Match/Game evidence;
- editing replaces stable Match records;
- tournament W-L-D remains Match-level;
- personal learning/Game Log may consume individual tournament Games;
- completion may record a real placement or **Dropped**;
- player count may be unknown;
- later corrections may replace Drop/unknown facts where better evidence exists;
- no CP or placement is fabricated from missing data;
- canonical sprites are reused across Compete surfaces.

Future work should build Personal Matchup Analysis / Practice Priorities over the existing evidence rather than creating another results model.

Collection / physical readiness remains deferred.
