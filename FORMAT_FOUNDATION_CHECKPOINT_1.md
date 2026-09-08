# Checkpoint 1 — Format/Rotation foundation review

**Status: Checkpoint 1 merged and accepted; PR #6 `14fe13b`, subsequent navigation repair PR #7 `94bc077`. Owner confirmed all six navigation retest steps pass. Checkpoint 2 has not begun.**

Latest preserved main: `30e669a` (8 September data refresh). Accepted specification: `df51755`, amended by the user's 8 September instructions below. No applicable `AGENTS.md` exists in this checkout. No failed PR was restored/cherry-picked and no existing application script, HTML, CSS, service worker or source payload was edited.

## Agreed simplification — 8 September

The owner will maintain infrequent set/rotation facts manually. No scraping, automatic date derivation, administration interface or exhaustive card-legality system is required.

The current calendar is `data/formats/maintained-calendar.json`, explicitly **user-maintained**, not independently verified:

- current Standard: H–J, earliest set TEF, latest PBL;
- 30C Online legality: 15 September 2026;
- 30C IRL legality: 24 September 2026;
- 30C release date, next rotation and releases after 30C: unknown.

The baseline is asserted as of 8 September, not the invented start of this format. Unknown historical dates and the exhaustive set roster remain unknown. Completing that history is no longer treated as a blocker to using the owner-supplied current format context. A list containing only TEF/PBL must never be advertised as the complete legal-set roster.

For a later rotation set, record `rotation: {lowestMark, regulationMarks, earliestSet}` on the set. Rotation applies independently at that set's Online/IRL legality dates. `earliestSet` can remain absent if only the new lower mark is known. Release remains a separate date; rotation can therefore occur without a tabletop release that day. The ordinary 30C entry has `rotation: null`.

## Shared API and boundaries

`v2-preview/apps/_shared/format-resolver.js` remains the one opt-in, synchronous, DOM-free owner. It has no fetches, implicit clock, observers, storage mutations or production consumers.

```js
const Format = require('./v2-preview/apps/_shared/format-resolver.js');
const calendar = require('./data/formats/maintained-calendar.json');
const resolver = Format.create(calendar);
const answer = resolver.resolve('2026-09-15');
const event = resolver.resolveEvent({date: '2026-09-15', environment: 'irl'});
```

For the maintained calendar, each environment exposes:

- `formatContext`: the maintained label, stable `contextId`, regulation range, baseline reference, additions, latest sets, source and unknowns;
- `maintainedBoundary`: lowest mark and earliest set;
- `scheduledSets`: explicit environment admission states/dates;
- `nextScheduledChange`: next known dated additions/rotation, retaining simultaneous changes and undated-order blockers;
- `nextRotation`: the next scheduled rotation, or explicit unknown.

Use `formatContext.contextId` for the maintained calendar identity. It is independent of environment and effective date once both environments have adopted the same changes. It identifies the maintained format context, **not** an exhaustive enumerated card pool. Compact labels are never individual-card/deck legality proof.

The lower-level explicit registry API is retained for independently verified historical evidence and synthetic tests. Its `format.id` remains null when exhaustive catalog/exception information is absent; `legalSets`/`releasedSets` enumerate registered facts only. Do not confuse these lower-level coverage flags with the known owner-maintained boundary. In particular, an empty `releasedSets` in the maintained seed means no exact release facts supplied, not that no sets have been released.

`data/formats/verified-seed.json` remains an optional partial historical evidence pack, not the current calendar. `tests/fixtures/format-synthetic.json` is an invented universe, not factual seed data. No production entrypoint loads any of these assets yet.

Dates use strict, inclusive `YYYY-MM-DD` event/environment calendar days. Viewer timezone cannot change them. Timestamps/Date objects and missing event dates are rejected instead of using today. This is day-level, not intraday Live availability. Results are deeply frozen and retain revision/provenance; later edits do not rewrite captured results. Saved-field integration remains a later checkpoint.

