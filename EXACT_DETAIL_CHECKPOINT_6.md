# Checkpoint 6 — Exact variant and selected field

**Status:** Merged and deployed through PR #15 (`e27a914`); owner passed all six device checks. Checkpoint 6 accepted. Checkpoint 7 subsequently authorized.
**Base:** main `c05a1af1212c57d14534795a048886583ec840ff`, including the 9 September data refresh.

## Outcome

Exact deck detail now includes **Against your selected field**, using the unchanged shared recommendation engine and compatible H2H. Its Field, Format and Evaluation H2H controls change the actual evaluation. Available named saved fields are selectable. Observed Online/IRL shares, results and matchup statistics remain separately labelled below; no blended observed statistics are invented.

Opening a WSIP recommendation captures the exact selected rows, exclusions/edits, format, saved-field identity, provenance, evaluation H2H source and Online scope. An immutable, opaque context ID travels with the exact variant route. Source switches and observed scope changes preserve that field. The in-app return or **Use this field in What should I play?** restores the composition rather than recomputing it from today's prediction. Ordinary mounted returns do not repeatedly restore over subsequent edits.

Context copies are stored in memory and same-tab session storage for reload/history recovery. They are navigation snapshots, not a new saved-field persistence system. If a context is absent (for example a link opened in a different session), detail says unavailable and asks the user to choose a field; it never substitutes today's field. Direct detail links without a snapshot initialise an explicitly labelled observed source-format field after data readiness. Checkpoint 7 still owns full saved-field persistence/provenance migration.

The explicit-format loader now supports observed results as well as H2H, with separate payload cache entries. Observed scope selection stays local to detail and cannot mutate the WSIP field's H2H scope. Delayed callbacks check exact variant, field context, source and active view. Missing/incompatible observed evidence remains empty; missing decisive H2H remains unknown. Failed observed or evaluation loads expose Retry.

## Validation

`npm test`: **116/116 pass**. Syntax and `git diff --check` pass.

Six new behavioural scenarios run the real router, field editor, detail controller/renderer, data access and shared analysis engine:

- Edited WSIP field → exact detail → source switch → in-app return retains composition and estimate.
- Saved-field snapshot survives same-tab reload and history navigation, retaining exact variant and target.
- Detail Format selector changes evaluation and carries it back into WSIP; observed source/scope changes preserve the field.
- Missing snapshot never substitutes live data; missing compatible matchups remain Unknown.
- Direct detail entry initializes without activating underlying sibling views.
- A delayed old observed-results response cannot overwrite a newer exact variant and field.

The pre-existing real-release blend assertion now derives expected weight from the committed release date rather than hardcoding 8 September's 52/48. Deterministic synthetic formula tests remain unchanged.

The browser connected but rejected local preview navigation with `net::ERR_BLOCKED_BY_CLIENT` before app load. No desktop/390px/iPhone visual pass is claimed. The owner authorized merging for manual testing; browser Back remains non-blocking as previously agreed.

## Owner test script after deployment

1. Reopen the app and go to **Meta → What should I play?** Select Blended and note a recommendation's exact name, estimate and coverage. Open its card. **Against your selected field** must show that exact variant, matching format, estimate and coverage (allowing displayed rounding).
2. In WSIP, remove a field variant, then open a recommendation. Confirm detail identifies an edited field. Use the top in-app Back button. The same exclusion and composition must remain.
3. In detail, switch the **Field** between Online, IRL and Blended; switch Format if alternatives exist. The target and evaluation must update. Choose **Use this field in What should I play?** and confirm that field is actually applied.
4. In detail's **Observed data & performance**, switch Online/IRL and scope. The exact deck and selected evaluation field above must stay unchanged. Missing evidence should say unavailable/unknown, not show another format's results.
5. Open detail again and reload in the same tab. The exact variant, field and format should survive. If you have a named saved field, select it and repeat reload and return to WSIP.
6. Navigate **Home → Meta → Compete → Meta**, reopen detail, switch selectors and return to WSIP. Controls should stay responsive; only the selected page should be visible. Check text and controls fit your iPhone screen.

Optional desktop Back/Forward is covered by route tests but remains non-blocking for owner acceptance. Cross-session context loss should produce the explicit unavailable message. Stop after Checkpoint 6 acceptance; do not begin Checkpoint 7 automatically.
