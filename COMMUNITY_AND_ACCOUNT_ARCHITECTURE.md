# PTCG Tools — Accounts, Community & Public-Ready Architecture

**Status:** Current companion architecture source of truth  
**Date:** 4 September 2026  
**Companion to:** `PTCG_TOOLS_MASTER.md`, `PERFORMANCE_ARCHITECTURE.md`, `PLAYTEST_ARCHITECTURE.md`, `TOURNAMENT_DAY_ARCHITECTURE.md`

## Purpose

This document records the account, persistence, community/public-release and source-governance decisions that keep PTCG Tools **personal-first, public-ready**.

The product should continue to optimize for the primary user's competitive workflow without making unnecessary choices that block future community use.

---

## 1. Current account model

### Authentication

PTCG Tools supports **Google sign-in through Supabase Auth**.

Google is the only provider for now. Apple and Discord were deliberately removed after Google proved sufficient for the current stage.

Principles:

- request only basic identity information needed for account functionality;
- no Gmail, Drive, Contacts or unrelated Google scopes;
- never receive/store the user's Google password;
- treat name/email/profile identifiers as personal data;
- keep provider secrets out of the public GitHub repository.

Current Supabase project:

- **PTCG Tools V2 Auth**;
- project ref `naylqcyrnhjvqodjpjsg`;
- `eu-west-2`;
- free tier at current scale.

The frontend uses only the publishable client key.

### OAuth / persistent-shell boundary

Google OAuth must never be loaded inside the embedded feature child view.

Authentication deliberately performs a **top-level navigation** away from PTCG Tools and returns to the top-level app afterward.

This remains the rule for any external auth/provider flow that prohibits iframe embedding.

---

## 2. Cross-device persistence

Authenticated users have cloud-backed per-account persistence through one schema-versioned `user_snapshots` row per account, protected by Supabase Row Level Security.

Current durable snapshot state includes:

- saved Decks;
- embedded DeckVersions/checkpoints;
- root V2 personal state including `eventParticipations`;
- attendance, retained event snapshots, Prep, Tournament Day and completion state;
- canonical Match/Game history;
- preferences including deck/archetype presentation overrides;
- saved Expected Fields and provenance.

### Sync behavior

Desired user model:

> Sign in once; meaningful PTCG Tools state follows the account.

Current behavior includes:

- local data uploads when an authenticated account has no cloud snapshot;
- newer cloud state can restore on another device;
- durable local changes mark state dirty and auto-upload;
- reconnect/focus/foreground may trigger reconciliation;
- collection replacement semantics allow deletions to sync correctly;
- offline local operation remains possible and reconciliation resumes later.

The sync controller belongs to the **top-level persistent shell**, not to an individual feature page.

### Proven behavior

Google authentication and cross-device persistence were tested successfully across devices, including event Attending state.

The account/sync milestone is therefore established for the current product stage.

---

## 3. Durable vs transient state

### Durable/account-owned

Examples:

- Deck identity and working lists;
- immutable DeckVersions;
- `listHash`;
- Expected Fields;
- event attendance/Prep;
- Tournament Day results/completion;
- real Match/Game history;
- preferences/presentation overrides;
- future Collection quantities/allocations;
- future Season/CP state.

### Transient/local work-in-progress

Current Mobile Playtest tabletop state remains local browser state, including:

- shuffle/deck order;
- Hand/Active/Bench/Prizes;
- attachments/evolution stacks;
- damage/markers;
- turn state;
- Undo history.

It is not silently uploaded as durable account data.

A future **Save Playtest session / Practice evidence** feature must be explicit.

Solo/goldfish Playtest never creates competitive W/L.

---

## 4. Shared competitive data vs private personal state

### Shared competitive data

Fetched/derived once and reused across users:

- cards/formats;
- event/tournament facts;
- tournament results/public decklists;
- normalized Meta evidence;
- public matchup evidence;
- aggregate analysis;
- official competitive-season/ruleset facts.

### Per-user data

Account-owned/private:

- Decks/versions;
- Collection;
- attendance;
- Prep;
- Tournament Day/completion;
- personal Matches;
- Expected Fields;
- notes/testing evidence;
- preferences and deck-icon overrides;
- season goals/manual corrections.

Do not duplicate heavyweight public datasets inside every user's account snapshot.

### Presentation preferences are account-owned but globally consumed

Deck/archetype sprite overrides are a good example of the boundary:

- the override itself is private user preference state;
- every feature should consume the same shared presentation engine (`DeckSprites`);
- features must not independently re-infer or maintain competing archetype→sprite mappings.

This keeps personal customization consistent across Meta, Decks, Compete and future surfaces.

---

## 5. Whole-account snapshot vs future normalized user tables

The current snapshot model remains appropriate while the product schema is evolving rapidly.

Normalize a domain only when there is a concrete need for:

- queryability;
- conflict resolution;
- history/audit;
- collaboration;
- scale/performance;
- selective sync.