## Validation

`node --test tests/*.test.js tests/*.test.mjs`: **68/68 pass** (28 foundation cases, 40 existing). `git diff --check` passes. An expected offline warning comes from an existing deliberate failure fixture.

Cases cover independent release/admission/rotation, before/at/after boundaries, simultaneous additions, rotation without release, missing dates/history/boundaries, explicit event/first-major dates, four-timezone parity, immutable results, schema/source validation, the actual maintained 30C transition, synthetic set-linked rotation and unknown next rotation. No weights or Blended implementation was added.

Browser checks ran against the local checkout including latest main. Dependency-free `package.json` QA commands and `tests/browser/serve.cjs` preserve the working static preview setup: `npm run dev` serves the checkout, `npm test` runs the tests, and `npm run report:format` prints the report. No installation or production build is introduced. In Work, use the supervised preview with this checkout as its root, not a wrapper root or symlink. `tests/browser/format-foundation.html` provides a reproducible 1100px/390px sizing wrapper, actual shell reload button and clearly synthetic attending-event fixture. It must run only on a fresh local test origin/profile, never a signed-in production session.

| Check | Result |
|---|---|
| Home fresh load and populated chart, desktop/390px | Pass |
| Online → IRL → Blended repeated source changes, desktop/390px | Pass; distinct data renders |
| Home ↔ mounted Meta, retained deck detail | Pass |
| Exact-deck detail entry and shell deep reload, desktop/390px | Pass |
| Browser Forward and direct top-level deep reload | Pass |
| Attending-event Prep loads field, shortlist and plan controls, desktop/390px | Pass using synthetic fixture |
| Prep Adjust controls, leave/return, 390px deep reload | Pass |
| Browser Back from first exact-detail route to bare Meta route | **Existing failure**, described below |
| Actual iPhone/Home Screen | Not tested; no new visible UI to accept in this checkpoint |

### Existing navigation finding — separate bounded fix

On the app opened directly (not just inside the sizing wrapper): Home → Meta → Dragapult detail; wait for the serialized detail URL; browser Back. The URL returns to `?section=meta`, but the Dragapult detail remains visible instead of Current Meta. Forward and reloading the fully serialized detail URL work. The same initial symptom also appeared in the 390px/desktop wrapper.

The current shell's popstate handler has no explicit child route in the bare Meta history entry and falls back to its retained latest route. This is consistent with the observed failure. The shell/router files are byte-identical to latest main, and the new resolver is not loaded by the app. This is not caused by the foundation. No navigation fix is included because this checkpoint preserves visible application behaviour.

The owner explicitly accepted this existing browser Back issue as non-blocking on 8 September: passing in-app navigation is sufficient for Checkpoint 1. The failure remains recorded; it is not claimed as a passing test. No navigation fix is required for this checkpoint.

## Review and next action

Review this isolated foundation and the maintained calendar results. The unknown 30C release date is a legitimate explicit unknown, not a reason to guess or scrape. The user may supply it later.

PR #6 is merged. A subsequent Compete freeze was repaired in PR #7; the owner confirmed all six navigation retest steps passed on 8 September. See `COMPETE_NAVIGATION_FIX_2026-09-08.md` for that separate repair and deferred feedback. No exact deployed SHA was independently captured. Stop at Checkpoint 1; no Home/Meta integration, Blended, administration/fitting, individual deck legality or Collection work was performed.

## Reproducible date report

