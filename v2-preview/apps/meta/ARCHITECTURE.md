# Meta V2 architecture

## Locked ownership

Meta uses one shared state/data/control contract across Current Meta, What Should I Play, Matchups, Deck Explorer and Deck Detail.

### MetaState
`meta-core.js` owns the selected evidence scopes:
- Online: `14`, `30`, `since-major`, `all` (`since-major` supports the shared current-field blend)
- IRL: `latest-weekend`, `all-irl`, `event:<id>`

No page-level script should introduce a second independent copy of these scope values.

### MetaData
`meta-core.js` owns source interpretation and exposes the evidence consumed by Meta surfaces:
- scoped decks / field data
- scoped matchups
- results
- source context (event count, entry count, scope label, update/date detail)

Pages render data; they do not independently reinterpret what Online or IRL means.

### MetaControls
`meta-controls.js` owns the reusable source/scope UI contract:
- Current Meta reuses its compact scope select for Online/IRL
- Matchups and Deck Explorer show exactly one subordinate scope matching the active source
- What Should I Play declares one field control and one H2H evidence control directly. It consumes the current shared source scopes and does not mirror them into hidden controls.
- Deck Detail renders its own source-matched scope control from `MetaState`

Controls do not own navigation and must not intercept generic clicks.

### Blended Current Meta
Current Meta also exposes a **Blended** presentation alongside Online and IRL.

Blended must consume `MetaBlendedField.current()` directly, using the same policy as the Home hero:
- IRL = latest IRL major weekend;
- Online = 50+ player events since that major weekend;
- IRL weight starts at 70%, decays by 2 percentage points per day and floors at 30%;
- Online receives the remaining weight;
- if only one source is available, that source becomes 100%.

Blended is a current-field presentation, not a third matchup/detail evidence source. Exact-variant drill-down remains Online/IRL and must not invent blended matchup evidence or blended deck-detail statistics.

### Navigation
Navigation remains separate from evidence state, with one owner at each boundary:
- `meta-router.js` is the only owner of the active Meta view;
- its route is a discriminated state: `current | prep | matchups | decks | detail`, where `detail` must also carry exact deck name, Online/IRL source and origin;
- the five view roots exist statically in `index.html`, and every route transition sets `hidden` and `inert` on all inactive roots before rendering the active root;
- child views use semantic hashes: `#prep`, `#matchups`, `#decks` (with existing What Should I Play aliases accepted on entry);
- `meta-explorer-v3.js` renders Deck Explorer, Matchups and exact-variant Deck Detail, but it never changes sibling visibility or browser history;
- exact-variant detail routes use `?deck=<exact variant>&source=<online|irl>&from=<origin>#detail`;
- when embedded, `persistent-shell.js` is the sole browser-history owner. Meta requests a route with `ptcg:shell-navigate`; the shell restores one with `ptcg:shell-apply-route` without reloading the iframe;
- when opened standalone, `meta-router.js` owns its own `pushState` / `replaceState` and Back/Forward projection;
- source and scope controls rerender evidence only. Detail source replacement may update the serialized route with `replaceState`, but never creates a view transition;
- shared data/control modules must not call `preventDefault`, `stopPropagation` or `stopImmediatePropagation` on unrelated page navigation.

Deck Detail is mutually exclusive with Current Meta / What Should I Play / Matchups / Deck Explorer by construction. Renderers cannot activate themselves, and no mutation observer rewrites section classes in the background.

Browser Back/Forward must restore Meta subviews/detail without changing evidence semantics. A shell reload of a routed Meta view must preserve the intended Meta child route rather than silently falling back to Current Meta. Ordinary interaction inside an open Deck Detail, including expanding/collapsing Data & performance and changing its source/scope controls, must never reveal or navigate to an underlying Meta view.

## Variant grouping
Variant grouping is presentation-only on Current Meta and defaults OFF.

Families can group Current Meta field share and expand inline. Matchups, Deck Explorer, Deck Detail and What Should I Play remain exact-variant analytical surfaces.

Canonical family metadata and field-row normalisation live in `../_shared/meta-field.js`, so Home and Meta do not maintain separate definitions.

## What Should I Play

WSIP consumes the shared field vocabulary, `MetaData` evidence, `MetaBlendedField` and the DOM-free `PTCGRecommendation` engine. Event Prep consumes the same field/recommendation engines for its shortlist. Missing H2H evidence remains unknown, small samples use the documented neutral prior, and only variants meeting the shared coverage/sample-quality rules receive ranks.

The accepted flow is **Field → Recommendations → direct exact-variant inspection**.

Accepted interaction rules:
- Blended, Online, IRL and Saved Expected Field remain the field inputs;
- selecting a Saved Expected Field applies it directly and the custom-field state is visibly distinct;
- show five recommendations initially and reveal five more at a time;
- the recommendation card itself opens exact variant detail;
- the collapsed card shows the covered-field estimate, evidence category, concise best/risk summary and **“H2H evidence against X% of field”** wording;
- expanding **Why this deck?** shows the three best and three worst evidenced matchups, with adjusted H2H rate, decisive-game count and expected field share;
- full matchup/methodology detail remains behind progressive disclosure;
- exact deck detail can evaluate against Blended, Online, IRL or actual named Saved Expected Fields and carry that field into WSIP;
- one- and two-Pokémon sprite identities must reserve enough width to avoid overlap.

**Compare is deliberately removed** from accepted WSIP. There is no Compare control, state or table. **Decide is deliberately removed** as a separate stage. WSIP recommends/explains; event-specific planned-deck choice remains explicit in Event Prep.

