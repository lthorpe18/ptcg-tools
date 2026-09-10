# PTCG Tools — Roadmap Handoff — 7 September 2026

**Status:** Format/Rotation and Blended Meta v2 recovery complete; Checkpoints 1–9 owner-accepted
**Supersedes:** `ROADMAP_HANDOFF_2026-09-05.md`
**Companion to:** `PTCG_TOOLS_MASTER.md`, `HOME_ARCHITECTURE.md`, `WHAT_SHOULD_I_PLAY_ARCHITECTURE.md`, `v2-preview/apps/meta/ARCHITECTURE.md`, `PERFORMANCE_ARCHITECTURE.md`

## Format/Blended programme closure — 9 September 2026

Checkpoints 1–9 are complete and owner-accepted. Checkpoint 8 merged in PR #17 (`9e3453e`) and passed all six Event Prep device checks. Checkpoint 9's 128 automated tests, deployed desktop workflow and final six-step installed-iPhone/offline-resume gate all passed. The recovery programme is closed; see `FORMAT_BLENDED_CHECKPOINT_9.md`.

## Prediction accuracy programme

Checkpoints 1–3 are accepted and merged through PR #21 (`e543e13`). Checkpoint 4's Meta accuracy interface is implemented for review; see `PREDICTION_ACCURACY_CHECKPOINT_4.md`. Worlds remains correctly unscored, so the first score will be the next compatible IRL major with a pre-Day-1 snapshot. Checkpoint 5 has not started.

## Checkpoint 5 accepted — 9 September 2026

PR #14 merged at `4380f8c`. The owner passed all six device checks and confirmed Home, Meta and WSIP agree on the correct Blended calculation. The prediction date has also advanced; the earlier daily-refresh concern is closed for now, as requested.

## Checkpoint 4 follow-ups merged

PR #12 merged at `1f0dace3` and PR #13 at `8ae4ccb`. Home retains its current split without a methodology link. The hero explicitly selects Blended, consuming the entry instruction once so subsequent user choices survive ordinary warm return. Device retest of these corrections remains pending; see `HOME_CHECKPOINT_4.md`. The original owner testing passed cold load, shares/weights, grouping and navigation before the handoff defect was reported.

## Checkpoint 3 acceptance — 8 September 2026

Checkpoint 3 is accepted and merged through PR #9 (`431c7e9`) and its concise explanation follow-up PR #10 (`77f12fc`). The owner confirmed the deployed iPhone result after the stale mounted Meta document was refreshed. Single/dual targets, P1–P3/P5 calculation, unavailable states, provenance and shared explanation are now the accepted Meta baseline. P4 remains an Event Prep consumer rule for Checkpoint 8.

## Checkpoint 2 implementation review — 8 September 2026

Checkpoint 2 merged in PR #8 at `80bf40b`. Its 90-test implementation gate passed. Later Checkpoint 3 device testing covered repeated source switching and navigation, although the original standalone browser script was not separately recorded as a complete pass.

Home and Event Prep only receive the shared-loader version update needed for schema compatibility. Deferred Prep entry/styling/usefulness feedback stays deferred. Preserve PR #7's owner-accepted navigation repair.

## Checkpoint 1 acceptance update — 8 September 2026

Checkpoint 1 is complete and accepted. PR #6 merged at `14fe13b`; the subsequent Compete navigation fix, PR #7, merged at `94bc077`. The owner confirmed all six post-fix navigation checks passed on 8 September (Compete entry with an attending event, cross-area navigation, Compete views, Prep entry/return and reload). Automated validation passed 71 tests after the repair, including three regressions that fail on the original scripts; GitHub validation also passed. The agent reproduced the original freeze but could not complete its own post-fix browser run; device acceptance is owner-reported, with no deployed SHA independently captured. Browser Back remains explicitly non-blocking. Checkpoint 2 is now implemented for review; see the update above.

The owner supplies set data manually; no scraping/admin UI is required. `data/formats/maintained-calendar.json` records the 8 September baseline H–J / TEF–PBL, then 30C Online legality on 15 September and IRL legality on 24 September. 30C release date, next rotation and later releases remain unknown. A rotation can be attached to its set and applies on each environment's legality date, independently of release. Unknown historical/card-level inventories do not block this maintained current-format context; they must not be presented as complete legal-set lists.

### Deferred Event Prep feedback — non-blocking

The owner reported and supplied screenshots of these issues after navigation acceptance:
- Prep links are available on Nearby/Majors cards but missing from My Tournaments; provide a consistent entry there in a later bounded pass.
- Event-card actions need compact styling: the oversized Prep button crowds/clips other actions and pushes the overflow control onto another row.
- The bottom Prep actions collide and have inconsistent styling; tidy the Plan this version / Open Tournament Day controls.
- Review the value of Event Prep alongside Meta and Tournament Day. Keep Event Prep; the owner explicitly requested no deletion for now.

