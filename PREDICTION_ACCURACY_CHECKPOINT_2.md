# Prediction Accuracy — Checkpoint 2

**Status:** Implemented for review — 9 September 2026
**Scope:** Immutable prediction snapshots only

## Delivered

- Every scheduled Meta release build archives one snapshot per current target format.
- Each snapshot stores the exact prediction, pre-blend Online/IRL rows, weights, formula parameters, evidence events/windows and release/revision/calendar identities.
- Snapshot filenames are content-addressed. Existing files must match byte-for-byte or the build fails; they are never overwritten.
- Repeated identical builds reuse one snapshot while the append-only index retains distinct publication times.
- The first honest retained snapshot is TEF–PBL for 9 September 2026. It cannot be used to backtest Worlds because it was published after Worlds Day 1.

## Verification

- The committed snapshot reproduces the canonical live calculation exactly.
- Predicted shares total 100%; both Online and IRL input fields are retained.
- Automated tests cover reproducibility, deduplication, publication indexing and rewrite rejection.
- Full regression suite: 131/131 passing.
- All three scheduled release workflows commit the archive, and Meta validation watches its code/data paths.

No UI, event-scoring engine or formula-fitting behaviour is included. Checkpoint 3 is the accuracy engine.
