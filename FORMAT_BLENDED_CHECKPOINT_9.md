# Checkpoint 9 — Full connected acceptance

Status: Accepted on 9 September 2026. The automated, deployed-desktop and final owner iPhone/offline-resume gates all passed. Checkpoints 1–8 are merged and owner-accepted; Checkpoint 8 merged in PR #17 (`9e3453e`) and all six owner device checks passed.

## Scope

This is the final integration and hardening gate for the Format/Rotation and Blended Meta recovery programme. It adds no new product surface and does not include prediction fitting, broad UI/UX consistency work or Collection.

The connected workflow under test is:

**Format calendar → generated evidence release → canonical Blended prediction → Home / Meta / WSIP → Saved Expected Field → exact deck detail → Event Prep → immutable preparation lock.**

Acceptance requires consistent format identity, field rows, weights and provenance across those consumers; explicit unknown/unavailable states; persistence through reload and mounted navigation; and a responsive real-iPhone Home Screen experience.

## Automated gate

`node --test tests/*.test.js tests/*.test.mjs`: **128/128 pass** on merged Checkpoint 8 main.

The suite covers settled/split/rotation/first-major calculations; source-format validation; all committed release payloads online and cached; last-known-good offline loading; Home/Meta parity; WSIP format/evidence switching; saved-field provenance and editor state; exact-detail handoff/reload; event-date resolution; explicit overrides; and immutable field/deck-version locks.

## Deployed desktop gate

The public GitHub Pages application was exercised at 1363 × 936 against the Checkpoint 8 deployment. The following passed without application console errors:

- Home loaded **Blended · TEF-PBL**, **50% IRL / 50% Online** and the same leading field share as Meta.
- Mounted navigation across Home, Meta and Compete retained the active WSIP state.
- Meta switched to Blended and agreed with Home on format, weights and field.
- WSIP loaded the canonical field, compatible H2H and recommendations; Online, IRL and Blended targets remained responsive.
- An edited field was saved as `Checkpoint 9 QA`; its format, exclusion and recalculated recommendations survived exact-detail navigation, full shell reload and in-app return.
- Exact detail retained the exact variant, edited field, TEF-PBL format, estimate and coverage while keeping observed statistics separate.
- A 12 September Event Prep selected the canonical **TEF-PBL · 50/50** prediction.
- A 26 September Event Prep resolved **TEF-30C** from the maintained IRL calendar and showed prediction evidence as unavailable rather than substituting TEF-PBL; personal deck planning remained available.
- Deep-page reload and the tested browser Back return restored the intended Meta/WSIP state.

The automation browser cannot emulate the installed iPhone Home Screen application or a true device offline/foreground lifecycle. Browser Forward did not complete before the browser-control session timed out, although the preceding Back transition completed and restored WSIP correctly. The owner subsequently passed the complete six-step iPhone gate below, including Back/Forward and offline/foreground recovery.

## Non-blocking UI/UX note

An edited saved-field context on exact deck detail can display the target format twice, for example `Blended · TEF-PBL · TEF-PBL · edited field`. The underlying format and evaluation are correct. Record this wording cleanup in the already-planned owner-led UI/UX consistency pass; do not expand the recovery programme for it.

## Final owner gate — iPhone — passed

1. Fully close and reopen the installed app. Home and Meta → Blended must agree on format, IRL/Online weights and leading deck share. Switch Online → IRL → Blended twice.
2. Open WSIP from Meta. Switch field and H2H sources, edit the field, save it with a new name and open one exact recommendation. The same exact variant, field, format, estimate and coverage must appear on detail.
3. Reload exact detail, use its in-app Back control, then use browser/app Back and Forward once. The saved/edited field and WSIP recommendations must return without a blank, mixed or untappable view.
4. Open a current-format attending event's Prep. Confirm its suggested field agrees with Meta. Open a future-format event: if no compatible prediction exists, it must say unavailable while still allowing personal deck/version planning.
5. In Prep, use a saved field, make an edit, save it for the event and lock an exact deck version. Reload and move Home → Meta → Compete → Prep. The event copy and lock must remain unchanged; the global saved field must not be rewritten.
6. With the app loaded, briefly use Airplane Mode: revisit Home, Meta/WSIP and the saved field. Cached data must load or show a clear unavailable state without replacing saved/locked state. Restore connectivity, foreground the app and refresh; it must recover and remain responsive.

The owner confirmed all six steps passed on 9 September 2026. Where a second live format was unavailable, synthetic split/rotation behaviour remains covered by the automated suite and the live future-event unavailable path was exercised.

## Programme closure and handoff

The Format/Rotation and Blended Meta v2 recovery programme is complete. The next programme is a separate prediction accuracy/fitting specification and review, followed by the owner-led UI/UX consistency pass, then Collection only when explicitly reopened. Do not start the next programme automatically.
