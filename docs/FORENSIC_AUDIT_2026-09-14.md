# PTCG Tools forensic audit — 14 September 2026

## Scope and evidence

Read-only audit completed before documentation edits. Audited all 60 returned PRs, all 72 returned branches (see inventory for actual rows), recent main and active-branch history, every tracked Markdown document's role/status, current roadmap/master/architecture, active #60 diff/tests, workflows and generated accuracy index. No application, pipeline, model, dataset, account or calendar changes were made. No merge or deployment was requested.

**Verified** means directly supported; **Inferred** means interpretation of evidence; **Unknown** means unrecovered. Main `6e6445524bda1856a8f782b3e235e26480a6925a`; #60 `311123b25ab9783570e5d47585fa4e0473dfe9b3`. PR merge metadata, not ancestry alone, establishes completion: squash merges leave some “unmerged” git branch tips whose changes shipped.

[CURRENT_STATE](../CURRENT_STATE.md) now owns operational state; [active handoff](../handoffs/shared-format-calendar-consumers.md) owns #60 recovery. Long-term product contracts remain in existing architecture documents.

## Reconstructed findings

- **Verified:** persistent V2 app is under `v2-preview/`; root entry redirects there. Legacy `apps/` code and older shell/meta branches are not authority for current implementation.
- **Verified:** #6–18 complete the Format/Blended recovery after failed #4/#5. #19–22 implement product Prediction Accuracy. #23–58 implement current fixes/features; #59 refreshes architecture. #60 is the only open implementation PR returned.
- **Verified:** latest main changes after #59 are generated data refreshes. Pages [34887779785](https://github.com/lthorpe18/ptcg-tools/actions/runs/34887779785) succeeds at audited main.
- **Verified:** Meta archive/index at audit has one Worlds actual and no scored evaluation, because no compatible pre-Day-1 prediction exists. Implemented scoring is not equivalent to an empirically validated formula.
- **Verified:** shared format-calendar maintenance is on main; consumer integration exists only in #60. Current docs describing it as the next package are directionally correct but omit its active branch.
- **Verified:** personal Results/Game Log use Games; Tournament Day/Season use Matches; public H2H remains separate. Product field prediction remains the documented v2.1 rule. The research grid winner has not been imported.
- **Verified:** current sequence in 13 September roadmap supersedes old “Collection next”, “Settings maintenance next”, broad UI-consistency and immediate formula-fitting directions.
- **Inferred:** old branches/experimental files are retained history, not additional active workstreams without a current PR or decision. Do not restore/delete them merely from naming.
- **Unknown:** device acceptance of #60; private calendar/database state; current installed-cache versions; any unrecorded product decisions newer than the audited refs.

## Validation and genuine debt

