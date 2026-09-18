# Meta exact-detail evidence loading — handoff

**Status:** PR #81 open; implementation validated in CI; merge and owner/device acceptance pending  
**Branch:** `fix/meta-detail-evidence-loading`  
**Base:** `main` at PR #80 merge `37c5afe09fc31423707ca9a1873ee8bbd40e1671`  
**Scope:** Meta release delivery only; no field, H2H, result, calendar or prediction semantics change

## Reported symptom

On the installed iPhone app, Current Meta → Online → TEF-30C → Slowking shows the expected 34 field entries, but exact detail remains on:

- “Loading compatible H2H…”
- “Loading field, matchup and result evidence…”

No matchup cards or recent results appear while those loaders remain unresolved.

## Evidence

### Verified

The committed current release is `2290dc8040438fc272b4`.

For Online TEF-30C:

- the 30-day core field has Slowking at 34 entries;
- `online-matchups.json` has 67 matchup rows involving Slowking in the 30-day scope;
- `online-results.json` has 22 Slowking result rows;
- the manifest labels both lazy payloads TEF-30C and the same release identity.

Therefore the symptom is not explained by missing Slowking evidence.

The exact-detail renderer already requests both payloads through `MetaData.ensureForFormat()` and renders observed performance, matchups and recent results once they resolve.

### Inferred

`MetaRelease` already bounded network fetches at eight seconds, but CacheStorage operations were unbounded. Lazy evidence loading checks CacheStorage before network and awaits cache persistence after network fetch. A stalled iOS/PWA CacheStorage read or write can therefore leave the UI indefinitely in the observed loading state.

This is the strongest code-grounded failure mode, but it remains **Unknown** whether it is the exact device cause until owner retest after deployment.

## PR #81 implementation

- bound Meta release CacheStorage read/write/prune operations;
- cache-read timeout/failure becomes a cache miss and falls through to the normal validated network fetch;
- cache-write/prune timeout/failure no longer blocks usable validated evidence;
- preserve checksum, release and format validation;
- preserve last-known-good release behavior;
- bump `meta-release-loader.js` to asset v6;
- bump installed-app service-worker cache generation to `ptcg-tools-v33`;
- add regression tests for stalled cache reads and writes.

## Validation

CI on PR #81:

- Meta JavaScript syntax: pass;
- required V2 Meta hooks: pass;
- Meta architecture contract: pass;
- new cache-read stall test: pass;
- new cache-write stall test: pass;
- full suite: 300 tests, 289 pass / 11 fail.

The repository already documents 11 transition-sensitive failures on the PR #79 baseline (287/298). PR #81 adds two passing tests and leaves the overall failure count at 11. Do not weaken those unrelated tests in this bugfix.

## Owner acceptance after merge/deploy

1. Fully reopen the installed app so the new worker/asset generation can take control.
2. Open Meta → Online TEF-30C → Slowking (currently 34 entries).
3. Confirm both loading messages resolve.
4. Confirm **Observed data & performance** renders.
5. Confirm **Matchups** contains variant-level rows.
6. Confirm **Recent results** renders Slowking tournament rows.
7. Repeat after a second app reopen to ensure cache persistence does not reintroduce the stall.

If this still fails, keep PR #81’s bounded-cache behavior and instrument the lazy evidence request/result/error path on-device. Do not change matchup/result semantics or substitute another format.

## Hard stop

Do not merge PR #81 without explicit owner authorization. After owner acceptance, return to the standing published-calendar production-generation integration task in `CURRENT_STATE.md`.
