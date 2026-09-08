# Checkpoint 4 — Home Blended integration

**Status:** Accepted through owner iPhone testing on 8 September 2026, with one requested concise-Home follow-up implemented for review. Checkpoint 5 has not begun.

## Outcome

- Home now selects the canonical Blended prediction for the current **Online** format through `PTCGMetaBlend.onlineTarget`; it no longer uses the legacy `currentFromCore` compatibility calculation.
- Home and Meta therefore use the same target identity, rows, weights, formula version and evidence revision.
- Retained IRL archive cores are loaded when needed for the eligible preceding-format prior during an ordinary set transition.
- The existing top format chip identifies the displayed Blended target and marks it unavailable when necessary.
- The existing hero layout is preserved. Its concise status shows the actual IRL/Online weights. The owner does not want the methodology link on Home; detailed calculation remains available in Meta.
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

`node --test tests/*.test.js tests/*.test.mjs`: **103/103 pass** after the concise-Home follow-up.

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

## Owner acceptance

The owner passed cold load, target/weight/share parity, grouping and warm navigation, then reported that the Home hero opened Online rather than Blended. The follow-up adds an explicit Blended route for both cold and mounted Meta, covered by a behavioural router regression. Device retest of that correction remains pending. The other requested change was to remove the methodology link from Home while retaining the visible current split. Meta keeps the detailed **How this is calculated** explanation.

The unavailable and future TEF–30C split cases are automated because production does not yet contain qualifying 30C results. Stop after Checkpoint 4 review; do not begin Checkpoint 5 without explicit authorization.

Checkpoint 4 follow-up: the Home hero now explicitly requests Blended on cold and mounted Meta. The owner subsequently reported this handoff failure; device retest of the correction remains pending. PR #12 includes both the handoff correction and Home methodology-link removal. On 8 September the owner authorized merging this follow-up and proceeding to Checkpoint 5.
