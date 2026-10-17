"""Models for LOCAL dorm data: the dorm, simulated residents, statuses, incidents, access.

Nothing here comes from external sources, and no real student data is ever stored.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

# ------------------------------------------------------------------ dorm & residents


class Dorm(BaseModel):
    id: str
    name: str
    address: str | None = None
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    floors: list[int]


class Resident(BaseModel):
    """A SIMULATED resident. ids start with 'sim-', display names with '[SIM]'."""

    id: str
    display_name: str
    dorm_id: str
    floor: int
    room: str


# ------------------------------------------------------------------ resident status

ResidentState = Literal["unknown", "safe", "still_inside", "needs_help"]
ConfirmationType = Literal["self", "peer", "staff"]


class ResidentStatus(BaseModel):
    """Latest status of one resident. A resident with NO ResidentStatus is 'unknown'."""

    resident_id: str
    state: ResidentState
    confirmation_type: ConfirmationType
    reported_by: str | None = None
    floor: int | None = None
    room: str | None = None
    note: str | None = None
    updated_at: datetime


class ResidentStatusCreate(BaseModel):
    """Body of POST /resident-statuses. The server sets updated_at."""

    resident_id: str
    state: ResidentState
    confirmation_type: ConfirmationType
    reported_by: str | None = Field(
        default=None, description="Who reported it (resident id or staff id). Required for peer."
    )
    floor: int | None = Field(default=None, description="Where the resident is now, if known")
    room: str | None = None
    note: str | None = Field(default=None, max_length=500)


# ------------------------------------------------------------------ incidents

IncidentType = Literal[
    "fire",
    "smoke",
    "gas_leak",
    "blocked_stairwell",
    "blocked_corridor",
    "structural_damage",
    "electrical_hazard",
    "injured_person",
    "trapped_person",
    "other",
]

VerificationState = Literal["reported", "corroborated", "staff_verified", "resolved"]


class DormIncident(BaseModel):
    id: str
    dorm_id: str
    incident_type: IncidentType
    floor: int | None = None
    room: str | None = None
    location_label: str | None = None
    description: str | None = None
    verification_state: VerificationState
    created_at: datetime
    updated_at: datetime


class IncidentReport(BaseModel):
    """One observation of an incident. Several reports may refer to the same incident."""

    id: str
    incident_id: str
    reporter_id: str | None = None
    description: str
    created_at: datetime


class IncidentCreate(BaseModel):
    """Body of POST /incidents. Creates the incident and, if a description is given, its
    first IncidentReport. dorm_id defaults to the demo dorm."""

    incident_type: IncidentType
    floor: int | None = None
    room: str | None = None
    location_label: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    reporter_id: str | None = None
    verification_state: VerificationState = "reported"


# ------------------------------------------------------------------ building access

AccessState = Literal["unknown", "usable", "blocked"]
AccessKind = Literal["stairwell", "exit", "corridor"]


class BuildingAccessPoint(BaseModel):
    id: str
    dorm_id: str
    name: str
    kind: AccessKind
    floor: int | None = None
    state: AccessState
    verification_state: VerificationState
    updated_at: datetime


class BuildingAccessUpdate(BaseModel):
    """Body of POST /building-access: change the state of an existing access point."""

    access_point_id: str
    state: AccessState
    verification_state: VerificationState = "reported"
