# PTCG Tools — Roadmap Handoff — updated 12 September 2026

**Status:** Current roadmap handoff; Format/Rotation + Blended recovery complete, Deck Results v1 complete, canonical sprite renderer unified app-wide
**Original handoff date:** 7 September 2026
**Updated:** 12 September 2026
**Supersedes:** `ROADMAP_HANDOFF_2026-09-05.md`
**Companion to:** `PTCG_TOOLS_MASTER.md`, `HOME_ARCHITECTURE.md`, `TOURNAMENT_DAY_ARCHITECTURE.md`, `WHAT_SHOULD_I_PLAY_ARCHITECTURE.md`, `v2-preview/apps/meta/ARCHITECTURE.md`, `PERFORMANCE_ARCHITECTURE.md`, `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md`

## 1. Current programme position

The major Format/Rotation + Blended Meta recovery programme is complete and owner-accepted through Checkpoint 9. Do not reopen PR #4/#5 or repeat the forensic recovery work unless a genuine new regression requires it.

Prediction Accuracy has the current scoring/history UI and retained prediction archive. Worlds remains honestly unscored because the archive starts after Day 1. Formula fitting/versioning is **not an automatic next step**: allow genuine scored compatible IRL majors to accumulate unless an early event exposes a structural formula flaw.

Since the original handoff, the owner completed a substantial bounded Decks/personal-results and visual-consistency pass:

- Deck Results v1 implemented;
- individual Deck tabs are now **Overview · List · Results**;
- Results supports **Archetype → Deck → Version** analysis;
- generic Odds remains Tools-owned rather than a Deck tab;
- Training/personal matchup evidence is now **game-level**;
- Tournament Day/Season competitive record remains **match-level**;
- tournament Games also feed personal deck/matchup learning without altering tournament Match W-L-D;
- Training Log excludes Tournament Day records while sharing the same canonical Match/Game store;
- personal evidence remains separate from public/global H2H;
- Results/Training were compacted into sprite-led mobile views with newest-first history;
- one canonical `DeckSprites.html()` renderer now owns deck/archetype visual identity across Home, Meta, Decks and Compete;
- two-Pokémon identities use one accepted treatment: dominant primary + circular secondary badge;
- Meta's old double-sprite spacing was tightened and pixel-art rendering sharpened.

Collection / physical readiness remains deferred. Do not begin Collection until the user explicitly reopens it.

## 2. Immediate next bounded feature — Settings → Formats & Sets

The owner has explicitly required a normal in-app way to maintain new set releases and their dates.

Current source of truth remains:

`data/formats/maintained-calendar.json`

It already models independent facts such as:

- set code/name;
- physical release date;
- Online legality date;
- IRL legality date;
- regulation marks;
- announced/confirmed status;
- optional rotation metadata.

The next bounded implementation should add **Settings → Formats & Sets** as the maintenance UI over this same shared format-calendar model.

Architecture locks:

- do **not** create a second Settings-only calendar;
- do **not** store global set/legal-date facts as ordinary per-user preferences;
- no automatic scraping is required;
- an authorised shared persistence/maintenance path should own writes;
- checked-in JSON may remain bootstrap/fallback where useful;
- the existing format resolver remains the consumer contract;
- Online and IRL legality dates remain independent;
- rotation remains distinct from ordinary release and applies according to the environment legality rules already accepted.

This is a bounded Settings/data-maintenance feature, not a general Settings redesign.

## 3. Personal-results architecture now locked

The app-wide evidence rule is:

**Personal learning = Games**  
**Tournament record / standings / completion / Season = Matches**  
**Public Meta H2H = separate global evidence**

### Deck Results v1

A saved Deck's Results page defaults to **Deck** scope and may switch to:

- **Archetype** — every canonically linked saved Deck explicitly classified as that archetype;
- **Deck** — all canonically linked evidence across versions/exact lists for that saved Deck;
- **Version** — one exact DeckVersion/list identity.

Results include game record/win rate, matchup breakdown, appropriate Deck/Version breakdown and recent Games. Tournament Match record may appear as secondary context but must not replace the game-level personal analysis.

Strict attribution remains mandatory. Do not guess historical Deck linkage from matching names/archetype labels if canonical IDs/list references do not prove it.

### Training Log

Training is game-level. A multi-game in-person entry may remain grouped as one editable session/entry, but its Games are the evidence units. PTCGL imports are naturally individual Games.

Training excludes Tournament Day records from the Training workspace. Tournament Games still remain usable by Deck Results/personal analysis through the shared evidence layer.

## 4. Canonical sprite architecture now locked

There is exactly one app-wide deck/archetype visual renderer:

`v2-preview/apps/_shared/deck-sprites.js` → `window.DeckSprites.html()`

It owns:

- defaults;
- Settings overrides;
- slug/source resolution;
- primary + circular-secondary composition;
- contextual sizing hooks;
- pixel-art rendering behavior.

