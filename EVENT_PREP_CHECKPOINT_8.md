# Checkpoint 8 — Event Prep integration

Status: Implemented for review; unmerged. Checkpoints 1–7 are merged and owner-accepted. Checkpoint 7 was accepted after PR #16 (`6421d06c`) and all six device steps passed. Checkpoint 9 has not started.

## Behaviour

Event Prep resolves the event's IRL start date through the maintained Format/Rotation calendar. Known Standard event types (Cup, Challenge and supported majors) use the calendar's maintained format context; unsupported formats, prereleases, missing/invalid dates, unknown event types and unresolved calendar facts remain explicit. Recorded format/environment metadata is retained in participation snapshots. No field is inferred from a saved name such as Local or Major.

The automatic default selects that exact format from the existing canonical predictions. It preserves the shared calculation date, weights, evidence windows/events/formats, revision, formula version and frozen status. It does not project weights to a future event date or substitute today's Online format. Suggested fields use the existing 90% field coverage convention. A future event whose format has no prediction remains unavailable. Personal deck/version planning remains usable even when Meta fails to load.

An explicitly selected field or event copy takes precedence. A missing saved ID stays unavailable. Saving or locking records the displayed rows, baseline, notes, edits and full supplied provenance directly within the participation; it does not create or overwrite a global saved field. Saved labels include their formats. A mismatched or unknown field requires an explicit checkbox override. Its original format, event context and confirmation survive save/reload/lock; the field is never relabelled as compatible, and recommendations are labelled as not validated for the event format. Changing the event date/format requires renewed override confirmation.

The shortlist uses `MetaWSIPSource` and `MetaData.ensureForFormat` with Online 30-day and IRL H2H for the selected field format. Previous-format blend priors do not become matchup evidence. Missing matchups stay unknown. Failed evidence has a retry action; delayed earlier requests cannot change the currently selected field/error state. Untouched automatic suggestions may refresh with a release; saved choices, locks and unsaved edits remain intact.

Locking captures the field snapshot, event format/calendar context, exact `deckId + deckVersionId + listHash`, and a copy of that version. The copied version remains visible even if the personal source deck is later edited or deleted. Controls are disabled while locked. Explicit Unlock to revise retains the old lock in `prep.lockHistory`; a later lock is a new copy. Planning and locking never write `usedDeckRef` or start Tournament Day.

## Verification

128/128 Node tests pass. Eight new behavioural tests cover date-boundary selection, unavailable/unknown formats, canonical real-release parity, rejection of name-based selection, explicit overrides, edited-field persistence, immutable lock and exact-version references, missing source decks, failed/delayed evidence, bounded retry handlers, missing saved IDs and preservation of unsaved edits. Existing shared storage serialization is exercised for lock/reopen. Syntax and whitespace checks pass.

Browser-control connected, but local preview navigation was blocked with `net::ERR_BLOCKED_BY_CLIENT` before page load. Desktop, 390px and actual iPhone visual/navigation acceptance remain pending. Node tests are not browser tests. No live cross-device sync acceptance is claimed.

## Device test — after merge and deployment

1. Reopen the app. In **Compete → Nearby or Majors**, mark a Standard event **Attending**, then open **Prep**. Confirm the event date and event format are correct. Before 24 September the maintained IRL format is TEF–PBL; from 24 September it is TEF–30C. A missing matching prediction should say unavailable, not display another format's field.
2. For an event with an available field, choose a named saved field, adjust a percentage and add a note. **Save for this event**, leave and reopen Prep. The field, format, adjustment and note should remain. Confirm the global saved field in WSIP has not changed.
3. Choose a mismatched saved field (for example a TEF–PBL field for a 24 September or later event). Confirm the warning and disabled save/lock until you tick the override. Save, reopen and verify the override and original field format remain visible. Use an available compatible event for subsequent steps if needed.
4. Select a personal deck and an **exact version**, then tap **Plan this version**. This must work even for an event without a prediction. It should remain planned, not used/played.
5. With a field selected and an exact version planned, tap **Lock field and deck version**. Reload and revisit Prep via Compete. The field and version should remain locked; edit controls should be disabled. Creating/changing a later version in Decks or updating the global saved field must not change the locked copy. **Unlock to revise** should make editing available again while retaining the prior lock internally.
6. Repeat field selection, adjustment, planning and locking; navigate **Home → Meta → Compete**, then reopen Prep. Check responsiveness, Back/Forward, reload and readability on iPhone. Do not start a real tournament merely to test Prep.

If no mismatched saved field is available, the override scenario has automated coverage and can be manually checked when the second format becomes available. Stop for owner acceptance; do not start Checkpoint 9 automatically.

## Remaining programme

Checkpoint 8 review/device acceptance → Checkpoint 9 full connected acceptance → separate prediction accuracy/fitting work → owner-led UI/UX consistency pass → Collection only when explicitly reopened.
