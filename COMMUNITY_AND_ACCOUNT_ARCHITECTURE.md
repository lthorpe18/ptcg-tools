# PTCG Tools — Accounts, Community & Public-Ready Architecture

**Status:** Current companion architecture source of truth  
**Date:** 3 September 2026  
**Companion to:** `PTCG_TOOLS_MASTER.md`, `PERFORMANCE_ARCHITECTURE.md`, `PLAYTEST_ARCHITECTURE.md`

## Purpose

This document records the decisions established while exploring PTCG Tools beyond a single-user personal web app: Google account sign-in, cross-device persistence, local-community sharing, future public release, third-party data-source implications and the architectural choices that keep those options open.

The product position is:

> **Personal-first, public-ready.**

PTCG Tools should continue to optimise for the primary user's competitive workflow, while avoiding implementation choices that unnecessarily prevent a future community or public release.

---

## 1. Current account model

### 1.1 Authentication

PTCG Tools now supports **Google sign-in** through Supabase Auth.

Google is the only supported sign-in provider for now. Apple and Discord were deliberately removed from the UI after Google was proven sufficient for the current product stage.

Authentication principles:

- request only the minimum identity information required for account functionality;
- do not request access to Gmail, Drive, Contacts or other unrelated Google services;
- never receive or store the user's Google password;
- treat name and email address as personal data;
- retain only identity data that has a clear product purpose;
- keep OAuth provider secrets out of the public GitHub repository.

Current Supabase project:

- project name: **PTCG Tools V2 Auth**;
- project reference: `naylqcyrnhjvqodjpjsg`;
- region: `eu-west-2`;
- current plan: free tier.

The public frontend uses only the Supabase publishable client key. Provider client secrets remain server-side in Supabase configuration.

### 1.2 OAuth and the persistent shell

The production app uses persistent embedded child views for the five main product areas. Google authentication pages must **never be loaded inside those embedded views**.

Google OAuth is therefore initiated as a **top-level navigation**. The entire PTCG Tools window leaves for Google and returns to the top-level app after authentication.

This is an architectural rule for any future external authentication flow: third-party identity pages must not be assumed to support iframe embedding.

---

## 2. Cross-device persistence

### 2.1 Current implementation

Authenticated users now have cloud-backed per-account persistence via Supabase.

The current cloud model stores one latest `user_snapshots` record per authenticated user, protected by Row Level Security using the authenticated Supabase user ID.

The snapshot currently includes the personal state that the V2 app knows how to capture, including:

- saved decks;
- deck versions contained within saved deck objects;
- root V2 personal state including canonical UserEventParticipation relationships, attendance intent and retained event snapshots;
- preferences;
- saved/custom expected Meta data.

The architecture is deliberately schema-versioned so it can evolve as Collection, Tournament Prep, testing history and other personal domains are added.

The V2 participation schema now migrates the previous `plannedEvents` plus linked Prep state into one `eventParticipations` collection. The relationship ID and event snapshot survive migration. A status-only relationship may be removed when intent is cleared; once dependent Prep, deck/version, match, Tournament Day or completion state exists, clearing intent archives rather than deletes the relationship. This preserves one account-owned record for later Season, Deck history, Home and Analytics consumers while retaining the pragmatic whole-account snapshot model.

### 2.2 Sync behaviour

The desired user model is simple:

> Sign in once; personal PTCG Tools data follows the account.

Current behaviour:

- when an authenticated user has no cloud snapshot, existing local data is uploaded rather than replaced by an empty cloud state;
- when another device has a newer cloud snapshot, it can be restored locally;
- local changes mark the account state dirty and are pushed automatically;
- returning online, refocusing the app or resuming visibility can trigger reconciliation;
- deck deletions are represented correctly because cloud restore can replace the local deck collection rather than only append records;
- local/offline operation remains possible and sync resumes when connectivity returns.

The sync controller lives at the **top-level persistent application shell**, not inside one particular feature page. This allows account persistence to continue while users move between Home, Meta, Decks, Compete and Tools.

### 2.3 Proven behaviour

On 1 September 2026 the account flow was tested across devices:

