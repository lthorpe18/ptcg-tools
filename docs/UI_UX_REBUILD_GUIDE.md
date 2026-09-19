# PTCG Tools — UI/UX rebuild guide

Version 1 · 19 September 2026 · Implementation programme and cross-workspace handoff

## 1. Purpose and authority

Rebuild the presentation and navigation of PTCG Tools into a distinctive, compact, coherent competitive companion. Preserve its shared data pipelines, identities, calculations and persistence contracts. The aim is a substantial new interface in the existing application repository, delivered through bounded, reviewable stages.

This guide records the direction established in this conversation. It is a planning deliverable, not a claim that the rebuild has been implemented, that Collection is live, or that existing data integrations are error-free. It does not authorize merging every future PR automatically.

**Latest visual decision:** a page hero is a shallow horizontal strip of real card artwork with the entity name overlaid. There is no separate title block underneath it. Version, format, card count, ownership and actions belong outside the artwork, only where useful. The deck list is the main element of a deck page.

Reference prototype: https://ptcg-art-study.lthorpe18.chatgpt.site

The prototype is an exploration, not production architecture. It has sample data, five featured cards rather than a complete deck, locally stored images and simplified interactions. Its latest published version still has a separate title block: the name-over-art decision in this guide supersedes that. Do not transplant its hard-coded data, direct asset sourcing, CSS overrides or miniature feature implementations into the real app.

### Evidence used

