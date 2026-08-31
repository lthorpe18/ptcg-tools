# PTCG Tools V2 — Events Data Source Strategy

**Status:** Current V2 source-of-truth for event ingestion and attendance UI  
**Date:** 31 August 2026

## Decision

PTCG Tools does not depend on the old Google Sheet and does not reverse-engineer or scrape the Play! Pokémon Event Locator as its normal local-event source.

The event system combines two source classes behind one normalized schema:

```text
LOCAL EVENTS
Pokédata
→ League Cups
→ League Challenges
→ Prereleases

MAJOR EVENTS
Official Pokémon Championship Series JSON calendar
        +
RK9 enrichment where available
→ Regionals
→ Special Championships
→ Internationals
→ Worlds when present in the official feed

             ↓
normalized data/events.json
             ↓
PTCG Tools Events
```

The Events app consumes only `data/events.json`; it does not know how individual upstream providers work.

## Local events — Pokédata

Pokédata exposes a simple JSON API supporting TCG event type, latitude, longitude, radius, unit and start date.

```text
https://www.pokedata.ovh/events/api/
_tcg/{TYPE}/
_latitude/{LAT}/
_longitude/{LONG}/
_radius/{RADIUS}/
_unit/mi/
_start/{YYYY-MM-DD}
```

Current TCG values:

```text
cups
challenges
pre
```

The upstream records provide stable `guid` values, event names/types, shop/venue, date/time, address, coordinates, cost and Pokémon event URLs. Pokédata remains a discovery/index source, so PTCG Tools preserves the official Pokémon event URL for verification.

Initial Bristol-area importer configuration:

```text
League Cups        100 miles
League Challenges  60 miles
Prereleases         50 miles
```

Bristol is only the initial importer search seed, not part of event identity or permanent product logic.

## Major events — official Pokémon calendar

The canonical major-event source is Pokémon's own Championship Series JSON feed:

```text
https://championships.pokemon.com/api/events.json?locale=en-us
```

The public Championship Series page itself declares this endpoint in its event-collection configuration.

The official feed supplies:

```text
eventName_s
displayDateRange_s
uRL_s
type_s
region_s
year_s
eventLocation_s
isStreaming_b
```

`year_s` is the Championship **season year**, not always the calendar year. For example, September 2026 events belong to the 2027 season. PTCG Tools resolves displayed dates using the season convention:

```text
July–December → season year - 1
January–June   → season year
```

The official API categorizes Special Championships under `type_s = regional`, so PTCG Tools distinguishes them from ordinary Regionals using the official event name.

Major normalized types are:

```text
Regional
Special Championship
International
World Championships
```

Worlds is supported by the importer whenever it appears in the official future-event feed. As of 31 August 2026, the official future dataset contains the announced 2027 Regionals, Specials and Internationals but no future Worlds entry yet.

## RK9 enrichment

RK9 is not the canonical major calendar. It is a secondary operational source used to enrich an official Pokémon event when the same event/date exists on RK9.

Where available PTCG Tools adds:

```text
registrationUrl       TCG-specific RK9 tournament/registration URL
secondarySourceUrl    RK9 event detail URL
```

An event remains in PTCG Tools even if RK9 has not created its event page yet, because existence/date/type come from Pokémon.

## Implemented pipeline

Production importer:

```text
scripts/import_events.py
```

Scheduled workflow:

```text
.github/workflows/import-events.yml
```

Generated V2 dataset:

```text
data/events.json
```

Preview mirror:

```text
v2-preview/data/events.json
```

The workflow runs four times per day and can also be dispatched manually. It validates before publishing, leaves the previous known-good V2 dataset untouched if a refresh fails, and mirrors successful data into the GitHub Pages V2 preview.

## Current normalized schema

Top-level dataset uses schema version 4:

```json
{
  "schemaVersion": 4,
  "status": "ok",
  "lastAttemptedUpdate": "...",
  "lastSuccessfulUpdate": "...",
  "eventCount": 0,
  "sources": {},
  "events": []
}
```

Common event fields include:

```text
id
source
sourceId
scope                 local | major
type
name
venue
startDate
startTime
endDate
endTime
address
city
region
postcode
country
latitude
longitude
distanceFromSeedMiles
cost
status
officialUrl
registrationUrl
sourceUrl
secondarySourceUrl
details
```

Major records additionally retain useful Championship metadata such as `season` and `isStreaming`.

Local identity:

```text
id = "pokedata:" + sourceId
sourceId = Pokédata guid
```

Major identity is derived from the stable official Pokémon Championship event path.

## Validation and last-known-good behavior

Candidate datasets are rejected for conditions including:

- missing or duplicate IDs;
- excessive unparseable dates;
- excessive missing coordinates for local records;
- an implausibly small major-event feed;
- catastrophic total event-count collapse;
- malformed/non-JSON upstream responses.

On failure `data/events.json` is left untouched and the GitHub Action fails visibly.

## Verified production result — 31 August 2026

The combined importer successfully retrieved and validated:

```text
LOCAL
29 League Cups
55 League Challenges
0 Prereleases
84 local events

MAJORS
24 Regionals
5 Special Championships
3 Internationals
32 major events

7 majors currently enriched from RK9

116 events total
```

## Personal attendance state

The generated event dataset is public/reference data. Attendance is shared personal workspace state.

The Events UI supports:

```text
Interested
Attending
Attended
Skipped
```

Saving any status stores both the event identity and a normalized event snapshot:

```text
PlannedEvent
- eventId
- source
- sourceId
- status
- eventSnapshot
- prepId
```

For this milestone `prepId` remains null for newly saved Events-screen state. Tournament Prep creation is intentionally deferred to the Tournament Prep milestone rather than being created implicitly by the Events UI.

The snapshot preserves useful event fields at that moment. This allows later source updates to be reconciled without allowing an upstream removal/change to erase the user's plan or tournament history.

## Implemented Events UI

`apps/events` is now rebuilt in the V2 shell with three top-level views:

```text
Nearby
Majors
Attending
```

### Nearby

- Cup / Challenge / Prerelease chips;
- distance filter;
- date-range filter;
- chronological mobile-first event cards;
- direct `I'm attending` action;
- official event/details link.

### Majors

- Regionals / Specials / Internationals / Worlds chips;
- region filter;
- city/event search;
- official Pokémon Championship records independent of local distance;
- RK9 registration link shown as `Register` when enrichment exists;
- direct attendance action.

### Attending

- Upcoming combined view;
- Going-only view;
- Interested-only view;
- History view for attended/skipped/past saved events;
- saved snapshots remain usable even if an upstream event disappears.

A bottom-sheet status chooser provides the four supported statuses and allows clearing a saved status.

## Home integration

Home now surfaces the next event whose status is specifically `attending`, using the normalized `startDate`/`startTime` snapshot fields. Interested events do not replace the next confirmed tournament on Home.

## Validation checkpoint

The Events milestone was validated with:

- JavaScript parse checks for `apps/events/app.js`, shared storage and Home;
- JSON validation of `data/events.json`;
- automated DOM-reference validation between the Events HTML and JS;
- successful V2 preview publication;
- successful GitHub Pages deployment.

## Next steps

1. Build Tournament Prep as a separate milestone, starting from an attending event rather than creating prep implicitly.
2. Decide exactly when an attending event should gain a prep record and how Home hands into it.
3. Continue hardening event normalization as real source edge cases appear.
4. Later add Tournament Day and result/history integration on top of the same event identity and snapshots.
