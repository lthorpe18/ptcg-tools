# PTCG Tools — Performance Architecture

**Status:** Current production source of truth  
**Date:** 4 September 2026

## Purpose

This document records the performance decisions established during the September 2026 app-performance pass, Mobile Playtest performance consolidation and the Tournament Day cache/navigation regression investigation. It is a companion to `PTCG_TOOLS_MASTER.md`, `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md`, `PLAYTEST_ARCHITECTURE.md` and `TOURNAMENT_DAY_ARCHITECTURE.md`.

Consult it before changing global navigation, caching, app-shell behaviour, shell-owned sync or Playtest/Tournament Day rendering.

## Core performance principle

The dominant recurring performance failure mode has been unnecessary **document lifecycle churn** rather than raw computation.

Examples observed:

- switching Home / Meta / Decks / Compete / Tools via full-document navigation;
- Playtest helper layers calling `location.reload()` after ordinary tabletop mutations;
- a service worker returning stale cached navigation HTML before the network, causing newer code to appear to regress to an older UI generation.

The durable principle is:

> **Routine interaction should preserve the active application/document where practical, render state changes in place, and use caching to accelerate—not override—the current online application.**

## 1. Persistent production shell

The production app keeps the five core areas mounted after first load:

**Home · Meta · Decks · Compete · Tools**

Section switching changes the active child view rather than cold-starting a new top-level document each time.

This provides:

- immediate repeat navigation once areas have loaded;
- retained feature state;
- background warming of other core areas;
- reduced repeated bootstrap/data work.

The current persistent-child-view architecture is a pragmatic migration path over the existing plain HTML/CSS/JS feature pages. A future shared-DOM/router shell is allowed only if it preserves or improves the measured iPhone experience.

## 2. Shell-owned account sync

Google account reconciliation belongs to the **top-level persistent shell**, not to one feature child view.

Current sync may react to:

- durable local personal-data changes;
- reconnect/online events;
- focus/foreground/resume signals.

Do not move the only sync controller into one feature page.

## 3. OAuth exception

External OAuth must escape embedded child views.

Google authentication is a deliberate top-level navigation because Google blocks the embedded authentication flow used by the persistent shell.

This is an exception to the normal “stay inside the shell” navigation rule and must remain available for future providers/external flows that prohibit embedding.

## 4. Service-worker architecture

### 4.1 Static/generated assets

Suitable static assets and generated JSON may use stale-while-revalidate caching.

Useful cache targets include:

- shell/static CSS and JS;
- generated shared data;
- card/sprite images where source/usage allows;
- pre-cached primary app entry surfaces.

Versioned assets should use deliberate version bumps when behavior changes.

### 4.2 Navigation HTML — network first

As of 4 September 2026, **navigation/document HTML is network-first with cached fallback**.

This supersedes the earlier stale-while-revalidate navigation behavior.

Reason: the previous service worker could return an old cached Tournament Day document immediately and only fetch the new document in the background. This made the user see a newer UI, navigate elsewhere, then reopen an apparently “regressed” older UI even though GitHub Pages had already deployed the new code.

Current rule:

1. for online navigation, request the current HTML from the network first;
2. cache a successful current response;
3. use cached HTML only when the network is unavailable/fails.

The service-worker cache generation was bumped from `ptcg-tools-v17` to `ptcg-tools-v18` for this transition.

Do not restore cache-first/stale-first navigation without a specific offline-first product requirement and direct testing that it cannot serve obsolete application generations during ordinary online use.

### 4.3 Query-string cache behavior

Historic development links such as `?build=YYYY...` were used to try to force fresh Tournament Day loads. They became dangerous because different entry points could pin different application generations, and the older service worker normalized navigation cache keys anyway.

Current direction:

- internal navigation should point to the canonical current page, e.g. `tournament-day.html?participation=<id>`;
- do not scatter dated build IDs across features;
- static JS/CSS versioning and correct service-worker strategy own cache invalidation;
- any temporary development token must have one explicit owner and be removed during release hardening.

## 5. Mobile Playtest in-place rendering

Ordinary Playtest actions follow the core path:

**mutate → push Undo snapshot → change state → persist → clear selection → render in place**

Do not use `location.reload()` for routine tabletop interactions.

This applies to:

- markers/status;
- prize taking;
- Hand multi-select/bulk movement;
- discard/deck/lost moves;
- damage;
- attachments/evolution;
- Stadium replacement;
- Deck search/shuffle/draw;
- turn advance and automatic start-of-turn draw.

Grouped actions remain one logical mutation / one Undo step.

## 6. Mobile Playtest image policy

Eager-load immediately visible main-tabletop art:

- Hand;
- Active;
- Bench;
- Stadium;
- visible Prize inspection where appropriate.

Keep secondary/search/list thumbnails lazy where appropriate.