Likely future candidates include:

- Collection;
- tournament/match history;
- saved Playtest/practice evidence;
- deck/version relationships;
- preparation workspaces;
- completed Championship Series/Season state.

Do not normalize only for database purity.

Import/export remains desirable as user-controlled backup/interoperability even with cloud accounts.

---

## 6. Local-community release

A legitimate middle ground is:

> no monetization required, no App Store required, no social network required — simply allow a local competitive community to use the installable app with their own accounts.

Approximate engineering thresholds:

| Scale | Expected concern |
|---|---|
| One user / a few friends | Essentially none |
| 20–100 regular users | Technically straightforward |
| Hundreds active | Watch bandwidth/upstream traffic |
| Low thousands | Production hosting/CDN/observability sensible |
| Tens of thousands | Genuine scale engineering |

User count does not multiply browser RAM; persistent-shell memory is per device.

GitHub Pages is suitable for the current personal/community phase but should not be assumed permanent high-scale hosting.

---

## 7. Upstream-source architecture

For community/public use, avoid:

`every browser → Limitless / Pokémon / Pokédata / other source`

Prefer:

`external source → PTCG Tools ingestion/cache → normalized shared data → all users`

Benefits:

- reduced rate-limit pressure;
- less duplicated traffic;
- consistent data across users;
- lower dependence on upstream availability at interaction time;
- easier source-governance/permission handling.

---

## 8. Source Adapter direction

The app should increasingly reason in normalized entities such as:

- Tournament;
- TournamentResult;
- Decklist;
- Match;
- Event;
- Card.

Potential adapters include Limitless, Pokémon, RK9 and Pokédata adapters or successors.

Imported records should retain provenance where practical:

- source;
- source record ID;
- retrieval timestamp;
- field authority;
- access classification.

Useful access classifications:

- Official API;
- Explicit permission;
- Public data;
- Scraped;
- User supplied.

Anything classified as **Scraped** that becomes essential to a public product should be replaced, reviewed or explicitly authorized before broad launch.

---

## 9. Third-party source implications

### Limitless

Prefer documented Limitless developer APIs for public/community integrations where possible. Legitimate public projects can seek appropriate access/higher limits.

For personal Deck workflow, favor compatible list import/export and supported links over rebuilding the Limitless editor.

### RK9

Do not treat a free/non-commercial app as permission to scrape RK9.

Current direction:

- official Pokémon remains major-event existence/date authority;
- RK9 may be an outbound registration/detail destination;
- richer automated RK9 use requires permission/authorized access.

### Pokédata / discovery sources

Treat discovery/index sources according to their actual authority and retain provenance. Do not overstate certainty.

---

## 10. Pokémon IP / public distribution

A free fan app is not automatically exempt from copyright, trademark, database-right or service-term obligations.

Before broad public/App Store release review at minimum:

- card artwork/images;
- Pokémon artwork/logos/sprites;
- Pokémon/name trademark presentation;
- symbols/assets;
- third-party service terms;
- privacy/GDPR;
- app-store IP requirements.

PTCG Tools should maintain an independent brand and identify itself as unofficial/community software if released widely.

---

## 11. Privacy position

Once accounts exist, PTCG Tools handles personal data.

Principles:

- collect the minimum necessary;
- never request unrelated Google scopes;
- protect account-owned rows with RLS;
- never expose one user's personal state to another;
- document what is stored before broader use;
- provide practical export/delete controls before public release;
- treat email/name/profile details as personal data.

A formal privacy policy is required before broad public distribution and sensible before a larger community cohort.

---

## 12. Public-release progression

Recommended progression:

1. **Personal product** — complete the connected competitive workflow.
2. **Development Cleanup / Release Hardening** — remove temporary build pins, dead compatibility code, duplicate cross-feature engines and stale cache assumptions.
3. **Public-ready architecture** — retain account scoping, provenance and normalized shared-data direction.
4. **Local community** — small real-player cohort.
5. **Private beta** — tens of users if useful.
6. **Provider/IP/privacy review** — resolve external dependencies and distribution obligations.
7. **Public release** — only with adequate data-source, privacy and operational foundations.

Do not design for millions prematurely.

---

## 13. Release-hardening implications

The Tournament Day development cycle exposed two classes of issue that must be systematically removed before a stable release:

1. **temporary navigation/cache scaffolding** — dated build strings, stale service-worker assumptions, multiple entry routes pinning different application generations;
2. **duplicate shared logic** — e.g. a feature-local archetype sprite resolver diverging from the account-owned Settings/Meta `DeckSprites` mapping.

Before stable release:

- search repository-wide for dated build/revision links;
- delete obsolete legacy UI paths rather than only hiding them;
- consolidate shared concerns into one implementation;
- verify service-worker generation/cache behavior;
- ensure personal preferences are consumed consistently everywhere;
- verify current deployed SHA and iPhone behavior.

This hardening step is part of becoming public-ready, not optional cosmetic refactoring.
