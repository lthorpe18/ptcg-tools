# Format Registry / Blended Meta v2 recovery status

**Branch:** `format-registry-blended-v2-recovery`  
**Programme status:** Checkpoints 1–2 complete; Checkpoint 3 next
**Last updated:** 7 September 2026

This document is the durable checkpoint log for the recovery programme. Each
checkpoint must leave the branch coherent and committed. The candidate must not
be merged before real-iPhone acceptance and explicit approval.

## Checkpoint 1 — Prove the rolled-back baseline

### Inspected

- Latest `main` at `ccb30d70bec33a8974e775611dbb5a1085a55433`.
- Rollback commit `b26c53854781f550fe16f2c2b344b7e236fa3886`.
- Accepted pre-rollout commit `c3d9573234724930e02646f1c5fa414eb28ffc6a`.
- Master, performance, Home, account, Meta and What Should I Play architecture
  documents and the 5 September roadmap handoff.
- Persistent shell, Meta router/data/release loader, service worker and current
  Meta/WSIP enhancement layers.
- Deployed production app in the Work browser.

### Baseline identity

- `c3d9573^{tree}` and `b26c538^{tree}` both resolve to
  `ad81e5bd0fe871f010de9c12f784049f22faf342`.
- The checked-out `main` differs from the rollback only in eleven expected
  generated Meta archive/release JSON files. There are no post-rollback runtime
  or feature-code changes.
- The exact accepted runtime baseline is therefore the tree at `c3d9573` /
  `b26c538`, with current generated Meta evidence from `ccb30d7`.

### Browser validation

The deployed app was exercised through the persistent shell:

- repeated `Home -> Meta -> Decks -> Compete -> Tools -> Home` navigation;
- repeated Online / IRL / Blended switching;
- Deck Explorer and exact-variant Deck Detail;
- Data & performance expand/collapse;
- browser Back/Forward between Explorer and Detail;
- What Should I Play source switching and recommendation rendering;
- Why this deck? and methodology expand/collapse;
- Saved Expected Field creation and reload through the selector;
- reload while routed to the WSIP child view;
- rapid Meta-to-other-area navigation and return.

Observed result:

- all active frames settled with no `data-loading` marker;
- the shell loading status always became hidden;
- no app-origin warning or error appeared in the browser console;
- no Meta content rendered into another area;
- no frozen control, blocking overlay or stuck loader was observed;
- Meta contained 20 external scripts with no duplicate script URL in its
  document;
- all five child areas remained mounted after first load.

The Work browser available for this checkpoint reported a 1363 x 936 viewport
and did not expose viewport emulation. Responsive/mobile source constraints were
inspected, but a true 390px interaction pass was not possible in this browser
surface. The mandatory iPhone-sized and real-device gates remain explicitly
open for Checkpoint 11 and user acceptance.

### Automated validation

Command:

```text
node --test tests/meta-navigation.test.js tests/meta-release.test.mjs tests/recommendation-engine.test.js tests/wsip-integration.test.js tests/season-engine.test.js
```

Result: **38 passed, 0 failed**. The logged offline release-refresh error is the
intentional fixture for the last-known-good fallback test.

### Changes and issues

- No baseline runtime fix was required.
- No feature code changed in this checkpoint.
- The only committed change is this recovery checkpoint log.
- Broad `MutationObserver` usage still exists in some accepted enhancement
  layers. It did not reproduce a baseline failure here; its relevance to the
  failed rollout must be assessed in Checkpoint 2 rather than changed
  speculatively.

### Next checkpoint

**Checkpoint 2 — Forensic review of failed PR #4 / #5.** Inspect their complete
diffs and runtime implications, identify confirmed and plausible causes of the
iPhone freezes, record the unsafe patterns, and define the safer replacement
pattern before writing replacement feature code.

## Checkpoint 2 — Forensic review of failed PR #4 / #5

### Inspected

- PR #4 (`0a30b63`, 47 files, 1,675 additions / 194 deletions) and every
  feature-branch commit from `c3d9573` to `26626f1`.
- PR #5 (`1ed9b12`, 17 files, 162 additions / 23 deletions) and its eight
  correction commits.
- The final failed-rollout tree, including:
  - `format-runtime.js` startup, fallback, Supabase refresh and readiness;
  - `app-shell.js` dynamic dependency loading;
  - `meta-release-loader.js` runtime injection;
  - `blended-field.js`, availability and performance add-ons;
  - Meta router integration;
  - Home format/model enhancement;
  - Settings administration startup;
  - Event Prep format context and guard;
  - test/workflow coverage added by both PRs;
  - static asset query versions and service-worker interaction.

### Root-cause report

#### Confirmed causes

1. **Event Prep installed a self-triggering mutation loop.**

   `prep-format-guard.js` observed `#workspace` with
   `childList + subtree + characterData`. On every mutation it queued
   `applyGuard()`, which then replaced `textContent` / `innerHTML` for several
   descendants of that same observed workspace. While a format mismatch was
   active, each guard application created the next observed mutation. The
   resulting unbounded microtask chain could monopolise the main thread, stop
   frames rendering and make shell navigation/taps appear dead. This directly
   repeated the already documented self-mutating-observer failure class and was
   still present in the final PR #5 tree.