[Main CI 34781658397](https://github.com/lthorpe18/ptcg-tools/actions/runs/34781658397), `676d669`: 242/244. [#60 CI 34883966415](https://github.com/lthorpe18/ptcg-tools/actions/runs/34883966415): 253/255. Both fail snapshot publication lookup and WSIP's `Unknown` expectation; syntax/hooks/architecture gates pass. Local #60 reproduces 253/255; focused audited-main run reproduces 18/20. Full local main attempt ended without summary and is not a full-suite result.

**Verified test failures / inferred fixture drift:** snapshot test combines mutable input JSON with fixed 2026-09-09 as-of date then requires an exact archived ID; WSIP tests changing release evidence against a fixed decision label. These do not by themselves establish corrupt production snapshots or broken recommendations. Repair fixtures/assertion assumptions without rewriting historical evidence or accepting unrelated regressions.

**Verified deferred hardening:** cache/service-worker audit, helper consolidation, sync recovery, backup/export and installed-iPhone regression are supported roadmap work, not declared current runtime defects. Old “not merged”, “browser unavailable” and “checkpoint paused” notices are stage-specific, not present blockers.

## Documentation inventory and dispositions

No historical documents are deleted/moved. Banners supersede operational status only; useful implementation explanations and accepted domain contracts remain. Generated evidence is not manually rewritten.

| Document | Finding / disposition |
|---|---|
| `PTCG_TOOLS_MASTER.md` | Retain authoritative product design; add CURRENT_STATE navigation/boundary. Its current calendar gap is main state, with implementation now tracked in #60. |
| `ROADMAP_HANDOFF_2026-09-13.md` | Retain authoritative planned sequence; add operational pointer and active-PR note. |
| `ROADMAP_HANDOFF_2026-09-03.md` | Mark SUPERSEDED; older milestone sequence. |
| `ROADMAP_HANDOFF_2026-09-04.md` | Mark SUPERSEDED; older next-milestone decision. |
| `ROADMAP_HANDOFF_2026-09-05.md` | Refresh superseded pointer; old pointer incorrectly routed to 7 September as current. |
| `ROADMAP_HANDOFF_2026-09-07.md` | Mark SUPERSEDED; filename says 7 September, body updated 12 September and claims current; maintenance/Online restrictions are stale. |
| `FORMAT_FOUNDATION_CHECKPOINT_1.md` | Historical milestone; mark operational status superseded. “No admin UI” was initial bounded scope, replaced by #51–58. |
| `META_FORMATS_CHECKPOINT_2.md` | Mark status SUPERSEDED; says unmerged/Checkpoint 3 not begun although #8 merged. |
| `BLENDED_V2_CHECKPOINT_3.md` | Retain historical implementation record; main architecture governs current formula. |
| `HOME_CHECKPOINT_4.md` | Mark status SUPERSEDED; follow-up/Checkpoint 5 pending claims outdated after #12–14. |
| `WSIP_CHECKPOINT_5.md` | Retain accepted historical milestone; subsequent references are period context. |
| `EXACT_DETAIL_CHECKPOINT_6.md` | Retain accepted historical milestone. |
| `SAVED_FIELDS_CHECKPOINT_7.md` | Retain accepted historical milestone/provenance contract. |
| `EVENT_PREP_CHECKPOINT_8.md` | Mark status SUPERSEDED; Checkpoint 9 is accepted, not in progress. |
| `FORMAT_BLENDED_CHECKPOINT_9.md` | Retain acceptance evidence; mark old next-programme direction superseded. |
| `FORMAT_BLENDED_V2_SPECIFICATION.md` | Retain recovery specification; mark programme sequencing superseded, including initial no-admin limitation. |
| `COMPETE_NAVIGATION_FIX_2026-09-08.md` | Retain cause/fix evidence; mark stale “Checkpoint 2 paused” status superseded. |
| `PREDICTION_ACCURACY_SPECIFICATION.md` | Retain technical specification; mark review/next-step status superseded by #22 and current roadmap. |
| `PREDICTION_ACCURACY_CHECKPOINT_2.md` | Retain accepted immutable-snapshot milestone. |
| `PREDICTION_ACCURACY_CHECKPOINT_3.md` | Retain accepted scoring-engine milestone. |
| `PREDICTION_ACCURACY_CHECKPOINT_4.md` | Mark review status SUPERSEDED; #22 merged. |
| `PERFORMANCE_ARCHITECTURE.md` | Retain authoritative lifecycle/performance contract. |
| `COMMUNITY_AND_ACCOUNT_ARCHITECTURE.md` | Retain authoritative account/shared-data/Settings boundary. |
| `HOME_ARCHITECTURE.md` | Retain authoritative Home contract; #60 is unmerged implementation. |
| `CARD_SEARCH_ARCHITECTURE.md` | Retain authoritative card-search contract. |
| `CARD_IMAGE_ARCHITECTURE.md` | Retain authoritative image/identity boundary. |
| `PLAYTEST_ARCHITECTURE.md` | Retain authoritative solo-play contract. |
| `SEASON_ARCHITECTURE.md` | Retain authoritative Season/CP contract. |
| `TOOLS_ARCHITECTURE.md` | Retain authoritative utility ownership. |
| `TOURNAMENT_DAY_ARCHITECTURE.md` | Retain authoritative tournament/results contract. |
| `WHAT_SHOULD_I_PLAY_ARCHITECTURE.md` | Retain authoritative decision/evidence contract. |
| `v2-preview/apps/meta/ARCHITECTURE.md` | Retain authoritative Meta runtime/data-delivery contract; add operational pointer and repository boundary. |
| Root README | Absent at audit; CURRENT_STATE plus master entry pointer supplies recovery without duplicating full design. |
| New `CURRENT_STATE.md`, `handoffs/shared-format-calendar-consumers.md`, this audit | Operational entry, substantial active-work handoff, and detailed evidence inventory respectively. |

Overlap between master/roadmap/architecture is intentional layering, not reason to delete documents. Contradictory current-state claims in older handoffs are the problem. No explicit existing document linking the two repositories into a shared roadmap was found; similar Meta/Blended terminology is a confusion risk, now addressed by explicit boundaries.

## Generated, experimental and historical material

**Verified:** `data/meta/`, `v2-preview/data/meta/release/` and event feeds contain generated evidence/releases; content-addressed snapshots/accuracy history are retained data, not disposable clutter. `artifacts/` includes historical validation artifacts. Notebook-style historical research is not this repository's active work.

**Inferred:** legacy `apps/`, old V2 publish/performance/navigation branches and recovery branches retain experiment/history value. The removed recovery-status/replacement-design documents found in older history are not current-main authorities and were not reintroduced. No deletion/archiving is performed.

## PR history (verified GitHub metadata)

| PR | Scope | Status | Merge or head |
|---|---|---|---|
| [#60](https://github.com/lthorpe18/ptcg-tools/pull/60) | Wire shared format calendar into live consumers | Open | `311123b25ab9` |
| [#59](https://github.com/lthorpe18/ptcg-tools/pull/59) | Refresh shared master architecture docs | Merged 2026-09-13 | `676d66949fc5` |
| [#58](https://github.com/lthorpe18/ptcg-tools/pull/58) | Reorganise Settings into focused pages | Merged 2026-09-13 | `65cb0583a48c` |
| [#57](https://github.com/lthorpe18/ptcg-tools/pull/57) | Fix iPhone format dates and optional tournament player count | Merged 2026-09-13 | `eb90fd8cb19f` |
| [#56](https://github.com/lthorpe18/ptcg-tools/pull/56) | Allow dropped tournaments without final placement | Merged 2026-09-13 | `324e40dc05b1` |
| [#55](https://github.com/lthorpe18/ptcg-tools/pull/55) | Space Formats & Sets date fields | Merged 2026-09-13 | `52dd898cc854` |
| [#54](https://github.com/lthorpe18/ptcg-tools/pull/54) | Simplify Formats & Sets to direct save | Merged 2026-09-13 | `7f69d3f05fd5` |
| [#53](https://github.com/lthorpe18/ptcg-tools/pull/53) | Compact Formats & Sets maintenance UI | Merged 2026-09-13 | `f33b17a07ced` |
| [#52](https://github.com/lthorpe18/ptcg-tools/pull/52) | Refine Formats & Sets around card-level legality | Merged 2026-09-13 | `272abf5107ee` |
| [#51](https://github.com/lthorpe18/ptcg-tools/pull/51) | Add shared Formats & Sets maintenance flow | Merged 2026-09-13 | `470b071f47f5` |
| [#50](https://github.com/lthorpe18/ptcg-tools/pull/50) | Restore per-deck sprite overrides | Merged 2026-09-13 | `0e5ed102147a` |
| [#49](https://github.com/lthorpe18/ptcg-tools/pull/49) | Polish Game Log and add tournament filter hierarchy | Merged 2026-09-12 | `574f35ab06ce` |
| [#48](https://github.com/lthorpe18/ptcg-tools/pull/48) | Unify training and tournament games in Game Log | Merged 2026-09-12 | `ed0970b59382` |
| [#47](https://github.com/lthorpe18/ptcg-tools/pull/47) | Compete Online tournament discovery and attendance | Merged 2026-09-12 | `958ad81d5ac3` |
| [#46](https://github.com/lthorpe18/ptcg-tools/pull/46) | Add lightweight Online tournament discovery (checkpoints 2–4) | Merged 2026-09-12 | `b2a9e9a8e2c0` |
| [#45](https://github.com/lthorpe18/ptcg-tools/pull/45) | Refresh master design docs after Results and sprite work | Merged 2026-09-12 | `028ddc0696d1` |
| [#44](https://github.com/lthorpe18/ptcg-tools/pull/44) | Fix Meta sprite spacing and crispness | Merged 2026-09-12 | `31b6bc7e3438` |
| [#43](https://github.com/lthorpe18/ptcg-tools/pull/43) | Use one canonical deck sprite renderer everywhere | Merged 2026-09-12 | `74a910739e02` |
| [#42](https://github.com/lthorpe18/ptcg-tools/pull/42) | Fix Home double-sprite positioning regression | Merged 2026-09-12 | `25a509769ee1` |
| [#41](https://github.com/lthorpe18/ptcg-tools/pull/41) | Unify deck sprite visuals across the app | Merged 2026-09-12 | `face6cc6647c` |
| [#40](https://github.com/lthorpe18/ptcg-tools/pull/40) | Fix Results mobile layout glitches | Merged 2026-09-12 | `27e6fddb263d` |
| [#39](https://github.com/lthorpe18/ptcg-tools/pull/39) | Redesign deck Results around sprite-led stats | Merged 2026-09-12 | `4780ea8380c5` |
| [#38](https://github.com/lthorpe18/ptcg-tools/pull/38) | Make Training and deck Results game-level and compact | Merged 2026-09-11 | `59a18c34e3e0` |
| [#37](https://github.com/lthorpe18/ptcg-tools/pull/37) | Add archetype, deck and version Results scopes | Merged 2026-09-11 | `f54aed4279ab` |
| [#36](https://github.com/lthorpe18/ptcg-tools/pull/36) | Add Deck Results v1 | Merged 2026-09-11 | `d88c75bb3b81` |
| [#35](https://github.com/lthorpe18/ptcg-tools/pull/35) | Unify Home deck sprite rendering | Merged 2026-09-11 | `d54f70579d30` |
| [#34](https://github.com/lthorpe18/ptcg-tools/pull/34) | Polish Home bottom actions | Merged 2026-09-11 | `7e9b0f00ebe6` |
| [#33](https://github.com/lthorpe18/ptcg-tools/pull/33) | Remove duplicate saved Expected Field choice | Merged 2026-09-11 | `52f7a3d67259` |
| [#32](https://github.com/lthorpe18/ptcg-tools/pull/32) | Compact WSIP context card | Merged 2026-09-11 | `22eb60c6b6b3` |
| [#31](https://github.com/lthorpe18/ptcg-tools/pull/31) | Simplify What Should I Play setup | Merged 2026-09-11 | `6ec3bd4b4300` |
| [#30](https://github.com/lthorpe18/ptcg-tools/pull/30) | Tighten Compete tab labels | Merged 2026-09-11 | `b244f7a60bbc` |
| [#29](https://github.com/lthorpe18/ptcg-tools/pull/29) | Standardise area headers and top selectors | Merged 2026-09-11 | `a9863dd97ddb` |
| [#28](https://github.com/lthorpe18/ptcg-tools/pull/28) | Polish Training history and tournament entry | Merged 2026-09-11 | `9451b16edc3e` |
| [#27](https://github.com/lthorpe18/ptcg-tools/pull/27) | Streamline PTCGL Training import | Merged 2026-09-11 | `c73578d756c6` |
| [#26](https://github.com/lthorpe18/ptcg-tools/pull/26) | Unify archetype search across Settings and Training | Merged 2026-09-11 | `ae4d968a284c` |
| [#25](https://github.com/lthorpe18/ptcg-tools/pull/25) | Resolve MEP promo artwork via official set code | Merged 2026-09-11 | `4a465642d3bd` |
| [#24](https://github.com/lthorpe18/ptcg-tools/pull/24) | Exclude Pocket cards and remove no-art Card Search tiles | Merged 2026-09-11 | `b239dd10da17` |
| [#23](https://github.com/lthorpe18/ptcg-tools/pull/23) | Fix Card Search and Blended defaults | Merged 2026-09-11 | `ef2839b709e1` |
| [#22](https://github.com/lthorpe18/ptcg-tools/pull/22) | Prediction accuracy checkpoint 4: Meta interface | Merged 2026-09-10 | `337934212b35` |
| [#21](https://github.com/lthorpe18/ptcg-tools/pull/21) | Prediction accuracy checkpoint 3: scoring engine | Merged 2026-09-09 | `e543e1367c1f` |
| [#20](https://github.com/lthorpe18/ptcg-tools/pull/20) | Prediction accuracy checkpoint 2: immutable snapshots | Merged 2026-09-09 | `741b5d97d1a9` |
| [#19](https://github.com/lthorpe18/ptcg-tools/pull/19) | Prediction accuracy checkpoint 1: specification and data audit | Merged 2026-09-09 | `309e630c34a3` |
| [#18](https://github.com/lthorpe18/ptcg-tools/pull/18) | Checkpoint 9: full connected acceptance gate | Merged 2026-09-09 | `f645840a90eb` |
| [#17](https://github.com/lthorpe18/ptcg-tools/pull/17) | Checkpoint 8: event-compatible fields and exact preparation locks | Merged 2026-09-09 | `9e3453edc493` |
| [#16](https://github.com/lthorpe18/ptcg-tools/pull/16) | Checkpoint 7: reliable saved field format and provenance round trips | Merged 2026-09-09 | `6421d06c34c8` |
| [#15](https://github.com/lthorpe18/ptcg-tools/pull/15) | Checkpoint 6: preserve exact deck and selected field | Merged 2026-09-09 | `e27a9140dfb9` |
| [#14](https://github.com/lthorpe18/ptcg-tools/pull/14) | Checkpoint 5: canonical WSIP fields and compatible H2H | Merged 2026-09-09 | `4380f8cbc4cf` |
| [#13](https://github.com/lthorpe18/ptcg-tools/pull/13) | Checkpoint 4: consume Home Blended route once | Merged 2026-09-08 | `8ae4ccbb16d1` |
| [#12](https://github.com/lthorpe18/ptcg-tools/pull/12) | Checkpoint 4: concise Home and correct Blended handoff | Merged 2026-09-08 | `1f0dace3fe1b` |
| [#11](https://github.com/lthorpe18/ptcg-tools/pull/11) | Checkpoint 4: canonical Blended prediction on Home | Merged 2026-09-08 | `4df1a23b119a` |
| [#10](https://github.com/lthorpe18/ptcg-tools/pull/10) | Simplify Blended calculation explanation | Merged 2026-09-08 | `77f12fcac9e0` |
| [#9](https://github.com/lthorpe18/ptcg-tools/pull/9) | Checkpoint 3: Blended Meta v2 | Merged 2026-09-08 | `431c7e95d39f` |
| [#8](https://github.com/lthorpe18/ptcg-tools/pull/8) | Checkpoint 2: independent Online/IRL formats and retained Meta evidence | Merged 2026-09-08 | `80bf40b42f65` |
| [#7](https://github.com/lthorpe18/ptcg-tools/pull/7) | Fix Compete freeze when attending-event Prep links render | Merged 2026-09-08 | `94bc0775a068` |
| [#6](https://github.com/lthorpe18/ptcg-tools/pull/6) | Checkpoint 1: maintained Format/Rotation calendar and validation report | Merged 2026-09-08 | `14fe13bccad6` |
| [#5](https://github.com/lthorpe18/ptcg-tools/pull/5) | Fix final Blended v2 production integration gaps | Merged 2026-09-06 | `1ed9b12806c4` |
| [#4](https://github.com/lthorpe18/ptcg-tools/pull/4) | Implement shared format registry and Blended Meta v2 | Merged 2026-09-06 | `0a30b6343848` |
| [#3](https://github.com/lthorpe18/ptcg-tools/pull/3) | Rework Meta data delivery architecture | Merged 2026-09-05 | `0bcda945aa5d` |
| [#2](https://github.com/lthorpe18/ptcg-tools/pull/2) | Publish V2 preview snapshot | Merged 2026-08-31 | `cf6fea3863bd` |
| [#1](https://github.com/lthorpe18/ptcg-tools/pull/1) | Add Deck stats panel to Decklist Manager and new Events app (cards + map) | Merged 2026-03-19 | `f0b94eadff2a` |

## Branch inventory

“Retained branch” does not imply open work. No unreferenced historical branch is promoted to active solely because its tip is not an ancestor after a squash merge.

| Branch | Audited tip | Classification |
|---|---|---|
| `checkpoint-1-format-foundation` | `1ad72d5026eb` | Verified merged PR; retained branch #6 |
| `checkpoint-2-meta-formats` | `9d8a264e8b20` | Verified merged PR; retained branch #8 |
| `checkpoint-3-blended-v2` | `95bc2cf4084c` | Verified merged PR; retained branch #11 |
| `checkpoint-4-concise-home` | `dc38c398eb39` | Verified merged PR; retained branch #12 |
| `checkpoint-4-route-cleanup` | `23bf3e33dcb5` | Verified merged PR; retained branch #13 |
| `checkpoint-5-compatible-wsip` | `166de2b7b301` | Verified merged PR; retained branch #14 |
| `checkpoint-6-detail` | `6ad50057bf07` | Verified merged PR; retained branch #15 |
| `checkpoint-7-saved-fields` | `deee636342e3` | Verified merged PR; retained branch #16 |
| `checkpoint-8-event-prep` | `4b1e0e2bd59d` | Verified merged PR; retained branch #17 |
| `checkpoint-9-connected-acceptance` | `42e7586bdd9c` | Verified merged PR; retained branch #18 |
| `codex/meta-sprite-spacing` | `bcbd288ca7f2` | Inferred historical/experimental; no PR in returned inventory, no current authorisation recovered |
| `codex/suggest-improvements-to-web-application` | `fa24248ceacc` | Verified merged PR; retained branch #1 |
| `docs/refresh-master-2026-09-13` | `cf71d5475255` | Verified merged PR; retained branch #59 |
| `feat/online-filters-attendance` | `4a60afea0acf` | Verified merged PR; retained branch #47 |
| `feat/online-tournament-feed` | `c2abeb7b6f5e` | Verified merged PR; retained branch #46 |
| `fix/archetype-consistency` | `86387d3228cc` | Verified merged PR; retained branch #26 |
| `fix/card-search-no-pocket-artwork` | `64b05ca94d32` | Verified merged PR; retained branch #24 |
| `fix/mep-official-set-code` | `7f4a36635e79` | Verified merged PR; retained branch #25 |
| `fix/ptcgl-import-flow` | `278bf38968e0` | Verified merged PR; retained branch #27 |
| `fix/sol-high-polish-chunk-1` | `d9556e31ec15` | Verified merged PR; retained branch #23 |
| `fix/training-history-tournament-polish` | `79a6c0bf15d9` | Verified merged PR; retained branch #28 |
| `fix/wsip-single-saved-field-picker` | `376c2439da2b` | Verified merged PR; retained branch #33 |
| `fix-compete-navigation` | `61eb4cc3a826` | Verified merged PR; retained branch #7 |
| `format-blended-v2-corrections` | `db33d1e71565` | Verified merged PR; retained branch #5 |
| `format-blended-v2-work` | `26626f1524df` | Verified merged PR; retained branch #4 |
| `format-blended-v2` | `0253ebff8403` | Inferred historical/experimental; no PR in returned inventory, no current authorisation recovered |
| `format-registry-blended-v2-recovery` | `86918b3e7b80` | Inferred historical/experimental; no PR in returned inventory, no current authorisation recovered |
| `main` | `6e6445524bda` | Verified default |
| `meta-data-architecture` | `31bba2296984` | Verified merged PR; retained branch #3 |
| `meta-lab-build` | `f0b94eadff2a` | Inferred historical/experimental; no PR in returned inventory, no current authorisation recovered |
| `meta-navigation-rework` | `1eafd3e8178e` | Inferred historical/experimental; no PR in returned inventory, no current authorisation recovered |
| `perf-persistent-shell-test` | `2c9200b559f4` | Inferred historical/experimental; no PR in returned inventory, no current authorisation recovered |
| `perf-shell-isolated` | `61a9a58f8ea1` | Inferred historical/experimental; no PR in returned inventory, no current authorisation recovered |
| `polish/home-bottom-actions` | `772167be63ea` | Verified merged PR; retained branch #34 |
| `polish/home-deck-sprite` | `11ce522aa5ad` | Verified merged PR; retained branch #35 |
| `prediction-accuracy-1-spec` | `aa19edd1afb8` | Verified merged PR; retained branch #19 |
| `prediction-accuracy-2-snapshots` | `97ddcfcf6b46` | Verified merged PR; retained branch #20 |
| `prediction-accuracy-3-engine` | `e4d3c69b2cf6` | Verified merged PR; retained branch #21 |
| `prediction-accuracy-4-ui` | `6b1c19d36240` | Verified merged PR; retained branch #22 |
| `ptcg-tools-v2` | `29fb9c5f872e` | Inferred historical/experimental; no PR in returned inventory, no current authorisation recovered |
| `sol/canonical-sprite-renderer-everywhere` | `1f5a217912f0` | Verified merged PR; retained branch #43 |
| `sol/compact-formats-settings` | `7428ac3d4011` | Verified merged PR; retained branch #53 |
| `sol/deck-results-scopes` | `4a2381fd2ee0` | Verified merged PR; retained branch #37 |
| `sol/deck-results-v1` | `f87b11b3df5c` | Verified merged PR; retained branch #36 |
| `sol/deck-sprite-override` | `62bd2b7986ee` | Verified merged PR; retained branch #50 |
| `sol/direct-format-save` | `5f6610dfc417` | Verified merged PR; retained branch #54 |
| `sol/fix-home-sprite-positioning` | `260f344cbbb8` | Verified merged PR; retained branch #42 |
| `sol/fix-sprite-density-and-meta-spacing` | `00b0fd1211e8` | Verified merged PR; retained branch #44 |
| `sol/format-calendar-persistence` | `2f936d8d5931` | Verified merged PR; retained branch #51 |
| `sol/format-date-spacing` | `fa353d38d4eb` | Verified merged PR; retained branch #55 |
| `sol/formats-settings-refine` | `ba1807626b05` | Verified merged PR; retained branch #52 |
| `sol/game-log-wp1-polish` | `69710a064aeb` | Verified merged PR; retained branch #49 |
| `sol/iphone-date-fields-optional-player-count` | `2620b5b2b0d7` | Verified merged PR; retained branch #57 |
| `sol/results-game-level-ux` | `f6ea105abbd5` | Verified merged PR; retained branch #38 |
| `sol/results-mobile-visual-fixes` | `30e17e2a0155` | Verified merged PR; retained branch #40 |
| `sol/results-sprite-stats-ui` | `ca8ac78be51d` | Verified merged PR; retained branch #39 |
| `sol/settings-hub-reorganisation` | `ed23e59dcb77` | Verified merged PR; retained branch #58 |
| `sol/shared-format-calendar-consumers` | `311123b25ab9` | Verified open work #60 |
| `sol/tournament-drop-placement` | `26a63c0df814` | Verified merged PR; retained branch #56 |
| `sol/unified-game-log` | `3d7d345d57bd` | Verified merged PR; retained branch #48 |
| `sol/unify-deck-sprite-visuals` | `dc6053979d4b` | Verified merged PR; retained branch #41 |
| `sol/update-master-docs-2026-09-12` | `552d0a8e401c` | Verified merged PR; retained branch #45 |
| `ui/compete-tab-label-fit` | `29074e6fce84` | Verified merged PR; retained branch #30 |
| `ui/shared-area-chrome-consistency` | `e981224dd5a6` | Verified merged PR; retained branch #29 |
| `ui/wsip-compact-context` | `d8870ceb0d58` | Verified merged PR; retained branch #32 |
| `ui/wsip-simplify` | `e6e0fc1bcc4e` | Verified merged PR; retained branch #31 |
| `v2-preview-publish` | `b9bbeb673d7e` | Inferred historical/experimental; no PR in returned inventory, no current authorisation recovered |
| `v2-preview-publish-check` | `b9bbeb673d7e` | Inferred historical/experimental; no PR in returned inventory, no current authorisation recovered |
| `v2-preview-publish-check2` | `b9bbeb673d7e` | Inferred historical/experimental; no PR in returned inventory, no current authorisation recovered |
| `v2-preview-publish-final` | `cf6fea3863bd` | Inferred historical/experimental; no PR in returned inventory, no current authorisation recovered |
| `v2-preview-publish-final2` | `cf6fea3863bd` | Inferred historical/experimental; no PR in returned inventory, no current authorisation recovered |
| `v2-preview-publish-pr` | `cf6fea3863bd` | Verified merged PR; retained branch #2 |

## Decisions needed before development continues

1. Accept/test #60 and decide separately about its merge; nothing in this consolidation merges it.
2. Resolve the two baseline validation failures through a scoped fixture/validation repair.
3. After calendar acceptance, use the current product roadmap; no decision to adopt research weights or reopen Collection is evidenced.
