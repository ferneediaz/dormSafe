"""Small parsing helpers for Taiwan government feeds (ported from safe-shelter-taiwan)."""

from __future__ import annotations

import math
import re
from datetime import datetime, timedelta, timezone

TAIPEI_TZ = timezone(timedelta(hours=8), name="Asia/Taipei")

# (min_lon, min_lat, max_lon, max_lat), including outlying islands (Kinmen, Matsu, Penghu).
TAIWAN_BBOX = (118.0, 21.7, 122.2, 26.5)
EARTH_RADIUS_M = 6_371_000.0

_ZH_TRUE = {"是", "有", "y", "yes", "true", "1"}
_ZH_FALSE = {"否", "無", "n", "no", "false", "0"}

# e.g. "2026/10/14 下午 10:19:00" (NCDR Atom feed, zh-TW locale formatting)
_ZH_AMPM_RE = re.compile(
    r"^(?P<date>\d{4}[/-]\d{1,2}[/-]\d{1,2})\s+(?P<ampm>上午|下午)\s*"
    r"(?P<h>\d{1,2}):(?P<m>\d{2})(?::(?P<s>\d{2}))?$"
)
_PLAIN_RE = re.compile(
    r"^(?P<date>\d{4}[/-]\d{1,2}[/-]\d{1,2})(?:[ T](?P<h>\d{1,2}):(?P<m>\d{2})(?::(?P<s>\d{2}))?)?$"
)


def clean_str(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


def parse_bool_zh(value: str | None) -> bool | None:
    """'是' -> True, '否' -> False, anything else -> None (unknown, never guessed)."""
    value = clean_str(value)
    if value is None:
        return None
    lowered = value.lower()
    if lowered in _ZH_TRUE:
        return True
    if lowered in _ZH_FALSE:
        return False
    return None


def parse_int(value: str | None) -> int | None:
    """Parse a non-negative integer count; None for blanks, junk, or negatives."""
    value = clean_str(value)
    if value is None:
        return None
    try:
        number = float(value.replace(",", ""))
    except ValueError:
        return None
    if number < 0 or number != int(number):
        return None
    return int(number)


def parse_float(value: str | None) -> float | None:
    value = clean_str(value)
    if value is None:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def split_list(value: str | None, separators: str = ",，、;；\n") -> list[str]:
    value = clean_str(value)
    if value is None:
        return []
    parts = re.split(f"[{re.escape(separators)}]", value)
    return [p.strip() for p in parts if p.strip()]


def normalize_name(value: str) -> str:
    """Key for matching the same shelter across datasets ('臺' == '台', no punctuation)."""
    value = re.sub(r"[\s　()（）\[\]【】「」、,，.。\-－_]", "", value)
    return value.replace("臺", "台")


def parse_datetime(value: str | None, default_tz: timezone = TAIPEI_TZ) -> datetime | None:
    """Parse ISO 8601, `YYYY/MM/DD HH:MM[:SS]` and zh-TW `YYYY/MM/DD 上午|下午 hh:mm[:ss]`.

    Naive values are assumed Taiwan time. Returns None if blank or unparseable.
    """
    value = clean_str(value)
    if value is None:
        return None

    parsed: datetime | None = None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        parsed = None

    if parsed is None and (m := _ZH_AMPM_RE.match(value)):
        hour = int(m["h"])
        if not 1 <= hour <= 12:
            return None
        if m["ampm"] == "上午":
            hour = 0 if hour == 12 else hour
        else:
            hour = 12 if hour == 12 else hour + 12
        parsed = _build(m["date"], hour, int(m["m"]), int(m["s"] or 0))

    if parsed is None and (m := _PLAIN_RE.match(value)):
        parsed = _build(m["date"], int(m["h"] or 0), int(m["m"] or 0), int(m["s"] or 0))

    if parsed is None:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=default_tz)
    return parsed


def _build(date_part: str, hour: int, minute: int, second: int) -> datetime | None:
    year, month, day = (int(x) for x in re.split(r"[/-]", date_part))
    try:
        return datetime(year, month, day, hour, minute, second)
    except ValueError:
        return None


def in_taiwan(latitude: float, longitude: float) -> bool:
    min_lon, min_lat, max_lon, max_lat = TAIWAN_BBOX
    return min_lat <= latitude <= max_lat and min_lon <= longitude <= max_lon


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a)) / 1000
