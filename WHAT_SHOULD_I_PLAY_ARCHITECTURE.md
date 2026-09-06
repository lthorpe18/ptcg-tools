# What Should I Play architecture

**Status:** Canonical bounded implementation — accepted after iPhone validation  
**Date:** 6 September 2026  
**Owner:** Meta

## Product question

What Should I Play (WSIP) helps a competitive player answer:

> Given the field I expect, which exact deck variants are best positioned, why, and how trustworthy is that conclusion?

It is decision support, not a deck selector. It never writes Deck state or silently sets `plannedDeckRef` or `usedDeckRef`. Event-specific deck choice remains explicit in Event Prep.

## Shared field contract

`v2-preview/apps/_shared/meta-field.js` is the shared vocabulary and normalisation layer for Home, Meta, WSIP and Event Prep.

- A field row is `{ name, share }` where `name` is an exact variant and `share` is an internal fraction from `0` to `1`.
- Displayed field percentage means expected entry share in the selected field.
- Active rows are normalised to 100% for analysis.
- `Other`, `Unknown`, zero-share rows and invalid names are excluded.
- Duplicate exact names are merged before normalisation.
- Families are presentation metadata only. They may describe Current Meta but never own field-vs-matchup analysis identity.
- Legacy Expected Fields containing a possible family label are flagged for review; WSIP does not silently expand them.

The field sources are:

| Source | Meaning |
|---|---|
| Blended current field | The app-wide `MetaBlendedField` policy: latest IRL majors weekend plus Online 50+ player events since that major, with time-decayed weights. |
| Online | Exact-variant field share from the current shared `MetaState` Online scope. |
| IRL | Exact-variant field share from the current shared `MetaState` IRL scope. |
| Saved Expected Field | An explicit, editable predicted field copied with provenance. |

The default WSIP field for an observed source includes rows through at least 90% of source field share, then renormalises those selected rows for analysis. A saved Expected Field uses all explicitly saved rows. The UI shows how much of an observed source field the selection represents.

Saved Expected Fields are first-class WSIP inputs. Selecting one applies it immediately. When a custom saved field is active, the top Field control must make that custom state obvious rather than misleadingly appearing to be Blended, Online or IRL. Returning to the normal source field must be explicit and clean.

## Matchup evidence

H2H evidence remains independent of the field source. WSIP supports Online, IRL and combined Online + IRL evidence.

- Default Online H2H scope is 30 days, or the active shared Online scope inside Meta.
- IRL H2H uses all IRL majors in the current format because narrower event/weekend scopes do not necessarily contain a usable matchup matrix.
- Combined evidence pools wins, losses and ties for the estimate, while retaining separate Online and IRL profiles for disagreement checks.
- Direct exact-variant rows are preferred. If only the reverse row exists, wins and losses are inverted.
- Ties are reported as evidence context but do not enter the win-rate denominator.
- A missing or zero-decisive-game matchup remains unknown. It is never replaced by 50%, 0%, overall deck win rate or a family result.

## Recommendation engine

`v2-preview/apps/_shared/recommendation-engine.js` is DOM-free and is consumed by both Meta WSIP and Event Prep.

For candidate `c` and opponent `o`:

`adjusted matchup WR(c,o) = (wins + 6) / (wins + losses + 12)`

This is a transparent 12-game neutral prior. It moderates small samples without pretending they are missing.

For covered opponents:

`expected WR(c) = sum(field share(o) × adjusted WR(c,o)) / covered field share(c)`

The expected rate is therefore explicitly a **covered-field estimate**, not a claim about unknown field share.

Each matchup contribution is:

`contribution(c,o) = field share(o) / covered field share(c) × (adjusted WR(c,o) - 50%)`

Positive and negative contributions drive the explanatory evidence. This distinguishes a large edge into a small deck from a modest edge into a high-share deck.

## Uncertainty rule

WSIP uses two deterministic measures:

- **Coverage:** field share with at least one decisive H2H game.
- **Sample quality:** full-field weighted `min(decisive games / 20, 1)` for each matchup. Unknown matchups contribute zero.

Evidence categories are:

| Category | Rule | May receive a rank? |
|---|---|---|
| Strong | coverage ≥85% and quality ≥70% | Yes |
| Moderate | coverage ≥70% and quality ≥45% | Yes |
| Weak | coverage ≥50% and quality ≥25%, but below Moderate | No; promising only |
| Insufficient | coverage <50% or quality <25% | No; promising only |

Decision-ready variants are ordered by covered-field estimate, then coverage, sample quality and exact name. Lower-evidence variants remain available but do not displace decision-ready recommendations.

If the top two decision-ready estimates differ by less than 2 percentage points, the outcome is a **close call** and their ordering is not presented as meaningful. A **strong recommendation** requires strong evidence, a gap of at least 2 points and no material source disagreement.

