"""Adapter: NCDR Public Warning Platform (國家災害防救科技中心 民生示警公開資料平台).

Ported from safe-shelter-taiwan (verified against the live platform 2026-10-14):

* Atom feed https://alerts.ncdr.nat.gov.tw/RssAtomFeed.ashx - each <entry> has id, title
  (event, zh-TW), updated, author/name, link@href -> CAP 1.2 document, summary,
  cap:status / cap:msgType / cap:effective / cap:expires (zh-TW 12-hour time format).
* CAP 1.2 documents with <info> (event, eventCode, severity, effective/onset/expires,
  headline, description) and <area>/<areaDesc> blocks.
* When rate-limited (< 3 s between requests) the platform answers HTTP 200 with
  `<WarningMessage>`; that is treated as "source unavailable", never as an empty feed.

Superseded (referenced by a newer alert) and cancelled alerts are dropped.
"""

from __future__ import annotations

import logging
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime

from dormsafe.external.models import CountyIntensity, DataMode, Earthquake, ExternalAlert
from dormsafe.external.parsing import clean_str, parse_datetime

log = logging.getLogger(__name__)

NCDR_SOURCE = "NCDR"

# CAP-TWP eventCode (lowercase) -> DormSafe event_type. Unlisted codes -> "other".
EVENT_CODE_MAP: dict[str, str] = {
    "earthquake": "earthquake",
    "rainfall": "heavy_rain",
    "heavyrain": "heavy_rain",
    "flood": "flood",
    "flooding": "flood",
    "typhoon": "typhoon",
}

# Fallback on the zh-TW event label (first hit wins).
EVENT_LABEL_KEYWORDS: list[tuple[str, str]] = [
    ("颱風", "typhoon"),
    ("豪雨", "heavy_rain"),
    ("大雨", "heavy_rain"),
    ("降雨", "heavy_rain"),
    ("淹水", "flood"),
    ("地震", "earthquake"),
]


def classify_event(event_code: str | None, event_label: str | None) -> str:
    if event_code and (mapped := EVENT_CODE_MAP.get(event_code.strip().lower())):
        return mapped
    for keyword, event_type in EVENT_LABEL_KEYWORDS:
        if event_label and keyword in event_label:
            return event_type
    return "other"


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _child(element: ET.Element | None, name: str) -> ET.Element | None:
    if element is None:
        return None
    return next((c for c in element if _local(c.tag) == name), None)


def _children(element: ET.Element, name: str) -> list[ET.Element]:
    return [c for c in element if _local(c.tag) == name]


def _text(element: ET.Element | None, name: str) -> str | None:
    child = _child(element, name)
    return None if child is None else clean_str(child.text)


def _parse_root(content: bytes) -> ET.Element:
    root = ET.fromstring(content.lstrip(b"\xef\xbb\xbf").strip())
    if _local(root.tag) == "WarningMessage":
        raise ValueError(f"NCDR refused the request: {''.join(root.itertext()).strip()}")
    return root


# ---------------------------------------------------------------- Atom feed


@dataclass
class FeedEntry:
    identifier: str
    title: str | None
    cap_url: str | None
    summary: str | None
    status: str | None
    msg_type: str | None
    effective: datetime | None
    expires: datetime | None


def parse_feed(content: bytes) -> list[FeedEntry]:
    """Parse the Atom feed. Raises ValueError if NCDR returned a rate-limit warning."""
    root = _parse_root(content)
    if _local(root.tag) != "feed":
        raise ValueError(f"not an Atom feed (root <{_local(root.tag)}>)")
    entries: list[FeedEntry] = []
    for entry in _children(root, "entry"):
        identifier = _text(entry, "id")
        if identifier is None:
            continue
        link = _child(entry, "link")
        entries.append(
            FeedEntry(
                identifier=identifier,
                title=_text(entry, "title"),
                cap_url=link.get("href") if link is not None else None,
                summary=_text(entry, "summary"),
                status=_text(entry, "status"),
                msg_type=_text(entry, "msgType"),
                effective=parse_datetime(_text(entry, "effective")),
                expires=parse_datetime(_text(entry, "expires")),
            )
        )
    return entries


# ---------------------------------------------------------------- CAP documents


@dataclass
class CapAlert:
    identifier: str
    status: str | None
    msg_type: str | None
    references: list[str] = field(default_factory=list)
    event: str | None = None
    event_code: str | None = None
    severity: str | None = None
    effective: datetime | None = None
    onset: datetime | None = None
    expires: datetime | None = None
    headline: str | None = None
    description: str | None = None
    sender_name: str | None = None
    web: str | None = None
    area_descriptions: list[str] = field(default_factory=list)
    parameters: list[tuple[str, str]] = field(default_factory=list)


def _parse_references(value: str | None) -> list[str]:
    # "sender,identifier,sent sender,identifier,sent ..."
    return [parts[1] for t in (value or "").split() if len(parts := t.split(",")) >= 2]


