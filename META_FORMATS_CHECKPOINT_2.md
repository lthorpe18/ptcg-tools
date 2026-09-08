# Checkpoint 2 — Meta Online/IRL format handling

**Status: implementation prepared for review; 90 automated tests pass. Browser acceptance is blocked by unavailable browser control. Not merged or deployed. Checkpoint 3 has not begun.**

Built on latest main `f33aa6a`, preserving PR #6 (foundation), PR #7 (accepted Compete navigation repair), and the subsequent scheduled deck/event updates. Browser release: `14227cd7d3249eaa24f3`.

## What changed

- `scripts/meta-format-contract.mjs` consumes the Checkpoint 1 resolver and maintained calendar. Online and IRL have independent current identities. Event classification uses the event date and environment, never ingestion time. Conflicting dataset, event, aggregate-set and result identities fail validation.
- Historical evidence before the 8 September maintained baseline retains its original source-declared format and explicitly unknown calendar verification. The old 17 July ingestion cutoff remains a legacy query boundary, **not a newly asserted release or legality date**. Unknown future date formats are rejected rather than treated as verified history.
- The Online daily job catches up outgoing-format events separately during the split, with an exclusive end boundary, before collecting the new format. Compact fields, detailed event evidence and results remain in separate format files. Old evidence is not deleted merely because it falls out of the API discovery window. A newer outgoing archive cannot be overwritten by an older current pointer.
- IRL ingestion selects its own date boundary and preserves prior discovered events. New per-event H2H rows support individual-event scopes. The existing sole-event aggregate can be attributed to that event; unavailable multi-event attribution is not invented.
- A new Limitless aggregate query must confirm its selected set/rotation filters before it may publish a new-format label. If confirmation or source coverage fails, that aggregate remains unavailable; current-format tournament evidence can still be published. The existing PBL query is retained as a legacy source declaration. No real 30C response has been verified; future rotation API mappings remain explicit maintenance inputs.
- Release schema 2 has independent source formats and per-file identity/checksums. All six current payloads use the same schema contract. Old-format packages remain available through manifest entries; their cores, history, matchups and results load only when selected. Current core is approximately 187 KB, rather than growing with complete archived histories.
- Meta shows the selected source's actual format and offers an evidence-format selector when archives exist. Online/IRL archive selections are independent and retained in the existing route's query parameters for reload. A missing requested archive shows empty evidence under its own label; it never silently substitutes the current format.
- Empty event scopes no longer return unrelated results or H2H. Late payloads cannot overwrite another format/release selection. The startup-ready callback reads the currently active core rather than reinstating an older core. Network timeouts cover both headers and response bodies, so unavailable startup settles.

Home and Event Prep receive **only a shared-loader asset version bump** so they can read the new schema. Their layout and feature logic are unchanged. No Blended v2, Home integration, WSIP redesign, Saved Field migration, Event Prep redesign, admin/fitting, individual deck legality or Collection work is included. The owner's deferred Prep feedback remains deferred.

## Representative maintained-calendar results

These are owner-maintained calendar dates. They are not synthetic dates or claims that future tournament results exist.

| Date | Current Online format | Current IRL format | Retained evidence behaviour |
|---|---|---|---|
| 8–14 September 2026 | TEF–PBL | TEF–PBL | Existing current evidence |
| 15–23 September 2026 | TEF–30C | TEF–PBL | Old Online is separately archived; IRL stays PBL |
| From 24 September, under the known schedule | TEF–30C | TEF–30C | Old source packages retained; missing new evidence stays empty |

H–J and the TEF lower boundary do not change. No release date or later rotation is invented. Current committed evidence contains 150 Online events / 21,412 entries in the 30-day field and one IRL event / 792 classified entries. The source reports 797 IRL players; the classified deck-entry count is intentionally separate.

## Validation

`node --test tests/*.test.js tests/*.test.mjs`: **90/90 pass**, including:

- current real-source build reproduces every committed release payload;
- the actual browser loader loads **every** current real payload online and from cache;
- every synthetic split/archive payload, including on-demand archive core, loads online and cached;
- wrong-format and wrong-schema secondary payloads are rejected even with matching checksums;
- event-date classification, source independence, missing history and unavailable archive handling;
- scoped results/H2H, independent archive switching, delayed-response and startup races;
- bounded startup when headers arrive but the response body never completes;
- the actual daily ingestion script, using synthetic network responses, preserves older records and the outgoing boundary-day results;
- all existing foundation, navigation, recommendations, season and Compete-loop tests.

The 2030 split calendar in `tests/meta-formats.test.mjs` is explicitly synthetic. The ingestion test uses fictional named tournaments on the owner's real September boundary, overrides the clock in a child test process and makes no live network requests. No live ingestion run or future API response is claimed.

Syntax and diff checks pass. Generated conflicts with newer main data were resolved by rebuilding from the newly merged raw inputs, not restoring older datasets.

## Genuine acceptance blocker

The supported cloud browser repeatedly timed out while listing/opening tabs; the final diagnostic reported `CDP operation refresh tabs timed out after 20000ms`. No usable post-change browser observation was obtained. Do not claim desktop, 390px, source-split visual, detail-reload or iPhone acceptance from the automated test count. Keep this PR in draft until that gate is completed or explicitly dispositioned by the owner.

## Remaining browser/device script

On this branch's preview (or after an explicitly authorized merge/deployment):

1. Load Home, open Meta, and switch Online → IRL → Online twice. Check that the format label follows the source and the field remains populated for today's data.
2. Open Matchups and Results, switch each source and scope, and inspect a deck's exact detail. Check field, H2H and result rows agree with the selected source/scope.
3. Switch Online/IRL within detail, then reload. Check the same deck and source return; in-app Home → Meta navigation remains responsive.
4. In an isolated preview checkout, build with `META_AS_OF=2026-09-15 node scripts/build-meta-release.mjs`. This is a **date simulation with real old evidence**, not future results. Online TEF–30C should be empty until real evidence exists; IRL remains TEF–PBL. Select archived Online TEF–PBL, open detail, reload, and switch back to current Online. Repeat source/archive switches; no cross-format rows or stalled loading.
5. Repeat at 390px and on the owner's iPhone. Confirm Compete remains navigable with an attending event, preserving PR #7. Browser Back remains the separately accepted non-blocking issue; do not redesign the shell.
6. Restore the normal release with `node scripts/build-meta-release.mjs` before committing any preview simulation. Do not publish simulated current dates as the real release.

Stop after Checkpoint 2 review. Do not begin Checkpoint 3 or take on deferred Prep styling.
