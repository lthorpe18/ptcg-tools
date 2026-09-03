# PTCG Tools — Performance Architecture

**Status:** Current production source of truth  
**Date:** 3 September 2026

## Purpose

This document records the performance decisions established during the September 2026 app-performance pass and the subsequent Mobile Playtest performance consolidation. It is a companion to `PTCG_TOOLS_MASTER.md`, `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md` and `PLAYTEST_ARCHITECTURE.md` and should be consulted before changing global navigation, caching, app-shell behaviour or Playtest rendering.

## Problem observed

On iPhone/home-screen use, the app could sometimes feel very fast and at other times hang for several seconds when moving between major areas.

The key finding was that the principal problem was **cross-page full-document navigation**, not general rendering slowness. Moving around inside an already-loaded Meta page was usually responsive; the largest stalls occurred when switching Home / Meta / Decks / Compete / Tools because each navigation destroyed the existing document and rebuilt the destination page, scripts and data state.

A later Playtest-specific regression reproduced the same underlying class of problem at a smaller scope: interaction helper layers used `location.reload()` after tabletop mutations. Safari then destroyed/recreated the whole Playtest document and visible card images, producing slow-looking image reloads and visible card-art popping. This reinforced the same architecture principle: **ordinary interaction should update state/render in place rather than restart the document.**

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

### 5. Mobile Playtest in-place rendering

Mobile Playtest initially accumulated helper/enhancement layers that persisted mutations and then called `location.reload()` to make the UI reflect the new state.

On iPhone this caused visible card art to disappear/reappear or “pop” during normal tabletop play, even where images were already cached.

The fix consolidated Playtest interaction layers onto the existing core mutation/render path:

**mutate → push Undo snapshot → change state → persist → clear selection → render in place**

Current architecture lock:

- ordinary Playtest actions must not reload the document;
- enhancement/completeness layers call the core Playtest API rather than maintaining a second reload/Undo path;
- grouped actions such as Hand multi-select remain one core mutation / one Undo step;
- turn advance + automatic start-of-turn draw remains one core mutation;
- card/zone state changes should re-render the relevant Playtest UI without top-level navigation.

This applies to actions including markers, prize taking, Hand bulk/multi-select actions, direct discard/deck/lost moves, damage controls, attachment/evolution management, Stadium replacement, Deck shuffle/draw and Deck-search destination movement.

### 6. Mobile Playtest image-loading policy

The Playtest performance pass also separated immediately visible art from secondary/search thumbnails.

Eager-load card images that are immediately visible in the main interaction surface:

- Hand;
- Active;
- Bench;
- Stadium;
- visible Prize inspection where appropriate.

Keep secondary/search/list thumbnails lazy-loaded where appropriate, including long Deck-search/zone lists.

The objective is not “load every image immediately”; it is to prevent the primary tabletop from looking unstable while keeping secondary lists economical.

### 7. Mobile Playtest cache-busting

Playtest had repeated stale-asset issues on iPhone because Safari/service-worker state could retain older generations of Playtest HTML/JS/CSS.

Current solution:

- every fresh Playtest launch receives a `_pt=<timestamp>` token;
- `playtest-v2.html` propagates `_pt` to local Playtest CSS/JS;
- the service worker explicitly bypasses `_pt` Playtest assets/navigation rather than stripping/normalising the token;
- card images remain normally cacheable;
- a fresh launch from Decks naturally creates a fresh token.

Do **not** return to manual `?v=` iteration as the normal Playtest asset-refresh strategy.

An outer Decks/shell `?v=` bump may still be used as a deliberate one-time cache transition where required.

Do not describe this system as “cache-proof”; verify iPhone behaviour after cache-sensitive changes.

### 8. Playtest / persistent-shell viewport boundary

The visible five-item bottom navigation is owned by the **outer persistent shell**, not by Playtest.

Playtest therefore must not reserve another internal app-nav height. Doing so previously created a blank band between the fixed Hand tray and the real shell navigation.

Current rule:

- the shell already bounds the child Playtest viewport above the outer nav;
- Playtest Hand fixes to the bottom of its own viewport;
- Playtest does not load/own a duplicate global bottom nav;
- its mobile zone dock remains hidden.

This is both a layout and performance/state-ownership boundary and should not be casually changed.

## Architecture lock

Future feature work must preserve the persistent-navigation behaviour.

Do **not** casually return the five core areas to ordinary full-page navigation.

Do **not** reintroduce full-page reloads as the normal Playtest interaction mechanism.

A future true shared-DOM/router shell is allowed and may ultimately be cleaner, but it must satisfy all of the following before replacing the current implementation:

1. already-loaded core areas remain immediately available;
2. routine section switching does not cold-start each feature;
3. feature state can be preserved across navigation;
4. measured/perceived iPhone performance is at least as good as the current shell;
5. the change is justified by product/technical value rather than framework modernisation for its own sake;
6. account/session sync retains an application-level lifecycle;
7. external OAuth can still navigate at the top level rather than being trapped inside a feature child view;
8. Playtest ordinary interactions remain in-place and Undo-consistent;
9. Playtest cache-busting continues to defeat stale local Playtest code without disabling useful card-image caching;
10. the outer shell remains the sole owner of the five-item global mobile navigation.

## Current performance status

After promotion, real iPhone use was reported as **much, much snappier to navigate**. A small number of hangs were still seen during initial warm-up/initialisation, but normal navigation after that was satisfactory.

The later Playtest card-art popping regression was traced to page reloads and corrected by moving interaction helper layers to the core render path. Subsequent user testing reported the Playtest behaviour as good.

Therefore:

- **the navigation-performance milestone is complete**;
- **the Mobile Playtest rendering-performance regression is resolved for the current stage**.

Do not prioritise further performance work over product milestones unless the app develops a material user-visible regression as it grows.

## If performance work is reopened

Diagnose the category before changing architecture:

- **Initialisation cost:** first load/warm-up of Meta, Decks, Compete, etc.
- **Navigation cost:** switching between already-loaded sections.
- **Data cost:** network latency, cache misses, large JSON or parsing.
- **Rendering/main-thread cost:** synchronous analysis, DOM construction or layout.
- **Sync cost:** account reconciliation or local snapshot work competing with active interaction.
- **Playtest mutation cost:** unnecessary full renders, reloads or repeated image-element reconstruction during tabletop actions.
- **Playtest asset freshness:** Safari/service-worker serving stale Playtest CSS/JS rather than a runtime performance problem.

Measure/diagnose before optimising. Do not assume every hang is caused by the network.

Likely future targets, only if needed:

- instrument transition and first-load timings;
- reduce Meta first-entry startup cost;
- make background warm-up adaptive so it never competes with active work;
- consolidate shared data/runtime caches;
- keep cloud reconciliation lightweight and asynchronous;
- eventually migrate from persistent child views to a true shared DOM shell if there is a clear benefit;
- consolidate older Playtest helper layers once acceptance testing proves behaviour is stable, without changing the settled interaction contract.

## Relationship to roadmap

Performance is no longer the next development focus. Product work should resume from the master roadmap around the broader Analyse → Build & Test → Prepare → Compete → Learn loop.

Account authentication and cross-device persistence are established foundations rather than unfinished infrastructure milestones. Mobile Playtest v1 is also now considered feature-complete pending acceptance/cleanup testing rather than a reason to keep extending the Build & Test milestone.

See `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md` for account/community boundaries and `PLAYTEST_ARCHITECTURE.md` for the complete current Mobile Playtest contract.