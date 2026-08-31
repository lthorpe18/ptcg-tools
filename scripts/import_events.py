#!/usr/bin/env python3
"""Build the normalized PTCG Tools event dataset.

Local competitive events are sourced from pokedata.ovh. The generated file is
safe for the static app to consume and is only replaced after validation.

Major-event providers are intentionally represented separately in the output
schema so Regionals/Internationals can be added without changing the client.
"""

from __future__ import annotations

import datetime as dt
import json
import math
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "events.json"

POKEDATA_BASE = "https://www.pokedata.ovh/events/api"
SEARCH_LAT = float(os.getenv("PTCG_EVENTS_LAT", "51.4545"))
SEARCH_LON = float(os.getenv("PTCG_EVENTS_LON", "-2.5879"))
SEARCHES = (
    ("cups", 100),
    ("challenges", 60),
    ("pre", 50),
)
SCHEMA_VERSION = 2
USER_AGENT = "PTCG-Tools/2 event importer (+https://github.com/lthorpe18/ptcg-tools)"


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def today() -> str:
    return dt.date.today().isoformat()


def get_json(url: str) -> Any:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=35) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status} for {url}")
        content_type = response.headers.get("Content-Type", "")
        body = response.read().decode("utf-8")
        if "json" not in content_type.lower() and not body.lstrip().startswith(("[", "{")):
            raise RuntimeError(f"Unexpected content type {content_type!r} for {url}")
        return json.loads(body)


def pokedata_url(kind: str, radius_miles: int) -> str:
    return (
        f"{POKEDATA_BASE}/_tcg/{kind}"
        f"/_latitude/{SEARCH_LAT}/_longitude/{SEARCH_LON}"
        f"/_radius/{radius_miles}/_unit/mi/_start/{today()}"
    )


