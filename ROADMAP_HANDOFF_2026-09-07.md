# PTCG Tools — Roadmap Handoff — 7 September 2026

**Status:** Current coordination handoff after rollback and baseline stabilization
**Supersedes:** `ROADMAP_HANDOFF_2026-09-05.md`
**Companion to:** `PTCG_TOOLS_MASTER.md`, `HOME_ARCHITECTURE.md`, `WHAT_SHOULD_I_PLAY_ARCHITECTURE.md`, `v2-preview/apps/meta/ARCHITECTURE.md`, `PERFORMANCE_ARCHITECTURE.md`

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

Transition weighting must preserve the previously agreed principles: previous-format IRL evidence may contribute at no more than 25% before the first current-format major, becomes 0% after that major, and becomes 0% immediately where rotation makes it incompatible. Exact interaction between those rules and the newly locked dual-prediction case must be made explicit in the forensic/specification checkpoint before implementation.

## 3. Immediate next checkpoint — forensic review only

Review PRs #4 and #5 to establish:

- the user requirements they attempted to deliver;
- the parts that behaved correctly;
- the causes of loading, navigation, responsiveness and persistent-shell failures;
- incorrect or incomplete set, format, legality, rotation and Blended assumptions;
- reusable tests or isolated ideas, without restoring either PR wholesale.

Output a clean, user-readable Format/Rotation and Blended Meta v2 specification plus a bounded implementation plan. Do not implement during this checkpoint. Stop after presenting the specification for user approval.

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

1. **Whole-app stability and consistency review** — judge navigation, repeated-use responsiveness, loading/failure clarity, cross-feature consistency, cache freshness and unfinished/duplicated experiences. Turn only confirmed worthwhile findings into bounded fixes.
2. **Finish existing product areas** — genuine defects first, incomplete core workflows second, significant usability improvements third and cosmetic polish last.
3. **Learning/personal performance analysis** — only when deliberately prioritised.
4. **Collection / physical readiness** — only when explicitly reopened by the user.
5. **Development Cleanup / Release Hardening** — before calling the wider app stable/public-ready; bring earlier only if required for stability.
6. **Community/public expansion** — only when actual usage justifies it.

## 8. Operating rule

Use one dedicated chat per bounded checkpoint. Each chat must state its scope, required output, verification gate and hard stop. If confidence falls, a regression appears or the checkpoint cannot be completed within the remaining allowance, stop with a precise handoff rather than continuing into another stage.

The next chat is the **failed-PR forensic review and specification checkpoint only**.
