# Format/Rotation and Blended Meta v2 — Accepted Recovery Specification

**Status:** Checkpoints 1–5 merged and accepted. Checkpoint 6 is implemented and authorized for merge/device testing; see `EXACT_DETAIL_CHECKPOINT_6.md`. Checkpoint 7 has not started.
**Source review:** main `eb7809c5724f687c15d2d99b7af1f1f7b5365365`.
**Companions:** PTCG_TOOLS_MASTER.md; ROADMAP_HANDOFF_2026-09-07.md; HOME_ARCHITECTURE.md; WHAT_SHOULD_I_PLAY_ARCHITECTURE.md; v2-preview/apps/meta/ARCHITECTURE.md; PERFORMANCE_ARCHITECTURE.md.

This document records the forensic findings, all five subsequently approved product decisions, explanation UX, and bounded implementation gates. It supersedes provisional transition language in the failed PRs. Product acceptance is not code, deployment or real-device acceptance.

## Owner clarification — 8 September 2026

For Checkpoint 1, the owner will supply and maintain infrequent set facts manually. Do not require automatic scraping or an admin UI. Use the current user-maintained format baseline and explicit Online/IRL legality dates; preserve unknown release dates/history rather than guessing. The current seed is H–J / TEF–PBL as of 8 September; 30C is legal Online on 15 September and IRL on 24 September. Its release date, next rotation and later sets are unknown.

A rotation may be attached to its set record with the new lower mark/set boundary. Apply it independently at that set's Online/IRL legality dates; keep the operations distinct from release and ordinary set addition. This replaces the earlier blanket rejection of a rotation set flag, while retaining the ban on guessed dates, calendar-year fallbacks or rotation inferred merely from release. A separate rotation-date override is unnecessary without a real exception.

The baseline is a maintained format context, not an exhaustive card/printing inventory. Do not block the current-calendar foundation on unrelated historical/card-level completeness, and do not claim complete legal-set enumeration or individual deck legality. See `FORMAT_FOUNDATION_CHECKPOINT_1.md` for implementation, current results and the separate existing browser Back finding. All later checkpoint boundaries and P1–P5 remain unchanged.

## 1. Forensic verdict and starting point

PR #4 (47 files, 57 commits) attempted shared format configuration, transition-aware Blended, prediction performance, Settings administration, Home integration and Event Prep guards. PR #5 (17 files, eight commits) attempted five corrections: embedded registry fallback, shared/addon loader identity, historical formula draft/publish, and saved-field provenance.

The rollback commit `b26c53854781f550fe16f2c2b344b7e236fa3886` has exactly the same Git tree as accepted baseline `c3d9573234724930e02646f1c5fa414eb28ffc6a`. Use the latest rolled-back application plus accepted subsequent fixes; never overwrite later accepted work by resetting the repository.

Confirmed findings:
- Running each PR's actual release loader against its committed assets loaded core but rejected all five secondary payloads: Online history, Online matchups, Online results, IRL matchups and IRL results. The builder emitted schema version 2 throughout; the loader permitted version 2 only for core.
- The mismatch guard observed the workspace and queued writes into the same observed subtree. Repeated text/HTML replacements can sustain a microtask mutation loop. Controls were not restored when mismatch cleared. PR #5 left this unchanged.
- PR #4 loader selectors did not match the hyphenated attributes created by camelCase dataset keys. PR #5 genuinely corrected that identity problem.
- Browser format readiness waited on network configuration without an explicit timeout. Child documents independently initialised configuration.
- Home's new helper competed with the existing chart renderer; an empty prediction could still render as loading.
- Release building could assign current configuration's format to an older source dataset without validating the source format first.
- PR #5 expanded provenance, but WSIP's save call still supplied hardcoded TEF-PBL.
- Tests checked mathematics, core loading and source-string contracts, not the full integrated loading/navigation/save story. One final-major-day fixture used an Online cutoff inconsistent with its event end date.

