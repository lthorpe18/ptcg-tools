# PTCG Tools — Format & Blended Meta Architecture

**Status:** Implemented and targeted-validation green on `format-blended-v2-work` as of 6 September 2026; merge/deploy and real-device acceptance remain pending.

## Core principle

PTCG Tools maintains separate Online and IRL legal-format timelines. A format is identified by its inclusive legal set-code range, e.g. `TEF-PBL`. The Online-current format begins when the newest set becomes playable on Pokémon TCG Live; the IRL-current format begins on the official sanctioned-play legality date.

The shared format/runtime definition is app-wide. Meta, What Should I Play, Home, Event Prep and future legality/readiness consumers must not create their own independent interpretation of current Online/IRL format.

## Set registry

Live shared configuration is Supabase-owned and admin-editable through Settings with draft → publish. Initial/default seed also lives in-repo as a last-known-good/fallback input.

Each set record contains:
- `setCode`
- `setTitle`
- `releaseOrder` (seeded once for currently relevant Standard sets; future additions auto-increment)
- `onlineLegalDate`
- `irlLegalDate`
- `isRotationSet`
- `rotationLowerSetCode` when `isRotationSet = true`

Future sets may be added in advance. The admin user is allowlisted from authenticated Supabase identity. Non-admin users may read current published status but cannot mutate it.

The Supabase foundation for registry versions, immutable formula versions, live-formula pointer, admin allowlist, activation history and review state is applied with RLS. Browser runtime reads the published Supabase configuration and falls back to the prepared release configuration only when live config cannot be fetched.

## Format resolution

- Canonical format ID is `<lowerSetCode>-<upperSetCode>`.
- Normal set release: upper bound advances, lower bound stays fixed.
- Rotation set: upper bound advances and lower bound becomes `rotationLowerSetCode`.
- Current Online format is derived from published set entries whose `onlineLegalDate <= now`.
- Current IRL format is derived independently from `irlLegalDate <= now`.
- Event Prep resolves the IRL format that applies on the event date, not merely today's global format.
- Historical DeckVersions, event snapshots and forecast observations retain their historical format identity; current legality is evaluated separately rather than rewriting history.

## Canonical Meta inputs

- Global Blended predicts the **current Online format**.
- Online input to Blended is exactly the canonical current Online Meta field. Blended does not define an independent Online window.
- Canonical Online evidence for this model is already filtered to qualifying 50+ player tournaments.
- IRL input to Blended is always the latest Major weekend only.
- Same-weekend Majors are merged into one IRL weekend observation using their full Day 1 fields.
- Weekend grouping uses event-start/weekend semantics; the decay clock starts after the latest finishing calendar day across that grouped weekend.

The prepared Meta release carries its format. Runtime Blended compares that release format with the live current Online format. If they differ, Blended is unavailable rather than using stale previous-format evidence as if it were current.

## Blended formula versioning

Existing accepted behaviour is preserved as immutable `blended-v1` baseline.

`blended-v2` adds the agreed format-transition rules while preserving the mature-format v1 decay parameters:

- normal current-format state after a current-format Major:
  - `IRL weight = max(30%, 70% - 2 percentage points × daysSinceMajorWeekend)`
  - `Online weight = 100% - IRL weight`
- normal non-rotation new set before first current-format Major:
  - immediately previous-format Major may be used only;
  - `previous-format IRL weight = min(normal decay weight, 25%)`;
  - current-format Online gets the remainder;
- as soon as a Major weekend has occurred in the new format, previous-format contribution becomes exactly 0%; the new-format latest Major becomes the IRL input;
- rotation: from the Online rotation legality date, previous-format contribution is exactly 0%, even before any new-format IRL Major exists;
- no usable IRL input: once Online is valid, Blended may be 100% current-format Online.

Blended becomes available only once at least one qualifying current-format Online event exists. If none exists, Blended is unavailable and must not be silently replaced by another source. What Should I Play/Event Prep must require an explicit alternative valid field source rather than silently changing source.

If a previously valid current-format Online dataset is temporarily stale because ingest failed, its last successful **same-format** dataset may remain usable with visible last-updated status. Stale data from another format is never eligible.

Every output-changing formula change creates a new immutable version. Admin may publish the suggested best-fit curve, manually adjust it before publishing, reactivate an older version, or publish a historically worse formula after an explicit accuracy warning. All changes use draft/review → publish. Historical snapshots remain attached to the formula version live at capture time.

## Prediction snapshot and accuracy

