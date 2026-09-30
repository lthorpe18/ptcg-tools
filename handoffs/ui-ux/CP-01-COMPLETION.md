# CP01 completion / review handoff

21 September 2026. Repository: `lthorpe18/ptcg-tools`.
Branch: `ui-ux/cp01-foundation`. PR is for review only; **not merged**.
The PR head is the authoritative delivery SHA (reported with the PR link in the
delivery message); this handoff is part of that commit rather than a self-hash.

## Baseline and isolation

- Required PR #82 merge `606f7dd1e0f9bdc12c83d7edd524759d023df206` is an ancestor.
- Initial base `407a0117203fd665fba57cb9d95ea60f857d114d`; resumed against main
  `c5000b37445b83b40272bba533028a02259065fb`. Main was rechecked at
  `292639adad8f699e74ddf352e73d723d529d5fd5`; its newer generated-feed commits
  remain untouched and are not overwritten by this branch.
- Clean initial checkout, no applicable AGENTS.md and no open PRs at start or
  resumption. All local CP01 work was preserved when resuming.
- Production root, V2, manifest, service-worker scope, auth, stores, data schemas,
  generated data, ETL and domain/evidence semantics are unchanged.
- The only existing code modified outside V3 is the repository QA server's
  JavaScript MIME mapping for `.mjs`. No dependency manifest/lockfile changes.

## Implementation

Shared tokens, shell, ArtworkHeader, compact toolbar, card rows/list/gallery,
dense data rows, disclosures, filter dialog, card inspector, loading/empty/
partial/error/retry patterns and labelled historical 60-card specimens.
Following owner review, the initial flatter styling was replaced with the
accepted Artwork Stage → floating Section Rail → overlapping Task Surface
system. Dark atmospheric chrome, warm paper, editorial type, restrained
cyan/mint accents, fine rules, authentic artwork, sprites and mobile bottom
sheets now define the shared presentation language.
Original canonical image/sprite scripts are reused without edits. A narrow
generation-guarded DOM adapter owns image display/fallback only. Per-printing
focal percentages never change a deck/list/card identity.

The app has four primary links and app-level Utilities/Settings. Unmigrated
areas explicitly open the real V2 destination at top level, with no nested
shells or dead Collection tab. Exact hash ownership, invalid-route recovery and
presentation-only history snapshots are centralised. No new account-sync owner
or private-data store is instantiated.

See `v3-preview/README.md` for ownership, adapter details, preview and test setup.
See `docs/UI_UX_ROUTE_PARITY.md` for exact routes and legacy transitions.

## Verification and actual visual inspection

Focused unit command: `node --test tests/ui-ux-cp01.test.mjs`: **10 passing**.
Syntax checks for new JS/modules and `git diff --check` pass.

The revised branch was loaded from its immutable RawGitHack commit in a real
cloud Chromium session. `tests/browser/cp01-responsive.html` supplied exact
390px, 360px and 390px/200%-text child viewports; screenshots were visually
inspected and its in-page metrics were recorded. Actual resolver artwork and
canonical sprites loaded—no image mock or substitute provider was used. The
original full Playwright harness remains at `tests/browser/ui-ux-cp01.cjs` and
was strengthened with overlap/section-rail assertions, but this workspace could
not download a local Chromium binary, so its final revised-build rerun remains a
separate CI/reviewer check. Earlier CP01 execution of that harness covered focus,
safe area, history and reduced-motion mechanics before this CSS-only direction
revision; those assertions were not removed.

