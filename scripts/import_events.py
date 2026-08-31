#!/usr/bin/env python3
"""Build the normalized PTCG Tools event dataset.

Local competitive events are sourced from pokedata.ovh. Major Championship
Series events are sourced from RK9's public Pokemon event index, which exposes
stable event/detail and TCG registration links. The generated file is safe for
the static app to consume and is only replaced after validation.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import html.parser
import json
import math
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "events.json"

POKEDATA_BASE = "https://www.pokedata.ovh/events/api"
RK9_EVENTS_URL = "https://rk9.gg/events/pokemon"
SEARCH_LAT = float(os.getenv("PTCG_EVENTS_LAT", "51.4545"))
SEARCH_LON = float(os.getenv("PTCG_EVENTS_LON", "-2.5879"))
SEARCHES = (
    ("cups", 100),
    ("challenges", 60),
    ("pre", 50),
)
SCHEMA_VERSION = 3
USER_AGENT = "PTCG-Tools/2 event importer (+https://github.com/lthorpe18/ptcg-tools)"


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def today() -> str:
    return dt.date.today().isoformat()


def request_text(url: str, accept: str = "text/html,application/xhtml+xml") -> str:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": accept},
    )
    with urllib.request.urlopen(request, timeout=35) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status} for {url}")
        return response.read().decode("utf-8", errors="replace")


def get_json(url: str) -> Any:
    body = request_text(url, "application/json")
    if not body.lstrip().startswith(("[", "{")):
        raise RuntimeError(f"Unexpected non-JSON response for {url}")
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
        "sourceUrl": "https://www.pokedata.ovh/events/",
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

    return sorted(merged.values(), key=sort_key), reports


class RK9TableParser(html.parser.HTMLParser):
    """Extract table rows/cells/links from RK9 without depending on CSS classes."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[list[dict[str, Any]]] = []
        self.current_row: list[dict[str, Any]] | None = None
        self.current_cell: dict[str, Any] | None = None
        self.current_link: dict[str, str] | None = None
        self.upcoming = False
        self.in_heading = False
        self.heading_text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = dict(attrs)
        if tag in {"h1", "h2", "h3", "h4", "h5"}:
            self.in_heading = True
            self.heading_text = []
        elif tag == "tr" and self.upcoming:
            self.current_row = []
        elif tag in {"td", "th"} and self.current_row is not None:
            self.current_cell = {"text": [], "links": []}
        elif tag == "a" and self.current_cell is not None:
            self.current_link = {"href": attrs_dict.get("href") or "", "text": ""}

    def handle_endtag(self, tag: str) -> None:
        if tag in {"h1", "h2", "h3", "h4", "h5"} and self.in_heading:
            heading = " ".join("".join(self.heading_text).split()).lower()
            if "upcoming" in heading and "pokémon" in heading and "event" in heading:
                self.upcoming = True
            elif "past" in heading and "pokémon" in heading and "event" in heading:
                self.upcoming = False
            self.in_heading = False
        elif tag == "a" and self.current_link is not None and self.current_cell is not None:
            self.current_link["text"] = " ".join(self.current_link["text"].split())
            self.current_cell["links"].append(self.current_link)
            self.current_link = None
        elif tag in {"td", "th"} and self.current_cell is not None and self.current_row is not None:
            self.current_cell["text"] = " ".join("".join(self.current_cell["text"]).split())
            self.current_row.append(self.current_cell)
            self.current_cell = None
        elif tag == "tr" and self.current_row is not None:
            if self.current_row:
                self.rows.append(self.current_row)
            self.current_row = None

    def handle_data(self, data: str) -> None:
        if self.in_heading:
            self.heading_text.append(data)
        if self.current_cell is not None:
            self.current_cell["text"].append(data)
        if self.current_link is not None:
            self.current_link["text"] += data


def absolute_rk9_url(href: str | None) -> str | None:
    if not href:
        return None
    if href.startswith("http://") or href.startswith("https://"):
        return href
    if href.startswith("/"):
        return "https://rk9.gg" + href
    return "https://rk9.gg/" + href


def parse_rk9_date_range(text: str) -> tuple[str | None, str | None]:
    clean = " ".join(text.replace("–", "-").replace("—", "-").split())
    # Examples: August 28-30, 2026 | September 26-27, 2026 | June 27, 2026
    match = re.search(r"([A-Za-z]+)\s+(\d{1,2})(?:-(\d{1,2}))?,\s*(\d{4})", clean)
    if match:
        month, first_day, last_day, year = match.groups()
        try:
            start = dt.datetime.strptime(f"{month} {first_day} {year}", "%B %d %Y").date()
            end = dt.datetime.strptime(f"{month} {last_day or first_day} {year}", "%B %d %Y").date()
            return start.isoformat(), end.isoformat()
        except ValueError:
            return None, None

    # Cross-month range, e.g. February 27-March 1, 2026
    match = re.search(r"([A-Za-z]+)\s+(\d{1,2})-([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})", clean)
    if match:
        m1, d1, m2, d2, year = match.groups()
        try:
            start = dt.datetime.strptime(f"{m1} {d1} {year}", "%B %d %Y").date()
            end = dt.datetime.strptime(f"{m2} {d2} {year}", "%B %d %Y").date()
            return start.isoformat(), end.isoformat()
        except ValueError:
            return None, None
    return None, None


def major_type(name: str) -> str | None:
    lower = name.lower()
    if "world championships" in lower:
        return "World Championships"
    if "international championships" in lower:
        return "International"
    if "special championships" in lower:
        return "Special Championship"
    if "regional championships" in lower:
        return "Regional"
    return None


