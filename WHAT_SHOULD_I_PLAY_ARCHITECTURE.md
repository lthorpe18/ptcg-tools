# What Should I Play architecture

**Status:** Canonical bounded implementation
**Date:** 5 September 2026
**Owner:** Meta

## Product question

What Should I Play (WSIP) helps a competitive player answer:

> Given the field I expect, which exact deck variants are best positioned, why, how trustworthy is that conclusion, and what are the important trade-offs?

It is decision support, not a deck selector. It never writes Deck state or silently sets `plannedDeckRef`.

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

Positive and negative contributions drive the “Helps” and “Hurts” explanation. This distinguishes a large edge into a small deck from a modest edge into a high-share deck.

## Uncertainty rule

WSIP uses two plain measures:

- **Coverage:** field share with at least one decisive H2H game.
- **Sample quality:** full-field weighted `min(decisive games / 20, 1)` for each matchup. Unknown matchups contribute zero.

Evidence categories are deterministic:

| Category | Rule | May receive a rank? |
|---|---|---|
| Strong | coverage ≥85% and quality ≥70% | Yes |
| Moderate | coverage ≥70% and quality ≥45% | Yes |
| Weak | coverage ≥50% and quality ≥25%, but below Moderate | No; promising only |
| Insufficient | coverage <50% or quality <25% | No; promising only |

Decision-ready variants are ordered by covered-field estimate, then coverage, sample quality and exact name. Lower-evidence variants are shown separately and do not displace decision-ready recommendations.

If the top two decision-ready estimates differ by less than 2 percentage points, the outcome is a **close call** and their ordering is not presented as meaningful. A **strong recommendation** requires strong evidence, a gap of at least 2 points and no material source disagreement.

Online/IRL disagreement is surfaced when both sources cover at least 50% of the field and their candidate estimates differ by at least 5 points. A profile is flagged as polarised when at least 15% of field share is favourable (adjusted WR ≥55%) and at least 15% is bad exposure (≤45%).

These categories are product thresholds, not formal statistical confidence intervals.

## Accepted player flow

1. **Field** — choose Blended, Online, IRL or a saved Expected Field; see provenance, exact variants and model shares; optionally make an explicit adjustment.
2. **Candidates** — show at most three decision-ready exact variants, a rounded covered-field estimate and evidence quality. Evidence-limited variants are separated.
3. **Why** — show largest positive and negative contributions, high-share matchup detail, unknown share, sample sizes, polarisation and source disagreement.
4. **Compare** — compare up to three realistic candidates on estimate, evidence, unknown share, bad exposure, favourable exposure and profile shape.
5. **Decide** — open exact-variant Meta detail or continue to Events. Any Event Prep leader and exact DeckVersion choice remains explicit.

The primary layout is a one-column iPhone flow. It avoids a wide matchup matrix and does not place methodology ahead of the recommendation.

## Integration boundaries

- **Home** launches `Meta/#prep` and owns no recommendation logic.
- **Meta** owns WSIP, source/scope evidence and Expected Fields.
- **Event Prep** consumes the shared field and recommendation engines for its lightweight shortlist. It may store a user’s reaction but never silently sets a planned deck.
- **Decks** owns saved deck and DeckVersion identity. Opening a variant from WSIP does not mutate Decks.

## Explicit deferrals

- formal confidence intervals or tournament simulation;
- personal skill/playtest adjustments to global H2H evidence;
- automated deck building or card substitutions;
- Collection/physical-readiness filtering;
- automatic planned/used-deck mutation;
- a large matchup analytics matrix;
- new external evidence providers.

## Tests

`tests/recommendation-engine.test.js` contains hand-checkable deterministic cases for normalisation, weighted contribution, missing data, coverage, order/near ties, exact-variant divergence, field overrides, sparse samples, polarisation, source disagreement and the current release data.
