# PTCG Tools — Accounts, Settings, Shared Data & Public-Ready Architecture

**Status:** Current companion architecture source of truth  
**Date:** 13 September 2026  
**Companion to:** `PTCG_TOOLS_MASTER.md`, `PERFORMANCE_ARCHITECTURE.md`, `PLAYTEST_ARCHITECTURE.md`, `TOURNAMENT_DAY_ARCHITECTURE.md`

## Purpose

This document records the account, persistence, Settings, shared-data and public-ready boundaries that keep PTCG Tools **personal-first, public-ready**.

The most important distinction is:

> **Private account state follows the user. Shared application facts are maintained once and consumed by all users.**

---

## 1. Authentication

PTCG Tools supports **Google sign-in through Supabase Auth**.

Current principles:

- Google is the only provider required at this stage;
- request only identity information required for account functionality;
- no Gmail, Drive, Contacts or unrelated scopes;
- never receive/store the Google password;
- name/email/profile identifiers are personal data;
- provider secrets stay out of the public repository;
- the frontend uses only the publishable client key.

### OAuth / persistent-shell boundary

Google OAuth deliberately escapes embedded feature child views and navigates at top level. This remains the exception to normal persistent-shell navigation for providers that prohibit embedding.

---

## 2. Cross-device personal persistence

Authenticated users have cloud-backed per-account persistence through one schema-versioned `user_snapshots` row protected by Supabase RLS.

Current durable personal state includes:

- saved Decks;
- immutable DeckVersions/checkpoints and list hashes;
- `eventParticipations` including attendance, Prep, Tournament Day and completion;
- canonical Match/Game history;
- account preferences including Deck icon overrides;
- Saved Expected Fields and provenance;
- Season corrections/goals where applicable.

### Sync contract

Desired user model:

> Sign in once; meaningful personal PTCG Tools state follows the account.

Current behaviour includes:

- local bootstrap upload when an account has no cloud snapshot;
- restoration of newer cloud state on another device;
- dirty-state auto-upload after durable local changes;
- reconnect/focus/foreground reconciliation;
- deletion-safe collection replacement semantics;
- continued local use while offline, followed by later reconciliation.

The sync controller belongs to the **top-level persistent shell**, not to one feature page.

---

## 3. Durable vs transient state

### Durable/account-owned

Examples:

- Deck identity, working lists and DeckVersions;
- Saved Expected Fields;
- attendance and Prep;
- Tournament Day participation/completion;
- Match/Game evidence;
- Deck icon/presentation preferences;
- Season corrections;
- future Collection quantities/allocations;
- future explicit saved practice sessions.

### Transient/local

Current Mobile Playtest tabletop state remains local/browser state:

- shuffled order;
- Hand/Active/Bench/Prizes;
- attachments/evolution stacks;
- damage/markers;
- turn state;
- Undo history.

Solo/goldfish Playtest never silently creates competitive W/L evidence.

---

## 4. Shared application data vs private personal state

### Shared application / competitive data

Maintained/fetched/derived once and reused across users:

- card/set metadata;
- **set release / Online legality / IRL legality / rotation calendar facts**;
- format/card-legality rules;
- event/tournament facts;
- public tournament results/decklists;
- normalized Meta evidence;
- public matchup evidence;
- official Season/ruleset configuration.

### Per-user/private data

Account-owned:

- Decks/versions;
- attendance and event lifecycle;
- Event Prep;
- Tournament Day/completion;
- personal Matches/Games;
- Expected Fields;
- notes/testing evidence;
- Deck icon preferences;
- Season corrections/goals;
- future Collection.

Do not duplicate heavyweight shared datasets inside every account snapshot.

---

## 5. Formats & Sets shared-data architecture — implemented

Settings → Maintenance → **Formats & Sets** is now implemented as an authorised maintenance surface for one shared application calendar.

The browser-side adapter is:

`v2-preview/apps/_shared/format-calendar-store.js` → `window.PTCGFormatCalendar`

The canonical resolver remains:

`v2-preview/apps/_shared/format-resolver.js` → shared date/environment/card-legality resolution.

### Storage boundary

The shared format calendar is **not part of `user_snapshots`** and is not an ordinary preference. It has its own shared persistence path and maintainer authorization.

Ordinary signed-in users may read shared format facts but must not gain write access merely because Settings is account-accessible.

Checked-in maintained calendar data remains bootstrap/fallback. A validated last-known-good calendar may be used if remote shared persistence is unavailable or invalid.

### Maintenance UX contract

The UI exposes:

- set code/name;
- physical release date;
- Online legality date;
- IRL legality date;
- optional rotation data;
- blank date = unknown;
- one visible **Save changes** action.

The previous user-facing status/draft/publish complexity is retired. Internally, validated versioning/publish semantics may remain so previous published data can be recovered.