Every deck/archetype identity surface must call this renderer. Feature pages may size/align the returned whole stack but must not compose two raw images independently.

The old Meta sprite entrypoint is compatibility plumbing only. Any future sprite bug should be fixed in the shared renderer or a consumer's container sizing, not by creating another renderer.

Regression-check at minimum:

- Home Blended hero and Deck preview;
- Meta Current list;
- My Decks/deck header;
- Training Log;
- Deck Results;
- My Events/Completed cards;
- Tournament Day selected deck and opponent rows.

## 5. Existing accepted product areas

The accepted top-level product remains:

**Home · Meta · Decks · Compete · Tools**

Settings is app-level.

Substantially established/current-stage complete:

- persistent shell/navigation;
- Home dashboard;
- Meta Online / IRL / Blended and format/rotation awareness;
- Expected Fields;
- What Should I Play;
- exact deck detail;
- Prediction Accuracy current UI/archive;
- Deck identity/version/listHash model;
- Card Search/Add Card;
- Mobile Playtest;
- Training Log;
- Deck Results v1;
- Event discovery and attendance;
- Event Prep v1;
- Tournament Day v1;
- Season v1 / 2027 CP+BFL;
- Tools: Cut / ID · Tournament · Odds;
- Google auth and per-account cloud snapshots.

Do not treat accepted areas as permanently frozen: bounded real-use bugs and architecture inconsistencies can still be fixed. Avoid reopening them as broad programmes without a concrete need.

## 6. Recommended sequence before Collection

After Settings → Formats & Sets, the strongest value sequence is:

1. **Personal Matchup Analysis** — build on existing game evidence rather than another store.
2. **Practice Priorities** — derive from expected field share × matchup difficulty × personal evidence, with sensible sample warnings.
3. **Event Prep v2 integration** — expected field + exact selected deck/list + concise practice priorities/readiness + Tournament Day handoff.
4. **Deck Version Intelligence** — exact card diffs, evidence by version and useful lineage/context.
5. **Compete → Online tournament discovery** — lightweight Limitless discovery only; no IRL Prep/Season lifecycle attached by default.
6. **Prediction Accuracy maturation/fitting** — once enough real scored majors exist to compare formula versions responsibly.
7. **Release Hardening / data safety** — duplicate helpers, cache/service worker, sync recovery, export/backup, installed-iPhone regression.
8. **Collection / physical readiness** — only after explicit owner decision to reopen it.

A broad generic UI/UX consistency milestone is no longer useful. Continue with concrete real-use findings as bounded fixes.

## 7. Online tournament discovery — retained design lock

Compete → Online remains a high-value bounded feature when scheduled.

It is lightweight Limitless discovery only, not the IRL Prep workflow. Tournament cards should show name, date, local start time, current field size where available, direct Limitless link and minimal useful format/style labels.

Default intent remains current Standard, Pokémon TCG Live, Online, next 7 days, joinable/live events where determinable, sensible evening-time filtering and soonest-first ordering. Do not attach Event Prep, Expected Fields, candidate decks, deck locking, venue data, participation lifecycle or Season/CP by default.

A later optional association from imported PTCGL results to an online tournament may be useful, but must not turn ordinary online events into Championship Series participation records.

## 8. Release-hardening debt retained

Before stable/public-ready release, perform a deliberate cleanup pass including:

- stale build/revision links;
- dead/hidden compatibility UI;
- duplicate feature-local render/domain engines;
- confirm only one DeckSprites composition implementation remains;
- Card Search bootstrap cleanup;
- move reusable GLC legality into shared card infrastructure;
- audit Playtest card-art helpers against `PTCGCardImages`;
- service-worker/cache-generation checks;
- asset version consistency;
- account export/backup validation;
- sync failure/recovery testing;
- current deployed SHA and installed-iPhone end-to-end regression.

Do not introduce a framework rewrite or database normalization project merely for tidiness.

## 9. Known current validation debt

The full repository suite currently reports one failing prediction-snapshot consistency assertion (`assert.ok(publication)`). This predates and is unrelated to the current Deck Results/sprite work; all newly added personal-results, Training and sprite-contract tests pass.

Do not ignore the failure indefinitely, but do not conflate it with unrelated bounded feature acceptance. Repair it in the appropriate Meta/prediction/release-hardening pass.

## 10. Operating rule

Use one bounded implementation scope at a time. Each pass should state:

- what it changes;
- what it deliberately does not change;
- the shared source of truth it consumes/owns;
- automated validation;
- real-device/browser acceptance where visual/mobile behavior changes.

If a shared engine exists, fix or consume that engine instead of adding another local implementation. This rule is now especially important for sprite rendering, Match/Game evidence, Meta fields/recommendations and format/calendar facts.

`PTCG_TOOLS_MASTER.md` and the updated companion architecture documents are the current product authority. Older checkpoint documents remain historical evidence and should not override the 12 September contracts above.