| Layout / behaviour | Observation |
|---|---|
| 390 × 844 portrait | 210px horizontal artwork stage; 28px surface overlap; real artwork and thumbnails; canonical sprites; one bottom nav; no horizontal overflow |
| 360 × 844 portrait | 196px artwork stage; long deck title remains legible over a horizontal crop; dense single-column rows and toolbar fit; one bottom nav; no horizontal overflow |
| Mobile sheets | Card inspector and filter inspected at 390px as bottom sheets; full exact-print card art, restrained backdrop and clear close/apply controls |
| 1363 × 936 desktop | 270px artwork stage; bounded warm task surface; floating rail; two-column dense list; no horizontal overflow |
| 390px / 200% root text | Hero grows to 302px; primary title/metadata scale and reflow; compact chrome remains bounded; measured horizontal overflow is false |
| Keyboard / focus | Native dialog open/Escape close exercised on the revised build. Full Tab/Shift+Tab containment, visible focus and trigger-return assertions remain in the focused browser harness and passed before the CSS-only revision; final harness rerun is pending as noted above |
| States | Revised states page visually inspected with loading, empty, partial and error/retry surfaces; disclosures and missing-art patterns remain in the same component implementation |
| Reduced motion | Token media query still sets all motion durations to 0ms and disables animation/transition; the existing browser assertion remains, but final cloud browser media emulation was unavailable |
| Safe area | Dynamic measured nav reserve is unchanged and the existing 34px simulated-inset assertion remains; final owner-device test is pending |
| History | Immutable direct load and native route transitions were exercised on the revised build. Full reload/Back/Forward/V2 roundtrip assertions remain in the browser harness; final local-Chromium rerun is pending |
| Data boundary | Fresh V3 specimen leaves localStorage empty before legacy exit; no account/personal state is created |

New failures found and fixed during CP01: null fresh history, missing `.mjs`
server MIME, skip-link hash conflict, exact sprite-name preservation, removal of
fallback sprite image by overly broad selection, default disclosure restoration,
enlarged-nav text wrapping, explicit dialog keyboard cycling, and safe-area
border-box observation. Browser assertions wait for actual route/render state.

## Failures, limitations and acceptance states

- **New V3 runtime failures:** none observed in the revised rendered routes.
- **Final browser-automation limitation:** a Playwright-compatible local Chromium
  binary was unavailable and its download timed out. Exact-width visual QA and
  manual interactions completed in cloud Chromium; the full scripted harness
  should run in PR CI or a reviewer machine before merge.
- **Inherited/local environment observation:** the unchanged V2 Home transition
  emits `Could not load Supabase client` when its external CDN is unavailable to
  this QA browser. V3 return still works. This is not a claimed production fix or
  a successful account-sync test. No sign-in/account data was used.
- **Historical suite baseline:** 289/300 with 11 documented transition/data
  failures, not rerun or weakened for this presentation checkpoint. PR CI may
  run that suite automatically; inspect its actual results separately.
- **Implemented:** CP01 foundation complete; no feature workflow migration.
- **Merged:** no; explicit authorization is required.
- **Hosted preview/deployed:** review-only RawGitHack URL:
  `https://raw.githack.com/lthorpe18/ptcg-tools/ui-ux/cp01-foundation/v3-preview/index.html#/specimen`.
  This is a source proxy, not a production deployment. Local preview remains
  `http://localhost:4173/v3-preview/` after `npm run dev`.
- **Production:** unchanged by this branch; current live deployment SHA is not
  independently asserted here.
- **Owner-device:** pending iPhone/Safari/installed-app acceptance; Chromium,
  enlarged text and simulated safe area do not substitute for that acceptance.
- **Remaining intentional limits:** historical fixtures only; V2 transitions
  require browser Back through any V2 history; no V3 entity-ID routes, live deck
  adapter or accepted single-owner live sync integration until CP02.

## Next action and rollback

Review the CP01 PR and explicitly authorize any merge. Arrange owner-device
acceptance when a review deployment or merged isolated preview is available.
Do not silently turn this pending device check into a pass. The complete next
prompt is `handoffs/ui-ux/CP-02.md`; CP02 starts only after its stated gate.

Rollback before merge: close the PR. If merged, revert the CP01 commit(s),
removing only its V3/tests/docs additions and QA MIME change. Production entry
never switched, and there is no personal-data migration to reverse. Preserve
all unrelated/newer generated-feed commits during rollback.