def cell_links(cell: dict[str, Any]) -> list[dict[str, str]]:
    value = cell.get("links")
    return value if isinstance(value, list) else []


def fetch_major_events() -> tuple[list[dict[str, Any]], dict[str, Any]]:
    body = request_text(RK9_EVENTS_URL)
    if "Upcoming Pokémon Events" not in body and "Upcoming Pokemon Events" not in body:
        raise RuntimeError("RK9 page no longer contains the upcoming Pokemon events heading")

    parser = RK9TableParser()
    parser.feed(body)
    events: list[dict[str, Any]] = []
    ignored = 0

    for row in parser.rows:
        if len(row) < 3:
            continue
        row_text = " | ".join(str(cell.get("text") or "") for cell in row)
        kind = major_type(row_text)
        if not kind:
            ignored += 1
            continue

        date_cell = row[0]
        event_cell = next((cell for cell in row if "championship" in str(cell.get("text") or "").lower()), None)
        if event_cell is None:
            continue
        name = str(event_cell.get("text") or "").strip()
        start_date, end_date = parse_rk9_date_range(str(date_cell.get("text") or ""))
        if not start_date:
            continue
        if end_date and end_date < today():
            continue

        event_links = cell_links(event_cell)
        detail_href = next((link.get("href") for link in event_links if link.get("href")), None)

        location = ""
        for cell in row:
            text = str(cell.get("text") or "").strip()
            if cell is date_cell or cell is event_cell:
                continue
            if text and not any(token in text.lower() for token in ("tcg", "vg", "go", "unite", "spectator")):
                location = text
                break
        city, country = location, None
        if "," in location:
            city, country = [piece.strip() or None for piece in location.rsplit(",", 1)]

        all_links = [link for cell in row for link in cell_links(cell)]
        tcg_href = next((link.get("href") for link in all_links if str(link.get("text") or "").strip().upper() == "TCG"), None)
        source_url = absolute_rk9_url(detail_href) or RK9_EVENTS_URL
        registration_url = absolute_rk9_url(tcg_href)
        source_id_seed = detail_href or f"{name}|{start_date}|{location}"
        source_id = hashlib.sha1(source_id_seed.encode("utf-8")).hexdigest()[:20]

        events.append({
            "id": f"rk9:{source_id}",
            "source": "rk9",
            "sourceId": source_id,
            "scope": "major",
            "type": kind,
            "name": name,
            "venue": None,
            "startDate": start_date,
            "startTime": None,
            "endDate": end_date,
            "endTime": None,
            "address": None,
            "city": city or None,
            "region": None,
            "postcode": None,
            "country": country,
            "latitude": None,
            "longitude": None,
            "distanceFromSeedMiles": None,
            "cost": None,
            "status": None,
            "officialUrl": None,
            "registrationUrl": registration_url,
            "sourceUrl": source_url,
            "details": None,
        })

    # Deduplicate defensively by normalized id.
    deduped = {event["id"]: event for event in events}
    result = sorted(deduped.values(), key=sort_key)
    if not result:
        raise RuntimeError("RK9 major-event parser produced zero upcoming Championship events")

    return result, {
        "provider": "rk9",
        "url": RK9_EVENTS_URL,
        "status": "ok",
        "returned": len(result),
        "ignoredRows": ignored,
        "types": sorted({event["type"] for event in result}),
        "authority": "Pokemon Championship Series; RK9 used as operational event/registration index",
    }


def sort_key(event: dict[str, Any]) -> tuple[str, str, str]:
    return (
        event.get("startDate") or "9999-12-31",
        event.get("startTime") or "",
        event.get("name") or event.get("venue") or "",
    )


def validate(events: list[dict[str, Any]], previous: dict[str, Any] | None) -> list[str]:
    errors: list[str] = []
    ids = [e.get("id") for e in events]
    if any(not value for value in ids):
        errors.append("one or more events have no id")
    if len(ids) != len(set(ids)):
        errors.append("duplicate normalized event ids")

    invalid_dates = 0
    local_count = 0
    local_missing_coords = 0
    majors = 0
    for event in events:
        try:
            if not event.get("startDate"):
                raise ValueError
            dt.date.fromisoformat(event["startDate"])
        except (TypeError, ValueError):
            invalid_dates += 1
        if event.get("scope") == "local":
            local_count += 1
            if event.get("latitude") is None or event.get("longitude") is None:
                local_missing_coords += 1
        elif event.get("scope") == "major":
            majors += 1

    if events and invalid_dates / len(events) > 0.05:
        errors.append(f"too many unparseable dates: {invalid_dates}/{len(events)}")
    if local_count and local_missing_coords / local_count > 0.25:
        errors.append(f"too many local events without coordinates: {local_missing_coords}/{local_count}")
    if majors == 0:
        errors.append("major-event feed produced zero events")

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
        major_events, major_report = fetch_major_events()
        events = sorted(local_events + major_events, key=sort_key)
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
                "major": major_report,
            },
            "events": events,
        }

        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        temp = OUTPUT.with_suffix(".json.tmp")
        temp.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        temp.replace(OUTPUT)

        counts = {report["type"]: report["accepted"] for report in reports}
        major_counts: dict[str, int] = {}
        for event in major_events:
            major_counts[event["type"]] = major_counts.get(event["type"], 0) + 1
        print(json.dumps({
            "status": "ok",
            "eventCount": len(events),
            "localCounts": counts,
            "majorCount": len(major_events),
            "majorCounts": major_counts,
        }, indent=2))
        return 0

    except (RuntimeError, urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError) as exc:
        print(f"Event import failed: {exc}", file=sys.stderr)
        # Deliberately do not touch OUTPUT: the repository keeps the previous
        # known-good file if this run fails.
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
