# PTCG Tools V2 — Events Data Source Strategy

**Status:** Current V2 source-of-truth for event ingestion  
**Date:** 31 August 2026

## Decision

PTCG Tools will not depend on the old Google Sheet and will not reverse-engineer or scrape the Play! Pokémon Event Locator as its normal local-event source.

The event system will combine two source classes behind one normalized schema:

```text
LOCAL EVENTS
Pokédata
→ League Cups
→ League Challenges
→ Prereleases

MAJOR EVENTS
Pokémon Championship Series calendar
+ RK9 practical registration/event details where available
→ Regionals
→ Special Championships
→ Internationals
→ Worlds

             ↓
normalized data/events.json
             ↓
PTCG Tools Events
```

The app consumes only `data/events.json`; it does not know how individual upstream providers work.

## Why Pokédata for local events

Pokédata exposes a simple JSON API that supports TCG event type, latitude, longitude, radius, unit and start date. It requires no login, browser automation or anti-bot workaround.

Current endpoint pattern:

```text
https://www.pokedata.ovh/events/api/
_tcg/{TYPE}/
_latitude/{LAT}/
_longitude/{LONG}/
_radius/{RADIUS}/
_unit/mi/
_start/{YYYY-MM-DD}
```

Current TCG event values used by PTCG Tools:

```text
cups
challenges
pre
```

The upstream records provide stable `guid` values, event names/types, shop/venue, date/time, address, coordinates, cost and Pokémon event URLs. This is sufficient for local discovery and stable personal event identity.

Pokédata explicitly warns users to verify exact event information with the league. Therefore PTCG Tools should present Pokédata as the discovery/index source and preserve the official Pokémon URL for verification.

## Why majors are separate

Pokédata contains historical major-event standings, but no equally clear supported future-major-event API has been established.

Major events therefore use a separate provider adapter. Target source hierarchy:

1. Pokémon Championship Series calendar — canonical event existence/date/type.
2. RK9 — practical registration, venue and event-specific details where available.

Major events are not constrained by the normal local distance radius. The Events UI should eventually expose a distinct `Majors` view/filter.

## Current implemented pipeline

Production-shaped importer:

```text
scripts/import_events.py
```

Scheduled workflow:

```text
.github/workflows/import-events.yml
```

Generated public dataset:

```text
data/events.json
```

Initial local search seed is Bristol-area coordinates. This is importer configuration, not part of the event identity or permanent UI logic.

Current configured local radii:

```text
League Cups        100 miles
League Challenges  60 miles
Prereleases         50 miles
```

The GitHub Action runs four times per day and can also be dispatched manually. It validates the generated JSON before committing it.

## Normalized event schema

Top-level dataset:

```json
{
  "schemaVersion": 2,
  "status": "ok",
  "lastAttemptedUpdate": "...",
  "lastSuccessfulUpdate": "...",
  "eventCount": 0,
  "sources": {},
  "events": []
}
```

Normalized event fields currently include:

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
details
```

The current local event identity is:

```text
id = "pokedata:" + sourceId
sourceId = Pokédata guid
```

The major provider adapter must produce the same event shape.

## Validation and last-known-good behavior

A bad refresh must not destroy the previous usable dataset.

The importer rejects candidate data for conditions including:

- missing or duplicate IDs;
- excessive unparseable dates;
- excessive missing coordinates for local records;
- catastrophic event-count collapse versus previous known-good coverage;
- non-JSON or failed upstream responses.

If the importer exits unsuccessfully, it deliberately leaves the existing `data/events.json` untouched and the GitHub Action fails visibly.

## Personal attendance state

The generated event dataset is public/reference data. `I'm attending` is personal shared-workspace state.

When the user marks an event as attending, persist both its source identity and a normalized snapshot:

```text
PlannedEvent
- eventId
- source
- sourceId
- status
- eventSnapshot
- prepId
```

`eventSnapshot` should contain the useful normalized event fields at that moment.

This means:

- future upstream changes can be reconciled using `sourceId`;
- an event disappearing upstream does not erase the user's plan or tournament history;
- attended events remain historically meaningful after Pokédata/RK9 stop listing them.

## UI contract

The future V2 Events screen should consume only the normalized dataset and personal attendance state.

Target top-level views:

```text
Nearby
Majors
Attending
```

Nearby supports Cup / Challenge / Prerelease filters, date and distance. Majors shows relevant Championship Series events regardless of local radius. Attending combines any event type the user has marked as attending.

Every event should expose the best authoritative/practical external link available.

## Current proof

The first successful GitHub Action import on 31 August 2026 retrieved and validated:

```text
29 League Cups
55 League Challenges
0 Prereleases
84 local events total
```

The resulting normalized dataset was committed to `data/events.json`.

## Next steps

1. Inspect the generated local records for field-quality edge cases and improve normalization where useful.
2. Implement the major-event provider adapter using Pokémon calendar data plus RK9 details.
3. Validate a combined local + major `data/events.json`.
4. Remove the obsolete Event Locator browser-probe tooling.
5. Rebuild `apps/events` in the V2 shell against the normalized dataset.
6. Add `Interested / Attending / Attended / Skipped` personal state with event snapshots in the shared Supabase workspace.
7. Surface the next attending event on Home and hand it into Tournament Prep.
