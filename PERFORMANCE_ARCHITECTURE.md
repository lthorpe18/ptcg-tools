# PTCG Tools — Performance Architecture

**Status:** Current production source of truth  
**Date:** 13 September 2026  
**Companion to:** `PTCG_TOOLS_MASTER.md`, `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md`, `PLAYTEST_ARCHITECTURE.md`, `TOURNAMENT_DAY_ARCHITECTURE.md`

## Purpose

This document records the performance and application-lifecycle decisions established during the September 2026 shell, Playtest, cache and Meta-release work.

Consult it before changing global navigation, caching, shell-owned sync, Home activation, Meta release loading, Playtest rendering or Tournament Day rendering.

## Core performance principle

The dominant recurring performance failure mode has been unnecessary **document lifecycle churn** rather than raw computation.

Durable rule:

> **Routine interaction should preserve the active application/document where practical, render state changes in place, and use caching to accelerate rather than override the current online application.**

---

## 1. Persistent production shell

The production app keeps the five core areas mounted after first load:

**Home · Meta · Decks · Compete · Tools**

Section switching changes the active child view rather than cold-starting a new top-level document every time.

Already-loaded areas remain immediately available; unopened areas load on demand.

This provides:

- fast repeat navigation;
- retained feature state;
- less repeated bootstrap/data work;
- lower perceived latency on iPhone.

The current persistent-child-view architecture is a pragmatic migration path over plain HTML/CSS/JS. A future router/shared-DOM rewrite is justified only if measured user experience improves.

---

## 2. Shell-owned account sync

Google account reconciliation belongs to the **top-level persistent shell**, not to one feature child view.

Sync may react to:

- durable local personal-data changes;
- reconnect/online events;
- focus/foreground/resume signals.

Do not move the only sync controller into an individual feature page.

---

## 3. OAuth exception

External OAuth deliberately escapes embedded child views and navigates at top level.

This remains an intentional exception to the normal “stay inside the shell” rule.

---

## 4. Service-worker and cache architecture

### Static/generated assets

Suitable static assets and generated shared JSON may use cache-friendly strategies such as stale-while-revalidate **only when serving the immediately cached copy cannot make the feature materially wrong**.

Time-sensitive discovery feeds are stricter. After the Online tournament freshness defect fixed in PR #79, Compete → Online explicitly bypasses the stale generated-data service-worker path with a cache-busting request + `cache: no-store`, revalidates on Online entry/app return/refresh, and keeps the last successful feed only as an explicit fallback after a failed refresh.

Versioned JS/CSS should use deliberate version bumps when behaviour changes.

### Navigation/document HTML — network first

Application/navigation HTML is **network-first with cached fallback**.

Reason: stale-first document caching previously caused newer deployed code to appear to regress to an older application generation.

Current rule:

1. request current HTML from the network when online;
2. cache a successful response;
3. fall back to cached HTML only when the network is unavailable/fails.

Do not restore stale-first navigation without an explicit offline-first requirement and direct regression testing.

### No scattered build pins

Internal routes use semantic current URLs rather than feature-specific dated `?build=` parameters.

Cache invalidation belongs to service-worker strategy and asset versioning, not scattered navigation tokens.

---

## 5. Meta release delivery

Shared Meta evidence is prepared centrally and published as content-addressed releases.

Normal Home/Meta startup loads only the small release manifest/core required for current navigation/context. Heavy matchup/results/history payloads load on demand.

A new release becomes active only after validation; current/previous validated releases remain available as last-known-good fallbacks.

Browser CacheStorage is an accelerator/fallback, not a blocking authority. Cache reads, writes and pruning on the Meta release path must be bounded. A stalled/failed cache read must fall through to the validated network payload; a stalled/failed cache write or prune must not prevent already validated evidence from becoming usable.

Normal browsers must not perform tournament ingestion themselves.

Prediction snapshots/accuracy archives remain separate from normal startup payloads and load only when the Prediction Accuracy surface requests them.

### Format-transition safety

Online and IRL format-labelled evidence is validated against its target format. Stale asynchronous evidence must not replace a newer selected release/format/context.

Generation/request guards remain required where a late async response could repaint a newer state.

---

## 6. Home warm-return freshness

Home is a mounted child view and may survive deployments/data changes while inactive.

When an already-mounted Home becomes active, the shell sends a lightweight activation signal. Home may then ask shared release/calendar loaders to refresh derived state.

Do not reload the page, create a second Home store or hit upstream tournament APIs merely to refresh current context.

