# PTCG Tools — Meta V2 Architecture

> **Operational entry:** [CURRENT_STATE.md](../../../CURRENT_STATE.md) and the [calendar handoff](../../../handoffs/shared-format-calendar-consumers.md) track current implementation/acceptance. This is the main app Meta architecture; the separate `ptcg-meta-analysis` research repository does not own this feature.

**Status:** Current Meta runtime/data-delivery source of truth  
**Date:** 16 September 2026  
**Companion to:** `PTCG_TOOLS_MASTER.md`, `WHAT_SHOULD_I_PLAY_ARCHITECTURE.md`, `HOME_ARCHITECTURE.md`

## Current position

The Format/Rotation + Blended recovery programme is complete through Checkpoint 9 and remains owner-accepted. Do not reopen the forensic recovery programme without a concrete regression.

Meta uses one shared state/data/control contract across Current Meta, What Should I Play, Matchups, Deck Explorer and Deck Detail. Prediction Accuracy is a separate read-only consumer of the generated accuracy archive.

---

## 1. Shared ownership

### MetaState

`meta-core.js` owns selected evidence scopes.

No page-level script should introduce a second independent scope state.

### MetaData

`meta-core.js` owns source interpretation and exposes:

- scoped decks/field data;
- scoped matchups;
- results;
- source context/evidence counts/date details.

Pages render this evidence; they do not reinterpret Online or IRL independently.

### MetaControls

`meta-controls.js` owns reusable source/scope control semantics. Controls do not own navigation and must not intercept unrelated clicks.

### Shared engines

Meta consumes rather than duplicates:

- `MetaBlendedField` / shared blend logic;
- `PTCGMetaField` field semantics;
- `PTCGRecommendation` recommendation logic;
- `DeckSprites.html()` for deck/archetype identity;
- `PTCGFormat` for canonical date/environment format resolution;
- `PTCGFormatCalendar` / the published Formats & Sets registry as the shared maintained calendar authority.

---

## 2. Online / IRL / Blended semantics

Online and IRL are distinct evidence sources.

Blended is PTCG Tools' estimate of the genuine competitive field at a hypothetical major-quality tournament today/tomorrow, not a third H2H evidence source.

Settled-format weighting:

`IRL = max(30%, 70% - 2 percentage points × days since latest compatible IRL major weekend)`

`Online = 100% - IRL`

At least one compatible 50+ player Online event is required.

During Online/IRL legality splits, separate format-labelled Blended predictions may coexist. Old-format Online evidence freezes at the Online legality boundary; compatible later IRL evidence may update the old-format prediction according to the accepted transition rules. Rotation-incompatible IRL contributes zero to the new-format prediction.

No prediction silently substitutes incompatible or IRL-only evidence when minimum Online evidence is absent.

---

## 3. Format/calendar authority

The format resolver remains the one canonical authority for date/environment legality context.

Settings → Maintenance → Formats & Sets provides the maintained **published shared calendar** with independent:

- physical release date;
- Online legality date;
- IRL legality date;
- rotation/legal-regulation-mark state.

Individual card legality is based on each printing's own `regulationMark`, not inferred from whole-set marks.

### Runtime consumers

Home, Meta/Blended/WSIP, Event Prep and Card Search are wired through the shared runtime. Interactive browser consumers use the shared published registry first, then a validated last-known-good copy, then the checked-in bootstrap if necessary for availability.

The runtime must preserve:

- independent Online vs IRL dates;
- explicit unknown facts;
- actual event date for Event Prep;
- Saved Expected Field provenance;
- generation guards against late stale async context replacing current state.

### Production Meta generation

Scheduled Meta ingestion and release generation must use the same **published Formats & Sets registry** as the application. The production jobs explicitly opt into the published source before resolving ingestion boundaries or current Online/IRL identities.

Production generation is intentionally stricter than an interactive browser: if the published registry cannot be read or validated, the job must **fail closed** and retain the previously generated release. It must not silently publish a new Meta release from a stale checked-in bootstrap.

`data/formats/maintained-calendar.json` remains a bootstrap/emergency runtime fallback and deterministic local/test fixture. It is not a second production calendar that maintainers must manually keep in sync with Settings → Formats & Sets.

Do not recreate format logic inside Meta pages or generation scripts.

---

## 4. Navigation

`meta-router.js` is the sole Meta view owner.

Current routes are mutually exclusive:

- Current Meta;
- What Should I Play;
- Matchups;
- Deck Explorer;
- Prediction Accuracy;
- exact Deck Detail.

When embedded, the persistent shell owns browser history and Meta communicates via shell navigation messages. Standalone Meta may own its own history projection.

