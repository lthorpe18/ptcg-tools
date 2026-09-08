# Checkpoint 4 — Home Blended integration

**Status:** Implemented for review on 8 September 2026. Automated validation passes. Local browser automation is unavailable in the current environment; owner iPhone acceptance is pending. Checkpoint 5 has not begun.

## Outcome

- Home now selects the canonical Blended prediction for the current **Online** format through `PTCGMetaBlend.onlineTarget`; it no longer uses the legacy `currentFromCore` compatibility calculation.
- Home and Meta therefore use the same target identity, rows, weights, formula version and evidence revision.
- Retained IRL archive cores are loaded when needed for the eligible preceding-format prior during an ordinary set transition.
- The existing top format chip identifies the displayed Blended target and marks it unavailable when necessary.
- The existing hero layout is preserved. Its concise status shows the actual IRL/Online weights and links to the shared methodology page.
- Missing target evidence and archive-load failures render an explicit unavailable panel; Home never substitutes another format or leaves permanent placeholder bars.
- Delayed prediction work is generation-guarded so an old release cannot replace a newer result.
- Returning to the already-mounted Home view asks its shared release loader to check for a newer release, preventing a warm Home chart from remaining stale after Meta/data updates.
- Variant grouping remains presentation-only. No shortcuts, badges, navigation redesign, WSIP work or later consumer integration was added.

## Current pinned result

| Consumer | Target | Weights | Top deck |
|---|---|---:|---:|
| Meta | TEF–PBL | 52% IRL / 48% Online | Dragapult — 17.3% |
| Home | TEF–PBL | 52% IRL / 48% Online | Dragapult — 17.3% |

Both rows are derived from the same prepared release and shared calculation. The release date, rather than the viewer's clock, determines this reproducible result.

## Validation

`node --test tests/*.test.js tests/*.test.mjs`: **101/101 pass**.

Coverage includes:

- exact Home/Meta Online-target result equality;
- Online-format selection during a synthetic split;
- refusal to substitute an available IRL-format result when the Online target is unavailable;
- normalized shares and weight parity;
- explicit unavailable rendering contract;
- delayed-release generation guard;
- warm-return release refresh signal;
- all prior Format, Meta, Blended, navigation, WSIP, recommendation and Compete regressions.

Syntax checks and `git diff --check` pass.

## Browser gate

The local QA server starts successfully, but the required `agent-browser` executable is not installed in this environment. The earlier cloud browser cannot access local preview URLs. No desktop or 390px browser pass is claimed.

## Owner test script after merge/deployment

1. Fully close and reopen PTCG Tools. On **Home**, confirm the header chip reads **Blended · TEF–PBL** and the hero shows **52% IRL / 48% Online**.
2. Confirm Home's top five begins **Dragapult — 17.3%** and the chart is fully populated rather than showing placeholder bars.
3. Toggle **Variant grouping Off → On → Off**. Confirm the chart changes and remains responsive without navigating away.
4. Tap **How this is calculated**. Confirm the shared methodology opens, then return to Home.
5. Tap the Home hero outside its grouping control/link. Confirm Meta opens and **Blended** shows the same TEF–PBL target, weights and top share.
6. Navigate **Meta → Compete → Home**. Confirm the warm Home view is responsive and still shows the same current prediction.
7. Repeat steps 3 and 5 after returning to Home.

The unavailable and future TEF–30C split cases are automated because production does not yet contain qualifying 30C results. Stop after Checkpoint 4 review; do not begin Checkpoint 5 without explicit authorization.