def parse_cap(content: bytes) -> CapAlert:
    root = _parse_root(content)
    if _local(root.tag) != "alert":
        raise ValueError(f"not a CAP alert (root <{_local(root.tag)}>)")
    identifier = _text(root, "identifier")
    if identifier is None:
        raise ValueError("CAP alert without identifier")
    alert = CapAlert(
        identifier=identifier,
        status=_text(root, "status"),
        msg_type=_text(root, "msgType"),
        references=_parse_references(_text(root, "references")),
    )
    infos = _children(root, "info")
    info = next(
        (i for i in infos if (_text(i, "language") or "").lower().startswith("zh")),
        infos[0] if infos else None,
    )
    if info is None:
        return alert
    alert.event = _text(info, "event")
    alert.event_code = _text(_child(info, "eventCode"), "value")
    alert.severity = _text(info, "severity")
    alert.effective = parse_datetime(_text(info, "effective"))
    alert.onset = parse_datetime(_text(info, "onset"))
    alert.expires = parse_datetime(_text(info, "expires"))
    alert.headline = _text(info, "headline")
    alert.description = _text(info, "description")
    alert.sender_name = _text(info, "senderName")
    alert.web = _text(info, "web")
    for param in _children(info, "parameter"):
        name, value = _text(param, "valueName"), _text(param, "value")
        if name and value:
            alert.parameters.append((name, value))
    for area in _children(info, "area"):
        desc = _text(area, "areaDesc")
        if desc and desc not in alert.area_descriptions:
            alert.area_descriptions.append(desc)
    return alert


# ---------------------------------------------------------------- normalization


def alert_from_cap(alert: CapAlert, data_mode: DataMode) -> ExternalAlert:
    return ExternalAlert(
        id=f"ncdr:{alert.identifier}",
        event_type=classify_event(alert.event_code, alert.event),
        headline=alert.headline or alert.event,
        description=alert.description,
        severity=alert.severity.lower() if alert.severity else None,
        effective_at=alert.effective or alert.onset,
        expires_at=alert.expires,
        affected_areas=alert.area_descriptions,
        source=NCDR_SOURCE,
        data_mode=data_mode,
    )


def alert_from_feed_entry(entry: FeedEntry, data_mode: DataMode) -> ExternalAlert:
    """Degraded alert when the CAP document is unavailable (no severity or areas)."""
    return ExternalAlert(
        id=f"ncdr:{entry.identifier}",
        event_type=classify_event(None, entry.title),
        headline=entry.title,
        description=entry.summary,
        severity=None,
        effective_at=entry.effective,
        expires_at=entry.expires,
        affected_areas=[],
        source=NCDR_SOURCE,
        data_mode=data_mode,
    )


def build_alerts(
    entries: list[FeedEntry], caps: dict[str, CapAlert], data_mode: DataMode
) -> list[ExternalAlert]:
    """Combine feed entries with fetched CAP docs; drop non-actual, cancelled, superseded."""
    superseded = {ref for cap in caps.values() for ref in cap.references}
    alerts: list[ExternalAlert] = []
    for entry in entries:
        cap = caps.get(entry.identifier)
        status = (cap.status if cap else entry.status) or "Actual"
        msg_type = (cap.msg_type if cap else entry.msg_type) or "Alert"
        if status.lower() != "actual" or msg_type.lower() == "cancel":
            continue
        if entry.identifier in superseded:
            continue
        alerts.append(
            alert_from_cap(cap, data_mode) if cap else alert_from_feed_entry(entry, data_mode)
        )
    return alerts


def is_earthquake_entry(entry: FeedEntry) -> bool:
    return classify_event(None, entry.title) == "earthquake"


def _first_float(value: str | None) -> float | None:
    match = re.search(r"-?\d+(?:\.\d+)?", value or "")
    return float(match.group()) if match else None


def earthquake_from_cap(alert: CapAlert, data_mode: DataMode) -> Earthquake | None:
    """CWA earthquake parameters (EventOriginTime, EventLatLon, LocalMaxIntensity, ...)."""
    if classify_event(alert.event_code, alert.event) != "earthquake":
        return None
    params: dict[str, str] = {}
    intensities: list[CountyIntensity] = []
    for name, value in alert.parameters:
        if name == "LocalMaxIntensity":
            # '3級;"花蓮縣";Taiwan_Geocode_103;10015;;;"CAP-EQ:1.0"'
            parts = [p.strip().strip('"') for p in value.split(";")]
            if len(parts) >= 2 and parts[0] and parts[1]:
                intensities.append(CountyIntensity(county=parts[1], intensity=parts[0]))
        else:
            params.setdefault(name, value)

    lat = lon = None
    if latlon := params.get("EventLatLon"):  # '23.559,121.453 0.000'
        try:
            lat_s, lon_s = latlon.split()[0].split(",")[:2]
            lat, lon = float(lat_s), float(lon_s)
        except ValueError:
            lat = lon = None

    return Earthquake(
        id=f"ncdr:{alert.identifier}",
        origin_time=parse_datetime(params.get("EventOriginTime")) or alert.onset,
        magnitude=_first_float(params.get("EventMagnitudeDescription")),
        depth_km=_first_float(params.get("EventDepth")),
        epicenter_latitude=lat,
        epicenter_longitude=lon,
        epicenter_location=params.get("EventLocationName"),
        description=alert.description,
        max_intensity=intensities[0].intensity if intensities else None,
        county_intensities=intensities,
        report_url=alert.web,
        publisher=params.get("EventPublisher") or alert.sender_name,
        source=NCDR_SOURCE,
        data_mode=data_mode,
    )


def cap_filename(identifier: str) -> str:
    return "".join(c if c.isalnum() or c in "-_." else "_" for c in identifier) + ".cap"
