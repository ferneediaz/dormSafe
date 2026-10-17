"""Adapter: NFA evacuation shelter locations (避難收容處所點位檔, data.gov.tw dataset 73242).

Ported from safe-shelter-taiwan. Source: CSV, UTF-8 with BOM, one row per shelter:

    序號, 縣市及鄉鎮市區, 村里, 避難收容處所地址, 經度, 緯度, 避難收容處所名稱, 預計收容村里,
    預計收容人數, 適用災害類別, [管理人姓名, 管理人電話,] 室內, 室外, 適合避難弱者安置

* There is no stable shelter id; we derive one from county/name/coordinates.
* Manager name/phone are personal data and are never read.
* The file has no activation status, so `status` is always "designated".
* Rows outside Taiwan, or > 150 km from their county's median (mis-geocoded), are dropped.
"""

from __future__ import annotations

import csv
import hashlib
import io
import logging
import statistics
from collections import defaultdict

from dormsafe.external.models import Shelter
from dormsafe.external.parsing import (
    clean_str,
    haversine_km,
    in_taiwan,
    parse_bool_zh,
    parse_float,
    parse_int,
    split_list,
)

log = logging.getLogger(__name__)

NFA_SOURCE = "NFA"

COL_SEQ = "序號"
COL_COUNTY_TOWN = "縣市及鄉鎮市區"
COL_ADDRESS = "避難收容處所地址"
COL_LON = "經度"
COL_LAT = "緯度"
COL_NAME = "避難收容處所名稱"
COL_CAPACITY = "預計收容人數"
COL_DISASTER_TYPES = "適用災害類別"
COL_VULNERABLE = "適合避難弱者安置"
REQUIRED_COLUMNS = {COL_NAME, COL_LAT, COL_LON}

DISASTER_TYPE_MAP: dict[str, str] = {
    "水災": "flood",
    "震災": "earthquake",
    "地震": "earthquake",
    "土石流": "debris_flow",
    "海嘯": "tsunami",
    "風災": "typhoon",
    "坡地災害": "landslide",
    "核子事故": "nuclear_accident",
    "核災": "nuclear_accident",
    "火山災害": "volcano",
    "生物病原災害": "biological_hazard",
    "其他": "other",
}

MAX_KM_FROM_COUNTY_MEDIAN = 150.0
MIN_POINTS_PER_COUNTY = 5


def normalize_disaster_types(value: str | None) -> list[str]:
    result: list[str] = []
    for label in split_list(value):
        mapped = DISASTER_TYPE_MAP.get(label, "other")
        if mapped not in result:
            result.append(mapped)
    return result


def county_of(value: str | None) -> str | None:
    """'桃園市復興區' -> '桃園市' (county names are always 3 characters)."""
    value = clean_str(value)
    if value and len(value) >= 3 and value[2] in ("市", "縣"):
        return value[:3].replace("台", "臺")
    return value


def shelter_id(county: str | None, name: str, latitude: float, longitude: float) -> str:
    key = f"{county or ''}|{name}|{latitude:.5f}|{longitude:.5f}"
    return "nfa-" + hashlib.sha1(key.encode("utf-8")).hexdigest()[:12]


def parse_shelters_csv(content: bytes) -> list[Shelter]:
    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    missing = REQUIRED_COLUMNS - set(reader.fieldnames or [])
    if missing:
        raise ValueError(f"NFA shelter CSV schema changed; missing columns: {sorted(missing)}")

    rows: list[tuple[str | None, Shelter]] = []
    seen: set[str] = set()
    for row in reader:
        name = clean_str(row.get(COL_NAME))
        lat = parse_float(row.get(COL_LAT))
        lon = parse_float(row.get(COL_LON))
        if name is None or lat is None or lon is None or not in_taiwan(lat, lon):
            continue
        county = county_of(row.get(COL_COUNTY_TOWN))
        sid = shelter_id(county, name, lat, lon)
        if sid in seen:
            sid = f"{sid}-{clean_str(row.get(COL_SEQ))}"
        seen.add(sid)
        shelter = Shelter(
            id=sid,
            name=name,
            address=clean_str(row.get(COL_ADDRESS)),
            latitude=lat,
            longitude=lon,
            status="designated",
            planned_capacity=parse_int(row.get(COL_CAPACITY)),
            suitable_for_vulnerable_people=parse_bool_zh(row.get(COL_VULNERABLE)),
            disaster_types=normalize_disaster_types(row.get(COL_DISASTER_TYPES)),
            source=NFA_SOURCE,
        )
        rows.append((county, shelter))

    outliers = _county_outliers(rows)
    if outliers:
        log.info("NFA shelters: dropped %d mis-geocoded rows", len(outliers))
    return [s for i, (_, s) in enumerate(rows) if i not in outliers]


def _county_outliers(rows: list[tuple[str | None, Shelter]]) -> set[int]:
    by_county: dict[str, list[int]] = defaultdict(list)
    for i, (county, _) in enumerate(rows):
        if county:
            by_county[county].append(i)
    outliers: set[int] = set()
    for indices in by_county.values():
        if len(indices) < MIN_POINTS_PER_COUNTY:
            continue
        med_lat = statistics.median(rows[i][1].latitude for i in indices)
        med_lon = statistics.median(rows[i][1].longitude for i in indices)
        for i in indices:
            s = rows[i][1]
            if haversine_km(s.latitude, s.longitude, med_lat, med_lon) > MAX_KM_FROM_COUNTY_MEDIAN:
                outliers.add(i)
    return outliers


def within_radius(
    shelters: list[Shelter], latitude: float, longitude: float, radius_km: float
) -> list[Shelter]:
    """Filter (not rank): keep source order. radius_km <= 0 returns everything."""
    if radius_km <= 0:
        return shelters
    return [
        s
        for s in shelters
        if haversine_km(latitude, longitude, s.latitude, s.longitude) <= radius_km
    ]
