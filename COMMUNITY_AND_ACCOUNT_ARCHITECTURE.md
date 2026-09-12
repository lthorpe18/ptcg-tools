# PTCG Tools — Accounts, Community & Public-Ready Architecture

**Status:** Current companion architecture source of truth  
**Date:** 12 September 2026  
**Companion to:** `PTCG_TOOLS_MASTER.md`, `PERFORMANCE_ARCHITECTURE.md`, `PLAYTEST_ARCHITECTURE.md`, `TOURNAMENT_DAY_ARCHITECTURE.md`

## Purpose

This document records the account, persistence, shared-data, community/public-release and source-governance decisions that keep PTCG Tools **personal-first, public-ready**.

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

Current Supabase project remains the existing PTCG Tools V2 Auth project in `eu-west-2` at current personal scale.

The frontend uses only the publishable client key.

### OAuth / persistent-shell boundary

Google OAuth must never be loaded inside an embedded feature child view.

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

> Sign in once; meaningful PTCG Tools personal state follows the account.

Current behavior includes:

- local data uploads when an authenticated account has no cloud snapshot;
- newer cloud state can restore on another device;
- durable local changes mark state dirty and auto-upload;
- reconnect/focus/foreground may trigger reconciliation;
- collection replacement semantics allow deletions to sync correctly;
- offline local operation remains possible and reconciliation resumes later.

The sync controller belongs to the **top-level persistent shell**, not to an individual feature page.

Google authentication and cross-device persistence have been tested successfully across devices, including event state.

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
- future personal performance preferences/goals.

### Transient/local work-in-progress

Current Mobile Playtest tabletop state remains local browser state, including:

- shuffle/deck order;
- Hand/Active/Bench/Prizes;
- attachments/evolution stacks;
- damage/markers;
- turn state;
- Undo history.

It is not silently uploaded as durable account data.

A future Save Playtest session / Practice evidence feature must be explicit.

Solo/goldfish Playtest never creates competitive W/L.

---

## 4. Shared competitive/application data vs private personal state

### Shared application / competitive data

Fetched, derived or maintained once and reused across users:

- cards/formats;
- **set release / Online legality / IRL legality / rotation calendar facts**;
- event/tournament facts;
- tournament results/public decklists;
- normalized Meta evidence;
- public matchup evidence;
- aggregate analysis;
- official competitive-season/ruleset facts.

### Per-user data

Account-owned/private:

- Decks/versions;
- future Collection;
- attendance;
- Prep;
- Tournament Day/completion;
- personal Matches/Games;
- Expected Fields;
- notes/testing evidence;
- preferences and deck-icon overrides;
- season goals/manual corrections.

Do not duplicate heavyweight public/shared datasets inside every user's account snapshot.

### Format/set calendar is shared, not a preference

The current canonical manual source is `data/formats/maintained-calendar.json`.

The agreed future **Settings → Formats & Sets** UI is a maintenance interface for this shared application model. It must not write independent set calendars into `user_snapshots` or ordinary account preferences.

A practical future implementation may use an authorised global table/record or another controlled shared maintenance endpoint, with checked-in JSON retained as bootstrap/fallback. The browser-facing format resolver should continue to consume one canonical shared calendar regardless of storage implementation.

Only authorised maintainers should be able to change shared release/legal-date/rotation facts. Ordinary signed-in users must not gain write access merely because Settings is account-accessible.

### Presentation preferences are account-owned but globally consumed

Deck/archetype sprite overrides are a good example of the opposite boundary:

- the override itself is private user preference state;
- every feature consumes the same shared presentation engine;
- features must not independently re-infer or maintain competing archetype→sprite mappings.

The one current visual renderer is:

`v2-preview/apps/_shared/deck-sprites.js` → `window.DeckSprites.html()`

That renderer owns both mapping and the accepted one/two-sprite composition. Account overrides therefore remain consistent across Home, Meta, Decks and Compete.

---

## 5. Match/Game evidence and account persistence

Canonical personal results remain stored as shared Match/Game evidence inside account-owned state.

The analytics semantics are now explicit:

- tournament record, completion and Season are Match-level;
- personal Deck/matchup/version learning is Game-level;
- Training Log is Game-level but excludes Tournament Day records from its workspace;
- tournament Games may still contribute to personal learning;
- personal evidence never overwrites public H2H.

Do not introduce a second personal-results store merely to support Personal Performance, Practice Priorities or Deck Results. Derived analytics should read canonical account-owned Match/Game evidence and exact Deck references.

