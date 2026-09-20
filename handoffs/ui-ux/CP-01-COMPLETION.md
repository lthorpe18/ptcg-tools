# CP01 completion / review handoff

20 September 2026. Repository: `lthorpe18/ptcg-tools`.
Branch: `ui-ux/cp01-foundation`. PR is for review only; **not merged**.
The PR head is the authoritative delivery SHA (reported with the PR link in the
delivery message); this handoff is part of that commit rather than a self-hash.

## Baseline and isolation

- Required PR #82 merge `606f7dd1e0f9bdc12c83d7edd524759d023df206` is an ancestor.
- Initial base `407a0117203fd665fba57cb9d95ea60f857d114d`; resumed against main
  `c5000b37445b83b40272bba533028a02259065fb`. Newer feed commits are preserved.
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

Focused unit command: `node --test tests/ui-ux-cp01.test.mjs`: **9 passing**.
Syntax checks for new JS/modules and `git diff --check` pass.

Browser harness: `tests/browser/ui-ux-cp01.cjs`, repository QA server, Chromium
153 in a fresh profile. Screenshots were captured and visually inspected, not
inferred from source or measurements alone. Actual artwork and canonical sprites
were loaded. The environment-only image transport bridge forwarded exact URLs
and original bytes using the configured proxy/CA; app image code was not mocked.

| Layout / behaviour | Observation |
|---|---|
| 390 × 844 portrait | 126px artwork strip; title wraps to two lines; first card row around y=341; six Pokémon rows fit above the bottom nav; readable quantities and real thumbnails; no page overflow |
| 360 × 800 portrait | Title retains horizontal art composition; specimen label wraps; first card row around y=360; long names wrap without overlapping quantities; single bottom nav |
| 360px gallery | Two full-card columns; count, printing and long names retained; touch targets remain usable |
| 1440 × 1000 desktop | Content bounded to 1100px; 140px art strip; two-column dense list, not magnified phone controls; no horizontal overflow |
| 390px / 200% root text | All text is enlarged; title grows to about 248px rather than clipping; toolbar and navigation labels wrap; extra scrolling is expected, not smaller essential text |
| Keyboard / focus | Skip link focuses main without changing route; visible rust focus ring; Enter opens inspector; Tab/Shift+Tab cycle inside dialogs; Escape closes and restores trigger; filter Apply returns focus |
| States | Loading, empty, partial and explicit error/retry inspected; expanded/collapsed disclosures distinguish correctly; missing art retains dimensions and canonical sprite/title treatment |
| Reduced motion | Actual reduced-motion media emulation resolves motion token to 0ms; no animated loaders or recurring sprite replacement |
| Safe area | CSS 34px bottom inset simulation; border-box ResizeObserver updates content reserve; final link remains above navigation. This is not an iPhone hardware test |
| History | Direct load/reload; filtered gallery return after reload; Back/Forward; real V2 Home exit and return; unknown-route recovery; native presentation state retained |
| Data boundary | Fresh V3 specimen leaves localStorage empty before legacy exit; no account/personal state is created |

New failures found and fixed during CP01: null fresh history, missing `.mjs`
server MIME, skip-link hash conflict, exact sprite-name preservation, removal of
fallback sprite image by overly broad selection, default disclosure restoration,
enlarged-nav text wrapping, explicit dialog keyboard cycling, and safe-area
border-box observation. Browser assertions wait for actual route/render state.

## Failures, limitations and acceptance states

- **New V3 runtime failures:** none in the final focused browser run.
- **Inherited/local environment observation:** the unchanged V2 Home transition
  emits `Could not load Supabase client` when its external CDN is unavailable to
  this QA browser. V3 return still works. This is not a claimed production fix or
  a successful account-sync test. No sign-in/account data was used.
- **Historical suite baseline:** 289/300 with 11 documented transition/data
  failures, not rerun or weakened for this presentation checkpoint. PR CI may
  run that suite automatically; inspect its actual results separately.
- **Implemented:** CP01 foundation complete; no feature workflow migration.
- **Merged:** no; explicit authorization is required.
- **Hosted preview/deployed:** no deployment created by this work. Local preview
  is `http://localhost:4173/v3-preview/` after `npm run dev`; it is not a remotely
  accessible phone link. The QA harness stops its own server on completion.
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