The local application checkout reviewed for this document is `lthorpe18/ptcg-tools`, commit `8fd9ad073068671da6ca6063f8a06b45856eaf6e` (PR #81 merge). Documents read: `CURRENT_STATE.md`, `PTCG_TOOLS_MASTER.md`, `ROADMAP_HANDOFF_2026-09-13.md`, `HOME_ARCHITECTURE.md`, `CARD_IMAGE_ARCHITECTURE.md`. Repository files can lag commits: CURRENT_STATE still describes #81 as open. This guide does not verify today's remote HEAD or production status. Check both at checkpoint 00.

Known issues recorded in those docs include published-calendar production generation, transition-sensitive failing tests, and outstanding device acceptance. Do not relabel old failures as successful or blame every failure on the redesign. The separate `ptcg-meta-analysis` repository remains a distinct research project.

### Decision categories

| Status | Meaning |
|---|---|
| Agreed direction | Art-led identity, compact content, restrained controls, sprites alongside card art, independent Decks and Collection, optional physical readiness |
| Latest explicit refinement | Hero = horizontal artwork + overlaid name only; main task appears immediately afterwards |
| Proposed implementation contract | Tokens, exact dimensions, route patterns, checkpoint sequence and component boundaries below; verify through implementation |
| Future feature design | General Collection, allocations and Kanto integration; prepare for these without silently shipping invented inventory functionality |

Checkpoint 00 should incorporate these distinctions into repository docs. The new requested UI programme supersedes the older instruction not to add a broad UI milestone; existing evidence, safety and domain contracts continue to apply.

## 2. Product principles

1. **Main task first.** Deck page: the list. Meta: the field and evidence. Event discovery: names and times. Tournament Day: current round and record. Collection: inventory or album.
2. **Earn every visible line.** Remove redundant labels before shrinking type. Collapse secondary information before introducing more vertical sections.
3. **Compact information, comfortable interaction.** Reduce containers and margins; preserve readable content and usable hit areas.
4. **Art gives identity.** A shallow, recognisable crop can distinguish a deck; it must not obscure the task or masquerade as evidence.
5. **One route per canonical object.** Home, Meta, decks, events and logs link to the same entities with context intact.
6. **One engine per concern.** New views consume current stores and resolvers. Presentation changes must not fork ETL, inventory, legality or results logic.
7. **Progressive disclosure is predictable.** Details stay accessible; users do not have to guess whether information was removed or hidden.
8. **State survives navigation.** Back returns to the same list, filters and position. Editing, account switching and history must work deliberately.

Avoid decorative quotations, slogans, dashboard boxes around every section, excessive pills, enormous headings, mock gauges, ornamental hero metadata and repeated navigation links. Do not confuse Pokémon card images with the generic rounded-container aesthetic we are avoiding.

## 3. Visual system

Use the approved prototype's restrained editorial direction: a light paper-like surface, deep green ink, fine dividing rules, controlled rust accent and vivid authentic card artwork. Retain modern sans-serif typography; a selective serif accent may distinguish a deck name, but is optional where space is tight.

### Initial tokens to validate

| Token | Starting specification |
|---|---|
| Canvas | `#F5F4EF` |
| Primary ink | `#192F31` |
| Deep artwork backing | `#183934` |
| Secondary text | `#647371`, subject to contrast checks at actual size |
| Divider | `#D5DBD3` |
| Accent | `#B84B29` |
| Spacing | 4, 8, 12, 16, 24, 32 px; large values only for real section boundaries |
| Phone gutters | 16 px initial target |
| Body / form fields | 16 px; no tiny inputs that trigger mobile zoom |
| Dense row labels | 14–16 px |
| Secondary metadata | 12–13 px; essential facts should not depend on tiny text |
| Section labels | 15–18 px; avoid stacked eyebrow + oversized heading |
| Corners | 3–6 px for ordinary controls/surfaces; full cards preserve their shape |
| Touch targets | Aim for 44 × 44 CSS px; visible controls can be smaller within that hit area |
| Motion | Brief state transitions; respect reduced motion; never repeatedly replace unchanged sprite/image nodes |

Use shared tokens and variants, not feature-local approximations. Desktop adapts by using columns and evidence tables, not by magnifying every mobile element. Dark mode can follow after the light system is accepted; do not double the initial scope unless already required by existing preferences.

### Hero specification

- Phone: full content width, approximately 100–140 px high as an initial target, adjusted to show the subject. This is a target, not a fixed clipping requirement.
- Name overlaid near the lower edge, using a restrained gradient/scrim for contrast. Target 22–28 px on phones; allow wrapping for long names without truncating their identity.
- No separate solid-colour title panel. No version eyebrow, explanatory subtitle, owned counts, giant button or duplicate deck name.
- Crop a real printing's illustration. Exclude card rules and header text where feasible. Use a focal point/crop preset tied to that printing; a universal percentage is not sufficient.
- On narrow screens retain a landscape composition. Never convert it into a narrow vertical slice beside the title.
- Fall back to a compact title with canonical sprites when art cannot resolve or cannot crop well. Image failure must not collapse layout or prevent interaction.
- Representative cover printing is a presentation preference. Changing it must not mutate deck contents, version identity or collection ownership.
- Hero is optional by screen. Dense lists, search and live-round entry generally need only a compact title.

### Art, full cards and sprites

| Surface | Image treatment | Reason |
|---|---|---|
| Deck detail / archetype detail | Shallow artwork title strip | Recognisable identity |
| Saved deck index | Compact sprite row; optional restrained art preview | Scan many decks quickly |
| Meta rankings / matchup rows | Canonical sprites | Preserve room for evidence and numbers |
| Deck list / search results | Exact-card thumbnail or complete-card gallery | Identify the selected printing |
| Card detail | Full uncropped card, zoom available | Read the actual card |
| Event page | Event identity first; selected deck artwork only when useful | Avoid decorative event banners |
| Collection album / goals | Full printings; art-led goal cover where appropriate | Printing identity is central |
| Home | At most one modest artwork emphasis | Keep the dashboard concise |

Production must use `PTCGCardImages` from `v2-preview/apps/_shared/card-images.js`, whose documented direction is Limitless TPCI → TCGdex → stable fallback. Reuse `DeckSprites.html()` from `v2-preview/apps/_shared/deck-sprites.js`, including existing user overrides and primary/secondary composition. The prototype's PokéAPI assets are not a new production sprite contract. Reuse existing caching; no random/session image cache-busting. Reserve dimensions and lazy-load off-screen images.

## 4. Navigation and ownership

Target mature navigation: **Home · Meta · Decks · Compete · Collection**. Five clear destinations are acceptable. Settings remains app-level. Card Search is a shared discovery capability with global access and contextual Add Card entry; it is not restricted to deck ownership or collecting.

| Area | Owns | Contextual links |
|---|---|---|
| Home | Derived next actions and concise summaries | Exact deck, next event, scoped Meta, recent game |
| Meta | Online/IRL/Blended field, archetype evidence, expected fields, What Should I Play, prediction accuracy | Save/import a list; prepare for an event; inspect exact evidence |
| Decks | Digital deck projects, working lists, immutable versions, playtest, deck-specific personal results | Card Search/Add Card, filtered Game Log, physical readiness |
| Compete | My Events, event discovery, event workspace, Game Log, Season | Exact used deck/version, expected field, calculators |
| Collection — future | Physical copies, allocations, Wanted, goals/albums | Deck readiness, exact card, Kanto 151 goal |
| App utilities | Card Search, standalone Odds, Cut/ID, Tournament Manager, settings | Also exposed at relevant points of use |

Move the global Game Log to Compete while retaining deck-filtered Results in Decks. Preserve old deep links through a route adapter or redirect. Tournament Manager is a standalone organiser tool, distinct from a player's event workspace.

**Before Collection exists:** ship four useful primary destinations and an app-level utility menu if the five-area future shell is otherwise ready. Reserve the Collection route and navigation extension point in code. Do not show a dead tab, pretend the Kanto tracker is a complete inventory, or ship a fake empty Collection page. This transitional choice is a recommendation to ratify at checkpoint 01.

### Cross-page route contracts

Paths below are logical examples; adapt them to the existing router. Do not force a routing framework change to match their spelling.

| Journey | Required identity/context | Back behaviour |
|---|---|---|
| Meta field → archetype | environment, format, period, grouping, exact archetype/variant, release where relevant | Restore field filters and scroll |
| Public list → personal deck | exact public list and provenance; explicit create/import action | Public source remains available; reading alone never creates a deck |
| Deck → version → results | Deck ID, immutable version ID/listHash, personal evidence filters | Return to selected version/tab |
| Deck results → Game Log | Deck/Version filter and evidence scope | Restore results scope |
| Game Log → tournament game | canonical game/match and participation IDs | Return to filtered log position |
| Event discovery → My Events | discovery identity becomes durable participation through existing attendance flow | Saved participation survives feed expiry |
| Event → selected deck | planned or actually used exact version, explicitly distinguished | Return to the same participation/workspace stage |
| Deck → readiness → Collection | deck context, required quantities, allocation scope | Return to unchanged digital deck |
| Card Search → Add Card | target Deck ID and chosen exact printing | Return to list; preserve search until dismissed |

Every interactive row must have a clear destination. Avoid nested clickable surfaces with ambiguous behaviour. Missing external URLs produce disabled/absent actions, never a link back to the current page. External links use appropriate browser behaviour; local navigation stays in the single app shell. Deep-link reloads, invalid IDs and deleted entities need explicit recovery paths.

## 5. Page-by-page information hierarchy

### Home

A concise competitive overview, adapting to available state: active/upcoming participation, current working deck, brief field summary and recent activity. If no event exists, do not leave a giant empty event panel. The order should favour the immediate task and be ratified with populated and empty examples. Home owns no calculations. Move the old dominant Meta hero into a compact evidence summary with a scoped link. Do not show broad destination cards duplicating the bottom bar.

### Meta field and archetype detail

Visible first: source/environment, format and period in one compact context row, then ranked field entries with meaningful counts/shares. Filters occupy one toolbar and an expandable filter surface. Show update/freshness context without filling the top with methodology.

Archetype detail: optional shallow art/name strip, compact evidence scope, then observed performance, matchups and recent results. Tables/rows link to their supporting detail where available. Keep public H2H, predicted performance and personal results explicitly separate. Preserve exact variants vs grouped families. A sample of zero is not 0% performance; a failed load is not an empty dataset. Prediction history/methodology remain discoverable under Meta, not permanent banners on every screen.

### Deck index and deck workspace

Index: saved deck rows, sprite identity, compact useful status, search/sort and one clear create/import action. Deck names and stable IDs remain separate concepts.

Deck workspace: minimal back/context control → artwork with overlaid name → compact list toolbar → actual complete deck list grouped into Pokémon, Trainers and Energy. Put count/version in the toolbar only where needed. Avoid a second heading saying “Inside the deck”. On phones the first rows should be visible immediately, without scrolling past ownership, results or explanatory text.

Support Gallery and List without changing the underlying deck. Use the last explicit view preference if available; initial compact List is the current prototype direction, subject to acceptance with a real 60-card deck. Counts remain visible and unambiguous. Tap a card for full exact printing; editing is a clear mode/action with intentional quantity controls. Preserve import, export, save, validation, version creation, playtest and results.

Versions, Results and Playtest are compact local destinations, not a stack of panels above the list. Physical readiness is an optional collapsed row below the primary list or in a clearly labelled secondary panel. Test discoverability in long decks; do not hide it behind an unexplained overflow icon.

### Card Search and card detail

Search input and relevant filters first; image-led results immediately after. Same results component in independent Search and contextual Add Card. The latter explicitly names the target deck and shows quantity/add feedback. Card detail shows the full printing, useful metadata and relevant actions. Choosing alternate art must not silently substitute a non-equivalent card or ignore legality context.

### Playtest

Preserve current board/state semantics and gestures. Controls should support the activity without crowding the table. Reuse shared card images and deck identity. Check hand access, zoom/inspect, reset confirmation and return to the exact deck/version. Do not redesign the playtest engine as part of visual consolidation.

### Compete and events

My Events prioritises current and upcoming attendance; past events remain accessible. Find Events separates Nearby, Majors and Online with compact discovery controls. Online preserves future-only default behaviour, essential tournament name/time, local timezone context, Standard/PTCGL defaults, time filtering, refresh/retry and durable attendance.

A single event workspace has appropriate Prepare, Play and Review states. These consume one participation rather than creating disconnected pages. Planned list and actual played version are visibly distinct. In Play, current round/record and score entry dominate; decorative art is minimal or absent. Review links matches to canonical game evidence and exact used version. Preserve dropped/unknown facts, legitimate edits and Season calculations without inventing missing data.

Global Game Log provides compact chronological entries, filters and clear training/tournament provenance. Season shows useful progress with expandable rules and breakdowns. Public performance is not blended into personal records.

### Utilities and Settings

Put Cut/ID at the event decision point, Odds near deck/playtest tasks and Card Search wherever discovery is needed. Keep standalone access in one discoverable utility menu. Preserve Tournament Manager workflows. Settings remains a compact hub with Account & Sync, Preferences, Data/backup and authorised Maintenance. Maintenance must not become visible merely because a new menu was built.

## 6. Collection and Kanto 151: future integration contract

Design for this now; implement it as a separately accepted feature after the existing app is stable. A digital deck never requires owned cards. Do not gate editing, saving, versions, recommendations or playtesting on collection setup.

### Quantity semantics

- Owned: copies that satisfy the requirement under an explicit matching policy, regardless of allocations elsewhere.
- Available for this deck: unallocated compatible copies plus copies already allocated to this deck; exclude copies committed elsewhere.
- Cap each contribution at the required quantity before summing; do not count surplus copies as filling other requirements.
- `52/60 owned`, `47/60 available` implies 8 not owned and 5 owned but committed elsewhere; 13 unavailable without moving cards.
- Expanded detail distinguishes buy/acquire needs from transfer needs and identifies the other decks holding copies.
- Separate exact-print preferences from playable-equivalence matching. Reuse canonical legality/equivalence knowledge; do not match by display name alone.
- Allocation is an explicit user action. Saving a digital deck must never reserve inventory automatically.

Logical entities should separate inventory quantities, allocation records, goal membership and wanted requirements. A goal references the same physical inventory; it does not create additional copies. Needed purchases across multiple decks require explicit planning semantics to avoid duplicate recommendations.

Kanto 151 eventually becomes **Collection → Goals → Kanto 151**, preserving its distinctive album experience, selected printings, Wanted/Owned state, filters and export. Existing boolean Owned status must not be silently treated as an authoritative quantity or allocation. Plan a previewable, repeatable migration with backups, source IDs and conflict handling. Keep the direct-link app intact until migration is verified; add a compatible redirect only after acceptance. Never make copied Kanto records a second inventory database.

## 7. Architecture and migration approach

Keep the application in `lthorpe18/ptcg-tools`. Introduce the new UI through an isolated preview route or feature flag in that repository. Maintain the existing production UI during staged work. Do not copy ETL into a fresh project, reconnect a second backend, or use this standalone Sites prototype as the production foundation.

Checkpoint 00 makes the concrete shell/framework decision after inspecting current code. Default to reusing the current stack. A framework migration needs a demonstrated benefit and a bounded proof of compatibility; it is not a prerequisite for a new interface.

Create a thin presentation layer over shared engines/stores: deck store, canonical Match/Game evidence, participation state, format/calendar, Meta release runtime, card catalog/images, sprites, Season and calculators. New view models may reshape data for display; they may not recalculate domain facts independently.

Define shared presentation primitives: AppShell, PageHeader, ArtworkHeader, ContextBar, SectionToolbar, DataRow, CardRow/CardGallery, SpriteIdentity, Disclosure, EvidenceSummary, FilterSheet, CardInspector and standard Loading/Empty/Error states. Names are illustrative. Use accessible existing primitives where available. Have one navigation owner, one account context and one route registry. Never embed the app shell recursively or reserve bottom-navigation height twice.

Future features slot into existing owners: personal matchup analysis in Deck Results, practice priorities in Results/Event Prep, version intelligence in Versions, accuracy maturation in Meta, collection readiness through an optional adapter. Core deck code must work when no Collection capability exists.

Preserve all IDs, list hashes, snapshots and storage keys unless a separately designed migration is essential. Old and new UI must not write incompatible schema revisions to the same store. Snapshot restore, account switching and rollback are release gates, not later clean-up.

## 8. Work programme: one bounded checkpoint per workspace

Run checkpoints in order unless the status ledger explicitly permits independent work. Each workspace starts from the latest accepted repository state, not an old downloaded archive. One checkpoint may need multiple chats; continue the same branch and handoff rather than restarting. A preview can be implemented while a data issue is tracked separately, but affected production workflows cannot pass acceptance with that issue unresolved.

### 00 — Reconcile baseline and establish the rebuild contract

**Work:** inspect current remote HEAD, active PRs, AGENTS instructions and current docs; inventory all routes and existing actions; identify shared dependencies; record baseline failures and production concerns; reconcile this guide with old navigation/roadmap docs. Decide preview isolation and framework approach. Create the rebuild status ledger and decision log.

**Deliver:** current feature/route parity matrix, documented architecture decision, updated planning docs and precise next checkpoint. No feature redesign yet.

**Accept:** every existing capability has a future owner; no issue silently declared fixed; latest hero and collection boundaries recorded; no data store duplicated.

**Workspace brief:** “Execute checkpoint 00 of the attached UI/UX rebuild guide. Reconcile current source, docs and open work; establish a safe preview strategy and complete parity inventory. Finish with a bounded checkpoint 01 brief.”

### 01 — Shared design system and app shell

**Work:** tokens, typography, density rules, reusable controls, one navigation shell, route/context/back contract, safe areas and account/settings entry. Agree transitional navigation before Collection exists. Build a compact component specimen using realistic long labels and states.

**Deliver:** preview shell and shared primitives, with no fake live data.

**Accept:** phone and desktop layouts work; navigation and refresh are coherent; keyboard/focus and text enlargement work; no double shell or duplicate bottom bar.

**Workspace brief:** “Execute checkpoint 01 only. Build the reusable visual system and preview shell from the accepted contract; validate density and navigation before porting features.”

### 02 — Real deck workspace: the reference implementation

**Work:** connect an actual saved deck and full list; implement artwork/name-only hero, compact toolbar, list/gallery, inspector and established editing/save/import/export actions. Secondary information must not displace the list. Do not show fabricated owned counts when inventory is unavailable.

**Deliver:** one complete new deck workspace using current domain services.

**Accept:** real 60-card list; first rows visible on phone entry; long names and missing art; correct save/undo/error behaviour where supported; no ID/version mutation from art selection; existing actions retained.

**Workspace brief:** “Execute checkpoint 02 only. Make the real deck list the primary surface and use the shallow artwork strip with name overlay. Prove existing deck behaviour and mobile density before expanding.”

### 03 — Deck index, Card Search and version navigation

**Work:** saved deck index, create/import entry, shared Search/Add Card, full card detail, version browser and existing diffs where implemented. Wire origins/back state. Reserve future version-intelligence extensions without inventing them.

**Accept:** independent Search and contextual Add Card work; exact printing and quantity preserved; immutable version stays immutable; browser Back restores origin; no lost edits.

**Workspace brief:** “Execute checkpoint 03. Complete the Decks discovery/build/navigation loop using checkpoint 02 components and current card/version engines.”

### 04 — Deck Results, Game Log relocation and Playtest presentation

**Work:** reuse personal evidence, move global log navigation to Compete, retain deck/version filtered results, unify row/detail links, adapt Playtest controls/art resolver without changing game state logic.

**Accept:** Games and Matches remain distinct; public H2H remains separate; training edits and tournament navigation correct; duplicate evidence not created; Playtest starts/returns to the intended list.

**Workspace brief:** “Execute checkpoint 04. Connect the personal learning and playtest flows, preserving all canonical evidence and deck-version identities.”

### 05 — Meta field and detail

**Work:** compact field controls/rows, exact archetype detail, observed evidence, linked matchups/results, loading/failure recovery and stateful Back. Use one current Meta release/context.

**Accept:** environment/format/period preserved; variants and families remain distinct; no endless loaders; no data becomes zero on failure; real evidence drill-down works. Recheck the previous exact-detail loading regression.

**Workspace brief:** “Execute checkpoint 05. Rebuild Meta field/detail presentation and its deep links; preserve provenance, scope and shared calculations.”

### 06 — Recommendations, expected fields and accuracy

**Work:** present existing What Should I Play, expected-field selection and prediction accuracy in the same design system. Answer first, evidence next, methodology on demand. Keep research/formula changes separate.

**Accept:** recommendation inputs and coverage are clear; archived predictions remain immutable; future and observed data are not mixed; contextual event/deck links retain scope.

**Workspace brief:** “Execute checkpoint 06. Integrate existing recommendation and accuracy surfaces visually without altering the prediction formula.”

### 07 — Event discovery and My Events

**Work:** compact event lists, Nearby/Majors/Online discovery, filters, durable attendance and next-event navigation. Reuse existing source classification and refresh contracts.

**Accept:** future Online name/time discovery; timezone boundaries; default time filters; refresh on return; expired feed does not erase participation; broken registration URL has no misleading action.

**Workspace brief:** “Execute checkpoint 07. Rebuild discovery and attendance presentation, preserving current feed freshness and participation behaviour.”

### 08 — Event workspace and Season

**Work:** connect existing Prepare/Play/Review as one event journey; expose exact planned/played version, round entry, completion/correction and Season. Integrate calculators at relevant moments.

**Accept:** real event can be prepared, played, reviewed and corrected; saved results survive navigation/reload; Games/Matches remain correct; missing player count/placement stays unknown; Season unchanged for identical evidence.

**Workspace brief:** “Execute checkpoint 08. Deliver the full event journey using one participation and current evidence/Season engines. Prioritise live-round usability.”

### 09 — Home, utilities and Settings integration

**Work:** compose Home from the now-migrated destinations; adaptive next actions; compact field/deck/event summaries; utility access; settings/auth/sync/backup/maintainer pages. Reconcile every old entry point with its replacement.

**Accept:** populated and first-use Home useful; no duplicate computations; every existing tool discoverable; settings permissions respected; account switching clears stale private state.

**Workspace brief:** “Execute checkpoint 09. Finish Home and global utility/settings integration, closing all navigation gaps in the parity matrix.”

### 10 — Complete journey acceptance and production cutover

**Work:** compare parity matrix to implementation; test actual browser viewports and installed phone; verify performance, stale caches, account/sync/export recovery and old links. Update release generation/service-worker strategy through existing mechanisms. Prepare reversible switch and rollback.

**Accept:** no unaccounted regressions; baseline failures explicitly resolved or dispositioned; critical production integration issues closed for affected journeys; owner acceptance recorded; source, merge and deployment states separately known.

**Workspace brief:** “Execute checkpoint 10. Verify complete user journeys, prepare the reversible production cutover and provide evidence for approval. Do not treat code completion as mobile acceptance.”

### 11 — Collection design and migration specification (future gate)

**Work:** inventory/allocation matching policy, capability boundary, Kanto record audit, quantity semantics, migration preview and rollback design. Confirm that general Collection implementation is now intended before starting it.

**Accept:** exact-print vs equivalent-card policy explicit; deck remains digital-first; Kanto boolean states are not guessed into quantities; independent inventory, goals and allocations model validated with examples.

**Workspace brief:** “Execute checkpoint 11 as design/specification only. Define Collection and Kanto migration over shared card identity; do not migrate or rewrite user records.”

### 12 — Collection implementation and Kanto integration (future feature)

**Work:** deliver inventory/Wanted/goals, real optional deck-readiness adapter, explicit allocations and reviewed Kanto migration. Activate Collection navigation when useful functionality exists.

**Accept:** 52/60 and 47/60 example works at per-card level; moving copies updates both decks correctly; digital saves reserve nothing; goals do not duplicate inventory; migration can be previewed, repeated safely and rolled back; existing Kanto users retain data and access.

**Workspace brief:** “Execute the accepted checkpoint 12 implementation scope. Connect Collection, deck readiness and Kanto goals without creating duplicate card inventory.”

## 9. Mandatory acceptance for every UI checkpoint

Check proportionately; do not run hundreds of unrelated tests for cosmetic spacing. Use domain regression tests where data/state risks exist. Browser verification is essential for layout work—CSS parsing does not demonstrate a good phone layout.

- Inspect at 390 CSS px portrait, a narrower 360 px case and desktop; add actual owner phone/installed-app acceptance for milestone surfaces. Check large text/200% zoom and landscape where relevant.
- Verify the primary content appears early. On deck entry, the artwork header plus toolbar must leave useful card rows visible in an ordinary phone viewport. Do not count ChatGPT's preview/share chrome as app UI, and do not rely on hiding browser chrome to pass.
- Real complete data: a 60-card deck, many saved decks, long names, enough rows to scroll, multiple versions and sample-size variation. No five-card mock list as final acceptance.
- Confirm no horizontal page overflow, clipped quantity controls, obstructed bottom actions or duplicate safe-area padding.
- Verify tap/keyboard access, focus return from dialogs, Escape where appropriate, selected/expanded states and non-colour-only statuses.
- Test loading, empty, partial, error, offline/last-known-good and retry states at the feature's actual boundaries.
- Navigate cross-feature and Back; reload deep links; inspect invalid/missing IDs; confirm scroll/filter state retention.
- Check identity and writes: no accidental deck creation, allocation, evidence duplication or changed historical version.
- Verify stable image dimensions, fallbacks, no flashing on unchanged updates, no duplicate large fetches and no image-driven layout jumps.
- Log what was actually checked. “Implemented”, “tested”, “merged”, “deployed” and “accepted on device” are separate statuses. If browser access is unavailable, say so and leave visual acceptance pending.

Production cutover additionally requires account/cloud restore, backup/export roundtrip, service-worker update behaviour and rollback verification. Do not weaken failing tests to make a redesign appear clean.

## 10. Durable cross-workspace operation

### Proposed repository documentation

At checkpoint 00, add this guide as `docs/UI_UX_REBUILD_GUIDE.md` and create:

- `docs/UI_UX_REBUILD_STATUS.md`: one authoritative checkpoint ledger, active work and exact continuation.
- `docs/UI_UX_ROUTE_PARITY.md`: old route/action → new owner/route → implementation and acceptance status.
- `docs/UI_UX_DECISIONS.md`: concise decisions, reasons and superseded alternatives.
- `handoffs/ui-ux/CP-XX.md`: bounded checkpoint brief and completion evidence.

Update CURRENT_STATE and master/architecture docs only where the accepted design or implementation changes their contract. Do not leave two documents claiming conflicting current navigation. Keep historical docs labelled historical rather than deleting evidence.

### Status row template

| Checkpoint | Branch / PR | Source SHA | Implemented | Tests | Preview/deploy | Device acceptance | Next action |
|---|---|---|---|---|---|---|---|
| CP-XX | Exact refs | Exact SHA | Pending/partial/done | Evidence + known failures | Exact URL/state | Pending/accepted + date | One concrete step |

### Start-of-work procedure

1. Read applicable AGENTS instructions, CURRENT_STATE, rebuild status and the selected checkpoint handoff.
2. Verify remote HEAD, branch/PR status and local changes; retain ongoing work rather than opening a duplicate branch.
3. Read only relevant architecture docs plus this design contract.
4. State the bounded outcome and identify existing engines/components to reuse.
5. Implement the checkpoint, verify proportionately and document any unresolved evidence.
6. Finish the authorized scope. Ask only when a material product decision or genuinely unauthorized action blocks completion.

### Completion handoff template

```text
Checkpoint:
Repository / branch / PR:
Base SHA and final SHA:
Implemented:
Shared components or engines reused:
User-visible changes:
Tests and browser/device evidence:
Known failures (baseline vs new):
Data/schema implications:
Merged / deployed / device-accepted status (separate):
Preview URL:
Docs updated:
Remaining work / blockers:
Exact next action:
Rollback:
```

Never finish with “continue where we left off” as the only instruction. Preserve the active branch, exact object identities and smallest next action. A new chat should not need to reconstruct decisions from dozens of messages.

### Universal new-workspace prompt

```text
Continue the PTCG Tools UI/UX rebuild in lthorpe18/ptcg-tools.
Execute checkpoint [XX] only, using docs/UI_UX_REBUILD_GUIDE.md,
docs/UI_UX_REBUILD_STATUS.md and the relevant handoff as the brief.
If the guide has not yet been committed, use the attached guide and begin CP00.

First inspect applicable AGENTS instructions, current remote main, active PRs,
CURRENT_STATE.md and relevant architecture documents. Reuse any active branch
for this checkpoint. Do not assume an old chat's SHA is still current.

Preserve shared engines, IDs, immutable versions, account persistence,
Games-vs-Matches and personal-vs-public evidence boundaries. Keep the new UI
inside the existing app repository. Do not copy or rebuild ETL.

Design contract: compact mobile working surfaces; real card art plus canonical
sprites; shallow horizontal artwork with name overlaid only; deck list first;
secondary info progressively disclosed; consistent shared controls and routes.
The prototype is a visual reference, not implementation code or live data.

Complete the bounded checkpoint, verify relevant behaviour and actual layouts,
and record the handoff and exact next step. Report implementation, tests,
merge, deployment and device acceptance separately. Do not claim mobile
acceptance without observing it. Prepare reviewable changes; merge or switch
production only when authorized in this session.
```

## 11. Definition of the finished rebuild

The same app capabilities are available through a coherent interface; the main task dominates every page; compact mobile layouts are verified with real content; contextual links preserve identity and state; shared components prevent drift; data engines and account records remain intact; future learning and collection features have explicit places to live; the rollback route works; the documentation identifies exactly what shipped and what remains future work.

The immediate next action is **checkpoint 00**, followed by a real deck workspace as the visual and interaction reference. This document does not change the application or its prototype.

