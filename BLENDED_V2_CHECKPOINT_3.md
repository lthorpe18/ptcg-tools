# Checkpoint 3 — Blended Meta v2

**Status:** Implemented for review. Automated validation passes. Cloud-browser desktop/390px acceptance is blocked because the browser rejects local preview URLs. Not merged or deployed. Checkpoint 4 has not begun.

Built from `origin/main` at `72bbd66`, including merged Checkpoint 2 (`80bf40b`) and the subsequent scheduled Meta refresh.

## What changed

- `PTCGMetaBlend` now calculates one or two independently format-labelled predictions from the retained Online/IRL source packages. It does not change the user's observed Online/IRL archive selections.
- A prediction requires at least one compatible Online tournament with 50 or more players. Missing evidence produces an explicit unavailable result; IRL-only and another-format fallbacks are prohibited.
- The settled curve uses the selected IRL weekend's final calendar day: 70/30 on day 0, two percentage points of IRL decay per day, and a 30/70 floor.
- The accepted transition rules are implemented: frozen old-format Online pools/weights, 70/30 reset after a newer old-format major, post-major Online reset/unavailability, 25% eligible preceding non-rotation IRL prior, and immediate exclusion of rotation-incompatible IRL.
- Every result retains formula version, rule, format, weights, evidence events/dates, frozen status, source generations and a reproducible evidence revision.
- Current Meta now shows the selected target's format/status, a target selector when two predictions exist, explicit unavailable copy and a compact **How this is calculated** drill-in.
- A shared Blended methodology page records the accepted formula and transition rules. Home, WSIP, exact detail, Saved Fields and Event Prep are deliberately not migrated in this checkpoint.
- Release cores now carry the maintained format context needed to distinguish an ordinary set transition from rotation. Existing incomplete historical coverage remains explicit.

## Current real release

| Target | Availability | Weights | Rule | IRL evidence |
|---|---|---:|---|---|
| TEF–PBL | Available | 52% IRL / 48% Online | Settled format | World Championship San Francisco weekend |

The weight clock uses Sunday 30 August as the major weekend's final calendar day and the pinned release date of 8 September. This is a reproducible release result, not a continuously changing browser clock.

## Synthetic acceptance coverage

| Scenario | Expected result |
|---|---|
| Day 0 / 10 / 20+ | 70/30, 50/50, 30/70 |
| 49-player Online event | Unavailable |
| One 50-player Online event | Available |
| Ordinary Online/IRL split | Two targets; new 75/25 and old frozen |
| Newer old-format major during split | Frozen Online retained; weights reset 70/30 |
| First new-format major, no post-major Online result | Unavailable |
| First qualifying post-major result | Available under settled curve |
| Rotation split | New target uses 100% Online; incompatible IRL is excluded |
| Empty/missing Online rows | Explicitly unavailable |
| Available result | Exact-variant shares normalize to 100% |
| UI unavailable → available | Rerenders in place without reinitialisation |

All dates and tournament identities in those transition cases are explicitly synthetic.

## Validation

`node --test tests/*.test.js tests/*.test.mjs`: **99/99 pass**.

This includes the nine new calculation cases, the unavailable-to-available Meta renderer case, all Checkpoint 1/2 release and cache tests, every actual committed release payload, navigation contracts, WSIP regressions, recommendation tests, Season and Compete navigation-loop tests.

Syntax checks and `git diff --check` pass. The generated browser release was rebuilt from the latest merged raw evidence rather than copying older payloads.

## Browser limitation

The local QA server started successfully, but the supported cloud browser rejected `http://localhost:4173/...` with `ERR_BLOCKED_BY_CLIENT` before the document loaded. No desktop or 390px visual result can be claimed. Manual iPhone acceptance therefore remains required after an authorized merge/deployment.

## Manual test script after deployment

1. Reload the app, open **Meta**, and switch **Online → IRL → Blended → Online → Blended**. Every tap should respond and the header label should match the selected source.
2. On **Blended**, confirm one TEF–PBL prediction is shown with **52% IRL / 48% Online** and a populated deck field.
3. Expand **How this is calculated**. Confirm it names the target format, both weights, World Championship San Francisco, Online tournament evidence, formula version and evidence revision.
4. Open **Read the shared Blended methodology**. Confirm the minimum-evidence, settled-format and transition explanations load; return to Meta.
5. Toggle **Variant grouping** off/on, search for a deck, and expand/close the full field. Confirm the page remains responsive.
6. Open a deck row, return using in-app navigation, then switch **Online → IRL → Blended** again.
7. Navigate **Home → Meta → Compete → Meta** and confirm all areas remain responsive.
8. Reload while Meta is open and repeat step 1.

The future two-target 30C split and unavailable-to-available transition are automated because no real 30C tournament evidence exists yet. They cannot be honestly reproduced in the current production UI.

Stop after review and acceptance. Do not begin Checkpoint 4 without explicit authorization.
