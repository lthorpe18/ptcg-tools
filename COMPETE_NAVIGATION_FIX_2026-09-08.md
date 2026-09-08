# Compete navigation freeze

Post-Checkpoint-1 smoke testing: the owner confirmed steps 1–5 (Home, sources, Meta, in-app return, detail reload). Compete navigation then froze. Checkpoint 2 remains paused.

## Reproduction and cause

Against main 14fe13b, open the persistent shell, enter Compete, wait for Nearby events and mark a displayed event attending. Home navigation then times out; the browser connection subsequently stopped responding. This was a local unsigned test session, not a change to the owner's account. The report's wording also mentions Complete; actual event-completion submission has not been confirmed as a separate reproduction.

Both prep-link.js and prep-entry-polish.js observed event content and rewrote the same Event Prep link. Assigning unchanged textContent still replaces child nodes, retriggering both observers. Their queued animation-frame callbacks multiply, starving interaction. The former checkpoint test opened a synthetic Prep route directly and missed this discovery-card path. These scripts predate Checkpoint 1; its resolver has no production consumer.

## Change

prep-link.js now owns the link, preserves the accepted prominent styling, changes text only when needed and coalesces updates. prep-entry-polish.js supplies styling only; its body-wide observer is removed. Attendance changes still remove/recreate the link and update accessibility labels. Script URL versions are bumped. No shell redesign or Format/Blended work.

## Validation

- 71 automated tests pass, including three new bounded mutation-scheduler regressions.
- All three new tests fail against the original main scripts because updates never settle.
- Browser reproduction of the original freeze confirmed. Post-fix browser verification is outstanding: the frozen reproduction left the supported browser connection unresponsive, including after documented recovery attempts. Do not claim a browser pass or deployment.

## Manual retest on the fixed version

1. Reload the app, enter Compete and display an attending event in Nearby or Majors. If necessary, mark one attending.
2. Open Event Prep and return using in-app navigation.
3. Switch Nearby / Majors / My Tournaments, then Home / Meta / Compete; repeat twice. All taps should respond.
4. Reload while Compete is selected and repeat the navigation checks with the saved attending event.
5. If the original issue specifically followed Complete on an event, repeat that path too and report whether it remains affected. Completing a real event changes its saved record; use an appropriate test event.

No actual iPhone test is claimed. This is a separate bounded repair following PR #6, not Checkpoint 2.