Source/scope changes rerender evidence only; they do not create sibling-view transitions.

Deck Detail must never reveal underlying sibling views through ordinary interaction.

---

## 5. Exact variants and family grouping

Variant grouping is presentation-only on Current Meta.

- families may group field share;
- Matchups, Deck Explorer, Deck Detail and WSIP remain exact-variant analytical surfaces;
- family metadata/field normalisation live in shared `meta-field.js`.

**Families describe the meta; variants play games.**

---

## 6. What Should I Play

WSIP consumes shared field vocabulary, MetaData evidence, Blended prediction and `PTCGRecommendation`.

Accepted flow:

**Field → Recommendations → direct exact-variant inspection**

Rules include:

- Blended / Online / IRL / Saved Expected Field inputs;
- five recommendations initially, then five more at a time;
- recommendation card opens exact detail;
- Why this deck? shows three best + three worst evidenced matchups;
- missing H2H remains unknown;
- evidence coverage/sample quality is explicit;
- Compare and Decide remain removed;
- event-specific planned-deck selection remains Event Prep-owned.

Public/global H2H remains separate from personal Game evidence. Future Personal Matchup Analysis may compare them side-by-side without merging the stores/evidence.

See `WHAT_SHOULD_I_PLAY_ARCHITECTURE.md`.

---

## 7. Event Prep boundary

Event Prep consumes the same canonical field/recommendation engines.

It owns event-specific Expected Field reaction, exact planned DeckVersion/list lock and Tournament Day handoff.

Event format resolution must use the **actual event date and environment**, never today's date as a substitute.

The planned Event Prep v2 extension should consume Practice Priorities derived from personal evidence after Personal Matchup Analysis exists.

---

## 8. Data release boundary

Normal browsers never ingest Limitless tournament result evidence directly.

Scheduled ingestion builds canonical archives and a content-addressed browser release under `v2-preview/data/meta/release/`. Before ingestion/release construction, production jobs resolve format context from the current published Formats & Sets registry.

`meta-release-loader.js` owns browser release discovery, checksum validation and last-known-good Cache Storage.

Heavy history/matchup/result payloads remain lazy-loaded.

Prediction Accuracy uses its separate generated archive/index and does not enlarge routine Home/Current Meta startup.

Do not restore retired browser-side ingestion/aggregate compatibility layers.

---

## 9. Rendering safety

No body-wide self-triggering `MutationObserver` loops for WSIP/Meta polish.

Prefer explicit lifecycle events and bounded/idempotent observers.

Do not alter data/release architecture merely to hide a presentation-layer render loop.

---

## 10. Retired architecture

Do not recreate superseded layers such as old Meta navigation, source-control mirrors, duplicate aggregation engines, legacy result-table stacks or browser-to-Limitless runtime ingestion.

Shared state/data/control, router, release loader and shared field/recommendation engines are the current architecture.

---

## 11. Deployment/validation rule

When behaviour/styling changes, deliberately bump relevant asset versions and verify iOS/PWA cache behaviour where applicable.

Smoke-test at minimum:

1. Online / IRL / Blended switching;
2. variant grouping + exact drill-down;
3. WSIP field/H2H changes, Saved Fields, recommendations and Why this deck?;
4. Matchups and Deck Explorer scopes;
5. Deck Detail source/scope and Back;
6. Prediction Accuracy lazy route;
7. Home → Meta / WSIP through persistent shell;
8. Back/Forward and reload restoration;
9. real iPhone startup for changes touching render lifecycle, service worker or data loading.

Calendar integration tests must cover published calendar loading, independent Online/IRL transition dates, production-generation source selection and Event Prep event-date resolution.

---

## 12. Current validation debt

At the PR #79 baseline the repository-wide suite reports **287 / 298 passing**. The same 11 failures were present on the immediately preceding #78 baseline. They cluster around the generated Meta release/calendar transition and dependent Blended, Event Prep/H2H, prediction archive, recommendation and WSIP expectations.

Repair the published-calendar production generation/release state first, then reconcile dependent assertions against the actual regenerated release. Do not weaken accepted Meta/WSIP contracts merely to make the current stale-release baseline green.

---

## 13. Current roadmap relationship

Meta/WSIP is not a broad active rebuild programme.

Shared browser consumer wiring and the published-calendar production-generation contract are merged. The remaining bounded work is operational: fix the production published-calendar read/auth failure, regenerate the release successfully, verify its calendar provenance/current formats and complete device acceptance.

After that, central product development moves to **Personal Matchup Analysis → Practice Priorities → Event Prep v2 → Deck Version Intelligence**, with Prediction Accuracy fitting delayed until enough genuine scored majors justify it.