Shared format-calendar consumers now follow the same model: refresh/resolve through the shared calendar store and canonical resolver rather than creating Home-local format logic. Production Meta generation uses a stricter fail-closed published-source contract tracked in the Meta architecture/handoff.

---

## 7. Mobile Playtest rendering

Ordinary Playtest actions follow:

**mutate → push Undo snapshot → change state → persist → clear selection → render in place**

Do not use `location.reload()` for routine tabletop interactions.

This applies to markers, prizes, multi-select moves, damage, attachments/evolution, Stadium replacement, Deck search/shuffle/draw and turn advance.

Grouped actions remain one logical mutation / one Undo step.

---

## 8. Mobile Playtest image policy

Eager-load immediately visible primary tabletop art where appropriate:

- Hand;
- Active;
- Bench;
- Stadium;
- visible Prize inspection.

Keep secondary/search/list thumbnails lazy where practical.

Card-art provider/fallback choice should remain centralized through shared card-image infrastructure rather than feature-local resolvers.

---

## 9. Shell / child viewport boundary

The visible five-item global navigation belongs to the **outer persistent shell**.

Child views must not reserve/own a second global-nav height or render a duplicate bottom nav.

This applies to Home, Playtest, Settings drill-in pages and Compete/Tournament Day child navigation.

---

## 10. Tournament Day and Game Log rendering

Tournament Day should update current record/round history in place after Match changes rather than reloading the document.

Game Log is a derived browser over canonical Match/Game evidence and should likewise render/filter the existing evidence rather than duplicate/persist a second log model.

Tournament rows route to Tournament Day; training rows remain editable through the training workflow. These are navigation decisions over shared data, not separate persistence systems.

---

## 11. Shared-engine rule

Performance and correctness both benefit from one shared implementation.

If a cross-app concern already has a shared engine, consume that engine first. Local fallbacks may exist only for genuinely unsupported data, not as a second primary implementation.

Current examples:

- `DeckSprites.html()`;
- shared card catalog/images;
- `PTCGMatchStore`;
- `PTCGMetaField` / `PTCGRecommendation`;
- shared format resolver/calendar store;
- Season engine;
- Cut / ID engine.

Duplicate helper stacks increase script cost, maintenance cost, drift and stale-code/cache confusion.

---

## 12. Current performance status

Current established state:

- persistent-shell navigation is accepted and materially faster on real iPhone testing;
- Mobile Playtest ordinary actions render in place;
- navigation HTML stale-cache regression is resolved architecturally through network-first documents;
- normal browsers do not run Meta ingestion;
- Home warm-return refresh uses lightweight shared-runtime activation rather than reloads;
- Settings has moved to compact hub + focused subpages without changing the five-area shell boundary;
- Game Log reuses canonical Match/Game evidence rather than creating a second data path.

Performance is an established foundation, not the current roadmap milestone unless a material user-visible regression appears.

---

## 13. If performance work is reopened

Diagnose before changing architecture:

- **initialisation cost** — first load of an area;
- **navigation cost** — switching mounted sections;
- **data cost** — network/cache/parse cost;
- **rendering cost** — DOM/layout/main-thread work;
- **sync cost** — reconciliation competing with interaction;
- **mutation cost** — unnecessary reload/re-render;
- **asset freshness** — mixed or stale HTML/JS/CSS generations;
- **service-worker lifecycle** — old worker/cache controlling current clients.

Measure first. Do not assume every delay is network latency or every stale UI is state corruption.

---

## 14. Architecture lock

Future work must preserve:

1. already-loaded core areas remain immediately available;
2. routine section switching does not cold-start each feature;
3. feature state survives normal navigation where practical;
4. perceived iPhone performance is at least as good as the current shell;
5. account sync remains application-level;
6. OAuth can escape to top-level navigation;
7. ordinary Playtest/Tournament Day interactions remain in-place;
8. the outer shell remains sole owner of global bottom navigation;
9. online navigation HTML does not preferentially serve stale app generations;
10. async release/format responses cannot overwrite a newer selected context;
11. shared concerns remain centralized rather than repeatedly reimplemented.

---

## 15. Release-hardening requirement

Before stable/public-ready release:

- search for stale dated `build=` links;
- remove obsolete compatibility/enhancer layers after parity is proven;
- verify one canonical implementation per shared concern;
- review service-worker precache and version strategy;
- verify network-first documents with offline fallback;
- verify shared format-calendar refresh/fallback behaviour;
- verify current deployment SHA;
- retest installed-iPhone navigation and warm-return behaviour.

Performance hardening should reduce lifecycle/cache drift, not trigger a framework rewrite for its own sake.
