# Format Registry / Blended v2 replacement design

**Status:** Checkpoint 3 design; implementation has not started  
**Date:** 7 September 2026  
**Scope:** Shared format registry, Blended v2, Event Prep, prediction evidence,
and Settings administration. The accepted persistent shell and its navigation
remain unchanged.

## Safety invariant

Format configuration is an enhancement dependency, never a navigation or
first-render dependency. Home, Meta, Decks, Compete and Tools must remain
navigable while Supabase is slow, unavailable or returning invalid data.

No consumer may inject the format runtime, await a remote-config readiness gate
before becoming usable, or maintain a second interpretation of format legality.

## Ownership and module boundary

There is one format owner per top-level browsing context:

- In the persistent application, `v2-preview/index.html` statically loads the
  format core and runtime before `persistent-shell.js`. The runtime instance is
  stored on the top window and is the only instance allowed to fetch, cache or
  publish live format state.
- An embedded same-origin feature document obtains a small facade over
  `window.top`'s instance. It never starts a second refresh.
- A feature page opened directly has no parent owner, so the same idempotent
  bootstrap creates one local owner for that standalone browsing context.
- Re-evaluating bootstrap code returns the existing owner. It does not add
  listeners, create a second promise or repeat the initial request.

Two statically declared shared files form the boundary:

1. `format-registry-core.js`: DOM-free UMD code containing the prepared registry,
   validation, date-only parsing, Online/IRL resolution and stable reason codes.
   Browser code and Node automation/tests execute this same core.
2. `format-registry-runtime.js`: browser lifecycle, last-known-good storage,
   bounded public-config refresh and subscriptions. It owns no feature DOM.

Consumer HTML declares these dependencies explicitly, with one versioned URL.
There is no dynamic script/style injection and no loader hidden inside Meta,
`app-shell.js` or a release loader.

## State and API contract

The public runtime exposes a read-only snapshot and methods with stable return
shapes:

```text
getState() -> {
  phase: "prepared" | "cached" | "live" | "degraded",
  registryVersion,
  source,
  checkedAt,
  lastLiveAt,
  errorCode,
  registry
}

resolveFormat({ channel: "online" | "irl", date: "YYYY-MM-DD" }) -> {
  available,
  formatId,
  lowerSetCode,
  upperSetCode,
  channel,
  effectiveDate,
  registryVersion,
  reason
}

subscribe(listener) -> unsubscribe
refresh({ reason }) -> bounded Promise<state>
```

`getState()` and `resolveFormat()` are synchronous from the first script
execution. Returned objects are defensive copies or frozen values. Subscribers
receive one explicit state-change notification only when the effective snapshot
changes; subscribing does not install global DOM observers.

`refresh()` deduplicates concurrent calls. Its promise always settles, but no
general feature startup awaits it. Invalid arguments and unresolved formats
return explicit reason codes rather than silently selecting another channel or
date.

Dates are parsed as calendar dates, not browser-local timestamps. Online and IRL
legality are resolved independently from the same ordered set records. Rotation
uses `rotationLowerSetCode` beginning on that channel's legality date.

## Startup, fallback and refresh order

Startup is deliberately usable before network work:

1. Validate and install the prepared registry bundled with the core.
2. Read the local last-known-good record synchronously. Accept it only if it
   passes the same strict schema validation and is newer than the prepared
   version. Reject a same-version/different-payload conflict as an integrity
   error; never downgrade.
3. Publish the initial state synchronously as `prepared` or `cached`.
4. Start one background refresh after bootstrap without delaying shell setup,
   frame mounting, controls or navigation.
5. Fetch one atomic public configuration document with `AbortController` and a
   short fixed timeout. Validate the entire response before replacing state.
6. If valid and not older, replace state atomically, persist it as last-known
   good, mark `live`, and notify subscribers once.
7. On timeout, network failure, authorization failure or validation failure,
   retain the current usable snapshot, mark `degraded`, record a bounded error
   code and settle the request.

The owner may refresh on explicit admin success, a later `online` event, and a
restored `pageshow` when its freshness interval has expired. These hooks are
installed once. Visibility changes and feature navigation do not independently
start requests.

