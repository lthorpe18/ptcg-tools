# PTCG Tools — What Should I Play Architecture

**Status:** Canonical accepted Meta decision-support architecture  
**Date:** 13 September 2026  
**Owner:** Meta

## Purpose

What Should I Play (WSIP) helps answer:

> Given the field I expect, which exact deck variants are best positioned, why, and how trustworthy is that conclusion?

It is decision support, not a deck selector. It never writes Deck state or silently sets `plannedDeckRef` / `usedDeckRef`. Event-specific selection remains explicit in Event Prep.

The Format/Rotation + Blended recovery programme is complete through Checkpoint 9. Historical checkpoint documents remain evidence for how the current contract was reached, but this document records the current accepted product behaviour.

---

## 1. Shared field contract

`v2-preview/apps/_shared/meta-field.js` owns field vocabulary/normalisation for Home, Meta, WSIP and Event Prep.

A field row is `{ name, share }`, where `name` is an exact variant and `share` is an internal fraction.

Rules:

- displayed percentage = expected entry share;
- active rows normalise to 100% for analysis;
- `Other`, `Unknown`, zero-share and invalid rows are excluded;
- duplicate exact names merge before normalisation;
- families are presentation-only and never own matchup identity;
- legacy Expected Fields with ambiguous family labels must be flagged rather than silently expanded.

Field sources:

- format-labelled **Blended prediction**;
- **Online** field;
- **IRL** field;
- **Saved Expected Field**.

Saved Expected Fields are account-owned snapshots with provenance, not silent live links to future Meta changes.

---

## 2. Format context and shared calendar

WSIP field/prediction identity is format-specific. Online and IRL may legally differ during set-transition windows.

Settings → Maintenance → Formats & Sets now maintains one published shared format calendar. The next format-consumer package must ensure WSIP/Meta resolves current date/environment context from that published shared calendar through the canonical `PTCGFormat` resolver rather than older checked-in/current-release assumptions.

Rules:

- do not infer event/current legality from set name alone;
- Online and IRL dates remain independent;
- card legality remains card-printing/regulation-mark based;
- Saved Expected Fields retain the format/provenance present when saved;
- missing/unknown calendar facts stay explicit rather than guessed.

---

## 3. Matchup evidence

H2H evidence is independent of field source. WSIP supports Online, IRL and combined compatible Online + IRL evidence.

- direct exact-variant rows are preferred;
- reverse rows may be inverted when required;
- ties are context but do not enter decisive-game win-rate denominator;
- missing/zero-decisive-game matchups remain **unknown**;
- unknown must never be replaced by 50%, 0%, overall deck win rate or a family result;
- only evidence compatible with the selected target format may contribute.

Personal Game evidence is **not** merged into public WSIP H2H. Future Personal Matchup Analysis may show personal results beside public H2H, but the two evidence domains remain separate.

---

## 4. Recommendation engine

Canonical engine:

`v2-preview/apps/_shared/recommendation-engine.js` → `window.PTCGRecommendation`

Meta WSIP and Event Prep consume the same DOM-free engine.

For candidate `c` and opponent `o`:

`adjusted matchup WR(c,o) = (wins + 6) / (wins + losses + 12)`

This is a transparent 12-game neutral prior.

For covered opponents:

`expected WR(c) = sum(field share(o) × adjusted WR(c,o)) / covered field share(c)`

This is explicitly a **covered-field estimate**, not a claim about unknown matchups.

Contribution for explanation:

`contribution(c,o) = field share(o) / covered field share(c) × (adjusted WR(c,o) - 50%)`

This lets explanations distinguish high-share relevant edges/risks from low-share ones.

---

## 5. Evidence quality / uncertainty

WSIP uses:

- **Coverage:** field share with at least one decisive H2H game;
- **Sample quality:** weighted `min(decisive games / 20, 1)` across the field, with unknown matchups contributing zero.

Current categories:

| Category | Rule | Rank? |
|---|---|---|
| Strong | coverage ≥85% and quality ≥70% | Yes |
| Moderate | coverage ≥70% and quality ≥45% | Yes |
| Weak | coverage ≥50% and quality ≥25%, below Moderate | No; promising only |
| Insufficient | coverage <50% or quality <25% | No |

