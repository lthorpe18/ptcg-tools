# Checkpoint 5 — Format-aware What Should I Play

**Status:** Merged in PR #14 at `4380f8c` and owner-accepted on 9 September 2026. All six device tests passed; Home/Meta/WSIP calculation agreement and advanced prediction date are confirmed. Checkpoint 6 is now implemented in `EXACT_DETAIL_CHECKPOINT_6.md`.
**Base:** main `8ae4ccbb16d1a4db7554b7443a420bc45fa853c2`, including merged PRs #12 and #13.

## Outcome

WSIP uses the selected canonical Blended prediction, or selected Online/IRL format field, and requests H2H for that exact format. A Format selector exposes compatible current/archive targets. Unavailable predictions have no usable rows or recommendations; unavailable choices are labelled and disabled. Existing exact-variant scoring, uncertainty thresholds, 90% initial field selection, editing, explanations and five-at-a-time recommendations are preserved.

`wsip-source.js` adapts canonical predictions and observed fields for WSIP. `meta-core.js` adds explicit-format data access and matchup loading without mutating Meta browsing selections. Cache and request identities include release, environment and format; stale-release responses cannot populate the active release. An ordinary set-transition IRL prior may contribute to predicted entry shares but cannot contribute incompatible H2H. Missing compatible matchups remain unknown.

Failed evidence loads display Retry. Returning to the view or changing fields does not add persistent handlers. The concise context names the field format and compatible H2H source; detailed Blended policy links to the shared methodology.

Saved field rows are preserved. A legacy field with no recorded format gets no borrowed matchup evidence. The existing save action passes the selected format instead of hardcoded TEF-PBL; complete saved-field provenance/round-trip migration remains Checkpoint 7. Exact-detail context migration remains Checkpoint 6; Event Prep remains Checkpoint 8. No scoring, Compare/Decide, personal-skill or navigation redesign is included.

## Validation

`npm test`: **110/110 pass**. Syntax checks and `git diff --check` pass.

Seven new behavioural scenarios execute the actual WSIP adapter, field editor, renderer, recommendation engine and format-aware Meta data layer:

- Dual target changes the field and recommendation order; a preceding-format IRL prediction prior is excluded from new-format H2H.
- Online/IRL format selection changes rows; evidence-source selection respects the chosen target.
- Unknown coverage is preserved; unavailable-to-available recovery never substitutes another target.
- Wrong-format payload rejection and retry recovery; repeated selection does not grow persistent handler counts.
- Delayed target responses and stale-release rejection.
- Legacy unknown-format saved fields preserve rows without borrowing H2H.
- Every real canonical prediction row, weights and revision match Meta; analysis matches the unchanged shared engine and initially shows five cards.

The browser runtime connected, but navigation to the local preview was blocked with `net::ERR_BLOCKED_BY_CLIENT` before the app loaded. No desktop, 390px or iPhone browser acceptance is claimed. Future split tests use explicitly synthetic targets; current production only exposes formats present in its release.

## Owner test script after merge and deployment

1. Fully close and reopen the app. On Home, confirm the IRL/Online split remains visible and there is no methodology link. Tap the hero graph: Meta must open on Blended.
2. Select Online in Meta, navigate Home, then return with the bottom Meta button. Online should remain selected. Return Home and tap the hero graph: this deliberate entry should select Blended again. These are the PR #12/#13 checks.
3. Open **What should I play?** Confirm Field defaults to Blended and a Format selector is visible. Its current format and split should agree with Meta's prediction. WSIP initially models approximately the top 90% of field share, renormalised to 100%; its edited/model percentages need not equal the full Meta field percentages.
4. Switch Field **Online → IRL → Blended** twice. The displayed format/context and field must agree, recommendations must refresh, and controls must remain responsive. Rankings may be similar when evidence supports the same decks.
5. Switch H2H **Online only → IRL only → Online + IRL**. Check coverage and recommendations update. Missing evidence must be described as unknown or insufficient, rather than a fabricated result.
6. Expand **Why this deck?** and the full matchup detail. Check best/worst matchups, decisive-game counts and coverage are readable. Use **Show 5 more decks** where available.
7. Remove a field variant, then **Reset source**. Recommendations should recalculate. Navigate **Home → Meta → WSIP**, then **Compete → Meta → WSIP**; ensure every tap responds. Reload and confirm WSIP loads again.
8. If multiple formats are offered, switch between available targets and confirm labels, fields and recommendations follow. Disabled/unavailable targets must not produce recommendations. A failed evidence request should offer Retry and recover when connectivity returns.

Report the step number and what happened. Current single-format production cannot manually prove a future legality split; automated synthetic coverage is recorded separately. Browser Back remains non-blocking as agreed. Stop after Checkpoint 5 review; do not start Checkpoint 6 automatically.