See `WHAT_SHOULD_I_PLAY_ARCHITECTURE.md` at the repository root for the scoring, uncertainty and full product contract.

## WSIP rendering safety

A September regression demonstrated that presentation-layer observers can freeze the whole Meta child even when the data/release architecture is healthy.

Rules:
- never use body-wide self-triggering `MutationObserver` loops for WSIP polish;
- prefer explicit lifecycle events such as `wsip:rendered`;
- if an observer is genuinely necessary, keep it bounded and idempotent;
- do not alter Meta release/startup architecture merely to mask a presentation-layer render loop.

The offending WSIP polish/reset observer loops were reproduced in browser runtime, removed/fixed and are now guarded by integration tests.

## Page hierarchy
Locked high-level hierarchy:
- Current Meta: purpose → source → scope → grouping → evidence summary → field → exploration
- What Should I Play: back → purpose → field/H2H sources → field → recommendations → Why this deck? → progressive methodology
- Matchups: back → purpose → source → scope → evidence summary → exact variant → matchup evidence → detail
- Deck Explorer: back → purpose → source → scope → evidence summary → exact variants → detail
- Deck Detail: back → identity → source → scope → headline stats → exact-variant evidence

## Evidence context
Evidence context confirms the current state; it is not another settings layer. It must be derived from the same `MetaData` request used by the rendered content.

## Data release boundary

Browsers never ingest Limitless tournament data directly. Scheduled GitHub Actions update the canonical source archives under `data/meta/`, then `scripts/build-meta-release.mjs` publishes one content-addressed browser release under `v2-preview/data/meta/release/`.

The release consists of a small manifest and purpose-specific files:

- `core.json`: source metadata, precomputed Online scopes, IRL event/field data and records links;
- Online history, matchup and result files;
- IRL matchup and result files.

`meta-release-loader.js` is the sole browser owner of release discovery, checksum validation and last-known-good Cache Storage. It activates a new release only after its core has been validated. `meta-core.js` reads that release and lazy-loads history/matchups/results only when the active view needs them.

Do not restore `CACHE`, `DATA`, `DeckAggregate`, `IRLLabs` or browser-to-Limitless compatibility globals. Shared public evidence is a generated GitHub Pages asset; Supabase remains the store for private per-account state.

## Retired layers
Do not recreate or re-add these superseded implementations:
- `irl-scope.js`
- `meta-consistency-v3.js`
- `meta-window-fix.js`
- `source-controls.js`
- `meta-scope-controls.js`
- `meta-detail-scope.js`
- `meta-navigation.js`
- `meta-explorer-v2.js`
- `meta-results-v2.js`
- `meta-table.js`
- `perf-shell/shell.js`
- `app.js`
- `meta-engine.js`
- `limitless.js`
- `live.js`
- `deck-aggregate.js`
- `irl-labs.js`
- `decklinks.js`
- `breakdown.css`
- mirrored hidden WSIP source controls and DOM relocation patches

## Deployment rule
Whenever behavior or styling changes, bump the relevant JS/CSS query version in `index.html`. Do not rely on the HTML URL query alone to invalidate iOS/PWA subresource caches.

Before calling a Meta change complete, smoke-test:
1. Current Meta Online, IRL and Blended switching
2. variant grouping off/on and exact variant drill-down
3. What Should I Play field/H2H source changes, Expected Field load/edit/save, direct card → exact variant navigation, Why this deck? best/worst matchups and five-at-a-time recommendation paging
4. Matchups source/scope and deck detail drill-down
5. Deck Explorer source/scope and deck detail drill-down
6. Deck Detail source/scope, Data & performance collapse/expand, Expected Field handoff, and Back
7. Current Meta back navigation and bottom app navigation
8. Home → Meta and Home → What Should I Play through the persistent shell
9. browser Back/Forward across Meta subviews and exact-variant detail
10. reload/restore of a shell-routed Meta child view
11. real iPhone/Home Screen startup when a change touches WSIP render lifecycle, service worker or Meta loading

## Current acceptance state — 6 September 2026

The Meta navigation and data-ingest/delivery architecture rework is **accepted and closed for the current product stage**, and the bounded WSIP rebuild/polish is also accepted.

Acceptance includes successful real-iPhone testing after the architecture rework and after the final WSIP changes. The current implementation is considered the canonical Meta runtime/data-delivery and WSIP interaction model:

- one `meta-router.js` navigation owner;
- one `MetaState` / `MetaData` / `MetaControls` evidence contract;
- scheduled central ingestion instead of browser-side Limitless tournament ingestion;
- canonical `data/meta/` archives;
- validated, content-addressed, purpose-split browser releases;
- small `core.json` for Home/current-field use;
- lazy-loaded history/matchup/result evidence;
- checksum validation and last-known-good local Cache Storage;
- shared Home/Meta blend calculation;
- on-demand top-level area loading rather than fixed startup warming of every area;
- WSIP Field → Recommendations → exact-variant inspection flow;
- Saved Expected Field handoff and clear custom-field state;
- best/worst matchup explanation and five-at-a-time paging;
- no Compare stage and no Decide stage;
- no body-wide self-triggering WSIP observer loops.

The relevant Meta/WSIP suite passed **37/37 tests** at final functional acceptance. Do not reopen Meta/WSIP as a broad roadmap programme unless a concrete correctness, navigation, ingest or usability regression is found. Routine upstream data refreshes are maintenance, not a feature milestone.