2. **Runtime changes were deployed without consistently changing their asset
   version URLs.**

   Several materially changed files retained existing query versions in one or
   more consumers. Important examples in the final rollout were:

   - `app-shell.js?v=7` in Home, Settings and Compete despite app-shell runtime
     changes in both PRs;
   - `meta-release-loader.js?v=1` in Home and Event Prep despite new format
     runtime injection and release-schema behaviour;
   - `blended-field.js?v=2` and `meta-router.js?v=1` in Meta despite new dynamic
     surfaces/routing behaviour.

   Navigation HTML being network-first does not refresh a browser-cached JS URL
   whose URL did not change. An installed iPhone/PWA could therefore assemble
   old and new runtime generations in one document. Examples include a router
   that knows the performance route with an old Blended wrapper that never adds
   its view, or an old shell with new feature HTML expecting shell-injected
   format code. This violated the repository's explicit subresource-versioning
   rule and explains device-specific inconsistent loading/runtime behaviour.

3. **PR #4 had two dynamic owners capable of injecting the format runtime in
   Home, with a selector that could not recognise the other owner's script.**

   `meta-release-loader.js` inserted `script[data-format-runtime]` while
   `app-shell.js` searched for a camelCase-derived `script[data-formatRuntime]`.
   `dataset.formatRuntime` serialises as `data-format-runtime`, so the selector
   did not match. Home loaded both the Meta release loader and app shell, making
   duplicate `format-runtime.js` execution and duplicate Supabase refreshes a
   real startup path. PR #5 corrected the selector/idempotency logic, but the
   unchanged `app-shell.js?v=7` references meant clients with a cached PR #4
   shell could continue running the broken loader after PR #5 deployed.

4. **The new readiness contract could remain pending indefinitely.**

   `format-runtime.js` created one `readyPromise`, immediately launched three
   Supabase REST requests in `Promise.all`, and supplied no timeout/abort path.
   The prepared-release fallback was assigned only in `catch`, so a request
   that remained pending never reached fallback and never resolved `ready()`.
   Settings initialization and both Event Prep format modules explicitly
   awaited this readiness. Their loading/config states therefore had no
   guaranteed failure exit under a stalled mobile request.

#### Likely contributing causes

- The supposed app-wide runtime was actually independently instantiated in
  several iframe documents (Home, Meta, Event Prep and Settings). Each instance
  owned its own state, promise, event stream and live Supabase refresh. This
  multiplied startup requests and made different mounted areas able to hold
  different config generations.
- Dynamic add-on loading had no `error` path. The prediction-performance view
  began as “Loading prediction evidence…” and depended on a dynamically added
  script defining `MetaPerformance`; a failed/mixed-generation script load
  could leave that placeholder indefinitely.
- `format-admin.js` awaited remote readiness before rendering its shared-config
  result and subscribed `init()` to the same config event emitted during that
  initial refresh. This created duplicate initialization/admin queries on a
  successful startup and amplified network work.
- `home-format-tools.js` could schedule several concurrent admin/review checks
  from initial execution, release readiness, format readiness and auth events.
  This was not the primary freeze, but added avoidable work during startup.
- Meta performance UI and Event Prep safety were added as post-render DOM
  enhancement/guard layers rather than being integrated into the owning render
  state. That increased race surface and made loading ownership ambiguous.

### Why automated green did not protect the rollout

- The Event Prep “test” checked for source-code tokens; it never executed the
  observer or rendered a mismatched event.
- Loader idempotency tests were regular-expression checks, not repeated script
  initialization in a document.
- No test held Supabase requests pending and asserted a bounded fallback.
- No browser test loaded mixed cached subresource generations.
- No end-to-end shell test navigated repeatedly while Event Prep's mismatch
  guard was active.
- PR #4 explicitly recorded that final real-iPhone acceptance had not yet been
  performed. PR #5's automated fixes did not close that gap.

### Failed patterns that must not be repeated

- Observing a subtree and rewriting that same subtree from the observer.
- Treating remote configuration as the gate for first usable render.
- Multiple modules independently injecting/owning the same runtime.
- Dynamic feature scripts without a settled success/error contract.
- Changing JS behaviour without bumping every live subresource URL that
  references it.
- Regex/source-presence tests standing in for runtime lifecycle tests.
- Implementing format correctness as a post-render disable/replace guard.

### Safer replacement pattern

- The prepared registry/formula snapshot is synchronously available first and
  is sufficient for navigation and initial feature rendering.
- One explicit format-state owner performs at most one deduplicated background
  refresh, bounded by timeout/abort, and always settles to ready/fallback/error.
- Consumers read state through a stable API and receive explicit change events;
  they do not inject or initialize their own copies.
- Event Prep resolves format in its state/data flow before field and
  recommendation rendering. A mismatch produces an ordinary explicit
  unavailable state while deck planning remains live; no observer is involved.
- Meta performance is a statically declared route/view or has one loader with
  explicit load/error completion. No indefinite placeholder is allowed.
- Every changed browser JS/CSS asset receives a deliberate query-version bump
  in every HTML/service-worker reference.
- Runtime tests must execute initialization twice, stalled/failed refresh,
  rapid navigation and mismatched Event Prep rendering—not merely inspect
  strings.

### Changes and issues

- No replacement feature code was written in this checkpoint.
- This root-cause report is the only checkpoint change.
- Live Supabase schema/RLS remains to be audited before replacement persistence
  decisions are made.

### Next checkpoint

**Checkpoint 3 — Design the replacement architecture.** Specify the single
owner, synchronous prepared fallback, bounded live refresh, lifecycle/events,
failure states, Event Prep contract and automation access path. Audit the
existing Supabase objects before committing that design.
