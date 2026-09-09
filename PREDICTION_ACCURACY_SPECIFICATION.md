# Prediction Accuracy & Formula Fitting — Specification

**Status:** Checkpoint 1 accepted; Checkpoint 2 implemented for review — 9 September 2026
**Previous programme:** Format/Rotation and Blended Meta v2 accepted through Checkpoint 9  
**Next checkpoint:** Accuracy engine after Checkpoint 2 review

## 1. Purpose and location

Prediction Accuracy measures how well a frozen Blended prediction anticipated the Day 1 field of a later IRL major. It lives in **Meta → Prediction accuracy**, alongside What Should I Play, Matchups and Deck Explorer. Formula fitting is an advanced section within that Meta-owned area, not Settings, Tools or Event Prep.

## 2. Locked evaluation contract

- **Eligible actuals:** IRL majors only: Regionals, Special Championships, Internationals and Worlds with a sufficiently complete Day 1 deck field. Cups, Challenges and ordinary 50+ player IRL events are excluded.
- **Prediction used:** the latest successfully published, available prediction for the event's exact format whose calculation time is before Day 1 begins.
- **Safe current cutoff:** while the IRL source supplies a date but no trustworthy local start time/timezone, use the latest snapshot strictly before the event's recorded Day 1 calendar date. Never use same-day or post-event evidence. A later verified start timestamp may refine this without rewriting old evaluations.
- **Actual field:** exact-variant Day 1 entries, not Day 2 survivors, placements or match results.
- **Format:** prediction and actual field must match exactly. Missing or incompatible data remains unscored.
- **Identity:** use canonical exact-variant names. Do not silently merge families. Any explicit future identity correction creates a new evaluation revision and preserves the original.
- **Coverage:** actual share is normalised across classified Day 1 deck entries. Record classified entries / total players. Below 95% classification coverage, show the event as unavailable for headline scoring.

## 3. Accuracy measures

For each exact variant, error is `predicted share − actual share` in percentage points.

Headline **Field accuracy** is distribution overlap:

`100% − ½ × Σ |predicted share − actual share|`

This gives 100% for a perfect prediction and remains interpretable as the proportion of field allocation correctly anticipated.

Supporting **MAE** is the mean absolute percentage-point error across the displayed deck universe. The deck universe contains every variant predicted above 1% or actually above 1%; all remaining share is combined into one Other bucket so totals remain complete. Show the five largest over-predictions and five largest under-predictions, expandable to the full universe. Zero-share decks outside that rule are omitted.

## 4. Immutable prediction snapshot

Every snapshot must retain enough information to reproduce and refit the forecast:

- stable snapshot ID and content hash;
- calculation timestamp/date and target format;
- exact predicted rows summing to 100%;
- Online and IRL input rows before blending;
- weights, rule, formula version and parameters;
- source event IDs, dates, entry counts and evidence windows;
- release/revision/calendar identities and availability state.

Snapshots are append-only. A later data correction, formula change or event result never mutates an existing snapshot. Identical content may be deduplicated by hash, while the index retains publication times.

## 5. Actual-event and evaluation records

An actual-event record retains event identity/type, Day 1 date, format, total players, classified entries, source/revision and exact-variant entry counts. An evaluation record pins one actual-event revision to one eligible snapshot and formula version, then stores the accuracy measures and deck variances. Re-evaluation creates another revision; historical results remain addressable.

## 6. Formula fitting boundary

Formula fitting replays candidate parameter sets against immutable source inputs. It must separate fitting events from held-out validation events, compare the live formula with proposed versions and never publish automatically. Draft, publish and rollback retain every formula version and its historical scores. With too few eligible events, the app reports insufficient evidence rather than optimising to one tournament.

## 7. Data audit result

Current data is sufficient for future scoring:

- the IRL feed supplies an eligible World Championships event with exact-variant Day 1 counts, 792 classified entries from 797 players (99.4% coverage);
- current prediction inputs, weights, formula rule and evidence provenance are reproducible;
- scheduled Online and IRL jobs publish refreshed releases daily.

Current history is **not** sufficient for an honest Worlds backtest. Repository prediction history begins after the 28 August Worlds Day 1 date, so every available TEF-PBL forecast already contains Worlds IRL evidence. Do not manufacture a pre-Worlds prediction. Reliable scored history begins with snapshots captured before the next eligible IRL major. Historical backfill is allowed only when all source inputs and the pre-event cutoff can be independently reconstructed.

## 8. Delivery checkpoints

1. **Specification/data audit — accepted and merged in PR #19.**
2. **Immutable snapshots — implemented for review:** append-only forecast archive and index in scheduled release builds; see `PREDICTION_ACCURACY_CHECKPOINT_2.md`.
3. **Accuracy engine:** eligible-event matching, data-quality guards, scoring and revisions.
4. **Meta UI:** latest score, trend, event history and predicted-versus-actual detail.
5. **Formula fitting/versioning:** candidate replay, held-out comparison, draft/publish/rollback.
6. **Connected acceptance:** scheduled pipeline, failure states, desktop/iPhone and documentation.

Checkpoint 2 adds no UI or fitting engine. Its committed snapshot reproduces the live prediction exactly, and the archive rejects any attempt to rewrite an existing snapshot.