Decision-ready variants order by covered-field estimate, then coverage, sample quality and exact name.

If the top two decision-ready estimates differ by less than 2 percentage points, present a **close call** rather than overstate ordering.

A **strong recommendation** requires strong evidence, ≥2 point lead and no material source disagreement.

Online/IRL disagreement is surfaced when both sources cover enough field and estimates differ materially. Polarised matchup profiles remain visible.

These are product thresholds, not formal statistical confidence intervals.

---

## 6. Accepted player flow

Accepted flow:

**Field → Recommendations → direct exact-variant inspection**

1. **Field** — choose available Blended, Online, IRL or Saved Expected Field; inspect target format/provenance; optionally edit an expected field where supported.
2. **Recommendations** — show decision-ready exact variants; first five initially, then reveal five more at a time.
3. **Inspect** — tapping a recommendation card opens that exact variant.
4. **Why this deck?** — show three best and three worst evidenced matchups plus progressive full detail/methodology.

Collapsed recommendation cards prioritise:

- rank/order;
- canonical deck sprite identity;
- exact variant name;
- covered-field estimate;
- evidence category;
- `H2H evidence against X% of field` wording;
- concise best-matchup/risk context.

The primary layout remains one-column iPhone-first.

---

## 7. Explicitly removed UX

**Compare** remains removed. There is no Compare stage/control/table.

**Decide** remains removed as a separate WSIP stage. WSIP recommends and explains; event-specific planned-deck selection belongs in Event Prep.

Do not reintroduce these by default without a new product decision.

---

## 8. Exact detail handoff

Exact variant detail can be evaluated against:

- available format-labelled Blended field;
- Online field;
- IRL field;
- named Saved Expected Fields.

Chosen field/context must genuinely carry into detail and back into WSIP. No fake/dead selectors and no silent live-field substitution for missing saved snapshots.

---

## 9. Event Prep boundary

Event Prep consumes the same field/recommendation engines but owns event-specific planning, immutable snapshots and explicit planned-deck choice.

Event Prep must resolve the **actual event date/environment**, never substitute today's date where event date is required.

The planned Event Prep v2 extension should add concise personal Practice Priorities/readiness after Personal Matchup Analysis exists, rather than duplicating personal analytics inside WSIP.

---

## 10. Integration boundaries

- **Home** launches WSIP and owns no recommendation logic.
- **Meta** owns WSIP, public field/H2H evidence and Saved Expected Fields.
- **Event Prep** consumes shared field/recommendation engines and owns event-specific choice/snapshot state.
- **Decks** owns Deck/DeckVersion and future personal matchup analysis.
- personal evidence remains separate from WSIP's public/global H2H.

---

## 11. Rendering/runtime safety

No body-wide self-triggering `MutationObserver` loops for WSIP polish.

Prefer explicit render lifecycle events such as `wsip:rendered`; any observer must be bounded and idempotent.

Do not alter Meta release/startup architecture merely to mask a presentation-layer loop.

---

## 12. Current validation state

Current WSIP functionality has broad deterministic/integration coverage for field normalisation, evidence quality, missing data, close calls, exact variants, saved fields, source changes, navigation handoff, incremental paging and rendering safety.

The full repository currently has one known WSIP-related **baseline expectation drift**: `wsip-formats.test.js` still expects an `Unknown` outcome for live/current release data while the current release now has enough evidence to render a strong recommendation. This is current-data/test expectation drift, not an accepted change to the recommendation formula.

Repair that assertion in the appropriate Meta/release-hardening pass; do not weaken recommendation behaviour merely to preserve stale fixture expectations.

---

## 13. Explicit deferrals

- formal confidence intervals/simulation;
- personal skill values merged into public H2H;
- automated deck building/card substitutions;
- Collection/readiness filtering;
- automatic planned/used-deck mutation;
- new external evidence providers without a deliberate source decision.

Current roadmap after shared format-calendar consumer wiring is **Personal Matchup Analysis → Practice Priorities → Event Prep v2 → Deck Version Intelligence → Prediction Accuracy maturation → Release Hardening → Collection later**.
