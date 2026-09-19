# PTCG Tools — Roadmap Handoff — 13 September 2026

> **19 September 2026 UI/UX programme:** the owner has explicitly reopened presentation and navigation through [UI_UX_REBUILD_GUIDE.md](docs/UI_UX_REBUILD_GUIDE.md), [status](docs/UI_UX_REBUILD_STATUS.md) and [decisions](docs/UI_UX_DECISIONS.md). Existing layouts and navigation in this document describe production V2; the new guide governs the staged target UI. Shared engines, identity, data safety and evidence rules remain binding. The old restriction against a broad UI milestone is superseded by this request. General Collection implementation and Kanto migration remain separately gated. No production changes in CP00.

> **Operational entry:** read [CURRENT_STATE.md](CURRENT_STATE.md) for the current implementation, validation and acceptance state. This roadmap retains the agreed product sequence and is synchronised through 18 September 2026. Historical research in `ptcg-meta-analysis` has a separate roadmap.

**Status:** Current roadmap handoff  
**Original roadmap date:** 13 September 2026  
**Last synchronised:** 18 September 2026  
**Supersedes:** `ROADMAP_HANDOFF_2026-09-07.md`  
**Companion to:** `PTCG_TOOLS_MASTER.md`, `PERFORMANCE_ARCHITECTURE.md`, `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md`, `HOME_ARCHITECTURE.md`, `TOURNAMENT_DAY_ARCHITECTURE.md`, `SEASON_ARCHITECTURE.md`, `WHAT_SHOULD_I_PLAY_ARCHITECTURE.md`

## Current programme position

PTCG Tools has moved beyond the Format/Rotation recovery phase. The current product baseline now includes:

- persistent five-area shell and accepted Home dashboard;
- Online / IRL / Blended Meta, exact-variant analysis, Expected Fields and What Should I Play;
- Prediction Accuracy scoring/history UI and immutable prediction archive;
- Deck identity, immutable DeckVersions and canonical list hashes;
- Card Search/Add Card and Mobile Playtest;
- Deck Results v1 with Archetype / Deck / Version scopes;
- one unified **Game Log** over training and tournament Games;
- one canonical `DeckSprites.html()` renderer across Home, Meta, Decks and Compete;
- event discovery, attendance, Online tournament discovery and durable participation;
- Event Prep v1, Tournament Day v1 and 2027 Season/CP/BFL;
- Tools: Cut / ID · Tournament · Odds;
- Google auth and cross-device user snapshots;
- shared, maintainer-editable Formats & Sets data;
- shared browser calendar consumers and published-calendar generation contract;
- Settings reorganised into a compact hub with focused subpages;
- network-fresh Online tournament discovery after PR #79;
- standalone Kanto 151 direct-link collector in the same repository.

General Collection / physical readiness in the main application remains deliberately deferred. The Kanto 151 spin-off is intentionally separate and does not reopen that roadmap item.

## Shared Formats & Sets — current state

Settings → Maintenance → Formats & Sets is implemented. It edits the one shared application calendar rather than a per-user copy.

Current contract:

- set code/name;
- physical release date;
- Online legality date;
- IRL legality date;
- optional rotation metadata;
- dates are edited directly, with blank meaning unknown;
- no user-facing Announced/Confirmed status workflow;
- no whole-set regulation-mark claim;
- individual card legality is resolved from each printing's own `regulationMark` against the resolved date/environment format;
- rotation is defined by the legal card regulation marks after rotation;
- set boundaries remain useful for readable format labels/grouping but are not card-legality authority;
- one visible **Save changes** action validates and publishes the new shared version;
- previous shared versions/last-known-good behaviour remain recoverable underneath;
- checked-in maintained data remains bootstrap/fallback.

The shared calendar is persisted separately from ordinary account snapshots and is maintainer-gated.

### Integration status

PR #60 merged the browser-side consumer wiring so Home / Meta / WSIP / Event Prep and relevant card-legality checks use the shared format runtime. PR #73 then changed scheduled Meta generation to opt into the published Formats & Sets calendar and fail closed if it cannot be read. PR #74 added the first Supabase REST-auth correction.

The published 30C Online legality date has been corrected to **15 September 2026**. However, the production `Archive Meta History` job was still observed failing HTTP 401 after #74, and the current committed browser release still carries an older calendar revision. The remaining work is production integration recovery/validation, not another browser-consumer implementation.

## Game Log and personal evidence — current state

The old Training Log split has been removed from the user model. **Game Log** is the unified chronological browser over canonical personal Game evidence.

Default **All games** includes:

- ordinary PTCGL training Games;
- manually recorded in-person training Games;
- Tournament Day Games;
- Online tournament Games.

Tournament rows retain event context and open Tournament Day; training rows remain editable through the training workflow. The evidence store remains `PTCGMatchStore`; there is no second results database.

Locked evidence rule:

**Personal deck/matchup/version learning = Games**  
**Tournament record / standings / completion / Season = Matches**  
**Public Meta H2H = separate global evidence**

Game Log tournament filters are:

- All games;
- Training;
- Tournaments — all;
- Online;
- Local / League;
- Challenge;
- Cup;
- Majors — all;
- Regional;
- Special Event;
- International;
- Worlds.

Tournament classification uses participation/event metadata, not discovery source.

## Online tournament discovery — current state

Compete → Online is implemented and accepted for the current stage.

It is future-facing Limitless discovery with the current user intent:

- future tournaments only;
- tournament name and start time are essential;
- Standard + PTCGL is the default;
- UK-time selector defaults to 17:00–22:00;
- format-specific card presentation;
- attendance can create/retain durable `UserEventParticipation`;
- saved participation survives discovery-feed expiry;
- online tournament results flow through the existing Tournament Day / Match/Game model;
- Online event cards use the same event-card visual language as the rest of Compete;
- the generated feed is revalidated network-fresh on Online entry, app return/pageshow and refresh;
- a failed refresh keeps the last successful feed visible and exposes retry.

PR #79 fixed the stale multi-day feed defect and was accepted on the owner's iPhone. This supersedes the earlier discovery-only/no-participation restriction.

## Tournament completion refinements

Tournament completion now allows:

- blank **Final placement** = explicitly **Dropped**;
- blank **Player count** = unknown/unspecified;
- a later correction may replace Dropped with a real placement;
- Season must not invent CP when placement/player-count facts are insufficient.

Exact used DeckVersion/list identity remains required before final completion so historical deck evidence stays precise.

## Settings organisation — current state

Settings is no longer one long page. The landing screen is a compact hub:

- **Account & Sync** — compact signed-in identity and cloud-sync status;
- **Preferences → Deck icons**;
- **Data → App data / backup & export**;
- **Maintenance → Formats & Sets**, visible only to authorised maintainers.

Substantial editors live on focused drill-in pages. Future Settings additions should follow this pattern rather than extending the landing page vertically.

## Standalone Kanto 151 spin-off

The same repository now contains `/v2-preview/spinoffs/kanto-151/`, a direct-link-only collector for the first 151 Pokémon. PRs #62–77 established a three-wide iPhone grid, exact printing selection, Wanted/Owned state, search/filter refinements, stable card art, per-user Supabase persistence with RLS and local cache, wanted-image export, card information and set-grouped browsing.

This spin-off is intentionally outside the main five-area navigation and outside the general Collection roadmap. It must not silently create a parallel main-app collection/evidence model.

## Immediate product roadmap

The strongest value sequence is now:

1. **Close published-calendar production generation** — fix the remaining production read/auth failure, successfully regenerate Meta from the published Formats & Sets calendar, verify release provenance/current formats, reconcile transition-sensitive tests and repeat Home / Meta / WSIP / Event Prep / Card Search acceptance.
2. **Personal Matchup Analysis** — extend Deck Results using canonical Game evidence; expose Archetype / Deck / Version records by opponent archetype, Training vs Tournament and Online vs IRL where useful, with explicit small-sample warnings and a clear side-by-side reference to public H2H without merging the datasets.
3. **Practice Priorities** — derive a concise practice list from expected field share × matchup difficulty × personal evidence, with transparent reasons.
4. **Event Prep v2** — Expected Field → selected exact deck/list → three practice priorities → readiness → Tournament Day.
5. **Deck Version Intelligence** — exact list diffs, evidence by version, tournaments using each version and useful lineage/context.
6. **Prediction Accuracy maturation** — continue genuine scored majors; fit/version the formula only when enough evidence exists or a structural flaw is demonstrated.
7. **Release Hardening / data safety** — cache/service-worker audit, duplicate helper cleanup, sync recovery, backup/export verification and installed-iPhone regression.
8. **General Collection / physical readiness** — only when explicitly reopened; the Kanto 151 spin-off is not this milestone.

Do not add a generic broad UI-consistency milestone. Continue handling real-use UX defects as bounded passes.

## Known validation debt

At the PR #79 baseline the repository-wide suite reports **287 / 298 passing**. The same 11 failures were present on the immediately preceding #78 baseline, while the new Online freshness tests pass.

The failures cluster around the generated Meta release/calendar transition and dependent expectations across Blended, Event Prep/H2H, Meta format/release integrity, prediction archive, recommendation and WSIP. New bounded work must distinguish this baseline from actual regressions. Repair the underlying generated-release/integration state and dependent assertions in the appropriate Meta/release-hardening pass rather than weakening unrelated feature acceptance.

## Operating rules

For each bounded package:

- inspect current V2 code first;
- identify the one shared source of truth;
- consume existing shared engines rather than recreating logic locally;
- preserve Games-vs-Matches and personal-vs-public evidence boundaries;
- keep shared application data separate from per-user snapshots;
- validate automated contracts;
- use real iPhone testing for visual/mobile acceptance;
- merge only after the intended package is coherent.

`CURRENT_STATE.md`, `PTCG_TOOLS_MASTER.md`, the current companion architecture documents and this handoff are the current authority. Older handoffs/checkpoints are historical evidence only when they conflict with the synchronised 18 September 2026 state.
