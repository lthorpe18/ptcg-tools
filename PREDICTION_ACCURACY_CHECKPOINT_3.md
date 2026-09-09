# Prediction Accuracy — Checkpoint 3

**Status:** Implemented for review — 9 September 2026
**Scope:** Eligible-major accuracy engine only

## Delivered

- Recognises Regionals, Special Championships, Internationals and Worlds from the IRL feed; other event classes are excluded.
- Creates immutable, content-addressed Day 1 actual-field revisions using exact variants.
- Requires at least 95% classified coverage and a valid player total.
- Selects the latest available exact-format prediction published strictly before the recorded Day 1 date. Same-day, post-event, unavailable and wrong-format snapshots cannot be used.
- Calculates Field accuracy (`100% − ½ × total absolute error`), supporting MAE, full predicted-versus-actual rows, and the five largest exact-variant over/under predictions.
- Preserves corrected actual/evaluation revisions instead of rewriting history.
- Runs after every scheduled Meta release build.

## Current result

World Championship San Francisco is retained as an eligible actual field: 792 of 797 entries classified (99.4%), across 45 exact variants. It is correctly **unscored** because snapshot history began after its 28 August Day 1 date.

Validation: 137/137 automated tests pass, including cutoff, format, coverage, scoring, revision and immutability cases.

No accuracy UI or formula fitting is included. Checkpoint 4 is the Meta Prediction accuracy interface.