- Google authentication completed successfully;
- a cloud snapshot was created in Supabase;
- changing an event to **Attending** on one device persisted to another device using the same Google account.

Therefore the **Google account + cloud persistence + cross-device restore/sync milestone is considered complete for the current product stage**.

### 2.4 Mobile Playtest persistence boundary

Mobile Playtest deliberately has two different persistence layers because they represent different kinds of state.

**Durable/account-owned:**

- Deck identity;
- mutable working list;
- immutable DeckVersions/checkpoints;
- exact canonical `listHash`;
- Event Prep's exact planned/candidate deck reference.

These continue to use the established Deck/account snapshot architecture and can therefore follow the account across devices.

**Transient/local tabletop state:**

- current shuffled Deck order;
- current Hand;
- Active/Bench placement;
- current Prizes;
- attachments/evolution stack;
- damage/markers;
- current turn/coin state;
- active Undo history.

The current active Playtest state is local browser work-in-progress state (`ptcg-tools.playtest.active.v2`). It is **not** silently uploaded as part of the user's durable account snapshot.

This is intentional for v1. A transient goldfish board position is not the same thing as a durable saved DeckVersion or competitive Match record.

Future cross-device Playtest persistence should therefore be an explicit product feature such as **Save Playtest session** or **Practice evidence**, not an accidental side-effect of syncing every tabletop mutation.

### 2.5 Playtest evidence boundary

Solo/goldfish Playtest does **not** write wins/losses and does not alter competitive matchup statistics.

Real PTCGL/in-person results remain in the Match/Game contract.

If Playtest later records durable practice evidence such as mulligan rate, opening-hand observations or scenario notes, that should be a separate account-owned Decks domain with explicit provenance and semantics.

Do not merge goldfish observations into competitive match evidence merely because both reference the same `deckId + listHash`.

### 2.6 Future persistence evolution

The current whole-account snapshot is appropriate while the product and data model are still changing rapidly.

As the app matures, high-value domains may move from one large snapshot into normalized per-user tables, especially:

- Collection quantities and allocations;
- tournament history and matches;
- deliberately saved Playtest sessions/practice evidence;
- matchup notes/testing evidence;
- deck/version relationships;
- preparation workspaces;
- completed Championship Series participation, season goals and manual event-result corrections.

Do not normalize prematurely solely for database purity. Move a domain when querying, conflict resolution, collaboration, history or scale genuinely benefits from it.

Import/export should remain available as a user-controlled backup/interoperability mechanism even with cloud accounts.

---

## 3. Shared data vs per-user data

The long-term architecture should maintain a strong distinction between shared competitive data and private/user-owned state.

### Shared competitive data

Fetched/derived once and reused by all users:

- Cards and formats;
- tournament/event records;
- tournament results;
- public decklists;
- normalized Meta data;
- public matchup evidence;
- generated aggregate analysis;
- official competitive-season boundaries and season-versioned Championship Point / Best Finish Limit rulesets.

### Per-user data

Owned by one authenticated account and protected accordingly:

- saved decks and versions;
- Collection quantities and allocations;
- event attendance intent;
- preparation workspaces;
- completed Championship Series participation, placement/player-count corrections and season goals;
- personal match/tournament history;
- deliberately saved testing notes/results/practice evidence;
- preferences and presentation overrides.

Transient unsaved Playtest tabletop state is local work-in-progress, not shared competitive data and not automatically durable per-user cloud data.

The app must not duplicate heavyweight public datasets inside every user's account data.

Competitive-season summaries are derived from both sides of this boundary: shared, source-cited season/CP rules and event facts are applied to private UserEventParticipation records. A user's manual correction may affect their own participation calculation without silently changing the shared event record for other users. Historical participation must retain the ruleset version used so later season updates cannot rewrite prior CP totals.

---

## 4. Local-community release

A middle ground between a single personal app and a broadly marketed public application is explicitly supported.

The intended model is:

> No monetisation required. No App Store required. Share the installable web app with a local competitive community and make it genuinely multi-user over time.

### 4.1 Scale expectations

Current static/PWA architecture is technically comfortable for a local community.