The cache stores only validated public configuration plus its version,
fingerprint and confirmation time. It contains no session or admin data. A
schema-versioned key permits safe invalidation.

## Supabase audit and disposition

The surviving `PTCG Tools V2 Auth` project was audited read-only. Migration
`20260906163159_add_format_and_blended_config` created the following objects:

| Object | Current state | Decision |
| --- | --- | --- |
| `ptcg_admins` | 1 row; RLS; self-read policy | Reuse as the database admin boundary. |
| `ptcg_format_registry_versions` | 2 published immutable-in-practice rows; v2 completes CRI dates | Reuse data/table; harden draft/publish semantics and validate payloads. Highest published version is live. |
| `ptcg_blended_formula_versions` | published `blended-v1` and `blended-v2` | Reuse history; harden immutability and fixed-policy validation. |
| `ptcg_blended_live_formula` | singleton points to `blended-v2` | Reuse as the live formula pointer. |
| `ptcg_blended_formula_activations` | 1 audit row | Retain for audit, but remove unnecessary public base-table exposure. |
| `ptcg_blended_review_state` | empty; owner-scoped RLS | Reuse for per-user review acknowledgement. |
| publish/activate RPCs | invoker functions with explicit admin checks | Replace with narrowly granted, transaction-safe RPCs; remove historical formula reactivation. |

RLS is enabled on every table and current policies use `auth.uid()` plus the
admin table for writes. Effective anonymous reads expose only published registry
and formula rows, the live formula pointer and activation history. The Supabase
security advisor reported no table/RLS finding.

The schema nevertheless needs a forward-only hardening migration before it is a
safe production contract:

- Revoke broad default table privileges. `anon` currently has all table
  privileges, including `TRUNCATE`, on these objects; RLS does not govern
  `TRUNCATE`. Grant only the operations each API path needs.
- Revoke default/PUBLIC and `anon` execution on admin RPCs; grant execution only
  to `authenticated`, with the admin allowlist checked inside each RPC.
- Stop public clients reading base configuration/audit tables. Add one
  argument-free, stable public-config RPC that returns only the active published
  registry and formula fields, without creator/administrator identifiers.
- Make direct draft updates require the resulting row to remain `draft`.
  Publication happens only through a locked transaction-safe RPC. Add database
  enforcement that published version rows cannot be updated or deleted.
- Formula publication accepts changes only to mature start weight, daily decay
  and floor. For v2-and-later publications it verifies the fixed 25% previous
  format cap and rotation-aware transition policy.
- Remove `activate_blended_formula`: historical formula rows are never directly
  reactivated. “Draft from this” inserts a new draft, which may later be
  published as a new version.
- Keep review state owner-scoped and grant only its required select/insert/update
  operations.
- Add the foreign-key indexes identified by the performance advisor where they
  support retained query/audit paths.
- Commit all forward migrations to the repository. The surviving migration
  exists in Supabase migration history but not in the rolled-back Git tree, so
  the recovery must restore reproducible schema history without copying failed
  browser runtime code.

The public-config RPC provides one PostgreSQL statement snapshot, so registry,
formula and live pointer cannot be assembled from different request moments. It
uses fully qualified names, a fixed empty search path, explicit safe-field JSON,
least-privilege execution grants and no caller-controlled SQL.

This design follows current Supabase guidance that exposed tables use RLS,
privileges remain least-privilege, `auth.uid()` checks be explicit, and any
security-definer helper be tightly scoped and locked down. It also accounts for
the 2026 Data API exposure changes; exposure and grants will be explicit rather
than inherited from project defaults.

## Browser lifecycle and persistent shell

The accepted five-frame shell remains untouched structurally. The format owner
does not mount frames, change active sections, intercept links, set shell loading
markers or register the service worker. `persistent-shell.js` remains the sole
owner of those behaviours.

The format runtime never changes shell controls into a waiting state. A
feature-specific surface may render a brief local “checking for updates” hint,
but it must already have either prepared/cached content or a settled unavailable
state. Every such hint has explicit success, degraded and unavailable endings.

Service-worker rules treat every changed JS/CSS URL as a new versioned asset.
All HTML and `CORE` references must be bumped together in the same checkpoint.
The prepared core and browser runtime use the same version generation, preventing
mixed owner/client contracts on a previously installed iPhone PWA.