For each grouped Major weekend:
- create at most one immutable prediction snapshot from the final valid Blended field on the calendar day before the earliest Day 1 start;
- capture only during the **23:00 local hour** in the timezone of the earliest-starting Major;
- if any event needed to establish the grouped weekend's earliest-start boundary has no safely known timezone, do not manufacture a UTC fallback snapshot;
- if Blended is unavailable at the snapshot boundary, do not create a valid forecast observation or substitute Online/IRL silently;
- the snapshot is one combined prediction for the grouped Major weekend;
- compare against the combined full Day 1 field once complete ingestion is available.

Snapshot evidence retained for reproducible backtesting:
- formula version;
- format ID;
- Online input field;
- IRL input field, if any;
- days since previous Major weekend final day;
- transition state;
- prescribed IRL/Online weights;
- final Blended predicted field;
- actual combined Day 1 field when available.

Headline field-distribution accuracy:

`accuracy = 100% - 0.5 × Σ |predictedShare - actualShare|`

The calculation uses the union of exact variants in predicted and actual distributions, treating absence on one side as 0%. Exact variants are canonical; family grouping remains presentation-only.

Deck-level diagnostics are display-filtered (not calculation-filtered): include decks where predicted share >= 1% OR actual share >= 1%. Show:
- top 5 biggest successes, expandable: smallest absolute percentage-point variance;
- top 5 biggest misses, expandable: largest absolute percentage-point variance;
- row fields: Deck · Predicted % · Actual % · signed Variance (pp).

## Formula fitting / review

After each completed Major weekend:
- calculate and display snapshot accuracy once the complete Day 1 field is ingested;
- show the snapshot position on the live decay curve, e.g. `Major +12 days`, plus formula version and prescribed split;
- fit one best alternative decay curve using all retained Major-weekend observations, weighted equally;
- optimise only the three mature-format parameters: starting IRL weight, daily decay rate, IRL floor;
- transition rules remain fixed policy;
- impose no artificial optimisation guardrails beyond valid 0–100 weights and internal coherence;
- compare only Best fit vs Live in normal review UI;
- make explicit how many Major-weekend data points underpin the suggestion.

The Home/Menu review badge means new model evidence is available, not that a formula change is required. It appears after a newly evaluated Major weekend produces fresh accuracy/backtest evidence and clears once the admin opens the review.

## UX visibility

Normal Meta:
- `Blended · <formatId>`;
- `Early format` indicator when relevant;
- Blended unavailable state is explicit when current-format Online evidence does not yet exist or prepared Meta evidence belongs to a different Online format.

Drill-in:
- Online/IRL contributions;
- formula version;
- current transition state.

Prediction performance:
- weekend accuracy;
- Major +N snapshot position;
- live split;
- biggest successes/misses;
- current live formula vs best-fit formula and aggregate accuracy;
- data-point count;
- admin review/publish controls where authorised.

## Event Prep format safety

Event Prep resolves the format legal on the event date through the shared runtime.

If the event's resolved format differs from the prepared Meta release format, Prep must not silently generate a suggested field or deck shortlist from the wrong format. The cross-format analytical surfaces are disabled with an explicit unavailable state until matching-format evidence exists. Exact personal deck planning remains available because it is a separate user-owned choice.

Saved/locked Event Expected Field snapshots retain the format and provenance that were actually used.

## Admin and storage

- Supabase owns live published set-format configuration and formula-version state.
- Admin identity is server/database-authorised from authenticated identity, not a client-side flag.
- Only the configured admin may mutate drafts/publish state.
- Public/authenticated users may read published configuration required for app operation.
- Settings exposes **Formats & Blended model** with registry draft/publish, formula draft/publish, best-fit adoption, historical reactivation and warning when a proposed formula backtests worse than live.

## Home shortcut

`Run tournament` is an additional Home quick action alongside Card Search, Cut / ID and Playtest. It opens the native standalone Tournament Manager directly. Tournament Manager remains Tools-owned and isolated: its local organiser tournaments do not create Compete Events, UserEventParticipation, Tournament Day, Match/Game or Season records.

## Validation status

Targeted automated coverage now includes:
- Online/IRL format divergence;
- rotation lower-bound changes;
- 25% normal-set previous-format IRL cap;
- immediate zero previous-format contribution at rotation;
- mature 70% / −2pp/day / 30% floor curve;
- stale prepared-release format rejection;
- Blended unavailable without qualifying current-format Online evidence;
- exact-variant distribution accuracy;
- >=1% diagnostic inclusion rule;
- best-fit replay across completed observations;
- 23:00-local snapshot boundary and no UTC fallback;
- Event Prep cross-format guard wiring.

`Validate Meta Lab` was green after the targeted implementation review on commit `ca681a9c9799497ec55c0dfa7453bf56b4efad25`.

This is **not yet a production acceptance statement**. Merge, broader regression validation, deploy verification and real-device smoke testing remain separate completion steps.
