# PTCG Tools — Competitive Record / Season Architecture

**Status:** Competitive Record / Season v1 accepted current-stage source of truth  
**Date:** 13 September 2026  
**Companion to:** `PTCG_TOOLS_MASTER.md`, `TOURNAMENT_DAY_ARCHITECTURE.md`, `PERFORMANCE_ARCHITECTURE.md`, `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md`

## Purpose

Competitive Record / Season is the Compete-owned continuation of the tournament lifecycle:

**attendance → Prep → Tournament Day → completion → Season**

It turns completed `UserEventParticipation` records into a derived season record without creating a second tournament-history database.

---

## 1. Ownership and identity locks

- Compete owns Competitive Record / Season.
- `UserEventParticipation` remains the canonical account-owned tournament-history entity.
- Match/Game remains the canonical per-round evidence contract.
- Deck/DeckVersion identity remains Decks-owned.
- `usedDeckRef` is the exact list actually played and is reused by Season.
- Playtest evidence remains separate from competitive evidence.
- Shared Season definitions and CP/BFL rules are public/shared data.
- User completions/corrections/goals are private account-owned data.
- `SeasonSummary` is derived; it is never independently edited truth.

---

## 2. Current implementation

Current shared modules include:

- `v2-preview/apps/_shared/season-engine.js` — canonical CP/BFL/summary engine;
- `v2-preview/apps/_shared/season-rules-2027.js` — official 2027 TCG CP tables/BFL configuration;
- `v2-preview/apps/_shared/season-config-2027.js` — 2027 season identity/start boundary;
- `v2-preview/apps/_shared/season-participation.js` — bounded user correction helpers;
- Events/Season UI modules under `v2-preview/apps/events/`;
- Tournament Day season stamping and Top Cut stage metadata;
- deterministic Season engine tests.

Tournament Day supplies the history contract required by Season:

- stable participation identity;
- event snapshot;
- completion state;
- placement state or explicit Drop;
- player count where known;
- final Match W-L-D snapshot;
- exact `usedDeckRef`;
- linked Match/Game evidence;
- optional Top Cut `roundStage` tags;
- completion timestamp/notes;
- persisted season/ruleset identity for supported Championship Series events.

---

## 3. CompetitiveSeason

Current 2027 configuration:

```js
{
  id: 'pokemon-2027',
  label: '2027 Championship Series',
  startDate: '2026-09-01',
  endDate: null,
  rulesetId: 'pokemon-tcg-2027-cp',
  boundaryStatus: 'start-verified-end-pending'
}
```

The season start is verified. The season end remains deliberately unset until directly verified from an authoritative source.

Do not infer a season end from calendar year or local-play periods.

---

## 4. ChampionshipPointRuleset

Rules are injected into the shared Season engine rather than hard-coded in UI pages.

Current ruleset identity:

- `id`: `pokemon-tcg-2027-cp`;
- `version`: `2027.1`;
- game: TCG;
- season: `pokemon-2027`.

The versioned ruleset contains official placement/kicker/BFL configuration for supported Championship Series event types.

BFL remains calculated dynamically over eligible positive-CP results.

---

## 5. Completion-time historical identity

Supported Championship Series completions persist season identity on the existing participation:

```js
participation.seasonId = 'pokemon-2027'
participation.seasonRulesetRef = {
  id: 'pokemon-tcg-2027-cp',
  version: '2027.1',
  assignedAt: 'completion timestamp',
  source: 'tournament-completion'
}
```

Generic locals, prereleases and unsupported types are not stamped as CP events merely because their date falls within the season.

Older completed supported records may be safely repaired/stamped when opened if canonical evidence is sufficient.

---

## 6. Shared Season engine

`window.PTCGSeasonEngine` owns:

- event-type normalization;
- season-date resolution;
- effective participation facts;
- CP calculation from injected rules;
- BFL application;
- raw vs counting CP;
- derived `SeasonSummary` construction.

Feature pages consume this engine instead of reimplementing CP/BFL logic.

---

## 7. Placement, Drop and player-count semantics

Tournament completion now allows incomplete standings facts honestly.