---

## 6. Whole-account snapshot vs future normalized user tables

The current snapshot model remains appropriate while the product schema is evolving rapidly.

Normalize a private domain only when there is a concrete need for:

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

The shared format/set calendar is a different concern: if Settings maintenance requires server-side writes, a small global authorised record/table is justified because the data is shared across accounts rather than private account state.

Import/export remains desirable as user-controlled backup/interoperability even with cloud accounts.

---

## 7. Local-community release

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

## 8. Upstream/shared-source architecture

For community/public use, avoid:

`every browser → Limitless / Pokémon / Pokédata / other source`

Prefer:

`external source → PTCG Tools ingestion/cache → normalized shared data → all users`

For Meta today, scheduled GitHub Actions ingest and normalize Online/IRL evidence into canonical archives, then build a content-addressed browser release served by GitHub Pages. Home/Meta validate and cache those files locally. A normal browser session does not query or scrape Limitless directly.

For infrequent manually maintained set/format facts, the equivalent principle is:

`authorised maintainer → one shared format calendar → format resolver → all users`

Supabase stores private per-user snapshots and authentication state. It need not become the public Meta warehouse. A small authorised shared calendar record is acceptable if required by the Settings maintenance workflow because it solves a distinct shared-write need.

Benefits:

- reduced rate-limit pressure;
- less duplicated traffic;
- consistent data across users;
- lower dependence on upstream availability at interaction time;
- easier source-governance/permission handling.

---

## 9. Source Adapter direction

The app should increasingly reason in normalized entities such as:

- Tournament;
- TournamentResult;
- Decklist;
- Match;
- Event;
- Card;
- Format/Set calendar facts.

Potential adapters include Limitless, Pokémon, RK9 and Pokédata adapters or successors.

Imported/shared records should retain provenance where practical:

- source;
- source record ID;
- retrieval/maintenance timestamp;
- field authority;
- access classification.

Useful access classifications:

- Official API;
- Explicit permission;
- Public data;
- Scraped;
- User supplied / manually maintained.

Anything classified as Scraped that becomes essential to a public product should be replaced, reviewed or explicitly authorized before broad launch.

---

## 10. Third-party source implications

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

## 11. Pokémon IP / public distribution

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

## 12. Privacy position

Once accounts exist, PTCG Tools handles personal data.

Principles:

- collect the minimum necessary;
- never request unrelated Google scopes;
- protect account-owned rows with RLS;
- never expose one user's personal state to another;
- document what is stored before broader use;
- provide practical export/delete controls before public release;
- treat email/name/profile details as personal data.

Shared calendar maintenance authorization must be separate from ordinary account privacy/RLS rules: a normal account may read shared format facts but should not automatically be allowed to edit them.

A formal privacy policy is required before broad public distribution and sensible before a larger community cohort.

---

## 13. Public-release progression

Recommended progression:

1. **Personal product** — complete the connected competitive workflow.
2. **Development Cleanup / Release Hardening** — remove temporary build pins, dead compatibility code, duplicate cross-feature engines and stale cache assumptions.
3. **Public-ready architecture** — retain account scoping, provenance and normalized/shared-data direction.
4. **Local community** — small real-player cohort.
5. **Private beta** — tens of users if useful.
6. **Provider/IP/privacy review** — resolve external dependencies and distribution obligations.
7. **Public release** — only with adequate data-source, privacy and operational foundations.

Do not design for millions prematurely.

---

## 14. Release-hardening implications

The recent development cycle exposed repeat classes of issue that must be systematically removed before stable release:

1. **temporary navigation/cache scaffolding** — dated build strings, stale service-worker assumptions, multiple routes pinning different application generations;
2. **duplicate shared logic** — feature-local sprite composition, card-art helpers or other local engines diverging from shared contracts;
3. **unclear shared/private boundaries** — global set/format facts must not be copied into private account preferences simply because their editor lives in Settings.

Before stable release:

- search repository-wide for dated build/revision links;
- delete obsolete legacy UI paths rather than only hiding them;
- consolidate shared concerns into one implementation;
- verify only one canonical deck/archetype sprite renderer remains;
- verify service-worker generation/cache behavior;
- ensure personal preferences are consumed consistently everywhere;
- keep shared format facts globally consistent;
- verify account backup/export and sync recovery;
- verify current deployed SHA and iPhone behavior.

This hardening step is part of becoming public-ready, not optional cosmetic refactoring.
