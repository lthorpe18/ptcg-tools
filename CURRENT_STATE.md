# PTCG Tools — current state

Review: 16 September 2026, after shared calendar consumer wiring merged and live acceptance exposed a generation-source mismatch. Read this first, then the linked handoff and current GitHub refs. This is an evidence snapshot, not a claim that branches stop moving.

## Purpose and boundary

**Verified:** `lthorpe18/ptcg-tools` is the main mobile-first competitive Pokémon TCG application. Its Meta, Blended Meta and Prediction Accuracy features belong here. The separate [ptcg-meta-analysis](https://github.com/lthorpe18/ptcg-meta-analysis) repository owns historical prediction research; its experiments, dashboard and roadmap are not this app's implementation or approved formula.

## Baseline and live state

- **Verified:** default branch `main`. Shared format-calendar consumer wiring [#60](https://github.com/lthorpe18/ptcg-tools/pull/60) merged on 16 September as `97a9f0b5f7db84ced626c23de67dbda665c7f385` and Pages deployment succeeded.
- **Verified:** persistent five-area shell; shared engines/stores; immutable DeckVersions; personal Games distinct from tournament Matches and public H2H; generated, versioned Meta releases with lazy payloads; Google/Supabase account snapshots; shared maintained format calendar.
- **Verified owner/device observation after #60:** Home's format pill followed the published shared calendar, but the generated Meta release still reflected the older checked-in calendar revision. This proved that browser consumers and scheduled Meta generation did not yet share one authoritative production calendar.

## Complete on main

**Verified by code and merged PRs:** Format/Blended recovery checkpoints 1–9; Prediction Accuracy archive/scoring/UI (#19–22); Deck Results with Archetype/Deck/Version scopes; unified Game Log; canonical sprites; Card Search and Playtest; event discovery/attendance, Online filters and durable results; Event Prep v1, Tournament Day and Season; Tools; Settings hub and maintainer Formats & Sets; shared format-calendar browser consumer wiring (#60). See [audit and evidence](docs/FORENSIC_AUDIT_2026-09-14.md).

“Complete” means the documented stage is implemented, not every future refinement. In particular, the accuracy index currently contains Worlds as **unscored**: there is no eligible pre-Day-1 snapshot.

## Active work and exact next action

**Verified:** branch `sol/meta-published-calendar-generation` is the bounded follow-up to #60. It changes production Meta ingestion/release workflows to load the latest **published Settings → Formats & Sets calendar** instead of silently using `data/formats/maintained-calendar.json`. Production generation fails closed if the published calendar cannot be read; deterministic tests/local tooling may continue to use the checked-in bootstrap unless explicitly switched to the published source.

**Owner action pending:** correct 30C Online legality back to 15 September through Settings → Formats & Sets and publish it. Do not encode that correction in product source as a competing production authority.

**Next engineering action:** validate the follow-up PR, merge only after explicit owner authorisation, let a production Meta job rebuild from the corrected published calendar, then repeat Home / Meta / WSIP / Event Prep acceptance. After that the supported next feature package is Personal Matchup Analysis.

## Debt, uncertainty and later work

- **Verified:** immediately after #60 merged, the repository-wide validation run reported 276/287 passing. Several new failures were transition-date assumptions exposed on 16 September; they must be distinguished from genuine #60 regressions rather than being normalised away.
- **Verified:** the earlier prediction snapshot publication lookup and stale WSIP expectation were pre-existing validation debt before #60.
- **Unknown:** final owner/device acceptance of #60 plus the generation follow-up is pending the corrected published calendar and regenerated Meta release.
- **Verified roadmap, not active branches:** after calendar integration is clean: Personal Matchup Analysis → Practice Priorities → Event Prep v2 → Deck Version Intelligence → Prediction Accuracy maturation → Release Hardening. Collection remains deferred until explicitly reopened. Research results do not reorder this sequence.

## Reading order and maintenance

1. This file: operational state.
2. Relevant `handoffs/` file: active branch, acceptance and exact continuation.
3. [13 September roadmap](ROADMAP_HANDOFF_2026-09-13.md): planned product sequence.
4. [Master product design](PTCG_TOOLS_MASTER.md), [performance](PERFORMANCE_ARCHITECTURE.md), [account/shared data](COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md), [Meta architecture](v2-preview/apps/meta/ARCHITECTURE.md): long-term contracts.
5. [Forensic inventory](docs/FORENSIC_AUDIT_2026-09-14.md): evidence, historical documents, branches and unknowns.

Update this file and the relevant handoff when implementation/acceptance/merge state changes. Record the implementation baseline separately from documentation commits. Labels: **Verified** = direct repository/history/context evidence; **Inferred** = supported interpretation; **Unknown** = not reliably recovered. Never resolve an unknown using the other repository's roadmap.
