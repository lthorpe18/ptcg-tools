# Compete navigation freeze

**Accepted — 8 September 2026.** PR #7 merged at `94bc077`. The owner confirmed all six manual navigation checks passed, including reload with saved attendance. The owner clarified the failing tap was Compete in the bottom navigation, not event completion.

Post-Checkpoint-1 smoke testing: the owner confirmed steps 1–5 (Home, sources, Meta, in-app return, detail reload). Compete navigation then froze. Checkpoint 2 remains paused.

## Reproduction and cause

Against main 14fe13b, open the persistent shell, enter Compete, wait for Nearby events and mark a displayed event attending. Home navigation then times out; the browser connection subsequently stopped responding. This was a local unsigned test session, not a change to the owner's account. The owner subsequently clarified that the reported entry point was Compete in the bottom navigation.

Both prep-link.js and prep-entry-polish.js observed event content and rewrote the same Event Prep link. Assigning unchanged textContent still replaces child nodes, retriggering both observers. Their queued animation-frame callbacks multiply, starving interaction. The former checkpoint test opened a synthetic Prep route directly and missed this discovery-card path. These scripts predate Checkpoint 1; its resolver has no production consumer.

## Change

prep-link.js now owns the link, preserves the accepted prominent styling, changes text only when needed and coalesces updates. prep-entry-polish.js supplies styling only; its body-wide observer is removed. Attendance changes still remove/recreate the link and update accessibility labels. Script URL versions are bumped. No shell redesign or Format/Blended work.

## Validation

- 71 automated tests pass, including three new bounded mutation-scheduler regressions.
- All three new tests fail against the original main scripts because updates never settle.
- Browser reproduction of the original freeze confirmed. The agent's post-fix browser verification was blocked: the frozen reproduction left the supported browser connection unresponsive, including after documented recovery attempts. The owner subsequently completed all six manual navigation checks successfully; no exact deployed SHA was captured.

## Manual retest on the fixed version

1. Reload the app, enter Compete and display an attending event in Nearby or Majors. If necessary, mark one attending.
2. Open Event Prep and return using in-app navigation.
3. Switch Nearby / Majors / My Tournaments, then Home / Meta / Compete; repeat twice. All taps should respond.
4. Reload while Compete is selected and repeat the navigation checks with the saved attending event.
5. Event-completion submission is not part of this regression: the owner clarified the original tap was Compete.

The six-step device navigation pass is owner-reported; it is not an agent-run browser pass. This is a separate bounded repair following PR #6, not Checkpoint 2.

### Deferred Event Prep feedback — non-blocking

The owner reported and supplied screenshots of these issues after navigation acceptance:
- Prep links are available on Nearby/Majors cards but missing from My Tournaments; provide a consistent entry there in a later bounded pass.
- Event-card actions need compact styling: the oversized Prep button crowds/clips other actions and pushes the overflow control onto another row.
- The bottom Prep actions collide and have inconsistent styling; tidy the Plan this version / Open Tournament Day controls.
- Review the value of Event Prep alongside Meta and Tournament Day. Keep Event Prep; the owner explicitly requested no deletion for now.

These are deferred, not acceptance blockers or additions to Checkpoint 2's scope.