The goal is stable primary interaction without needlessly eager-loading every secondary image.

## 7. Mobile Playtest cache-busting

Playtest uses a fresh `_pt=<timestamp>` launch token for local Playtest assets/navigation.

The service worker bypasses `_pt` requests rather than normalizing the token away.

Card images remain normally cacheable.

This remains a Playtest-specific mechanism; do not generalize it into dated build strings throughout the application.

## 8. Shell / Playtest viewport boundary

The visible five-item navigation belongs to the **outer persistent shell**.

Playtest does not reserve/own a second global-nav height and does not load a duplicate bottom nav.

Its Hand tray anchors to the bottom of its own bounded child viewport.

## 9. Tournament Day rendering and shared services

Tournament Day should update its current record/round history in place after Match changes rather than reloading the document.

Cross-feature presentation/data helpers should be reused rather than duplicated. The September 4 sprite issue demonstrated this clearly: Tournament Day had independently inferred archetype sprites instead of consuming the shared `DeckSprites` engine used by Settings/Meta.

Performance and correctness both benefit from one shared implementation because duplicate helper stacks increase:

- script cost;
- maintenance cost;
- inconsistent behavior;
- stale-code/cache confusion;
- re-render races.

Architecture rule:

> If a cross-app concern already has a shared engine, consume that engine first. A local fallback may exist only for genuinely unsupported data, not as a second primary implementation.

## 10. Current performance status

Real iPhone testing after the persistent-shell pass reported navigation as **much, much snappier**.

Mobile Playtest’s card-art popping regression was resolved by removing full-page reloads from ordinary actions.

Tournament Day’s apparent saved-state/UI regression was traced to stale navigation HTML served by the application service worker and corrected by making online document navigation network-first.

Therefore:

- **navigation-performance milestone is complete**;
- **Mobile Playtest in-place rendering regression is resolved**;
- **navigation HTML cache regression is resolved architecturally as of 4 September 2026**;
- further performance work is not the next product milestone unless a material user-visible regression appears.

## 11. Architecture lock

Future shell/router/performance work must preserve:

1. already-loaded core areas remain immediately available;
2. routine section switching does not cold-start each feature;
3. feature state survives normal navigation where practical;
4. perceived iPhone performance is at least as good as the current shell;
5. account/session sync retains an application-level lifecycle;
6. external OAuth can navigate at top level;
7. ordinary Playtest actions remain in-place and Undo-consistent;
8. Playtest cache-busting keeps local Playtest code fresh without disabling useful image caching;
9. the outer shell remains sole owner of the five-item global mobile navigation;
10. online navigation HTML must not preferentially serve a stale cached application generation;
11. cross-app helpers such as deck/archetype sprite mapping remain centralized rather than repeatedly reimplemented.

## 12. If performance work is reopened

Diagnose the category before changing architecture:

- **Initialisation cost** — first load/warm-up of Meta, Decks, Compete, etc.;
- **Navigation cost** — switching between already-loaded sections;
- **Data cost** — network latency, large JSON, cache misses, parsing;
- **Rendering/main-thread cost** — DOM/layout/synchronous analysis;
- **Sync cost** — account reconciliation competing with interaction;
- **Mutation cost** — unnecessary re-renders/reloads;
- **Asset freshness** — stale JS/CSS/HTML masquerading as a runtime bug;
- **Service-worker lifecycle** — an old worker/cache generation controlling the client.

Measure/diagnose before optimising. Do not assume every delay is network latency and do not assume every UI regression is state corruption.

Potential future work only if justified:

- instrument transition/first-load timings;
- reduce Meta first-entry startup cost;
- adaptive background warming;
- consolidate shared runtime/data caches;
- keep cloud reconciliation asynchronous/lightweight;
- migrate from persistent child views to a shared-DOM shell only with clear product/performance benefit;
- consolidate temporary feature enhancer layers during release hardening.

## 13. Release-hardening requirement

Before a stable/public-ready release, perform a deliberate cache/runtime cleanup pass:

- search repository-wide for dated `build=` links and stale development route pins;
- remove obsolete compatibility/enhancer code where behavior has moved into core;
- verify one canonical shared engine for reusable cross-app concerns;
- review service-worker pre-cache contents and generation/version strategy;
- ensure navigation remains network-first online with offline cached fallback;
- verify current deployment SHA before acceptance;
- retest iPhone/home-screen navigation after service-worker changes.

## Relationship to roadmap

Performance is an established foundation, not the current feature milestone.

Product work should continue through:

**Analyse → Build & Test → Prepare → Compete → Learn**

See `TOURNAMENT_DAY_ARCHITECTURE.md` for the current Compete implementation contract, `PLAYTEST_ARCHITECTURE.md` for Mobile Playtest and `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md` for account/public-ready boundaries.