Run `node scripts/report-format-foundation.mjs`. Its first table is the current user-maintained calendar. The second is historical/synthetic acceptance evidence and must not override the maintained calendar.
## User-maintained current calendar
Dates supplied by the project owner; not independently verified. Unknown release/history data remain unknown.
| Date | Online format | IRL format | Lowest mark / set | Next Online / IRL scheduled change | 30C release |
|---|---|---|---|---|---|
| 2026-09-08 | TEF-PBL | TEF-PBL | H / TEF | 2026-09-15 / 2026-09-24 | Unknown |
| 2026-09-14 | TEF-PBL | TEF-PBL | H / TEF | 2026-09-15 / 2026-09-24 | Unknown |
| 2026-09-15 | TEF-30C | TEF-PBL | H / TEF | Unknown / 2026-09-24 | Unknown |
| 2026-09-23 | TEF-30C | TEF-PBL | H / TEF | Unknown / 2026-09-24 | Unknown |
| 2026-09-24 | TEF-30C | TEF-30C | H / TEF | Unknown / Unknown | Unknown |
| 2026-09-25 | TEF-30C | TEF-30C | H / TEF | Unknown / Unknown | Unknown |

Next rotation: unknown. Releases after 30C: unknown. H–J remains the maintained regulation range.

## Historical evidence and synthetic acceptance fixtures
| Date | Case | Released (registered only) | Online lower mark / legal sets | IRL lower mark / legal sets | Full identities | Next Online / IRL change |
|---|---|---|---|---|---|---|
| 2025-07-17 | Real simultaneous Online admission | None | G / ? (incomplete) | G / ? (incomplete) | Unknown/incomplete | 2026-03-26 (order uncertain) / 2026-04-10 (order uncertain) |
| 2025-07-18 | Real simultaneous tabletop release | BLK, WHT | G / ? (incomplete) | G / ? (incomplete) | Unknown/incomplete | 2026-03-26 (order uncertain) / 2026-04-10 (order uncertain) |
| 2026-03-25 | Real before Online rotation | BLK, WHT | G / ? (incomplete) | G / ? (incomplete) | Unknown/incomplete | 2026-03-26 (order uncertain) / 2026-04-10 (order uncertain) |
| 2026-03-26 | Real Online rotation/admission; no tabletop release | BLK, WHT | H / ? (incomplete) | G / ? (incomplete) | Unknown/incomplete | none known (order uncertain) / 2026-04-10 (order uncertain) |
| 2026-03-27 | Real tabletop release; IRL rotation still pending | BLK, WHT, POR | H / ? (incomplete) | G / ? (incomplete) | Unknown/incomplete | none known (order uncertain) / 2026-04-10 (order uncertain) |
| 2026-04-10 | Real IRL rotation/admission | BLK, WHT, POR | H / ? (incomplete) | H / ? (incomplete) | Unknown/incomplete | none known (order uncertain) / none known (order uncertain) |
| 2026-09-08 | Outside verified rotation coverage | BLK, WHT, POR | ? / ? (incomplete) | ? / ? (incomplete) | Unknown/incomplete | none known (order uncertain) / none known (order uncertain) |
| 2030-01-20 | SYNTHETIC normal | OLD, BASE | G / OLD, BASE | G / OLD, BASE | Known, same | 2030-02-01 / 2030-02-15 |
| 2030-02-01 | SYNTHETIC split + simultaneous additions | OLD, BASE | G / OLD, BASE, A, B | G / OLD, BASE | Known, different | 2030-03-01 / 2030-02-15 |
| 2030-02-02 | SYNTHETIC released; IRL still old | OLD, BASE, A, B | G / OLD, BASE, A, B | G / OLD, BASE | Known, different | 2030-03-01 / 2030-02-15 |
| 2030-02-15 | SYNTHETIC both adopt | OLD, BASE, A, B | G / OLD, BASE, A, B | G / OLD, BASE, A, B | Known, same | 2030-03-01 / 2030-03-15 |
| 2030-03-01 | SYNTHETIC rotation without release | OLD, BASE, A, B | H / BASE, A, B | G / OLD, BASE, A, B | Known, different | none known / 2030-03-15 |
| 2030-03-15 | SYNTHETIC IRL catches up | OLD, BASE, A, B | H / BASE, A, B | H / BASE, A, B | Known, same | none known / none known |
