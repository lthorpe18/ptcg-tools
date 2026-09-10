# Prediction Accuracy — Checkpoint 4

**Status:** Implemented for review — 10 September 2026  
**Scope:** Meta accuracy interface only

## Delivered

- Adds **Meta → Prediction accuracy** beside What Should I Play, Matchups and Deck Explorer.
- Shows the latest Field accuracy and supporting MAE when a scored major exists.
- Shows the scored-major trend and eligible-major history.
- Shows predicted versus actual exact variants, including the five largest over- and under-predictions and an expandable full universe.
- Loads the separate generated accuracy archive only when this view is opened; ordinary Home and Meta startup remain unchanged.
- Provides explicit loading, failure, empty and unscored states. It does not fabricate a historical score.

## Current result

Tracking is active, but there is no scored major yet. World Championship San Francisco appears in history with 792 of 797 entries classified (99.4%, 45 exact variants) and explains that it cannot be scored because no prediction snapshot was published strictly before its 28 August Day 1 date.

The scored-state interface has deterministic automated coverage using synthetic evaluation records. Formula fitting, candidate replay and publishing controls remain Checkpoint 5.

## Validation

- 140/140 automated tests pass.
- The browser-control environment blocked the local preview before the application loaded, so desktop/390px visual acceptance remains pending.

## Review script after merge

1. Open **Meta → Prediction accuracy**. Confirm the header says **Prediction accuracy · IRL majors**.
2. Confirm the page says **Tracking active** and **Waiting for the first score**, rather than showing a manufactured score.
3. Under Event history, select **World Championship San Francisco** and confirm it is labelled **Not scored**.
4. Confirm the detail shows **792 classified**, **797 players**, **99.4% coverage**, and explains that no eligible pre-Day-1 snapshot exists.
5. Reload on the accuracy page, then navigate **Current Meta → Prediction accuracy → What should I play? → Prediction accuracy**. State and navigation must remain responsive.
6. On iPhone, confirm the cards, event row and explanation fit without horizontal scrolling or clipped controls.

Pass means the current no-score state is clear, accurate and responsive. The first real scored-major detail and trend are automated until such an event exists.
