# Shared format-calendar consumers

Status at 14 September 2026: **implemented on an open branch; not merged or device-accepted in recovered evidence**.

## Purpose and agreed scope

**Verified:** roadmap package 1 in [ROADMAP_HANDOFF_2026-09-13.md](../ROADMAP_HANDOFF_2026-09-13.md). Use the published maintained calendar for Home, Meta/Blended/WSIP, Event Prep and relevant card legality. Retain shared → last-known-good → checked-in fallback. This is product integration, not historical model fitting.

## Branch and implementation

- Repository: `lthorpe18/ptcg-tools`; target `main`.
- [PR #60](https://github.com/lthorpe18/ptcg-tools/pull/60); branch `sol/shared-format-calendar-consumers`.
- Audited head: [311123b25ab9783570e5d47585fa4e0473dfe9b3](https://github.com/lthorpe18/ptcg-tools/commit/311123b25ab9783570e5d47585fa4e0473dfe9b3).
- Audited main: `6e6445524bda1856a8f782b3e235e26480a6925a`.
- 15 changed files, 388 insertions / 60 deletions relative to merge base. Twenty branch commits cover implementation and focused test corrections.

**Verified code:** new `v2-preview/apps/_shared/format-runtime.js` wraps `PTCGFormatCalendar` and `PTCGFormat`; manages readiness/refresh, generation guards, publication metadata and change events; exposes current formats, event resolution and card legality. Meta overlays current format context while retaining historical packages. Home uses runtime current formats. Event Prep delegates its former private calendar handling. Card Search lazily loads runtime dependencies and checks each printing's regulation mark.

Read these files on #60, not on unmerged main. [Pinned changed runtime](https://github.com/lthorpe18/ptcg-tools/blob/311123b25ab9783570e5d47585fa4e0473dfe9b3/v2-preview/apps/_shared/format-runtime.js).

## Contracts and data sources

**Verified:** calendar persistence and maintenance shipped in #51–58. Shared published registry, validated local last-known-good and `data/formats/maintained-calendar.json` bootstrap are separate from per-user snapshots. Independent Online/IRL legality dates and explicit unknowns remain mandatory. Individual printing `regulationMark`, not whole-set marks or TCGdex's generic Standard flag, determines this implemented check.

Keep archived Meta evidence immutable; saved Expected Fields retain their own captured composition/provenance. Resolve Event Prep at the event date/environment. Do not import the research repository's historical legality calendar or exploratory weights. Long-term contracts: [accounts/shared data](../COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md), [Meta](../v2-preview/apps/meta/ARCHITECTURE.md), [Card Search](../CARD_SEARCH_ARCHITECTURE.md).

## Validation

**Verified:** [CI 34883966415](https://github.com/lthorpe18/ptcg-tools/actions/runs/34883966415) at the audited head passes syntax, hooks and architecture stages; suite **253 pass / 2 fail / 255 total**. Local Node 24.19.0 run reproduced 253/255. CI uses Node 22.

Failures:
1. `prediction-snapshots.test.mjs`: `assert.ok(publication)`. It rebuilds with a fixed 2026-09-09 as-of date from changing source files, then expects an exact published snapshot ID. Failure also reproduces on audited main.
2. `wsip-formats.test.js`: expects `Unknown`; current release generates a strong recommendation. Also reproduced on main.

Main CI [34781658397](https://github.com/lthorpe18/ptcg-tools/actions/runs/34781658397) at `676d669` reports 242/244 with these same failures. A focused audit run on `6e64455` gives 18/20 with these failures. The attempted full local main run ended without a summary; it is not counted as completed validation.

**Verified:** new/affected runtime, consumer wiring, Card Search and transition tests pass in #60's suite, including 15 September Online / 24 September IRL boundaries. **Unknown:** browser/device acceptance and private shared-store state. Passing static/VM contracts does not prove the live end-to-end flow.

## Exact continuation

1. Refresh refs and inspect #60's diff; distinguish scheduled main data changes from implementation.
2. Exercise published-calendar/fallback loading and Home, Meta/WSIP, event-date Prep and Card Search on iPhone. Verify independent legality boundaries, unknown dates, saved-field provenance and repeated navigation.
3. Review baseline failures as fixture/validation debt; fix them in an appropriately scoped change without weakening assertions or rewriting archived predictions. Reconcile any new failures separately.
4. Record acceptance and ask for the separate implementation merge decision; then update CURRENT_STATE. This documentation task authorises no merge.

After this package, the supported next product feature is Personal Matchup Analysis. No branch/PR for that feature was recovered.

## Confidence / open questions

Scope comes directly from #60, current roadmap and code (**Verified**). The recommended acceptance sequence is audit guidance (**Inferred**), not evidence that a user already performed it. Whether runtime refresh propagates correctly on the user's installed app, and when the user wants to merge, remain **Unknown**.