The loading rejection was reproduced in a JavaScript harness. The guard's self-triggering mechanism is established from code. Attributing every historical untappable-navigation report to it remains inference; the original iPhone execution was not replayed. Neither PR replaced the outer persistent shell. A broad shell redesign is not justified.

Reusable ideas, independently revalidated: separate environment timelines, explicit unavailable states, mature-weight calculation tests, full Day 1 accounting, evidence provenance, stable loader identity, immutable formula/snapshot identities. Passing isolated tests never establishes app safety.

## 2. Format and Rotation foundation

For any relevant date, one shared resolver must answer:
- which sets have been released;
- which sets are legal Online and which are legal IRL;
- each environment's legal format;
- applicable rotation in each environment;
- the lowest legal regulation mark or verified set boundary;
- the next confirmed format change, with uncertainty explicitly represented.

Release, Online legality, IRL legality and rotation are separate facts. Rotation can occur without a set release that day. A new Online set must not alter IRL evidence.

Format identity represents the permitted card pool; TEF-PBL-style labels are compact display shorthand, not proof of the full legality rules. Preserve simultaneous releases and any relevant exceptions. Individual deck/card legality checks and Collection are excluded from this recovery.

Facts retain source, confirmation status and effective-date/time convention. Event legality follows the applicable environment and event date. Viewer timezone must not change the answer. Define one deterministic shared weight clock; use the selected IRL weekend's actual final calendar day as day 0. Do not derive it from an unrelated Online cutoff.

Unknowns:
- Announced set with unconfirmed legality: show announced; legality unknown.
- Missing historical coverage: do not infer the lower boundary from the first registry row.
- Undated potential change: do not claim a later dated change is certainly the next change.
- Unknown event-date format: do not silently use today's format.
- Registry changes never rewrite historical saved fields or locked snapshots.
- Verified seed facts and clearly labelled synthetic test fixtures are separate. Never adopt failed-PR seed dates as authority.

## 3. Prediction definition and evidence

Blended is the best estimate of the genuine competitive field at a hypothetical major-quality tournament today or tomorrow in its labelled target format. Online and IRL are evidence sources. A specific local field is normally better represented by an edited/Saved Expected Field.

When formats align, one current prediction exists. During a split, two target identities exist: current Online format and current IRL format. Each may independently be available or unavailable.

Availability requires at least one compatible Online tournament with 50+ players and usable field results in the applicable window. One is sufficient. Registration counts alone are not field results. No qualifying Online input means unavailable, never IRL-only or another-format substitution. No usable IRL input means 100% Online when Online qualifies.

IRL input is the latest usable compatible major weekend, combining same-format majors by Day 1 entry counts. Do not equally weight differently sized tournaments or substitute Day 2 survivors.

Normal Online window starts after that weekend finishes and ends at the latest available qualifying results. Before a usable target-format major exists, Online starts at target-format Online legality. A major in another format must not reset this target's Online window.

Classify evidence by the format actually played, not ingestion date. Preserve event identities and coverage boundaries. Retain validated same-format last-known-good evidence on ingest failure with visible freshness; never relabel it as another format. Corrections have distinguishable revisions and never rewrite saved snapshots.

## 4. Approved weighting and transition decisions

All five decisions below were explicitly accepted by the user. They are no longer open questions.

### Settled format

