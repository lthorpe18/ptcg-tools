# Checkpoint 7 — Saved Expected Fields

Status: Merged in PR #16 (`6421d06c`) and accepted. The owner passed all six device steps. Checkpoint 8 follows in `EVENT_PREP_CHECKPOINT_8.md`.

## Changes

Saved records retain the actual selected composition, format, complete supplied prediction provenance (formula version, weights, evidence formats/events/windows, frozen state and revision), capture time, source coverage, editor inclusions/exclusions/adjustments and parent capture ancestry. Loading uses that stored copy; it never recalculates composition from today's prediction. H2H remains live compatible-format evidence, not a frozen recommendation score.

The existing storage key and account snapshot contract remain in place. Records have schemaVersion 2; old records remain readable without fabricated format, provenance or exact-variant identity. Same name plus same format replaces the existing named field as before; the same name in another format creates a separate record. WSIP and detail options show the format. Replacements without provenance clear old calculation metadata. A conflicting supplied target format is rejected.

Editor metadata is used only when its selected rows match the stored composition. Saved copies remain unchanged by editor work until explicitly saved again. Saved selection follows record identity rather than guessing from matching composition. Event Prep only receives shared-script cache-version updates; its integration remains Checkpoint 8.

## Verification

120/120 Node tests pass. New behavioural coverage checks dual-format round trips, formula/evidence metadata, immutable saved copies, editor exclusion/coverage restoration, ancestry, detail selection/return, legacy unknowns, conflicting formats, stale-provenance removal, corrupt editor fallback and the existing workspace snapshot/restore path using an in-memory IndexedDB stand-in. Real release provenance is saved and restored byte-for-byte through JSON.

The browser-control workflow connected but local preview navigation returned net::ERR_BLOCKED_BY_CLIENT before page load. Subsequent owner testing passed all six iPhone steps; automated desktop/390px verification remains unavailable. No live sign-in or cross-device sync acceptance is claimed.

## Device test (after merge and deployment)

1. Reopen the app; go to Meta → What should I play? → Blended. Remove one variant, note the shares/format, and save with a new test name.
2. Switch to Online, then reopen the saved field. The format, composition and excluded variant should remain as saved. Adding the variant back must not alter the stored copy; reopen it to confirm.
3. Open a recommendation. The exact variant, saved field and format should agree. Reload detail, then return to WSIP; the same saved composition and edits should survive.
4. Save another field with a distinct name. Switch between them repeatedly. If two formats are available, save the same name once in each: both entries must remain, distinguished by format. The dual-format case has automated coverage if only one is currently available.
5. Fully close/reopen the app and reopen the saved field. If using account sync on another device, check that the saved name, format and composition restore there too. Existing older fields should remain listed; missing format should explicitly say Unknown format.
6. Navigate Home → Meta → Compete → Meta and repeat saved selection/detail return. Check that controls remain responsive and readable on iPhone.

Owner acceptance is complete. The owner subsequently authorized Checkpoint 8.