### Card legality boundary

Set-wide regulation marks are not authoritative and are not maintained as a set property.

Individual printing legality is derived from **that card printing's own `regulationMark`** against the resolved environment/date format. Rotation is represented by the legal regulation marks after rotation.

Set boundaries may remain for readable format labels and Meta grouping only.

### Immediate consumer-integration gap

The shared calendar maintenance/store is implemented, but the published shared calendar still needs to become authoritative across normal runtime consumers such as Home current format, Meta/WSIP, Event Prep and relevant card-legality checks. Consumers must load the shared calendar and call the canonical resolver rather than recreating logic locally.

---

## 6. Settings information architecture — implemented

Settings is now a compact hub rather than one long page.

### Landing page

Shows compact **Account & Sync** state and navigation into focused settings areas.

### Preferences

**Deck icons** lives on its own focused page. Overrides are private account preferences but are consumed globally through the shared `DeckSprites.html()` renderer.

### Data

**App data / backup & export** lives on its own focused page. Future import/restore/recovery controls should remain in this area rather than being scattered across feature pages.

### Maintenance

**Formats & Sets** lives on a maintainer-only focused page because it edits shared application data rather than personal settings.

### Settings rule

Future substantial editors should get focused subpages. Do not grow the Settings landing page back into a long vertical collection of forms.

---

## 7. Personal Match/Game evidence and persistence

Canonical personal results remain stored in shared Match/Game evidence inside account-owned state.

Locked semantics:

- tournament record/completion/Season = Match-level;
- personal Deck/matchup/version learning = Game-level;
- **Game Log** is the unified chronological browser over training and tournament Games;
- tournament Games can contribute to personal learning;
- public/global H2H remains separate.

Game Log does not introduce a new store; it reads the existing canonical Match/Game model.

Do not create a second personal-results database for Personal Matchup Analysis, Practice Priorities or Deck Version Intelligence.

---

## 8. Whole-account snapshot vs future normalized private tables

The current user snapshot remains pragmatic while the personal schema is still evolving quickly.

Normalize a private domain only when there is a concrete need for:

- queryability;
- conflict resolution;
- history/audit;
- collaboration;
- scale/performance;
- selective sync.

Possible future candidates include Collection, long-term match history or richer preparation workspaces.

The shared format calendar is different: separate shared storage is justified because it is global application data rather than private account state.

---

## 9. Shared-source architecture

For community/public use, avoid:

`every browser → upstream provider`

Prefer:

`external source → one PTCG Tools ingestion/cache/maintenance layer → normalized shared data → all users`

Current examples:

- Meta evidence is built centrally by scheduled repository ingestion and served as validated content-addressed releases;
- future online tournaments are discovered through prepared shared assets rather than each browser scraping Limitless;
- formats/sets are maintained once by an authorised maintainer and resolved consistently for all users.

Benefits:

- reduced upstream pressure;
- consistent data across users;
- less interaction-time dependency on provider availability;
- easier provenance and permission handling.

---

## 10. Source governance

The app should reason in normalized entities rather than provider-specific UI assumptions.

Useful provenance fields include:

- source/provider;
- source record ID;
- retrieval or maintenance timestamp;
- field authority;
- access classification.

Useful access classifications:

- Official API;
- Explicit permission;
- Public data;
- Scraped;
- User supplied / manually maintained.

Anything classified as Scraped that becomes essential to a broad public product should be replaced, reviewed or explicitly authorised.

---

## 11. Privacy and public-readiness

Once accounts exist, PTCG Tools handles personal data.

Principles:

- collect only what is needed;
- protect account rows with RLS;
- never expose one user's private state to another;
- document stored data before broader use;
- provide practical export/delete controls before public release;
- keep shared-maintenance authorization separate from ordinary user privacy/RLS.

A formal privacy policy and provider/IP review are required before broad public distribution.

PTCG Tools should maintain independent branding and clearly present itself as unofficial/community software if released widely.

---

## 12. Public-release progression

Recommended progression:

1. complete the personal competitive workflow;
2. Development Cleanup / Release Hardening;
3. verify public-ready account/shared-data boundaries;
4. small local-community cohort;
5. private beta if useful;
6. provider/IP/privacy review;
7. broader public release only with adequate operational foundations.

Do not design prematurely for massive scale.

---

## 13. Release-hardening implications

Before stable release:

- remove stale build/revision navigation pins;
- delete obsolete compatibility UI/runtime layers;
- consolidate shared concerns into one implementation;
- verify only one canonical DeckSprites renderer;
- verify format-calendar authorization and fallback behaviour;
- verify service-worker/cache generation;
- verify account backup/export and sync recovery;
- verify no shared application facts are accidentally stored as per-user preferences;
- verify current deployment SHA and iPhone behaviour.

This is architectural hardening, not cosmetic cleanup.