def as_float(value: Any) -> float | None:
    try:
        return float(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 3958.7613
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return radius * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


def normalize_type(raw_type: Any, requested_kind: str) -> str:
    text = str(raw_type or "").strip().lower()
    if "challenge" in text or requested_kind == "challenges":
        return "League Challenge"
    if "cup" in text or requested_kind == "cups":
        return "League Cup"
    if "pre" in text or requested_kind == "pre":
        return "Prerelease"
    return str(raw_type or requested_kind).strip()


def normalize_when(raw: dict[str, Any]) -> tuple[str | None, str | None]:
    when = str(raw.get("when") or "").strip()
    date_value = str(raw.get("date") or "").strip()
    time_value = str(raw.get("time") or "").strip()

    if when:
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
            try:
                parsed = dt.datetime.strptime(when, fmt)
                return parsed.date().isoformat(), parsed.time().replace(microsecond=0).isoformat()
            except ValueError:
                pass
        if len(when) >= 10:
            date_value = date_value or when[:10]

    start_date = None
    if date_value:
        try:
            start_date = dt.date.fromisoformat(date_value[:10]).isoformat()
        except ValueError:
            pass

    start_time = None
    if time_value:
        for fmt in ("%H:%M:%S", "%H:%M", "%I:%M %p", "%I:%M%p"):
            try:
                start_time = dt.datetime.strptime(time_value.strip(), fmt).time().replace(microsecond=0).isoformat()
                break
            except ValueError:
                continue

    return start_date, start_time


def normalize_local(raw: dict[str, Any], requested_kind: str) -> dict[str, Any]:
    source_id = str(raw.get("guid") or "").strip()
    lat = as_float(raw.get("latitude"))
    lon = as_float(raw.get("longitude"))
    start_date, start_time = normalize_when(raw)

    contact = raw.get("contact_data") if isinstance(raw.get("contact_data"), dict) else {}
    details = contact.get("Details") if isinstance(contact, dict) else None

    distance = None
    if lat is not None and lon is not None:
        distance = round(haversine_miles(SEARCH_LAT, SEARCH_LON, lat, lon), 1)

    return {
        "id": f"pokedata:{source_id}" if source_id else None,
        "source": "pokedata",
        "sourceId": source_id or None,
        "scope": "local",
        "type": normalize_type(raw.get("type"), requested_kind),
        "name": raw.get("name") or None,
        "venue": raw.get("shop") or None,
        "startDate": start_date,
        "startTime": start_time,
        "endDate": None,
        "endTime": None,
        "address": raw.get("street_address") or None,
        "city": raw.get("city") or None,
        "region": raw.get("state") or raw.get("region") or None,
        "postcode": raw.get("postal_code") or raw.get("postcode") or None,
        "country": raw.get("country") or None,
        "latitude": lat,
        "longitude": lon,
        "distanceFromSeedMiles": distance,
        "cost": raw.get("cost") or None,
        "status": raw.get("status") or None,
        "officialUrl": raw.get("pokemon_url") or None,
        "registrationUrl": raw.get("registration_url") or None,
        "details": details,
    }


def fetch_local_events() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    merged: dict[str, dict[str, Any]] = {}
    reports: list[dict[str, Any]] = []

    for kind, radius in SEARCHES:
        url = pokedata_url(kind, radius)
        payload = get_json(url)
        if not isinstance(payload, list):
            raise RuntimeError(f"Pokédata {kind} response is not a list")

        accepted = 0
        for raw in payload:
            if not isinstance(raw, dict):
                continue
            event = normalize_local(raw, kind)
            if not event["sourceId"]:
                continue
            merged[event["id"]] = event
            accepted += 1

        reports.append({
            "type": kind,
            "radiusMiles": radius,
            "returned": len(payload),
            "accepted": accepted,
        })

    return sorted(merged.values(), key=lambda e: (e.get("startDate") or "9999", e.get("startTime") or "", e.get("venue") or "")), reports


def validate(events: list[dict[str, Any]], previous: dict[str, Any] | None) -> list[str]:
    errors: list[str] = []
    ids = [e.get("id") for e in events]
    if any(not value for value in ids):
        errors.append("one or more events have no id")
    if len(ids) != len(set(ids)):
        errors.append("duplicate normalized event ids")

    invalid_dates = 0
    missing_coords = 0
    for event in events:
        try:
            if not event.get("startDate"):
                raise ValueError
            dt.date.fromisoformat(event["startDate"])
        except (TypeError, ValueError):
            invalid_dates += 1
        if event.get("latitude") is None or event.get("longitude") is None:
            missing_coords += 1

    if events and invalid_dates / len(events) > 0.05:
        errors.append(f"too many unparseable dates: {invalid_dates}/{len(events)}")
    if events and missing_coords / len(events) > 0.25:
        errors.append(f"too many events without coordinates: {missing_coords}/{len(events)}")

    previous_count = 0
    if isinstance(previous, dict):
        previous_events = previous.get("events")
        if isinstance(previous_events, list):
            previous_count = len(previous_events)
    if previous_count >= 10 and len(events) < previous_count * 0.2:
        errors.append(f"catastrophic event-count drop: {previous_count} -> {len(events)}")

    return errors


def read_previous() -> dict[str, Any] | None:
    if not OUTPUT.exists():
        return None
    try:
        value = json.loads(OUTPUT.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else None
    except (OSError, json.JSONDecodeError):
        return None


def main() -> int:
    attempted = utc_now()
    previous = read_previous()

    try:
        local_events, reports = fetch_local_events()
        # Major events will be supplied by a separate provider adapter. Keep the
        # schema stable now rather than making the client infer source shape.
        major_events: list[dict[str, Any]] = []
        events = local_events + major_events
        errors = validate(events, previous)
        if errors:
            raise RuntimeError("; ".join(errors))

        output = {
            "schemaVersion": SCHEMA_VERSION,
            "status": "ok",
            "lastAttemptedUpdate": attempted,
            "lastSuccessfulUpdate": attempted,
            "eventCount": len(events),
            "sources": {
                "local": {
                    "provider": "pokedata",
                    "url": "https://www.pokedata.ovh/events/",
                    "searchSeed": {"latitude": SEARCH_LAT, "longitude": SEARCH_LON},
                    "queries": reports,
                },
                "major": {
                    "provider": None,
                    "status": "adapter-pending",
                    "types": ["Regional", "Special Championship", "International", "World Championships"],
                },
            },
            "events": events,
        }

        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        temp = OUTPUT.with_suffix(".json.tmp")
        temp.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        temp.replace(OUTPUT)

        counts = {report["type"]: report["accepted"] for report in reports}
        print(json.dumps({"status": "ok", "eventCount": len(events), "localCounts": counts}, indent=2))
        return 0

    except (RuntimeError, urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError) as exc:
        print(f"Event import failed: {exc}", file=sys.stderr)
        # Deliberately do not touch OUTPUT: the repository keeps the previous
        # known-good file if this run fails.
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
