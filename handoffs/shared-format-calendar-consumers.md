# Shared format-calendar consumers

Status at 18 September 2026: **browser consumer wiring and published-calendar generation contract are merged; production Meta generation still has an unresolved authenticated-read failure, so end-to-end acceptance is not complete.**

## Purpose and agreed scope

**Verified:** this work closes roadmap package 1 in [ROADMAP_HANDOFF_2026-09-13.md](../ROADMAP_HANDOFF_2026-09-13.md). Home, Meta/Blended/WSIP, Event Prep and relevant card legality consume the maintained shared calendar through the common runtime. Production Meta generation is also intended to use the latest published calendar rather than a second checked-in authority. This is product integration, not historical model fitting.

## Merged implementation

- Repository: `lthorpe18/ptcg-tools`; target `main`.
- [PR #60](https://github.com/lthorpe18/ptcg-tools/pull/60) — browser/shared runtime consumers; merged 16 September 2026.
- [PR #73](https://github.com/lthorpe18/ptcg-tools/pull/73) — scheduled Meta generation explicitly opts into the published Formats & Sets calendar and fails closed if it cannot be read; merged 16 September 2026.
- [PR #74](https://github.com/lthorpe18/ptcg-tools/pull/74) — first Supabase REST-auth correction for the Node published-calendar loader; merged 17 September 2026.

**Verified browser code:** `v2-preview/apps/_shared/format-runtime.js` wraps `PTCGFormatCalendar` and `PTCGFormat`; manages readiness/refresh, generation guards, publication metadata and change events; exposes current formats, event resolution and card legality. Meta overlays current format context while retaining historical packages. Home uses runtime current formats. Event Prep delegates its former private calendar handling. Card Search lazily loads runtime dependencies and checks each printing's regulation mark.

**Verified generation contract:** production Meta workflows set `PTCG_FORMAT_SOURCE=published`; deterministic tests/local tooling may continue to use the checked-in bootstrap unless explicitly switched. Production generation must fail closed if the published calendar cannot be read.

## Contracts and data sources

Shared published registry, validated local last-known-good and `data/formats/maintained-calendar.json` bootstrap are separate from per-user snapshots. Independent Online/IRL legality dates and explicit unknowns remain mandatory. Individual printing `regulationMark`, not whole-set marks or TCGdex's generic Standard flag, determines card legality.

Keep archived Meta evidence immutable; saved Expected Fields retain their own captured composition/provenance. Resolve Event Prep at the event date/environment. Do not import the research repository's historical legality calendar or exploratory weights. Long-term contracts: [accounts/shared data](../COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md), [Meta](../v2-preview/apps/meta/ARCHITECTURE.md), [Card Search](../CARD_SEARCH_ARCHITECTURE.md).

## Current published-calendar state

**Verified from the owner session:** 30C Online legality was corrected back to **15 September 2026** through Settings → Formats & Sets. IRL legality remains **24 September 2026**.

Browser consumers now follow that shared published state.

## Remaining production failure

**Verified production observation after #74:** `Archive Meta History` still failed with HTTP 401 when trying to read the published calendar. Therefore #74 did not complete the production integration in practice.

**Verified repository evidence:** the current committed browser release is still generated on 16 September, before #73/#74 completed, and `v2-preview/data/meta/release/core.json` still reports `calendarRevision: user-calendar-2026-09-08.1`. The current release can therefore not be used as proof that production generation is reading the latest published registry.

This is the remaining gap. Do not reintroduce the checked-in bootstrap as a silent production fallback merely to make generation pass.

## Validation state

At the PR #79 baseline the repository-wide suite reports **287 / 298 passing**. The same 11 failures were present on #78 immediately before it, so they are current baseline debt rather than an identified #79 regression.

Those failures cluster around generated Meta release/format-transition state and dependent Blended, Event Prep/H2H, prediction archive, recommendation and WSIP expectations. Repair the source integration/release state first and then reconcile the affected assertions without weakening the contracts.

## Exact continuation

1. Diagnose the remaining production Supabase published-calendar read/auth failure from the actual `Archive Meta History` workflow environment.
2. Make the smallest production-auth/source fix; retain fail-closed behaviour and the one published production authority.
3. Run `Archive Meta History` successfully.
4. Verify the newly committed Meta release records the latest published calendar revision and resolves current Online / IRL formats from that source.
5. Re-run the full suite and reconcile remaining transition-sensitive failures at source.
6. Recheck Home format pill, Meta / Blended / WSIP, Event Prep event-date formats and Card Search legality on iPhone.
7. Record final owner/device acceptance in `CURRENT_STATE.md`.
8. Proceed to **Personal Matchup Analysis** as the next feature package.

## Confidence / open questions

- Browser consumer integration: **Verified implemented/merged**.
- Published-calendar production generation contract: **Verified implemented/merged**.
- Published 30C Online date = 15 September: **Verified from owner maintenance action**.
- Successful production Meta generation from the published calendar: **Unknown / not yet achieved after the observed HTTP 401**.
- Final end-to-end device acceptance: **Unknown** until regeneration and recheck complete.
