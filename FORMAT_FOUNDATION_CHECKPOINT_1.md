# Checkpoint 1 — Format/Rotation foundation review

Status: **implementation prepared; acceptance incomplete**. No merge, deployment, UI integration or Checkpoint 2 work.

Base: `f6c59c8` on latest main, including accepted specification `df51755` and the subsequent data refresh. No applicable `AGENTS.md` exists in this checkout. The requested specification, master, roadmap, performance, Home, WSIP and Meta architecture documents were read. PRs #4/#5 were neither restored nor cherry-picked.

## Changes

- `v2-preview/apps/_shared/format-resolver.js`: one synchronous, DOM-free resolver for explicit calendar dates and environments. No fetches, readiness promise, implicit clock, observers, storage writes or consumer initialization.
- `data/formats/verified-seed.json`: separately sourced, deliberately partial real evidence pack. Does **not** claim complete production formats.
- `tests/fixtures/format-synthetic.json`: explicitly invented 2030 universe for deterministic acceptance; never loaded by the app.
- `tests/format-resolver.test.js`: behavioural acceptance tests.
- `scripts/report-format-foundation.mjs`: reproduces the representative table below.

No existing application JS, HTML, CSS, service worker, data payload or navigation was changed. The new module is opt-in and no production entrypoint loads it. Existing visible behaviour is therefore structurally unchanged, but this is not a substitute for the outstanding browser gate.

## Contract

```js
const Format = require('./v2-preview/apps/_shared/format-resolver.js');
const resolver = Format.create(registry);
const result = resolver.resolve('2030-03-01');
const eventResult = resolver.resolveEvent({date: '2030-03-01', environment: 'irl'});
```

A classic browser script exposes the same API as `PTCGFormat`. No loader or consumer integration is supplied in this checkpoint. Callers must supply a registry explicitly. `validate(registry)` returns schema errors; `create` rejects invalid registries. Missing evidence is valid input, not a startup exception.

Dates must be valid, strict `YYYY-MM-DD` strings. A date denotes the applicable environment/event calendar day, inclusive, independent of the viewer's timezone. Timestamps and `Date` objects are rejected rather than silently converted. This API does **not** answer intraday Live availability; the verified 17 July 2025 Live source specifies 10:00 PDT, retained in provenance. A later consumer needing intraday resolution must not describe the day-level result as midnight activation.

Release is tabletop release, independent of Online admission, IRL admission and rotation. No release-offset or calendar-year rotation fallback exists. The one derived Perfect Order IRL seed date is recorded explicitly with its qualifying regular booster-release evidence and the separately sourced two-week policy. That arithmetic is not runtime policy for other sets, especially special sets.

Each environment returns:

- the last recorded applicable rotation and, separately, a trusted boundary (null outside verified chronology coverage);
- legal, illegal and unknown registered sets, with reasons and admission status;
- the legal regulation-mark portion of mixed-mark sets;
- an exact canonical pool identity only when catalog, timeline, marks and exception information are complete;
- the next dated legality/rotation changes, grouped for simultaneous changes, with ordering uncertainty and blockers.

A lower mark is not inferred from the first set row. An explicit `boundary.setIds` can alternatively define the complete permitted set pool when no mark is supplied; it is an explicit membership list, not a first-set shorthand. A mark-based boundary uses separately recorded set marks. These are set/pool-level results; older equivalent printings and individual deck legality are not adjudicated here.

Format identity includes scope, lower boundary, permitted set/mark portions and versioned exception identifiers. It excludes environment, query date, display shorthand and metadata revision: equal permitted pools in Online/IRL receive the same identity. Exception identifiers must refer to an exhaustive verified policy set before declaring their fact confirmed. A null exception fact is not equivalent to a confirmed empty list.

Coverage has inclusive `from`/`through` bounds. Catalog completeness means all relevant sets, not just all rows that happen to be registered. Unknown chronology never silently becomes today's format. Future/undated announced sets can retain an established present identity within explicit complete coverage, while their legality remains unknown and the ordering of future changes is qualified. An unconfirmed rotation prevents a complete identity. A future dated change beyond coverage is not necessarily next.

Inputs are copied at resolver creation; outputs are deeply frozen, include registry revision and fixture kind, and can be serialized as independent values. This proves resolver immutability only; Saved Expected Field/locked snapshot integration remains a later checkpoint.

## Verification and blockers

`node --test tests/*.test.js tests/*.test.mjs`: **61/61 pass**, comprising 21 new cases and 40 existing cases. The expected offline-loader warning is from an existing deliberate failure fixture. No production failure was observed by these tests.

New coverage: independent release/Online/IRL legality; before/at/after both legality and rotation boundaries; rotation without release; simultaneous additions; mixed marks and exception identity; missing dates/history/marks/catalog/lower boundary; announced undated sets and rotations; next-change ordering; explicit event and first-major date; invalid dates; UTC/London/Los Angeles/Kiritimati parity; immutable snapshots; source/schema rejection; browser-global execution without browser services.

**Browser gate: blocked, not passed.** The local browser runner failed during startup. The supported cloud-browser preview could load a temporary wrapper, but application navigation was blocked; the static checkout was outside that wrapper's restricted preview filesystem. No working Home/Meta/Prep page was reached, and no browser responsiveness, source-switching, Back/Forward, deep reload, desktop or 390px acceptance is claimed. The wrapper is outside the repository and is not part of the change. No actual iPhone testing occurred. A supported preview setup for this static repository is required to finish this gate.

**Real-data coverage: incomplete, not production-ready.** Official indexed sources verified two rotation announcements and three expansions' release/Online facts. Complete official page/PDF retrieval was unavailable for several sources. The seed deliberately leaves set regulation-mark inventories, exhaustive exception policy, BLK/WHT IRL dates, other sets/promos, older history and later chronology unconfirmed. It cannot generate a complete real format identity, including for 8 September 2026. Full seed coverage is required before this foundation can supply current production consumers; no TEF-PBL or other inferred identity is substituted. This is outstanding foundation data work, not authorization to start Checkpoint 2.

Stop here. Review the implementation, complete real-data verification and the browser gate before marking Checkpoint 1 accepted. Do not continue into Meta, Blended, Home, WSIP, Prep integration or Collection.

## Representative date results

Run `node scripts/report-format-foundation.mjs`. “Released” below lists **registered rows only**, never all released Pokémon sets. `?` is an explicitly unknown complete legal pool. Real rows retain confirmed admission dates even where marks/exception gaps prevent full legality classification.

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

## Seed sources

Source references, verification date, confirmation status, date convention and retrieval limitations are retained per fact in the seed. The factual sources are:

- [2025 rotation](https://www.pokemon.com/us/news/2025-pokemon-tcg-standard-format-rotation-announcement)
- [2026 rotation](https://www.pokemon.com/uk/news/2026-pokemon-tcg-standard-format-rotation-announcement)
- [Perfect Order announcement](https://press.pokemon.com/en/MEDIA-ALERT-Pokemon-Trading-Card-Game-Mega-EvolutionPerfect-Order-Laun)
- [2026 product legality update](https://community.pokemon.com/en-us/discussion/22216/pokemon-tcg-product-legality-update)
- [Black Bolt/White Flare product showcase](https://www.pokemon.com/uk/news/pokemon-tcg-scarlet-violet-black-bolt-and-white-flare-product-showcase)
- [Black Bolt/White Flare on Live](https://www.pokemon.com/us/news/battle-with-pokemon-tcg-scarlet-violet-black-bolt-and-white-flare-on-pokemon-tcg-live)