## Feature access contracts

### Meta and What Should I Play

Meta reads the current Online and IRL format from the runtime; it does not infer
legality from whichever release JSON happened to load. Every evidence payload
declares a `formatId`. Blended and WSIP compare that ID with the resolved target
before using the payload. Saved Expected Fields preserve format ID, registry
version and, when Blended, the complete Blended provenance object.

### Event Prep

Event Prep resolves `{ channel: "irl", date: event.startDate }` in its own state
flow before selecting field or recommendation evidence. Its derived analysis
state is one of:

- `available`: evidence format exactly matches the event-date format;
- `unavailable:no-matching-field`;
- `unavailable:no-matching-matchups`;
- `unavailable:format-unresolved`.

Unavailable analysis renders ordinary explicit copy in steps 1 and 2. Step 3,
personal deck selection, notes, saving and Playtest remain usable. Render
functions own these states directly; no post-render guard, subtree observer or
text replacement is permitted.

### Blended v2

The DOM-free Blended engine receives resolved registry state and explicit Online
and IRL evidence. It targets only the current Online format, requires qualifying
current-format Online evidence, applies the locked transition/rotation rules,
and returns a discriminated available/unavailable result with full provenance.
It never substitutes the IRL format for a missing Online target.

### Prediction automation

Node automation imports `format-registry-core.js`, so it uses the identical
validation and calendar-date resolver as the browser. At a forecast cutoff it
loads the same atomic public-config document, records its registry/formula
versions and fingerprint, and validates event timezone, qualifying Online
evidence and Blended availability before writing anything.

If timezone cannot be resolved safely, config cannot be validated, or Blended is
unavailable, the run records a skipped reason and creates no fake observation.
Later evaluation freezes only after complete Day 1 coverage is explicitly
confirmed; `Unknown` remains in the denominator.

## Failure matrix

| Failure | Runtime result | User-visible effect |
| --- | --- | --- |
| Supabase request stalls | Abort at fixed deadline; retain prepared/LKG; `degraded` | Navigation and existing feature content remain usable. |
| Supabase is offline | Retain prepared/LKG; retry only on bounded lifecycle signal | No global loading screen or disabled shell controls. |
| Remote payload is malformed/older | Reject atomically; retain current snapshot | Feature may show stale/degraded provenance, never partial config. |
| Core/runtime script fails to load | Static dependency failure is visible in console; consuming analysis settles unavailable | Other shell areas and navigation do not depend on it. |
| Embedded page initializes twice | Existing top owner/facade returned | No duplicate request, event hook or listener. |
| Evidence format differs | Consumer returns explicit unavailable analysis | Event/deck planning remains usable; no silent substitution. |
| Prediction timezone/completeness unknown | Snapshot/evaluation skipped with reason | No UTC fallback and no misleading score. |

## Verification gates

Implementation checkpoints must add executable tests for:

- Online/IRL boundary dates and rotation lower bound;
- invalid, stale and conflicting cached/live payloads;
- two initializations sharing one owner and one request;
- a forever-pending fetch settling by timeout;
- offline startup from prepared and cached states;
- embedded facade versus standalone owner;
- repeated shell navigation during failed refresh;
- Event Prep mismatch with planning controls still enabled;
- complete Blended transition/rotation/Online-only provenance cases;
- prediction cutoff timezone and complete-Day-1 gates;
- every changed asset URL matching HTML and service-worker declarations.

Each browser-bearing checkpoint repeats the five-area shell stress pass. The
final candidate additionally requires an iPhone-sized automated pass and the
user's real-iPhone acceptance before merge.

## Implementation sequence

1. Checkpoint 4: core resolver, prepared registry, single browser owner,
   hardening/public-config migration, and registry-only consumers/tests.
2. Checkpoint 5: DOM-free Blended v2 engine and provenance.
3. Checkpoint 6: Meta/WSIP integration and saved provenance.
4. Checkpoint 7: Event Prep state-flow integration.
5. Later checkpoints: prediction capture/evaluation, Settings admin, Home
   shortcut verification, regression/performance gates, pull request and
   real-device handoff. No merge occurs without explicit user instruction.