IRL weight = max(30%, 70% - 2 percentage points × days since the selected compatible major weekend's final day).
Online receives the remainder. Day 0: 70/30; day 10: 50/50; day 20+: 30/70.

### P1 — New old-format major during the split

At the Online legality boundary, freeze the old-format Online pool gathered after the preceding compatible major, ending immediately before the boundary.

A newer compatible old-format IRL major replaces the IRL input while retaining that frozen Online pool and its original dates. This explicitly allows Online evidence from BEFORE the newer major. It is the agreed exception to the normal post-major Online window; do not pretend its start moved forward.

### P2 — Frozen old-format weights

Freeze both the old-format Online evidence and the weight split at the Online boundary.

If a newer compatible old-format major becomes usable, reset the old prediction to 70% IRL / 30% Online, then freeze those weights again. Without new IRL evidence or a recorded data correction, that old prediction does not drift daily.

When IRL catches up, remove the old target from normal current selection. Preserve saved fields and locked snapshots.

### P3 — Empty post-major Online window

Once a new same-format major is accepted as the IRL input, reset the Online window to after that weekend. Blended is temporarily unavailable until one qualifying post-major Online event exists. Do not silently retain pre-major Online evidence in ordinary settled-format operation.

P1 is the deliberate exception for an old-format prediction during an Online/IRL split.

### P4 — Explicit Event Prep override

Allow the user to explicitly choose a mismatched Saved/Edited Field. Clearly show and retain the mismatch and override in provenance. Never relabel it as event-compatible or describe recommendations as validated for the event's format.

### P5 — Ordinary set transition prior

Before the first target-format IRL major finishes, eligible immediately preceding non-rotation IRL evidence contributes exactly 25%; target-format Online contributes 75%.

Eligibility requires the immediately preceding format, unchanged compatible rotation boundary and no other unsupported incompatibility. An arbitrary older/different format is not eligible.

After the first target-format IRL major finishes, previous-format IRL contributes 0%. If that major's field is still pending, use qualifying current-format Online alone; do not restore the previous-format prior. Once the major field is usable, apply the normal curve and P3.

Rotation-incompatible IRL contributes 0% immediately to the rotated prediction. It can still contribute to the old-format prediction, where it remains compatible. With no usable IRL evidence, use 100% Online.

The 25% allowance is for predicting field shares. It does not automatically permit previous-format H2H records.

## 5. Scenario acceptance matrix

Old/new are target format labels. Example dates in tests are synthetic unless independently verified.

| Scenario | Evidence and window | Expected behaviour |
|---|---|---|
| Normal mid-format | Latest compatible major; Online after its final day through now | One prediction; normal curve; one qualifying Online event required |
| New set Online before IRL | Old Online ends at Online change; new Online starts at new legality | Two labelled targets; old evidence/weights frozen; new 25/75 if P5 eligible, otherwise 0/100 |
| New format, no qualifying Online result | No usable new-format Online input | New target unavailable; Home does not silently substitute old |
| Both adopt new set | New-format Online and eligible IRL only | One current target; adoption alone does not supply IRL major results |
| Online rotation before IRL | Old retains compatible old evidence; new uses rotated Online | Two targets; old remains valid; new 0/100 or unavailable |
| Old-format IRL tournament tomorrow | Select old target; Online pool ends at split | Old-format prediction with frozen evidence/weight status |
| New-format hypothetical tournament tomorrow | Select new target; Online starts at new legality | Ordinary addition: 25/75 if eligible; rotation: 0/100; missing Online: unavailable |
| New old-format IRL major during split | Replace IRL; retain pre-split Online with original dates | Reset to 70/30 and freeze again (P1/P2) |
| First current-format major finishes, field pending | Prior-format IRL excluded; qualifying current Online retained | 0/100 while usable IRL evidence is pending |
| First current-format major becomes usable | New IRL weekend; Online after its final day | Normal decay; unavailable until one post-major Online event (P3) |
| Later settled-format major | Replace IRL and reset Online window | Reset normal curve and apply P3 |
| IRL rotation catches up | Only rotated current target remains | 0/100 until compatible major evidence, then normal curve/P3 |
| Announced set without dates | Preserve established present facts; future uncertainty explicit | No guessed legality or future prediction |
| No usable IRL | Online from target-format legality | 0/100 after one qualifying Online event |
| Online missing, incompatible or below 50 players | No qualifying input for target | Target unavailable; no silent substitute |
| Temporary ingest failure | Valid same-format last-known-good evidence | Show freshness; do not manufacture results or cross formats |
| Saved/locked field reopened after transition | Captured rows, format and provenance | No recalculation from today's model |

The hypothetical new-format prediction is not a requirement to attach Prep to lightweight Online tournament discovery. Compete → Online discovery remains a separate scope; this recovery adds no Online-discovery participation, preparation or results workflow.

## 6. Consumer contracts and explanation UX

### Progressive disclosure — approved

Analysis pages remain concise and decision-first:
- show prediction, format and essential status such as Early format, Online evidence frozen, or unavailable reason;
- provide a small How this is calculated link to actual weights, evidence dates, contributing tournaments and the applicable transition rule;
- provide one shared Blended methodology page recording complete assumptions, formula version and changes over time;
- Home, Meta, WSIP and Event Prep reference the same explanation; no independently maintained rule descriptions;
- saved fields retain the assumptions/version used at capture, even when today's methodology changes.

A methodology page is explanatory content, not an invitation to build the failed performance-fitting/admin subsystem during recovery. Implement explanation alongside the relevant consumer checkpoints using existing navigation ownership and visual principles.

### Home and Meta

Meta exposes separate available format-labelled predictions during a split and explains unavailable targets without offering them as usable fields. Browsing scopes do not silently change the canonical prediction.

Home defaults to current Online format. Its existing top format chip unambiguously identifies the displayed target, including when unavailable. Home and Meta consume the same prediction/revision. No second blend engine, competing renderer, additional shortcuts or perpetual skeletons for unavailable data. Grouping remains presentation only.

### WSIP and exact deck detail

Preserve exact-variant Field → Recommendations → Inspect, existing uncertainty/scoring rules, five-at-a-time presentation, and no Compare/Decide stages.

Use H2H evidence compatible with the selected target format. Combined H2H pools only compatible records and retains separate source profiles. Missing evidence remains unknown; missing prediction yields no recommendations.

Exact detail preserves variant, field and target through entry, source changes, WSIP handoff and Back. Observed Online/IRL statistics remain separate from predicted-field evaluation; never invent blended matchup statistics.

### Saved Expected Fields

Save a copy of actual selected rows and retain target format, prediction/formula version, source formats, event identities, evidence windows, actual weights, frozen status, evidence revision, capture time, selected coverage and subsequent edits/ancestry. No hardcoded current-format save arguments. Loading never recomputes the field from today's model. Legacy unknowns remain explicit.

### Event Prep

Automatically select the prediction compatible with the event's date and legal format. If that format is unknown or lacks evidence, explain unavailable; do not substitute today's prediction. Explicit choices and locked snapshots take precedence over automatic defaults. Do not guess a suitable field from names containing Local or Major.

Retain P4 overrides. Lock captures selected/edited field, complete provenance, event format and exact selected DeckVersion reference. Later evidence/configuration updates do not change the locked snapshot. Personal deck planning must remain usable when prediction evidence is unavailable; no automatic planned-to-used deck mutation.

## 7. Bounded implementation checkpoints

Each checkpoint requires a separate bounded task and a hard stop. Do not continue automatically. Preserve accepted subsequent repository fixes. Across visible checkpoints verify fresh load, repeated source changes, navigation away/back, Back/Forward and deep reload on desktop and 390px. No unbounded readiness, self-triggering render loops, duplicate initialisation or inactive-view navigation interference.

| Checkpoint | Outcome and exclusions | Automated acceptance | Browser gate and hard stop |
|---|---|---|---|
| 1. Format/Rotation foundation | Shared date resolver and reviewable fixture report; production UI behaviour unchanged. No Blended implementation, admin UI, deck legality or Collection | Independent release/legality/rotation; rotation without release; simultaneous sets; missing dates/history/lower boundary; before/at/after changes; event dates; timezone consistency; verified vs synthetic fixtures | Home/Meta/Prep still load and navigate unchanged. Stop after foundation report/review |
| 2. Meta Online/IRL | Independent correct source-format handling and required archives. No new Blended or other consumers | Reject mislabeled data; event format classification; retained archives; scoped evidence; build and load EVERY actual release payload online and cached | Source switching during splits, matchups/results/detail reload, label/data agreement. Stop |
| 3. Blended v2 | Single/dual targets, approved P1–P5 weighting/windows where applicable, provenance, unavailable states and shared methodology explanation. No Home integration or fitting/admin UI | Normal curve; 49/50 boundary; one event; frozen pools/weights; newer old major; first new major; rotation; insufficient data; normalization | Repeated target/source switching, unavailable→available, method drill-in and responsive navigation. Stop |
| 4. Home | Shared Online-target prediction and existing format chip, essential status and visible split; no Home methodology link (owner decision). No layout redesign/shortcuts/badges | Home/Meta target, revision, share and weight parity; no silent fallback; no stale chart after format update | Cold/warm return, grouping, hero handoff, unavailable display, compact 390px. Stop |
| 5. WSIP | Selected format field plus compatible H2H. No scoring redesign, Compare/Decide or personal skill model | Selection changes analysis; incompatible H2H excluded; unknown preserved; existing ranking/coverage; unavailable yields no recommendations | Targets, explanations, paging, return navigation, failure recovery without reinitialisation growth. Stop |
| 6. Exact detail | Preserve exact variant/field/format, observed vs predicted distinction. No family pages/new formula | Variant/source/format/saved-field handoff; Back/Forward; missing/incompatible evidence | WSIP→detail→WSIP, selector changes, direct reload, no underlying sibling activation. Stop |
| 7. Saved fields | Complete format/provenance save/load. No persistence redesign | Round-trip both targets; no hardcoded format; windows/weights/revisions/edits retained; later releases cannot alter copy; legacy unknowns | Save/reopen similarly named fields across both targets; existing account restoration. Stop |
| 8. Event Prep | Automatic date-compatible selection, P4 override and immutable lock. No event ingestion or tournament-day redesign | Tomorrow across boundary; unknown date/format; unavailable; override; locked choices protected; exact DeckVersion; no name-based guesses | Attending event Prep, adjust/select/override/lock/reopen; deck planning usable without prediction. Stop |
| 9. Full acceptance | Pinned-release complete-story verification. No new features or speculative cleanup | Integrated matrix; all payloads; round-trips; delayed/failed requests; stale-format rejection; bounded handler/init counts | Desktop, 390px AND actual iPhone Home Screen: cold/warm/offline/resume, transitions, deep reload, Back/Forward, save/load, lock. Record SHA and update docs; stop before next programme |

Source-string checks are supplementary, not behavioural acceptance. Do not claim real-iPhone acceptance without actual testing.

## 8. Explicit non-reuse

Do not restore/cherry-pick PR #4 or #5, or copy:
- prep-format-guard.js observer/DOM blocking and incomplete recovery;
- format-runtime.js unbounded readiness/per-document ownership and mixed live/precomputed state;
- incompatible builder/loader schema handling or unvalidated format relabelling;
- rotation inferred from release alone, inferred first-row lower bound or calendar-year rotation fallback (explicit set-linked rotation on independently supplied legality dates is allowed by the 8 September clarification);
- single Online-target blend, arbitrary different-format prior selection, newest-set rotation check, or one major cutoff across targets;
- blended-availability.js and home-format-tools.js corrective renderer overlays;
- hardcoded TEF-PBL saves or provenance-field-only tests as end-to-end proof;
- unverified registry seed facts;
- prediction-performance job, fitting/admin UI or Home shortcuts as part of this recovery;
- passing calculation/string tests as proof of integrated app safety.

Broader prediction accuracy/fitting/version-administration work is deferred, not cancelled by this specification. Its event-format selection and evidence reproducibility need separate review before future implementation.

## 9. Immediate handoff

Checkpoint 6 is implemented in `EXACT_DETAIL_CHECKPOINT_6.md` and authorized for merge/device testing. Exact detail preserves the selected variant, field snapshot, target format and H2H context across source changes, reload and WSIP return. Predicted-field evaluation is separate from observed statistics. All 116 tests pass; local browser access is blocked before page load, so owner visual acceptance remains pending. Checkpoint 7 has not started.

Checkpoint 5 passed the owner’s six tests; prediction-date advancement is confirmed, so no daily-refresh investigation is outstanding. The owner explicitly requested implementation and merge of Checkpoint 6. Stop after its device acceptance before Checkpoint 7.