Online/IRL disagreement is surfaced when both sources cover at least 50% of the field and their candidate estimates differ by at least 5 points. A profile is flagged as polarised when at least 15% of field share is favourable (adjusted WR ≥55%) and at least 15% is bad exposure (≤45%).

These categories are product thresholds, not formal statistical confidence intervals.

## Accepted player flow

The accepted WSIP flow is intentionally simple:

1. **Field** — choose Blended, Online, IRL or a Saved Expected Field; inspect provenance, exact variants and model shares; optionally make an explicit adjustment.
2. **Recommendations** — show the best-positioned exact variants, ranked where evidence is decision-ready. The first five are shown initially; **Show 5 more decks** reveals the next five at a time rather than expanding the entire candidate pool.
3. **Inspect** — tapping the recommendation card itself opens that exact deck-variant page. There is no separate “Open exact variant” action.
4. **Why this deck?** — expanding a recommendation shows the three best and three worst evidenced matchups, with opponent identity/sprites, adjusted rate, decisive-game count and field share. Polarisation, source disagreement and unknown evidence remain visible where relevant, with full field matchup detail available by progressive disclosure.

The collapsed recommendation card prioritises:

- rank / recommendation order;
- canonical one- or two-Pokémon deck sprite identity;
- exact variant name;
- covered-field estimate;
- evidence category;
- wording such as **“H2H evidence against X% of field”** rather than ambiguous “field covered” language;
- concise best-matchup and risk summary.

The primary layout is a one-column iPhone flow. Two-sprite identities must always reserve enough width to avoid overlap in recommendation cards and matchup rows.

## Explicitly removed UX

The bounded September review deliberately removed two earlier concepts:

- **Compare** — removed completely. It did not add enough decision value relative to the complexity and vertical space it consumed. There is no Compare button, Compare state, Compare table or hidden auto-selection behaviour in accepted WSIP.
- **Decide** — removed completely. WSIP recommends and explains. Tapping a recommendation opens exact variant detail; event-specific selection belongs to Event Prep.

Do not reintroduce either as default WSIP stages without a new product decision.

## Exact deck detail handoff

Exact deck-variant detail may be evaluated against:

- Blended current field;
- Online field;
- IRL field;
- actual named Saved Expected Fields.

The chosen field must genuinely carry into WSIP. The selector must never be a dead/fake dropdown.

## Event Prep boundary

WSIP does not choose an event deck. Any attending event must expose an obvious Event Prep entry point, and Event Prep remains the place where the user explicitly chooses a planned exact deck/list for that event.

Event Prep may consume the same `PTCGRecommendation` and Expected Field records, but it owns event-specific reactions, snapshots and planned-deck choice.

## Integration boundaries

- **Home** launches `Meta/#prep` and owns no recommendation logic.
- **Meta** owns WSIP, source/scope evidence and Expected Fields.
- **Event Prep** consumes the shared field and recommendation engines for its lightweight shortlist. It may store a user’s reaction but never silently sets a planned deck.
- **Decks** owns saved deck and DeckVersion identity. Opening a variant from WSIP does not mutate Decks.

## Runtime / rendering safety rule

A September regression showed that cosmetic WSIP enhancement code can block the entire Meta child if it observes and mutates the same broad DOM subtree recursively.

Accepted rule:

- no body-wide self-triggering `MutationObserver` loops for WSIP polish;
- render-dependent enhancements should use explicit render lifecycle events such as `wsip:rendered` or bounded/idempotent observers;
- Meta startup/data-loader architecture must not be changed to compensate for a presentation-layer render loop.

The regression was traced to self-triggering observers in the WSIP polish/reset helpers, reproduced in browser runtime, removed/fixed, and guarded by integration tests.

## Explicit deferrals

- formal confidence intervals or tournament simulation;
- personal skill/playtest adjustments to global H2H evidence;
- automated deck building or card substitutions;
- Collection/physical-readiness filtering;
- automatic planned/used-deck mutation;
- a large matchup analytics matrix;
- new external evidence providers.

## Tests and acceptance

Current relevant automated coverage includes:

- recommendation-engine deterministic cases for normalisation, weighted contribution, missing data, coverage, order/near ties, exact-variant divergence, field overrides, sparse samples, polarisation, source disagreement and current release data;
- Meta navigation/release/offline contracts;
- WSIP direct exact-variant navigation;
- best/worst matchup exposure;
- no Compare surface or controls;
- five-at-a-time recommendation paging;
- two-sprite width protection;
- no body-wide WSIP mutation-observer feedback loop.

The relevant Meta/WSIP suite passed **37/37 tests** at final functional acceptance. The final WSIP interaction/presentation flow was then accepted through real iPhone Home Screen testing on 6 September 2026, including Meta startup recovery, recommendation cards, matchup expansion, incremental paging and the Saved Expected Field selector polish.
