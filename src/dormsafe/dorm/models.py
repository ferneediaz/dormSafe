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
# "simulated" is set only by the demo simulator; the API rejects it on POST.
ConfirmationType = Literal["self", "peer", "staff", "simulated"]


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
    roll_call_id: str | None = Field(
        default=None, description="Roll call active when reported (null if none)"
    )


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


# ------------------------------------------------------------------ roll call


class RollCall(BaseModel):
    """An accountability event. Starting one resets every resident to `unknown`."""

    id: str
    dorm_id: str
    reason: str
    alert_id: str | None = Field(default=None, description="ExternalAlert that triggered it")
    started_at: datetime
    ended_at: datetime | None = None
    active: bool


class RollCallStart(BaseModel):
    reason: str | None = Field(
        default=None, max_length=200, description="Defaults to a text built from alert_id"
    )
    alert_id: str | None = Field(
        default=None, description="e.g. an id from /external/earthquakes or /external/alerts"
    )


# ------------------------------------------------------------------ summary


class StatusCounts(BaseModel):
    total: int
    safe: int
    still_inside: int
    needs_help: int
    unknown: int


class FloorSummary(StatusCounts):
    floor: int
    blocked_access_point_ids: list[str]
    open_incident_ids: list[str] = Field(description="Incidents not yet resolved on this floor")


class DormSummary(BaseModel):
    dorm_id: str
    roll_call: RollCall | None
    residents: StatusCounts
    floors: list[FloorSummary] = Field(description="Ordered top floor first")
    blocked_access_points: list[BuildingAccessPoint]
    open_incidents: int
    generated_at: datetime


class SimulateCheckIns(BaseModel):
    """Body of POST /demo/simulate-check-ins. Fractions of the whole roster; defaults follow
    the readme scenario (623 safe / 43 inside / 5 need help of 812)."""

    safe: float = Field(default=623 / 812, ge=0, le=1)
    still_inside: float = Field(default=43 / 812, ge=0, le=1)
    needs_help: float = Field(default=5 / 812, ge=0, le=1)
    seed: int = 42
