#!/usr/bin/env python3
"""Build the normalized PTCG Tools event dataset.

Local competitive events come from pokedata.ovh. Major Championship Series
calendar entries come from the official Pokemon Championships JSON feed and
are enriched with RK9 event/TCG registration links when a matching RK9 row is
available. The static app only consumes the generated normalized JSON.
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
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "events.json"

POKEDATA_BASE = "https://www.pokedata.ovh/events/api"
POKEMON_MAJORS_API = "https://championships.pokemon.com/api/events.json?locale=en-us"
POKEMON_MAJORS_BASE = "https://championships.pokemon.com"
RK9_EVENTS_URL = "https://rk9.gg/events/pokemon"
SEARCH_LAT = float(os.getenv("PTCG_EVENTS_LAT", "51.4545"))
SEARCH_LON = float(os.getenv("PTCG_EVENTS_LON", "-2.5879"))
SEARCHES = (("cups", 100), ("challenges", 60), ("pre", 50))
SCHEMA_VERSION = 4
USER_AGENT = "PTCG-Tools/2 event importer (+https://github.com/lthorpe18/ptcg-tools)"

MONTHS = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def today_date() -> dt.date:
    return dt.date.today()


def request_text(url: str, accept: str = "text/html,application/xhtml+xml") -> str:
    req = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": accept,
        "Accept-Language": "en-GB,en;q=0.9",
    })
    with urllib.request.urlopen(req, timeout=35) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status} for {url}")
        return response.read().decode("utf-8", errors="replace")


def get_json(url: str) -> Any:
    body = request_text(url, "application/json")
    if not body.lstrip().startswith(("[", "{")):
        raise RuntimeError(f"Unexpected non-JSON response for {url}")
    return json.loads(body)


def as_float(value: Any) -> float | None:
    try:
        return float(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 3958.7613
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return radius * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


def sort_key(event: dict[str, Any]) -> tuple[str, str, str]:
    return (
        event.get("startDate") or "9999-12-31",
        event.get("startTime") or "",
        event.get("name") or event.get("venue") or "",
    )


# ---------------------------------------------------------------------------
# Pokédata local events
# ---------------------------------------------------------------------------

def pokedata_url(kind: str, radius_miles: int) -> str:
    return (
        f"{POKEDATA_BASE}/_tcg/{kind}"
        f"/_latitude/{SEARCH_LAT}/_longitude/{SEARCH_LON}"
        f"/_radius/{radius_miles}/_unit/mi/_start/{today_date().isoformat()}"
    )


def normalize_local_type(raw_type: Any, requested_kind: str) -> str:
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
                start_time = dt.datetime.strptime(time_value, fmt).time().replace(microsecond=0).isoformat()
                break
            except ValueError:
                continue
    return start_date, start_time


def normalize_local(raw: dict[str, Any], requested_kind: str) -> dict[str, Any]:
    source_id = str(raw.get("guid") or "").strip()
    lat, lon = as_float(raw.get("latitude")), as_float(raw.get("longitude"))
    start_date, start_time = normalize_when(raw)
    contact = raw.get("contact_data") if isinstance(raw.get("contact_data"), dict) else {}
    distance = round(haversine_miles(SEARCH_LAT, SEARCH_LON, lat, lon), 1) if lat is not None and lon is not None else None
    return {
        "id": f"pokedata:{source_id}" if source_id else None,
        "source": "pokedata",
        "sourceId": source_id or None,
        "scope": "local",
        "type": normalize_local_type(raw.get("type"), requested_kind),
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
        "secondarySourceUrl": None,
        "details": contact.get("Details") if isinstance(contact, dict) else None,
    }


def fetch_local_events() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    merged: dict[str, dict[str, Any]] = {}
    reports = []
    for kind, radius in SEARCHES:
        payload = get_json(pokedata_url(kind, radius))
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
        reports.append({"type": kind, "radiusMiles": radius, "returned": len(payload), "accepted": accepted})
    return sorted(merged.values(), key=sort_key), reports


# ---------------------------------------------------------------------------
# RK9 enrichment feed
# ---------------------------------------------------------------------------
class RK9TableParser(html.parser.HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[list[dict[str, Any]]] = []
        self.row: list[dict[str, Any]] | None = None
        self.cell: dict[str, Any] | None = None
        self.link: dict[str, str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_d = dict(attrs)
        if tag == "tr":
            self.row = []
        elif tag in {"td", "th"} and self.row is not None:
            self.cell = {"text": [], "links": []}
        elif tag == "a" and self.cell is not None:
            self.link = {"href": attrs_d.get("href") or "", "text": ""}

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self.link is not None and self.cell is not None:
            self.link["text"] = " ".join(self.link["text"].split())
            self.cell["links"].append(self.link)
            self.link = None
        elif tag in {"td", "th"} and self.cell is not None and self.row is not None:
            self.cell["text"] = " ".join("".join(self.cell["text"]).split())
            self.row.append(self.cell)
            self.cell = None
        elif tag == "tr" and self.row is not None:
            if self.row:
                self.rows.append(self.row)
            self.row = None

    def handle_data(self, data: str) -> None:
        if self.cell is not None:
            self.cell["text"].append(data)
        if self.link is not None:
            self.link["text"] += data


def absolute_rk9_url(href: str | None) -> str | None:
    if not href:
        return None
    if href.startswith(("http://", "https://")):
        return href
    return "https://rk9.gg" + (href if href.startswith("/") else "/" + href)


def parse_rk9_date_range(text: str) -> tuple[str | None, str | None]:
    clean = " ".join(text.replace("–", "-").replace("—", "-").split())
    cross = re.search(r"([A-Za-z]+)\s+(\d{1,2})-([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})", clean)
    if cross:
        m1, d1, m2, d2, year = cross.groups()
        try:
            return (
                dt.datetime.strptime(f"{m1} {d1} {year}", "%B %d %Y").date().isoformat(),
                dt.datetime.strptime(f"{m2} {d2} {year}", "%B %d %Y").date().isoformat(),
            )
        except ValueError:
            return None, None
    same = re.search(r"([A-Za-z]+)\s+(\d{1,2})(?:-(\d{1,2}))?,\s*(\d{4})", clean)
    if same:
        month, d1, d2, year = same.groups()
        try:
            start = dt.datetime.strptime(f"{month} {d1} {year}", "%B %d %Y").date()
            end = dt.datetime.strptime(f"{month} {d2 or d1} {year}", "%B %d %Y").date()
            return start.isoformat(), end.isoformat()
        except ValueError:
            return None, None
    return None, None


def canonical_text(value: str | None) -> str:
    text = unicodedata.normalize("NFKD", value or "")
    text = "".join(ch for ch in text if not unicodedata.combining(ch)).lower()
    text = text.replace("pokémon", "pokemon")
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def extract_rk9_events() -> list[dict[str, Any]]:
    body = request_text(RK9_EVENTS_URL)
    parser = RK9TableParser()
    parser.feed(body)
    found = []
    for row in parser.rows:
        if len(row) < 4:
            continue
        event_cell = next((c for c in row if "championship" in str(c.get("text") or "").lower()), None)
        if event_cell is None:
            continue
        start, end = parse_rk9_date_range(str(row[0].get("text") or ""))
        if not start or (end and dt.date.fromisoformat(end) < today_date()):
            continue
        links = [link for cell in row for link in (cell.get("links") or [])]
        event_href = next((x.get("href") for x in event_cell.get("links", []) if x.get("href")), None)
        tcg_href = next((x.get("href") for x in links if canonical_text(x.get("text")) == "tcg"), None)
        found.append({
            "name": str(event_cell.get("text") or "").strip(),
            "startDate": start,
            "endDate": end,
            "eventUrl": absolute_rk9_url(event_href),
            "registrationUrl": absolute_rk9_url(tcg_href),
        })
    return found


# ---------------------------------------------------------------------------
# Official Pokemon Championship major feed
# ---------------------------------------------------------------------------

def month_number(token: str) -> int | None:
    return MONTHS.get(token.lower().strip().rstrip("."))


def major_calendar_year(season_year: int, month: int) -> int:
    # Championship seasons begin in the prior calendar year. E.g. September
    # 2026 is part of the 2027 season, while January 2027 is also 2027 season.
    return season_year - 1 if month >= 7 else season_year


def parse_pokemon_display_range(text: str, season_year: int) -> tuple[str | None, str | None]:
    clean = " ".join(text.replace("–", "-").replace("—", "-").replace(" ", " ").split())
    # Cross-month: Oct. 31 - Nov. 1
    cross = re.fullmatch(r"([A-Za-z.]+)\s+(\d{1,2})\s*-\s*([A-Za-z.]+)\s+(\d{1,2})", clean)
    if cross:
        m1s, d1s, m2s, d2s = cross.groups()
        m1, m2 = month_number(m1s), month_number(m2s)
        if not m1 or not m2:
            return None, None
        y1 = major_calendar_year(season_year, m1)
        y2 = major_calendar_year(season_year, m2)
        # Defensive New-Year crossing support.
        if m2 < m1 and y2 <= y1:
            y2 = y1 + 1
        try:
            return dt.date(y1, m1, int(d1s)).isoformat(), dt.date(y2, m2, int(d2s)).isoformat()
        except ValueError:
            return None, None
    same = re.fullmatch(r"([A-Za-z.]+)\s+(\d{1,2})(?:\s*-\s*(\d{1,2}))?", clean)
    if same:
        ms, d1s, d2s = same.groups()
        month = month_number(ms)
        if not month:
            return None, None
        year = major_calendar_year(season_year, month)
        try:
            start = dt.date(year, month, int(d1s))
            end = dt.date(year, month, int(d2s or d1s))
            return start.isoformat(), end.isoformat()
        except ValueError:
            return None, None
    return None, None


def normalize_major_type(item: dict[str, Any]) -> str | None:
    name = canonical_text(str(item.get("eventName_s") or ""))
    raw = str(item.get("type_s") or "").lower()
    if "world championships" in name or raw == "world":
        return "World Championships"
    if "special championships" in name:
        return "Special Championship"
    if "international championships" in name or raw == "international":
        return "International"
    if "regional championships" in name or raw == "regional":
        return "Regional"
    return None


def split_major_location(value: str) -> tuple[str | None, str | None]:
    text = value.strip()
    if not text:
        return None, None
    if "," not in text:
        return text, None
    city, tail = [part.strip() for part in text.rsplit(",", 1)]
    return city or None, tail or None


def rk9_match(official: dict[str, Any], rk9_events: list[dict[str, Any]]) -> dict[str, Any] | None:
    oname = canonical_text(official.get("name"))
    for candidate in rk9_events:
        if candidate.get("startDate") != official.get("startDate"):
            continue
        cname = canonical_text(candidate.get("name"))
        if cname == oname or (oname and cname and (oname in cname or cname in oname)):
            return candidate
    return None


def fetch_major_events() -> tuple[list[dict[str, Any]], dict[str, Any]]:
    payload = get_json(POKEMON_MAJORS_API)
    if not isinstance(payload, dict) or not isinstance(payload.get("items"), list):
        raise RuntimeError("Pokemon Championship events API shape is not recognized")
    rk9_events = extract_rk9_events()
    events = []
    enriched = 0
    rejected = 0
    for item in payload["items"]:
        if not isinstance(item, dict):
            continue
        kind = normalize_major_type(item)
        try:
            season = int(str(item.get("year_s") or ""))
        except ValueError:
            rejected += 1
            continue
        start, end = parse_pokemon_display_range(str(item.get("displayDateRange_s") or ""), season)
        if not kind or not start:
            rejected += 1
            continue
        if end and dt.date.fromisoformat(end) < today_date():
            continue
        rel_url = str(item.get("uRL_s") or "").strip()
        official_url = POKEMON_MAJORS_BASE + rel_url if rel_url.startswith("/") else rel_url or None
        source_id = rel_url or hashlib.sha1(f"{item.get('eventName_s')}|{start}".encode()).hexdigest()[:20]
        city, country_or_region = split_major_location(str(item.get("eventLocation_s") or ""))
        event = {
            "id": f"pokemon-major:{source_id.lstrip('/').replace('/', ':')}",
            "source": "pokemon-championships",
            "sourceId": source_id,
            "scope": "major",
            "type": kind,
            "name": item.get("eventName_s") or None,
            "venue": None,
            "startDate": start,
            "startTime": None,
            "endDate": end,
            "endTime": None,
            "address": None,
            "city": city,
            "region": item.get("region_s") or None,
            "postcode": None,
            "country": country_or_region,
            "latitude": None,
            "longitude": None,
            "distanceFromSeedMiles": None,
            "cost": None,
            "status": "upcoming",
            "officialUrl": official_url,
            "registrationUrl": None,
            "sourceUrl": POKEMON_MAJORS_API,
            "secondarySourceUrl": None,
            "details": None,
            "season": season,
            "isStreaming": str(item.get("isStreaming_b") or "").lower() == "true",
        }
        match = rk9_match(event, rk9_events)
        if match:
            event["registrationUrl"] = match.get("registrationUrl")
            event["secondarySourceUrl"] = match.get("eventUrl")
            enriched += 1
        events.append(event)
    if not events:
        raise RuntimeError("Official Pokemon major feed produced zero upcoming events")
    return sorted(events, key=sort_key), {
        "provider": "pokemon-championships",
        "url": POKEMON_MAJORS_API,
        "status": "ok",
        "returned": len(payload["items"]),
        "accepted": len(events),
        "rejected": rejected,
        "apiVersion": payload.get("version"),
        "rk9Enriched": enriched,
        "rk9Url": RK9_EVENTS_URL,
        "types": sorted({event["type"] for event in events}),
    }


# ---------------------------------------------------------------------------
# Validation / publication
# ---------------------------------------------------------------------------

def read_previous() -> dict[str, Any] | None:
    if not OUTPUT.exists():
        return None
    try:
        value = json.loads(OUTPUT.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else None
    except (OSError, json.JSONDecodeError):
        return None


def validate(events: list[dict[str, Any]], previous: dict[str, Any] | None) -> list[str]:
    errors = []
    ids = [e.get("id") for e in events]
    if any(not value for value in ids):
        errors.append("one or more events have no id")
    if len(ids) != len(set(ids)):
        errors.append("duplicate normalized event ids")
    invalid_dates = 0
    local_count = local_missing_coords = major_count = 0
    for event in events:
        try:
            dt.date.fromisoformat(str(event.get("startDate")))
            if event.get("endDate"):
                dt.date.fromisoformat(str(event["endDate"]))
        except ValueError:
            invalid_dates += 1
        if event.get("scope") == "local":
            local_count += 1
            if event.get("latitude") is None or event.get("longitude") is None:
                local_missing_coords += 1
        elif event.get("scope") == "major":
            major_count += 1
    if events and invalid_dates / len(events) > 0.05:
        errors.append(f"too many unparseable dates: {invalid_dates}/{len(events)}")
    if local_count and local_missing_coords / local_count > 0.25:
        errors.append(f"too many local events without coordinates: {local_missing_coords}/{local_count}")
    if major_count < 5:
        errors.append(f"implausibly small major-event feed: {major_count}")
    previous_count = len(previous.get("events", [])) if isinstance(previous, dict) and isinstance(previous.get("events"), list) else 0
    if previous_count >= 10 and len(events) < previous_count * 0.2:
        errors.append(f"catastrophic event-count drop: {previous_count} -> {len(events)}")
    return errors


def main() -> int:
    attempted = utc_now()
    previous = read_previous()
    try:
        local_events, local_reports = fetch_local_events()
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
                    "queries": local_reports,
                },
                "major": major_report,
            },
            "events": events,
        }
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        temp = OUTPUT.with_suffix(".json.tmp")
        temp.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        temp.replace(OUTPUT)
        local_counts = {r["type"]: r["accepted"] for r in local_reports}
        major_counts: dict[str, int] = {}
        for event in major_events:
            major_counts[event["type"]] = major_counts.get(event["type"], 0) + 1
        print(json.dumps({
            "status": "ok",
            "eventCount": len(events),
            "localCounts": local_counts,
            "majorCount": len(major_events),
            "majorCounts": major_counts,
            "rk9Enriched": major_report["rk9Enriched"],
        }, indent=2))
        return 0
    except (RuntimeError, urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError) as exc:
        print(f"Event import failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
