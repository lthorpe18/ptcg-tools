# PTCG Tools — Format & Blended Meta Architecture

**Status:** Implementation contract agreed 6 September 2026

## Core principle

PTCG Tools maintains separate Online and IRL legal-format timelines. A format is identified by its inclusive legal set-code range, e.g. `TEF-PBL`. The Online-current format begins when the newest set becomes playable on Pokémon TCG Live; the IRL-current format begins on the official sanctioned-play legality date.

## Set registry

Live shared configuration is Supabase-owned and admin-editable through Settings with draft → publish. Initial/default seed may also live in-repo.

Each set record contains:
- `setCode`
- `setTitle`
- `releaseOrder` (seeded once for currently relevant Standard sets; future additions auto-increment)
- `onlineLegalDate`
- `irlLegalDate`
- `isRotationSet`
- `rotationLowerSetCode` when `isRotationSet = true`

Future sets are added in advance. The admin user is allowlisted from authenticated Supabase identity. Non-admin users may read current published status but cannot mutate it.

## Format resolution

- Canonical format ID is `<lowerSetCode>-<upperSetCode>`.
- Normal set release: upper bound advances, lower bound stays fixed.
- Rotation set: upper bound advances and lower bound becomes `rotationLowerSetCode`.
- Current Online format is derived from published set entries whose `onlineLegalDate <= now`.
- Current IRL format is derived independently from `irlLegalDate <= now`.
- Future Event Prep resolves the format that applies on the event date, not merely today's global format.

## Canonical Meta inputs

- Online input to Blended is exactly the canonical current Online Meta field. Blended does not define an independent Online window.
- IRL input to Blended is always the latest Major weekend only.
- Same-weekend Majors are merged into one IRL weekend observation using their full Day 1 fields.
- Weekend grouping uses event-start/weekend semantics; the decay clock starts after the latest finishing day across that grouped weekend.

## Blended formula versioning

Existing accepted behaviour is preserved as `blended-v1` baseline.

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

Blended becomes available only once at least one qualifying current-format Online event exists. The Online pipeline already filters to 50+ player events. If none exists, Blended is unavailable and must not be silently replaced by another source. If a previously valid current-format Online dataset is temporarily stale because ingest failed, its last successful current-format dataset may remain usable with visible last-updated status.

Every output-changing formula change creates a new immutable version. Admin may publish the suggested best-fit curve, manually adjust it before publishing, reactivate an older version, or publish a historically worse formula after an explicit accuracy warning. All changes use draft/review → publish. Historical snapshots remain attached to the formula version live at capture time.

## Prediction snapshot and accuracy

For each Major weekend:
- create one immutable prediction snapshot from the final Blended field on the calendar day before the earliest Day 1 start;
- use the local timezone of the earliest-starting Major for the day boundary;
- the snapshot is one combined prediction for the grouped Major weekend;
- compare against the combined full Day 1 field once ingestion is complete.

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
- immediately calculate and display snapshot accuracy;
- show the snapshot position on the live decay curve, e.g. `Major +12 days`, plus formula version and prescribed split;
- fit a best alternative decay curve using all retained Major-weekend observations, weighted equally;
- optimise only the three mature-format parameters: starting IRL weight, daily decay rate, IRL floor;
- transition rules remain fixed policy;
- impose no artificial optimisation guardrails beyond valid 0–100 weights and internal coherence;
- compare only Best-fitting vs Live in normal review UI;
- make explicit how many Major-weekend data points underpin the suggestion.

The Home/Menu review badge means new model evidence is available, not that a formula change is required. It appears after a newly ingested Major weekend produces a fresh accuracy/backtest result and clears once the admin opens the review.

## UX visibility

Normal Meta:
- `Blended · <formatId>`;
- `Early format` indicator when relevant;
- Blended unavailable state is explicit when current-format Online evidence does not yet exist.

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

## Admin and storage

- Supabase owns live published set-format configuration and formula-version state.
- Admin identity is server/database-authorised from authenticated identity, not a client-side flag.
- Only the current sole admin may mutate drafts/publish state.
- Public/authenticated users may read published configuration required for app operation.

## Home shortcut

Add `Run tournament` as an additional Home quick action alongside Card Search, Cut / ID and Playtest. It opens the native standalone Tournament Manager directly. Tournament Manager remains Tools-owned and isolated: its local organiser tournaments do not create Compete Events, UserEventParticipation, Tournament Day, Match/Game or Season records.
