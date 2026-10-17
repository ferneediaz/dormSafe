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
        description="'designated' = on the official shelter list; activation is not published "
        "in this dataset, so this never means 'open'.",
    )
    planned_capacity: int | None = Field(default=None, ge=0)
    suitable_for_vulnerable_people: bool | None = None
    disaster_types: list[str] = Field(default_factory=list)
    source: str = Field(description="Publishing agency, e.g. 'NFA'")
