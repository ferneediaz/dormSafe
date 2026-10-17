"""Adapter: NFA shelter opening status (避難收容處所開設情形, data.gov.tw dataset 12849).

Ported from safe-shelter-taiwan. Source: XML, https://portal2.emic.gov.tw/Pub/EEA2/OpenData/Shelter.xml

    <SheltersInfoList><ShletersInfo><ShletersInfo>   <- sic, and nested
        <name/> <county/> <lat/> <lon/> <openstatus>開設|已滿|撤除</openstatus> <shelterId/> ...

* ~18k records but only ~5.9k unique shelterId (exact duplicates); de-duplicated by shelterId.
* 撤除 ("withdrawn / stood down") is reported as `withdrawn`, NOT "closed": on 2026-10-14
  every record had it, so it is probably also the default for never-opened shelters.
* The two NFA datasets share no key. Status is attached to a shelter location only when the
  normalized name matches within 300 m, or a similar name matches within 50 m. Ambiguous
  records stay unmatched; the shelter then keeps status `designated`.
"""

from __future__ import annotations

import logging
import xml.etree.ElementTree as ET
from collections import defaultdict
from dataclasses import dataclass
from difflib import SequenceMatcher

from dormsafe.external.models import Shelter
from dormsafe.external.parsing import (
    clean_str,
    haversine_km,
    in_taiwan,
    normalize_name,
    parse_float,
)

log = logging.getLogger(__name__)

# Raw openstatus -> Shelter.status
STATUS_MAP: dict[str, str] = {
    "開設": "open",
    "開設中": "open",
    "已開設": "open",
    "已滿": "full",
    "額滿": "full",
    "收容已滿": "full",
    "撤除": "withdrawn",
    "已撤除": "withdrawn",
    "未開設": "withdrawn",
    "關閉": "withdrawn",
}

MATCH_RADIUS_KM = 0.3
FUZZY_RADIUS_KM = 0.05
FUZZY_MIN_RATIO = 0.6
_GRID_DEG = 0.001  # ~100 m buckets


@dataclass
class StatusRecord:
    record_id: str
    name: str
    latitude: float
    longitude: float
    status: str


def normalize_status(value: str | None) -> str:
    value = clean_str(value)
    if value is None:
        return "unknown"
    return STATUS_MAP.get(value.replace(" ", "").replace("　", ""), "unknown")


def _text(element: ET.Element, tag: str) -> str | None:
    child = element.find(tag)
    return None if child is None else clean_str(child.text)


def parse_status_xml(content: bytes) -> list[StatusRecord]:
    """Unique status records that have usable coordinates (needed for matching)."""
    root = ET.fromstring(content)
    records: dict[str, StatusRecord] = {}
    for element in root.iter():
        if element.find("name") is None:  # record elements directly contain <name>
            continue
        record_id = _text(element, "shelterId")
        name = _text(element, "name")
        lat = parse_float(_text(element, "lat"))
        lon = parse_float(_text(element, "lon"))
        if not record_id or not name or record_id in records:
            continue
        if lat is None or lon is None or not in_taiwan(lat, lon):
            continue
        records[record_id] = StatusRecord(
            record_id, name, lat, lon, normalize_status(_text(element, "openstatus"))
        )
    return list(records.values())


def merge_status(shelters: list[Shelter], records: list[StatusRecord]) -> list[Shelter]:
    """Return copies of `shelters` with `status` set from matching status records."""
    merged = [s.model_copy() for s in shelters]
    by_name: dict[str, list[int]] = defaultdict(list)
    grid: dict[tuple[int, int], list[int]] = defaultdict(list)
    for i, s in enumerate(merged):
        by_name[normalize_name(s.name)].append(i)
        grid[_cell(s.latitude, s.longitude)].append(i)

    claimed: set[int] = set()
    leftovers: list[StatusRecord] = []
    for record in records:
        candidates = [i for i in by_name.get(normalize_name(record.name), []) if i not in claimed]
        match = _nearest(record, merged, candidates, MATCH_RADIUS_KM)
        if match is None:
            leftovers.append(record)
            continue
        merged[match].status = record.status
        claimed.add(match)

    fuzzy = 0
    for record in leftovers:
        row, col = _cell(record.latitude, record.longitude)
        candidates = [
            i
            for dr in (-1, 0, 1)
            for dc in (-1, 0, 1)
            for i in grid.get((row + dr, col + dc), [])
            if i not in claimed and _similar(record.name, merged[i].name)
        ]
        match = _nearest(record, merged, candidates, FUZZY_RADIUS_KM)
        if match is not None:
            merged[match].status = record.status
            claimed.add(match)
            fuzzy += 1
    log.info(
        "NFA status merge: %d/%d records matched (%d fuzzy)", len(claimed), len(records), fuzzy
    )
    return merged


def _nearest(
    record: StatusRecord, shelters: list[Shelter], candidates: list[int], radius_km: float
) -> int | None:
    best: tuple[float, int] | None = None
    for i in candidates:
        s = shelters[i]
        d = haversine_km(record.latitude, record.longitude, s.latitude, s.longitude)
        if d <= radius_km and (best is None or d < best[0]):
            best = (d, i)
    return best[1] if best else None


def _cell(latitude: float, longitude: float) -> tuple[int, int]:
    return int(latitude // _GRID_DEG), int(longitude // _GRID_DEG)


def _similar(a: str, b: str) -> bool:
    a, b = normalize_name(a), normalize_name(b)
    if not a or not b:
        return False
    return a in b or b in a or SequenceMatcher(None, a, b).ratio() >= FUZZY_MIN_RATIO
