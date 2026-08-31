# PTCG Tools V2 — Official Event Locator Integration Approach

**Status:** Technical direction for V2.3 Events  
**Date:** 31 August 2026  
**Canonical upstream:** Official Play! Pokémon Event Locator (`events.pokemon.com/EventLocator`)

## Decision

PTCG Tools should ingest official Play! Pokémon event data **server-side on a schedule** and publish a validated, normalised repository dataset for the mobile app.

The production client must **not** scrape the Pokémon Event Locator in the user's browser and must **not** rely on the old manually maintained Google Sheet.

Target flow:

```text
Official Play! Pokémon Event Locator
        ↓
GitHub Actions importer
        ↓
normalise + validate + compare with last known good
        ↓
data/events.json
        ↓
PTCG Tools Events UI
```

## What the investigation established

The current Event Locator is an OutSystems Reactive Web application behind Imperva/Incapsula browser protection.

A plain headless Playwright request can be challenged before the application renders, so browser-DOM scraping is not a dependable foundation.

However, the application's public JavaScript bundles are accessible and expose the actual OutSystems screen-service routes used by the locator.

Current Home screen data actions identified from the live bundle include:

```text
screenservices/EventLocator/MainFlow/Home/DataActionGetEventList
screenservices/EventLocator/MainFlow/Home/DataActionGetLocations
screenservices/EventLocator/MainFlow/Home/DataActionGetFilters
screenservices/EventLocator/MainFlow/Home/DataActionGetPremierEventsByStartDate
screenservices/EventLocator/MainFlow/Home/DataActionGetRelatedEvents
screenservices/EventLocator/MainFlow/Home/DataActionGetBatchConfig
screenservices/EventLocator/MainFlow/Home/ScreenDataSetGetPremierEventTypes
```

The current `DataActionGetEventList` API/version token exposed by the frontend is:

```text
lbKy3fbhrLZ5eb1JFcZNZw
```

This token must be treated as implementation metadata discovered dynamically, **not** as a permanent constant. A Pokémon deployment may change it.

The frontend also confirms the current input/query concepts:

```text
locale
filters
latitude
longitude
range
iskm
SortDistance
```

and relevant client variables include:

```text
StartDate
EndDate
Latitude
Longitude
Range
IsKm
IsShowEvents
AreEventsBeingSearched
FilterEventTypes
UserLocale
LocationName
```

The locator currently exposes useful event filters including Cup, Challenge, Prerelease, League and Friendly Tournament, plus product type including Pokémon Trading Card Game.

## Preferred ingestion strategy

### Strategy A — direct OutSystems screen-service call

This is the preferred production architecture.

The importer should:

1. fetch the current Event Locator application/bootstrap metadata and/or public JS bundle;
2. discover the current `DataActionGetEventList` endpoint metadata rather than assuming the action token never changes;
3. construct the same OutSystems payload the official frontend sends, including current `versionInfo`, screen variables and client variables;
4. POST to the official `DataActionGetEventList` screen service;
5. parse its structured JSON response;
6. normalise only the fields PTCG Tools needs.

Advantages:

- structured source data rather than DOM parsing;
- materially less fragile than CSS selectors;
- no browser engine in the production importer if Pokémon accepts the direct service request;
- easier schema validation and deduplication;
- event IDs, dates, coordinates and event metadata remain machine-readable.

### Strategy B — browser bootstrap + direct service call

If Imperva requires a valid browser session before accepting the screen-service request, use SeleniumBase/CDP only to establish the official site session and collect the required cookies/bootstrap values.

Then perform the structured `DataActionGetEventList` request using that session.

This keeps browser automation away from the actual data extraction and still avoids parsing rendered event cards.

### Strategy C — rendered DOM extraction

Use only as a last-known fallback if the underlying service becomes inaccessible independently.

If ever required:

- SeleniumBase/CDP is currently more successful against this locator than ordinary Playwright;
- extract stable data attributes/links rather than relying only on visual CSS structure;
- retain the same validation and last-known-good safety layer;
- surface the importer as degraded/fallback mode in metadata.

Do not make Strategy C the normal production path unless A and B have been proven unworkable.

## Geographic ingestion scope

PTCG Tools does not need to download every Pokémon event worldwide for the personal-first V2 implementation.

