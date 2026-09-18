# PTCG Tools — current state

Review: 18 September 2026, after Online tournament freshness PR #79 merged and owner/device acceptance confirmed. Read this first, then the linked handoff and current GitHub refs. This is an evidence snapshot, not a claim that branches stop moving.

## Purpose and boundary

**Verified:** `lthorpe18/ptcg-tools` is the main mobile-first competitive Pokémon TCG application. Its Meta, Blended Meta and Prediction Accuracy features belong here. The separate [ptcg-meta-analysis](https://github.com/lthorpe18/ptcg-meta-analysis) repository owns historical prediction research; its experiments, dashboard and roadmap are not this app's implementation or approved formula.

The same repository also contains a deliberately standalone Kanto 151 collection spin-off at `/v2-preview/spinoffs/kanto-151/`. It is direct-link only, does not join the main five-area navigation, and does **not** reopen the deferred general Collection / physical-readiness roadmap item.

## Baseline and live state

- **Verified:** default branch `main`; current reviewed product baseline is merge commit `fbd28f2f8cc34432ddf7c8f5c4a07b95d167fed6` from [PR #79](https://github.com/lthorpe18/ptcg-tools/pull/79).
- **Verified:** persistent five-area shell; shared engines/stores; immutable DeckVersions; personal Games distinct from tournament Matches and public H2H; generated/versioned Meta releases with lazy payloads; Google/Supabase account snapshots; shared maintained format calendar.
- **Verified:** shared browser format-calendar consumer wiring [#60](https://github.com/lthorpe18/ptcg-tools/pull/60), published-calendar production-generation wiring [#73](https://github.com/lthorpe18/ptcg-tools/pull/73), and the first REST-auth follow-up [#74](https://github.com/lthorpe18/ptcg-tools/pull/74) are merged.
- **Verified owner/device acceptance:** [PR #79](https://github.com/lthorpe18/ptcg-tools/pull/79) fixed stale Compete → Online discovery. Online now bypasses the service-worker/browser stale generated-data path, revalidates on entry / app return / refresh, and retains last-known-good results if a refresh fails.
- **Verified:** [PR #78](https://github.com/lthorpe18/ptcg-tools/pull/78) stops Current Meta sprite flashing caused by unnecessary DOM replacement on unchanged data updates. Merge is complete; final owner/device acceptance of that specific visual fix is **Unknown**.
- **Verified:** Kanto 151 PRs #62–77 are merged on `main`, including direct-link collector UI, exact printing selection, stable artwork, search/filter refinements, per-account cloud persistence, wanted-image export, card information and set grouping.

## Complete on main

**Verified by code and merged PRs:** Format/Blended recovery checkpoints 1–9; Prediction Accuracy archive/scoring/UI; Deck Results with Archetype/Deck/Version scopes; unified Game Log; canonical sprites; Card Search and Playtest; event discovery/attendance; Online tournament discovery/filters/durable results/freshness; Event Prep v1; Tournament Day; Season; Tools; Settings hub and maintainer Formats & Sets; shared format-calendar browser consumers; published-calendar generation code; standalone Kanto 151 collector.

“Complete” means the documented stage is implemented, not every future refinement or production integration is accepted. In particular, the current committed Meta release still predates the final published-calendar generation migration described below.

## Active production integration issue

**Verified:** the owner corrected 30C Online legality to **15 September 2026** in the published Formats & Sets calendar. Browser consumers follow the shared published calendar.

**Verified code state:** #73 makes scheduled Meta generation opt into the latest published calendar and fail closed rather than silently using the checked-in bootstrap. #74 added the expected Supabase REST authentication headers.

**Verified production observation after #74:** `Archive Meta History` was still failing with HTTP 401. The current committed browser release remains generated on 16 September and its `core.json` still reports `calendarRevision: user-calendar-2026-09-08.1`. Therefore end-to-end published-calendar authority for production Meta generation is **not yet accepted**, even though the consumer and generator contracts are implemented.

**Exact next engineering action:** diagnose and fix the remaining production published-calendar read/auth failure, run a successful Meta regeneration, verify the generated release records the published calendar revision/current formats, reconcile the transition-sensitive test debt, then repeat Home / Meta / WSIP / Event Prep / Card Search acceptance. After that, the supported next feature package is **Personal Matchup Analysis**.

## Validation debt and uncertainty

- **Verified:** PR #79 CI ran 298 tests: **287 passed / 11 failed**. The Online-specific freshness tests passed.
- **Verified:** the same 11 failures were already present on the immediately preceding #78 baseline; #79 introduced no identified test regression.
- **Verified:** current failures cluster around the stale/generated Meta release and transition expectations across Blended, Event Prep/H2H, Meta format/release integrity, prediction archive, recommendation and WSIP tests. They must be fixed at source rather than weakened to make CI green.
- **Unknown:** final owner/device acceptance of #78's Current Meta sprite-flash fix.
- **Unknown:** final end-to-end acceptance of the shared published calendar until production Meta regeneration succeeds.
- **Verified roadmap, not active feature branches:** once calendar-generation integration is clean: Personal Matchup Analysis → Practice Priorities → Event Prep v2 → Deck Version Intelligence → Prediction Accuracy maturation → Release Hardening. General Collection remains deferred. The Kanto 151 spin-off is separate from that roadmap item. Research results do not reorder this sequence.

## Reading order and maintenance

1. This file: operational state.
2. Relevant `handoffs/` file: active branch, acceptance and exact continuation.
3. [Current roadmap handoff](ROADMAP_HANDOFF_2026-09-13.md): planned product sequence.
4. [Master product design](PTCG_TOOLS_MASTER.md), [performance](PERFORMANCE_ARCHITECTURE.md), [account/shared data](COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md), [Meta architecture](v2-preview/apps/meta/ARCHITECTURE.md): long-term contracts.
5. [Forensic inventory](docs/FORENSIC_AUDIT_2026-09-14.md): historical evidence, branches and unknowns.

Update this file and the relevant handoff when implementation, validation, merge, deployment or owner/device acceptance changes. Record those statuses separately. Labels: **Verified** = direct repository/history/context evidence; **Inferred** = supported interpretation; **Unknown** = not reliably established. Never resolve an unknown using the other repository's roadmap.