Approximate engineering thresholds:

| Scale | Expected concern |
|---|---|
| One user / a few friends | Essentially none |
| 20–100 regular users | Still technically trivial |
| Hundreds of active users | Start watching bandwidth and upstream-source traffic |
| Low thousands | Production hosting/CDN/backend observability becomes sensible |
| Tens of thousands | Genuine scale engineering required |

User count does not multiply browser RAM. Each user's device runs its own frontend. The persistent shell's memory cost is primarily a **per-device** concern.

### 4.2 GitHub Pages

GitHub Pages is suitable for the current personal/community phase, but it is not the assumed permanent production platform for a large public application.

Current documented constraints include approximately:

- recommended source repository size up to 1 GB;
- published site size up to 1 GB;
- soft bandwidth limit around 100 GB/month;
- build-frequency limits unless custom Actions workflows are used.

Service-worker caching materially reduces repeat-download bandwidth.

Before the application reaches sustained low-thousands usage, reassess deployment and likely move public delivery to production hosting/CDN infrastructure.

### 4.3 Browser storage

Browser-local storage capacity is not the main scaling constraint for PTCG Tools personal data. Decklists, collection quantities, attendance records and notes are small structured data.

The more important issue is **durability**: browser storage can be cleared, evicted or lost with device replacement.

Therefore meaningful user-owned data should be cloud-backed once users begin relying on it. The implemented Google-account sync addresses this for current V2 durable personal state.

This does not imply that every transient UI/session state must be synced. Mobile Playtest is the current example of a deliberate boundary: saved Deck identity is durable/cloud-backed, while an unsaved live tabletop remains local until an explicit saved-session feature exists.

---

## 5. Upstream-source architecture

For a community/public application, upstream requests should not multiply linearly with users.

Avoid:

`every user's browser → Limitless / Pokémon / Pokédata / other source`

Prefer:

`external source → PTCG Tools ingestion/cache → normalized shared data → all users`

This reduces:

- rate-limit pressure;
- dependency on source availability during every user interaction;
- duplicated network traffic;
- inconsistency between users;
- source-permission risk caused by uncontrolled distributed scraping.

Shared public competitive data should increasingly be generated/ingested centrally, while personal state remains account-specific.

Card-art delivery used by Mobile Playtest is a presentation dependency and must not be confused with card/deck identity. A future public-scale review should consider the authority/licensing/cache strategy for card images separately from the user's exact Deck state.

---

## 6. Source Adapter architecture

If PTCG Tools expands beyond its current scripts, external data access should converge on a normalized adapter model.

The application should reason about normalized entities such as:

- `Tournament`;
- `TournamentResult`;
- `Decklist`;
- `Match`;
- `Event`;
- `Card`.

Possible adapters:

- `LimitlessAdapter`;
- `PokemonAdapter`;
- `RK9Adapter`;
- `PokedataAdapter`.

Each imported record should retain provenance where practical:

- source;
- source record/event ID;
- retrieval timestamp;
- which fields the source is authoritative for;
- data-access classification.

Useful source-access classifications:

- **Official API**;
- **Explicit permission**;
- **Public data**;
- **Scraped**;
- **User supplied**.

Anything classified as **Scraped** that is essential to a future public product should be reviewed, replaced with an authorized mechanism, or explicitly permitted before broad launch.

---

## 7. Third-party source implications

### 7.1 Limitless

Limitless publishes developer documentation for tournament data, including tournament placings, decklists, matches and webhooks.

Public-facing PTCG Tools should prefer documented Limitless APIs over undocumented/scraped endpoints wherever possible.

Most documented endpoints can be used without an API key subject to limits, while legitimate public projects can seek API keys/higher limits. A future community/public launch should therefore approach Limitless with the working product and expected traffic rather than treating scraping as the long-term integration contract.

### 7.2 RK9

RK9's published Terms prohibit automated extraction/screen scraping for both commercial and non-commercial purposes.

Therefore:

- a free app does **not** make RK9 scraping acceptable;
- PTCG Tools should not make unauthorized RK9 scraping a core public dependency;
- official Pokémon data should remain the major-event existence/date authority;
- RK9 can remain a practical outbound registration/detail destination;
- richer automated RK9 use should require permission or an authorized access mechanism.

### 7.3 Pokédata and other discovery sources

Discovery/index sources should be treated as such unless exact authority is established. Normalization must retain provenance and the UI should not overstate certainty.

---

## 8. Pokémon intellectual property and app-store implications

A free fan application is not automatically exempt from trademark, copyright, database-right or third-party-service obligations.

Before a broad public/App Store release, review at minimum:

- card artwork/images, including the card-image strategy used by Mobile Playtest;
- Pokémon artwork and logos;
- Pokémon/name trademark presentation;
- energy/game symbols and other protected assets;
- third-party service terms;
- privacy/GDPR obligations;
- app-store intellectual-property requirements.

PTCG Tools should maintain its own independent brand, avoid presenting itself as an official Pokémon product, and clearly identify itself as unofficial/community software if released more widely.

Facts, calculations and statistics are a different category from copying protected artwork, but the terms governing the source of those facts still matter.

### Native app viability

A future iOS/Android application is technically viable without rewriting all domain logic from scratch.

Potential evolution:

1. continue maturing the responsive PWA;
2. strengthen the shared backend/data model;
3. use a native wrapper such as Capacitor if the mature web UI remains the preferred client;
4. consider React Native/Expo or another more-native client only if native interaction requirements justify it.

Apple requires apps to provide sufficient functionality beyond a simple repackaged website. PTCG Tools' saved decks, Collection, Playtest, preparation, tournament-day and account functionality should naturally support that requirement if the product reaches that stage.

---

## 9. Privacy position

Once accounts are available, PTCG Tools is handling personal data.

Current identity data from Google can include:

- stable provider/user identifiers;
- email address;
- display name;
- profile image URL where supplied.

Principles:

- collect the minimum necessary;
- never request unrelated Google scopes;
- protect user-owned database records with Row Level Security;
- do not expose one user's personal state to another;
- document what is stored before broader community use;
- provide a reasonable route to export/delete personal data before a broad public release;
- treat email/name as personal data even when the application is free.

A formal privacy policy becomes necessary before broad public distribution and is sensible before inviting a larger community cohort.

If Playtest later gains cloud-backed saved sessions/practice notes, those become private account-owned data and must follow the same privacy/export/delete principles. The current unsaved transient tabletop is local and should not be represented to users as cloud-restorable.

---

## 10. Public-release progression

The recommended progression is deliberately incremental:

1. **Personal product** — build the strongest possible competitive companion for the primary user.
2. **Public-ready architecture** — use accounts, normalized shared data and source provenance so future release remains feasible.
3. **Local community** — allow a small competitive community to use the PWA and validate whether the connected workflow is useful to people other than the creator.
4. **Private beta** — if valuable, expand to roughly tens of competitive players and observe usage/support/data-source impact.
5. **Provider/IP review** — approach Limitless/RK9/other providers as required; review Pokémon asset use, privacy and store requirements.
6. **Public release** — only once data-source permissions, durability, privacy and operational support are adequate.

Do not design for millions of users prematurely. The two decisions that matter now are:

1. user-owned durable state must remain cleanly account-scoped and cloud-restorable;
2. shared third-party competitive data should increasingly be ingested once and served to many users rather than fetched independently by every client.

A third implementation discipline follows from Mobile Playtest: **do not automatically cloud-sync high-frequency transient UI state merely because an account exists.** Persist it only when it has a clear durable user value and conflict model.

---

## 11. Product implication

The defensible value of PTCG Tools is not simply reproducing Limitless, RK9 or Pokémon data.

Its value is the connected player workflow:

**Meta → Deck choice → Deck development/testing → physical readiness → event preparation → tournament-day decisions → review/learning**

The account/cloud layer is what allows the durable parts of that workflow to become longitudinal and device-independent.

Mobile Playtest now completes a substantial part of the **Build & Test** stage without confusing transient tabletop state with durable competitive history.

That connected personal competitive history is a more important product asset than any one external data source.
