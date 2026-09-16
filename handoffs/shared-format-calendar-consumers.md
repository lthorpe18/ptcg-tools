# Shared format-calendar consumers

Status at 16 September 2026: **PR #60 merged; browser consumer wiring deployed. Live owner/device acceptance exposed one follow-up production-generation source mismatch.**

## Purpose and agreed scope

**Verified:** roadmap package 1 in [ROADMAP_HANDOFF_2026-09-13.md](../ROADMAP_HANDOFF_2026-09-13.md). Home, Meta/Blended/WSIP, Event Prep and relevant card legality now consume the maintained shared calendar through the common runtime. Browser runtime retains shared → last-known-good → checked-in fallback. This is product integration, not historical model fitting.

## Merged implementation

- Repository: `lthorpe18/ptcg-tools`; target `main`.
- [PR #60](https://github.com/lthorpe18/ptcg-tools/pull/60), branch `sol/shared-format-calendar-consumers`.
- Audited implementation head: `311123b25ab9783570e5d47585fa4e0473dfe9b3`.
- **Merged:** 16 September 2026 as `97a9f0b5f7db84ced626c23de67dbda665c7f385`; Pages deployment succeeded.

**Verified code:** `v2-preview/apps/_shared/format-runtime.js` wraps `PTCGFormatCalendar` and `PTCGFormat`; manages readiness/refresh, generation guards, publication metadata and change events; exposes current formats, event resolution and card legality. Meta overlays current format context while retaining historical packages. Home uses runtime current formats. Event Prep delegates its former private calendar handling. Card Search lazily loads runtime dependencies and checks each printing's regulation mark.

## Contracts and data sources

**Verified:** calendar persistence and maintenance shipped in #51–58. Shared published registry, validated local last-known-good and `data/formats/maintained-calendar.json` bootstrap are separate from per-user snapshots. Independent Online/IRL legality dates and explicit unknowns remain mandatory. Individual printing `regulationMark`, not whole-set marks or TCGdex's generic Standard flag, determines card legality.

Keep archived Meta evidence immutable; saved Expected Fields retain their own captured composition/provenance. Resolve Event Prep at the event date/environment. Do not import the research repository's historical legality calendar or exploratory weights. Long-term contracts: [accounts/shared data](../COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md), [Meta](../v2-preview/apps/meta/ARCHITECTURE.md), [Card Search](../CARD_SEARCH_ARCHITECTURE.md).

## Post-merge acceptance finding

**Verified owner/device observation:** after #60 deployed, the Home format pill followed the latest published shared calendar while the generated Meta package still carried `calendarRevision: user-calendar-2026-09-08.1`. The scheduled Meta ingestion/release scripts were still importing `data/formats/maintained-calendar.json` directly through `scripts/meta-format-contract.mjs`.

This is not a second legitimate format authority. It is a migration gap between runtime consumers and production generation.

The owner confirmed the current published 17 September Online date was a deliberate later edit but should now be corrected back to **15 September** through the in-app Formats & Sets editor. That correction remains an owner maintenance action, not a code constant to add in this follow-up.

## Active follow-up

Branch `sol/meta-published-calendar-generation` is scoped to production Meta generation only:

- scheduled Meta, IRL and aggregate matchup jobs explicitly opt into the latest **published** Formats & Sets calendar;
- `scripts/meta-format-contract.mjs` uses that published registry for ingestion boundaries, current Online/IRL identities and release construction when production mode is enabled;
- deterministic tests/local tools retain the checked-in bootstrap by default;
- production generation fails closed if the published calendar cannot be read rather than silently generating against a stale bootstrap;
- focused tests cover published-row loading and ensure all scheduled Meta-generation workflows opt into it.

## Validation and continuation

#60's pre-merge suite was 253/255, with two failures reproduced on main. Immediately after merge, the full suite reported 276/287 as transition dates advanced; several additional failures are stale date assumptions and must be reconciled separately rather than treated automatically as #60 regressions.

Exact continuation:

1. Owner updates and publishes 30C Online legality = 15 September in Settings → Formats & Sets.
2. Validate the generation follow-up PR; do not merge without explicit owner authorisation.
3. After merge, run/allow the production Meta job to regenerate from the corrected published calendar.
4. Recheck Home format pill, Meta/Blended/WSIP, Event Prep dates and Card Search legality on iPhone.
5. Reconcile remaining transition-sensitive tests without weakening assertions.
6. Record owner acceptance, then proceed to Personal Matchup Analysis.

## Confidence / open questions

The runtime/generation mismatch and its source are **Verified** from deployed behaviour, repository code and the published calendar history. Final device acceptance is **Unknown** until the published date is corrected and a production Meta release is rebuilt from it.
