# Meta V2 architecture

## Locked ownership

Meta uses one shared state/data/control contract across Current Meta, What Should I Play, Matchups, Deck Explorer and Deck Detail.

### MetaState
`meta-core.js` owns the selected evidence scopes:
- Online: `14`, `30`, `all`
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
- What Should I Play shows only the Online and/or IRL scopes required by its selected field and matchup sources
- Deck Detail shows the scope matching its active Online/IRL source

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
Navigation remains separate from evidence state:
- `meta-home.js` owns Current Meta / child view navigation
- child views use semantic hashes: `#prep`, `#matchups`, `#decks` (with existing What Should I Play aliases accepted on entry)
- `meta-explorer-v2.js` owns exact-variant drill-down / deck detail rendering
- exact-variant detail routes use `?deck=<exact variant>&source=<online|irl>&from=<origin>#detail`
- `meta-navigation.js` keeps detail/subview intent synchronized with browser history and the outer persistent shell
- the persistent shell remains the sole owner of top-level Home / Meta / Decks / Compete / Tools history and preserves child-route intent when switching areas
- shared data/control modules must not call `preventDefault`, `stopPropagation` or `stopImmediatePropagation` on unrelated page navigation

Browser Back/Forward must restore Meta subviews/detail without changing evidence semantics. A shell reload of a routed Meta view must preserve the intended Meta child route rather than silently falling back to Current Meta. Ordinary interaction inside an open Deck Detail, including expanding/collapsing Data & performance and changing its source/scope controls, must not reset the Meta view to Current Meta.

## Variant grouping
Variant grouping is presentation-only on Current Meta and defaults OFF.

Families can group Current Meta field share and expand inline. Matchups, Deck Explorer, Deck Detail and What Should I Play remain exact-variant analytical surfaces.

## Page hierarchy
Locked high-level hierarchy:
- Current Meta: purpose → source → scope → grouping → evidence summary → field → exploration
- What Should I Play: back → purpose → field/matchup sources → required scopes → evidence summaries → expected field → recommendations → checker → advanced settings
- Matchups: back → purpose → source → scope → evidence summary → exact variant → matchup evidence → detail
- Deck Explorer: back → purpose → source → scope → evidence summary → exact variants → detail
- Deck Detail: back → identity → source → scope → headline stats → exact-variant evidence

## Evidence context
Evidence context confirms the current state; it is not another settings layer. It must be derived from the same `MetaData` request used by the rendered content.

## Compatibility boundaries
Some older analysis code still consumes `CACHE`, `DATA`, `DeckAggregate` and `IRLLabs`. `meta-core.js` is the only permitted compatibility boundary for keeping those consumers aligned while they are incrementally migrated.

Do not create new wrappers around these globals elsewhere.

## Retired layers
Do not recreate or re-add these superseded implementations:
- `irl-scope.js`
- `meta-consistency-v3.js`
- `meta-window-fix.js`
- `source-controls.js`
- `meta-scope-controls.js`
- `meta-detail-scope.js`

## Deployment rule
Whenever behavior or styling changes, bump the relevant JS/CSS query version in `index.html`. Do not rely on the HTML URL query alone to invalidate iOS/PWA subresource caches.

Before calling a Meta change complete, smoke-test:
1. Current Meta Online, IRL and Blended switching
2. variant grouping off/on and exact variant drill-down
3. What Should I Play field source, matchup source and required scope visibility
4. Matchups source/scope and deck detail drill-down
5. Deck Explorer source/scope and deck detail drill-down
6. Deck Detail source/scope, Data & performance collapse/expand, and Back
7. Current Meta back navigation and bottom app navigation
8. Home → Meta and Home → What Should I Play through the persistent shell
9. browser Back/Forward across Meta subviews and exact-variant detail
10. reload/restore of a shell-routed Meta child view
