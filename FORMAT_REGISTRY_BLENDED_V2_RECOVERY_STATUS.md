# Format Registry / Blended Meta v2 recovery status

**Branch:** `format-registry-blended-v2-recovery`  
**Programme status:** Checkpoint 1 complete; Checkpoint 2 next  
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