### Real placement

A positive final placement is used as the recorded finishing position.

### Explicit Drop

A blank final placement in the current completion flow means **Dropped**.

Season must:

- display `Dropped` rather than a fake numeric placement;
- preserve the distinction between explicit Drop and genuinely missing legacy data;
- allow a later explicit correction to replace Dropped with a real placement.

### Player count

Player count is optional at tournament completion.

Blank means unknown. Season must not require a fabricated player count merely to render a result.

### CP honesty

Where CP rules require placement and/or player-count facts that are unavailable, Season must not invent missing facts or award speculative CP.

A result can still appear in Season history with `Dropped` or unknown player-count context while CP remains unavailable/zero as dictated by the canonical engine.

---

## 8. Manual corrections

Corrections are participation-local metadata and do not mutate shared event data.

Current correction envelope may include:

```js
participation.seasonCorrection = {
  fields: {
    eventType: 'league-cup',
    placement: 3,
    playerCount: 24,
    seasonId: 'pokemon-2027'
  },
  source: 'user',
  correctedAt: 'ISO timestamp',
  note: 'optional explanation'
}
```

The Season UI exposes bounded corrections for event type, placement and player count with optional note.

A correction with a genuine placement supersedes an explicit Dropped display state for Season calculations/presentation.

Clearing corrections restores the recorded participation facts.

---

## 9. SeasonSummary

A `SeasonSummary` is a read model derived from:

- completed participations;
- effective/corrected participation facts;
- applicable season;
- applicable versioned ruleset.

Current UI may expose:

- counting CP;
- raw CP;
- eligible/completed Championship Series event counts;
- BFL bucket state;
- per-event CP;
- counting/excluded state;
- Match W-L-D;
- placement/player count or Dropped/unknown states;
- exact used Deck/DeckVersion/list snapshot;
- correction state;
- linked round history and Top Cut tags;
- direct Tournament Day link.

It is not separately persisted as editable truth.

---

## 10. BFL semantics

For each official BFL bucket:

1. collect eligible positive-CP results;
2. rank by CP earned;
3. retain the top `limit` results;
4. mark lower results excluded;
5. recalculate whenever relevant completion/correction/ruleset input changes.

This allows shared BFL buckets spanning multiple event types with different CP scales.

---

## 11. Compete integration

Season remains an in-page Compete view alongside event discovery/My Events surfaces.

Completed tournament records can be reopened without losing event snapshot, exact used deck or Match/Game evidence.

Season is downstream of Tournament Day completion; it does not replace Tournament Day as the authoritative detailed record.

Online tournament participation may appear in general tournament history, but only event types supported by the canonical Championship Series ruleset contribute Championship Points.

---

## 12. Top Cut round semantics

Top Cut stage remains optional metadata on canonical Matches, not a second result model.

Accepted tags include:

- Swiss/default;
- Asym Top 16/8/4;
- Top 16/8/4;
- Finals.

PTCG Tools does not automate bracket determination in v1; the user records stage where useful.

---

## 13. Acceptance state — 13 September 2026

Season v1 remains accepted/current-stage complete.

Current accepted contracts include:

- versioned official 2027 CP/BFL rules;
- derived Season read model over completed participations;
- exact used DeckVersion/list identity retained;
- linked Match/round evidence;
- manual bounded corrections;
- dynamic BFL calculations;
- explicit Dropped handling;
- optional player count;
- no fabricated CP from missing facts;
- later placement correction may replace a Drop.

Season is not the current feature-development milestone.

---

## 14. Current roadmap relationship

The old sequence that placed Collection immediately after Season is superseded.

Current central sequence before general Collection is:

1. close published-calendar production Meta generation/acceptance;
2. Personal Matchup Analysis;
3. Practice Priorities;
4. Event Prep v2;
5. Deck Version Intelligence;
6. Prediction Accuracy maturation;
7. Release Hardening;
8. general Collection only when explicitly reopened.

The standalone Kanto 151 direct-link spin-off is outside this sequence and does not reopen the main Collection domain.

Season should only reopen for bounded defects, official rules/config updates or directly justified competitive-record improvements.
