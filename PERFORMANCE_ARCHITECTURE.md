# PTCG Tools — Performance Architecture

**Status:** Current production source of truth  
**Date:** 1 September 2026

## Purpose

This document records the performance decisions established during the September 2026 app-performance pass. It is a companion to `PTCG_TOOLS_MASTER.md` and should be consulted before changing global navigation, caching or app-shell behaviour.

## Problem observed

On iPhone/home-screen use, the app could sometimes feel very fast and at other times hang for several seconds when moving between major areas.

The key finding was that the principal problem was **cross-page full-document navigation**, not general rendering slowness. Moving around inside an already-loaded Meta page was usually responsive; the largest stalls occurred when switching Home / Meta / Decks / Compete / Tools because each navigation destroyed the existing document and rebuilt the destination page, scripts and data state.

## Performance work completed

### 1. Caching baseline

A service worker was added for the V2 app.

Current direction:

- stale-while-revalidate caching for suitable static assets and generated JSON;
- pre-cache the primary app surfaces;
- allow genuine explicit refresh paths to bypass cache;
- deliberate cache-version bumps when shell/static behaviour changes.

Home was also cleaned up so routine Meta-preview data no longer deliberately uses `cache: no-store`, and duplicate requests for the Meta format index were shared.

This improved network behaviour but **did not solve the main navigation stalls by itself**.

### 2. Persistent production shell

A persistent five-area shell was prototyped, tested on iPhone, then promoted to production.

Core areas:

**Home · Meta · Decks · Compete · Tools**

The key behaviour is:

- areas stay mounted once loaded;
- section switching changes the active view rather than performing a new top-level document load;
- already-loaded feature state is retained;
- other core areas progressively warm in the background after launch;
- ordinary repeat navigation is therefore largely independent of network latency and repeated application bootstrap.

The current implementation uses persistent child views around the existing plain-HTML feature pages. This was intentionally chosen as a safe migration path that produced a large real-world improvement without forcing a framework rewrite.

### 3. Shell-owned account sync

Google account persistence and cross-device cloud reconciliation were added after the navigation-performance pass.

The automatic cloud-sync controller belongs to the **top-level persistent shell**, not to one feature child view. This ensures that authentication/session reconciliation and dirty-state uploads continue to work while the user moves among Home, Meta, Decks, Compete and Tools.

Current sync triggers include local personal-data changes plus appropriate resume/reconnect signals such as returning online, focusing the app or bringing it back to the foreground.

Do not move the account sync lifecycle into one feature page unless an equivalent top-level lifecycle remains in place.

### 4. External OAuth must escape child views

The persistent child-view architecture creates an important exception to the normal “keep navigation inside the shell” rule.

Third-party authentication pages such as Google OAuth must **not** be navigated inside a child iframe. Google blocks authentication in that embedded context and the result on iPhone was a Google 403 page displayed underneath the still-visible PTCG Tools navigation.

OAuth therefore deliberately performs a **top-level navigation** away from PTCG Tools, then returns to the top-level application after authentication.

This is correct behaviour and must be preserved for future authentication providers or other external flows that prohibit iframe embedding.

## Architecture lock

Future feature work must preserve the persistent-navigation behaviour.

Do **not** casually return the five core areas to ordinary full-page navigation.

A future true shared-DOM/router shell is allowed and may ultimately be cleaner, but it must satisfy all of the following before replacing the current implementation:

1. already-loaded core areas remain immediately available;
2. routine section switching does not cold-start each feature;
3. feature state can be preserved across navigation;
4. measured/perceived iPhone performance is at least as good as the current shell;
5. the change is justified by product/technical value rather than framework modernisation for its own sake;
6. account/session sync retains an application-level lifecycle;
7. external OAuth can still navigate at the top level rather than being trapped inside a feature child view.

## Current performance status

After promotion, real iPhone use was reported as **much, much snappier to navigate**. A small number of hangs were still seen during initial warm-up/initialisation, but normal navigation after that was satisfactory.

The user explicitly considers current performance good enough and is happy to accept the remaining initialisation pause for now.

Therefore:

**The navigation-performance milestone is complete.**

Do not prioritise further performance work over product milestones unless the app develops a material user-visible regression as it grows.

## If performance work is reopened

Diagnose the category before changing architecture:

- **Initialisation cost:** first load/warm-up of Meta, Decks, Compete, etc.
- **Navigation cost:** switching between already-loaded sections.
- **Data cost:** network latency, cache misses, large JSON or parsing.
- **Rendering/main-thread cost:** synchronous analysis, DOM construction or layout.
- **Sync cost:** account reconciliation or local snapshot work competing with active interaction.

Measure before optimising. Do not assume every hang is caused by the network.

Likely future targets, only if needed:

- instrument transition and first-load timings;
- reduce Meta first-entry startup cost;
- make background warm-up adaptive so it never competes with active work;
- consolidate shared data/runtime caches;
- keep cloud reconciliation lightweight and asynchronous;
- eventually migrate from persistent child views to a true shared DOM shell if there is a clear benefit.

## Relationship to roadmap

Performance is no longer the next development focus. Product work should resume from the master roadmap around the broader Analyse → Build & Test → Prepare → Compete → Learn loop.

Account authentication and cross-device persistence are also now established foundations rather than an unfinished infrastructure milestone. See `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md` for the account/community/public-ready architecture.