Initial scope should cover a useful UK search region around the user's relevant geography, with enough radius to find realistic Cups/Challenges/Prereleases that might be travelled to.

Recommended first implementation:

- run several fixed UK geographic search centres with overlapping radii;
- request TCG events only where the upstream filter permits;
- union results by stable official event ID/GUID;
- retain coordinates so the app can calculate actual user-to-event distance locally;
- make expansion to all-UK or additional countries a configuration change rather than an Events UI rewrite.

Do not make Bristol itself part of the event schema or product logic; it is only an importer search seed.

## Normalised event schema

Proposed generated `data/events.json`:

```json
{
  "schemaVersion": 1,
  "source": "play-pokemon-event-locator",
  "sourceMode": "screen-service",
  "lastAttemptedUpdate": "...",
  "lastSuccessfulUpdate": "...",
  "eventCount": 0,
  "events": []
}
```

Each normalised event should aim to contain:

```text
officialEventId
locationGuid
displayId
name
eventType
productType
venue
address
city
region
postcode
country
latitude
longitude
startTime
endTime
registrationUrl
officialUrl
organizerName
sourceUpdatedAt (if supplied upstream)
```

Retain the raw upstream identifiers needed to construct an official Event Locator/detail link even if the official site changes its display URL format.

## Validation / last-known-good gate

A scheduled refresh must never blindly overwrite the previous dataset.

Reject a new candidate dataset if any major validation fails, including:

- response is empty when the previous dataset was materially populated, unless there is strong evidence this is legitimate;
- response shape is no longer recognised;
- event identifiers are absent or unusably duplicated;
- dates do not parse or are implausible;
- coordinates/location fields disappear for an abnormal proportion of records;
- TCG/event classification can no longer be determined;
- event count drops catastrophically (initial guard: >80% versus comparable previous coverage) without an explicit schema/source explanation;
- the upstream returns an Imperva/hCaptcha/error page instead of event data.

On failure:

```text
lastAttemptedUpdate = now
lastSuccessfulUpdate = unchanged
published events = previous known-good dataset
status = stale/import-failed
```

The GitHub Action should fail visibly as well.

## Update cadence

Initial production cadence:

```text
4 times per day
```

This is frequent enough for local event discovery while remaining conservative toward the upstream service.

The mobile app should never make freshness dependent on the user pressing Refresh.

## Events UI contract

The V2 Events UI should consume only the normalised repository dataset, not know about OutSystems request details.

This keeps the UI stable if the importer changes implementation later.

Initial UI should support:

- nearby/all/favourite views;
- Cup / Challenge / Prerelease / other relevant TCG filters;
- date range;
- distance;
- list/map;
- venue, date/time and official link;
- visible data freshness/status;
- prominent `I'm attending` action.

`I'm attending` remains personal app state in the shared Supabase workspace and does not alter the generated public event dataset.

## Personal event identity

Persist personal intent using the upstream stable event identifier where possible:

```text
PlannedEvent.eventId = Event.officialEventId
```

Also snapshot the useful event fields at the moment the user marks it attending so later upstream changes/removal do not erase tournament history.

## Current investigation tooling

The branch contains temporary diagnostic tooling:

```text
scripts/event-locator-probe.mjs
scripts/event_locator_selenium_probe.py
.github/workflows/event-locator-probe.yml
```

These are investigation tools, not the intended production importer.

Once the direct-service contract is proven, replace them with a small deterministic importer and remove the unnecessary browser probe jobs.

## Next implementation steps

1. Finish reconstructing the current OutSystems `DataActionGetEventList` request payload from the public runtime/bundle.
2. Prove a direct GitHub Actions POST can return structured event JSON.
3. If needed, prove Strategy B using browser bootstrap cookies + structured POST.
4. Inspect real UK event records and lock the normalised schema.
5. Implement the scheduled importer and validation/last-known-good publication.
6. Commit a known-good `data/events.json` fixture.
7. Rebuild `apps/events` into the V2 shell against that file.
8. Add favourite and attendance state through the shared V2 storage/Supabase layer.
9. Surface the next attending event on Home.

The UI rebuild should not begin until steps 1–5 demonstrate a sufficiently reliable source pipeline.
