# PTCG Tools — current state

Review: 15 September 2026, reconciling the 14 September forensic audit with current `main`. Read this first, then the linked handoff and current GitHub refs. This is an evidence snapshot, not a claim that branches stop moving.

## Purpose and boundary

**Verified:** `lthorpe18/ptcg-tools` is the main mobile-first competitive Pokémon TCG application. Its Meta, Blended Meta and Prediction Accuracy features belong here. The separate [ptcg-meta-analysis](https://github.com/lthorpe18/ptcg-meta-analysis) repository owns historical prediction research; its experiments, dashboard and roadmap are not this app's implementation or approved formula.

## Baseline and live state

- **Verified:** default branch `main`. Immediately before this documentation merge, current main was [fa173586123ec884ca7f1ee70397db827beef9f0](https://github.com/lthorpe18/ptcg-tools/commit/fa173586123ec884ca7f1ee70397db827beef9f0). Since the original audited main [6e6445524bda1856a8f782b3e235e26480a6925a](https://github.com/lthorpe18/ptcg-tools/commit/6e6445524bda1856a8f782b3e235e26480a6925a), three commits advanced generated Meta/event data only: one Limitless PBL matchup refresh and two future-online-tournament refreshes. No intervening product implementation PR merged.
- **Verified:** latest substantive product merge remains Settings hub [#58](https://github.com/lthorpe18/ptcg-tools/pull/58); architecture refresh [#59](https://github.com/lthorpe18/ptcg-tools/pull/59) merged at `676d669`. Subsequent main commits through the pre-merge baseline above are generated data refreshes.
- **Verified:** [Pages run 34932294641](https://github.com/lthorpe18/ptcg-tools/actions/runs/34932294641) successfully deployed the pre-documentation-merge `fa17358` baseline. **Unknown:** exact version cached on any particular installed iPhone.
- **Verified:** persistent five-area shell; shared engines/stores; immutable DeckVersions; personal Games distinct from tournament Matches and public H2H; generated, versioned Meta releases with lazy payloads; Google/Supabase account snapshots; separate shared maintained format calendar.

## Complete on main

**Verified by code and merged PRs:** Format/Blended recovery checkpoints 1–9; Prediction Accuracy archive/scoring/UI (#19–22); Deck Results with Archetype/Deck/Version scopes; unified Game Log; canonical sprites; Card Search and Playtest; event discovery/attendance, Online filters and durable results; Event Prep v1, Tournament Day and Season; Tools; Settings hub and maintainer Formats & Sets. See [audit and evidence](docs/FORENSIC_AUDIT_2026-09-14.md).

“Complete” means the documented stage is implemented, not every future refinement. In particular, the accuracy index currently contains Worlds as **unscored**: there is no eligible pre-Day-1 snapshot.

## Active work and exact next action

**Verified:** [PR #60](https://github.com/lthorpe18/ptcg-tools/pull/60), `sol/shared-format-calendar-consumers`, head `311123b25ab9783570e5d47585fa4e0473dfe9b3`, implements shared-calendar consumer wiring and remains **open/unmerged** at the 15 September documentation review.

**Next recommended action:** read [the calendar handoff](handoffs/shared-format-calendar-consumers.md), inspect #60 against current main, verify the shared calendar through Home → Meta/WSIP → Event Prep and Card Search on iPhone, then review the two known test failures before making a separate merge decision. Do not reimplement this package as if it had not started.

## Debt, uncertainty and later work

- **Verified:** #60 CI and local suite: **253/255 pass**, two failures. Main CI at `676d669`: **242/244 pass**; targeted tests on original audited main reproduce both failures. Snapshot publication lookup and WSIP's stale `Unknown` expectation are existing debt. No green full-suite claim.
- **Unknown:** #60 owner/device acceptance; live shared-calendar database contents and every installed-client cache state. This audit did not publish calendar data or inspect private user records.
- **Verified roadmap, not active branches:** after calendar wiring: Personal Matchup Analysis → Practice Priorities → Event Prep v2 → Deck Version Intelligence → Prediction Accuracy maturation → Release Hardening. Collection remains deferred until explicitly reopened. Research results do not reorder this sequence.
- **Inferred:** old experimental branches without an open PR are historical remnants; the inventory records them without authorising restoration or deletion.

## Reading order and maintenance

1. This file: operational state.
2. Relevant `handoffs/` file: active branch, acceptance and exact continuation.
3. [13 September roadmap](ROADMAP_HANDOFF_2026-09-13.md): planned product sequence.
4. [Master product design](PTCG_TOOLS_MASTER.md), [performance](PERFORMANCE_ARCHITECTURE.md), [account/shared data](COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md), [Meta architecture](v2-preview/apps/meta/ARCHITECTURE.md): long-term contracts.
5. [Forensic inventory](docs/FORENSIC_AUDIT_2026-09-14.md): evidence, historical documents, branches and unknowns.

Update this file and the relevant handoff when implementation/acceptance/merge state changes. Record the implementation baseline separately from documentation commits. Labels: **Verified** = direct repository/history/context evidence; **Inferred** = supported interpretation; **Unknown** = not reliably recovered. Never resolve an unknown using the other repository's roadmap.
