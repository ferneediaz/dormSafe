"""Normalized models for EXTERNAL REAL Taiwan open data.

No government field names appear here; they live only in the adapter modules.
Every object carries `source` (and alerts carry `data_mode`) so provenance is never lost.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

# live        - fetched from the official source for this request
# cached_real - fetched live earlier and served from the in-process cache
# frozen_real - bundled snapshot of real official data (data/frozen/), used offline/for demos
DataMode = Literal["live", "cached_real", "frozen_real"]

# Stable vocabulary for ExternalAlert.event_type. Anything else official (strong wind, heat,
# reservoir discharge, tsunami, ...) is reported as "other"; the original label is in headline.
EVENT_TYPES: tuple[str, ...] = ("earthquake", "heavy_rain", "flood", "typhoon", "other")


class ExternalAlert(BaseModel):
    id: str = Field(description="'ncdr:<CAP identifier>'")
    event_type: str = Field(description="One of: earthquake, heavy_rain, flood, typhoon, other")
    headline: str | None = None
    description: str | None = None
    severity: str | None = Field(
        default=None, description="CAP severity, lowercase: extreme|severe|moderate|minor|unknown"
    )
    effective_at: datetime | None = None
    expires_at: datetime | None = None
    affected_areas: list[str] = Field(default_factory=list, description="Area names as published")
    source: str = Field(description="Publishing platform, e.g. 'NCDR'")
    data_mode: DataMode


class Shelter(BaseModel):
    id: str = Field(description="Deterministic 'nfa-<hash>' (the source has no stable id)")
    name: str
    address: str | None = None
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    status: str | None = Field(
        default=None,
        description="From NFA dataset 12849 when a status record matches: 'open' | 'full' | "
        "'withdrawn' (撤除; also the apparent default for never-opened shelters, NOT 'closed') "
        "| 'unknown'. 'designated' = on the official list, no status record matched.",
    )
    planned_capacity: int | None = Field(default=None, ge=0)
    suitable_for_vulnerable_people: bool | None = None
    disaster_types: list[str] = Field(default_factory=list)
    source: str = Field(description="Publishing agency, e.g. 'NFA'")


class NearestShelter(Shelter):
    distance_km: float = Field(description="Straight-line distance from the query point")


class CountyIntensity(BaseModel):
    county: str = Field(description="County/city as published, e.g. '花蓮縣'")
    intensity: str = Field(description="Max local intensity as published, e.g. '3級', '5弱'")


class Earthquake(BaseModel):
    """A CWA earthquake report as distributed through the NCDR CAP feed."""

    id: str = Field(description="Same id as the matching ExternalAlert ('ncdr:<CAP id>')")
    origin_time: datetime | None = None
    magnitude: float | None = Field(default=None, description="Richter magnitude (芮氏規模)")
    depth_km: float | None = None
    epicenter_latitude: float | None = None
    epicenter_longitude: float | None = None
    epicenter_location: str | None = Field(default=None, description="e.g. '花蓮縣豐濱鄉'")
    description: str | None = None
    max_intensity: str | None = None
    county_intensities: list[CountyIntensity] = Field(
        default_factory=list, description="Strongest first, as published"
    )
    report_url: str | None = None
    publisher: str | None = Field(default=None, description="Issuing agency, e.g. 中央氣象署")
    source: str
    data_mode: DataMode