These are deferred, not acceptance blockers or additions to Checkpoint 2's scope.

## 1. Current programme position

The failed Format Registry / Blended Meta v2 rollout was rolled back. PR #4 and PR #5 are evidence for forensic review, not code to restore or continue wholesale.

The accepted product baseline remains **Home · Meta · Decks · Compete · Tools**, with Settings app-level. Home, the core Meta/WSIP baseline, Navigation/Shell, Settings, Tools, Tournament Day and Season remain accepted for their current stage unless a concrete regression is found.

Collection / physical readiness is deferred. Do not begin it until the user explicitly reopens it after the existing application—including Format/Rotation and Blended Meta—is stable, polished and satisfactory.

## 2. Blended Meta product definition

Blended is **PTCG Tools' best estimate of the genuine competitive field at a hypothetical major-quality tournament taking place today or tomorrow**. It is a prediction derived from Online and IRL evidence, not an Online field with IRL added.

When Online and IRL share the same legal format, there is one current Blended prediction.

When their legal formats differ, there may be two legitimate current predictions, exposed separately and labelled by format, for example:

- **Blended (TEF-PBL)**;
- **Blended (MEG-PBL)**.

Locked transition decisions:

- Home defaults to the current Online-format prediction and makes the format obvious through the existing top-of-page format chip;
- Meta exposes separate format-labelled Blended options during a split;
- the current IRL-format prediction combines the latest compatible IRL major evidence with compatible Online evidence after that major, stopping when the new format became legal Online;
- that old-format Online contribution freezes at the Online legality boundary;
- newer compatible IRL tournament evidence may continue to update the old-format prediction;
- Event Prep automatically selects the prediction compatible with the event's date and legal format, while allowing user override;
- one qualifying compatible current-format Online tournament with at least 50 players is sufficient to make a Blended prediction available;
- without qualifying compatible Online evidence, that prediction is unavailable rather than silently substituting IRL-only or incompatible evidence;
- Saved Expected Fields retain the selected prediction's format and evidence provenance.

Settled-format weighting remains:

- IRL starts at 70%;
- IRL falls by 2 percentage points per day since the latest compatible IRL major weekend;
- IRL floors at 30%;
- Online receives the remaining weight.

The five transition decisions are now accepted in `FORMAT_BLENDED_V2_SPECIFICATION.md`:

1. Retain the pre-split frozen Online pool when a newer compatible old-format IRL major replaces the IRL input; explicitly retain its original dates.
2. Freeze old-format weights at the Online boundary; a newer compatible old-format major resets them to 70/30, then freezes them again.
3. Outside that exception, a new accepted same-format major resets the Online window; Blended is unavailable until one qualifying post-major Online event exists.
4. Permit explicit mismatched Saved/Edited Field overrides in Prep, visibly retaining mismatch and provenance.
5. Eligible immediately preceding non-rotation IRL contributes exactly 25% until the first target-format IRL major finishes; thereafter prior-format contribution is 0%. Rotation-incompatible evidence is immediately 0%; no usable IRL means 100% Online.

Explanation UX is also accepted: concise inline format/status, a How this is calculated drill-in for actual evidence/weights, and one shared methodology page for assumptions/version/history. Saved fields retain captured assumptions. See the canonical specification for exact windows and acceptance cases.

## 3. Immediate next checkpoint — Meta Online/IRL only

The owner authorized **Checkpoint 2: Meta Online/IRL only**. Its implementation is now awaiting review and browser acceptance; see `META_FORMATS_CHECKPOINT_2.md`. Use the shared foundation for independent source formats, event classification, retained archives and scoped evidence. Verify every actual release payload online and cached, source/label agreement, source switching, detail and reload. No new Blended or Home/WSIP/Prep integration, navigation redesign, admin/fitting tools or Collection. Preserve PR #7 and subsequent fixes; stop after Checkpoint 2 review. Do not restore PR #4/#5 or repeat the full forensic review.

The foundation and navigation repair are accepted; do not repeat them. Follow Checkpoint 2 automated and browser gates in `FORMAT_BLENDED_V2_SPECIFICATION.md`. For 15–23 September the maintained calendar admits 30C Online while IRL remains TEF–PBL; data must reflect actual played formats, never mere relabelling. Unknown or incompatible evidence stays explicit.

## 4. Format and rotation recovery

For any relevant date, the app must answer:

- which sets have been released;
- which sets are legal Online;
- which sets are legal IRL;
- the current Online format;
- the current IRL format;
- whether rotation has occurred in either environment;
- the lowest legal regulation mark or set boundary;
- the next known format change.

Online and IRL may differ. A new set becoming legal Online must not automatically change IRL evidence, and rotation must be distinct from an ordinary set release. Future announced sets with no confirmed legality date and missing/incomplete information must remain explicitly unknown rather than being guessed.

Before visible integration, agree and verify examples covering:

- a normal mid-format date;
- a new set available Online before IRL;
- a new set legal in both;
- rotation active Online but not yet IRL;
- the first IRL major in a new format;
- a future announced set without a confirmed legality date;
- missing or incomplete information.

## 5. Bounded implementation sequence

Implement in separate, finishable checkpoints:

1. **Format/Rotation foundation** — prove the agreed date/legality answers without changing visible feature behaviour.
2. **Meta Online and IRL** — show the correct independent format for each evidence source.
3. **Blended Meta v2** — add the single or dual format-labelled predictions and explicit unavailable states.
4. **Home** — consume the exact same prediction, default to current Online format and show its format chip.
5. **What Should I Play** — recommend only against the selected compatible field.
6. **Exact deck detail** — preserve compatible field selection and evaluation.
7. **Saved Expected Fields** — retain named format and evidence provenance.
8. **Event Prep** — select the event-compatible prediction automatically and preserve it when preparation is locked.
9. **Full desktop, 390px and real-iPhone acceptance** — verify the complete story on a pinned release.

Each checkpoint has explicit outcomes, exclusions, automated cases, browser checks and a hard stop in `FORMAT_BLENDED_V2_SPECIFICATION.md`.

After every checkpoint, verify Online, IRL, Blended and global navigation before continuing. Deck legality, Collection and broader card-legality expansion are not part of this recovery.

## 6. Acceptance gate

Before merge, verify:

- fresh load;
- repeated Online → IRL → Blended switching;
- a period where Online and IRL formats differ;
- a rotation boundary;
- first-major transition behaviour;
- Blended unavailable behaviour;
- Home and Meta showing the same selected prediction;
- WSIP recommendations and exact deck detail using the selected field;
- Expected Field save/load and retained provenance;
- Event Prep automatic format selection and override;
- Back/Forward and repeated navigation after areas are mounted;
- deep-page reload;
- desktop and 390 px mobile browser behaviour;
- actual iPhone Home Screen use.

Correct calculations alone are insufficient. The feature must remain responsive, tappable and navigable on the real target device. After acceptance, update the master documents, record the accepted version and stop before beginning another programme.

## 7. Subsequent programme order

**Owner update — 9 September 2026:** Finish Format/Blended Checkpoints 7–9 → prediction accuracy/fitting (separate specification/review) → a bounded UI/UX consistency pass based on the owner’s real-use findings → Collection only when explicitly reopened. This ordering supersedes the older generic sequence below. No fitting, broad UI/UX redesign or Collection is included in Checkpoint 7. Necessary regression fixes remain allowed as they arise.

1. **Whole-app stability and consistency review** — judge navigation, repeated-use responsiveness, loading/failure clarity, cross-feature consistency, cache freshness and unfinished/duplicated experiences. Turn only confirmed worthwhile findings into bounded fixes.
2. **Finish existing product areas** — genuine defects first, incomplete core workflows second, significant usability improvements third and cosmetic polish last.
3. **Learning/personal performance analysis** — only when deliberately prioritised.
4. **Collection / physical readiness** — only when explicitly reopened by the user.
5. **Development Cleanup / Release Hardening** — before calling the wider app stable/public-ready; bring earlier only if required for stability.
6. **Community/public expansion** — only when actual usage justifies it.

## 8. Operating rule

Use one dedicated chat per bounded checkpoint. Each chat must state its scope, required output, verification gate and hard stop. If confidence falls, a regression appears or the checkpoint cannot be completed within the remaining allowance, stop with a precise handoff rather than continuing into another stage.

The next action after Checkpoint 4 review is Prediction Accuracy Checkpoint 5: formula fitting and versioning. After all six accuracy checkpoints comes the owner-led UI/UX consistency pass, then Collection only when explicitly reopened. Do not start Checkpoint 5 automatically.

Checkpoint 4 follow-up: the Home hero now explicitly requests Blended on cold and mounted Meta. The owner subsequently reported this handoff failure; device retest of the correction remains pending. PR #12 includes both the handoff correction and Home methodology-link removal. On 8 September the owner authorized merging this follow-up and proceeding to Checkpoint 5.
