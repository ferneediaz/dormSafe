"""In-memory store for LOCAL dorm state (single process; resets on restart).

Rules enforced here:
* A resident without a recorded status is `unknown`; the store never fabricates statuses.
* A status applies to exactly one resident: nothing is inferred for roommates.
"""

from __future__ import annotations

import threading
from datetime import UTC, datetime

from dormsafe.config import Settings
from dormsafe.dorm.fixtures import build_access_points, build_dorm, build_residents
from dormsafe.dorm.models import (
    BuildingAccessPoint,
    BuildingAccessUpdate,
    Dorm,
    DormIncident,
    IncidentCreate,
    IncidentReport,
    Resident,
    ResidentStatus,
    ResidentStatusCreate,
)


class NotFoundError(LookupError):
    pass


class ValidationError(ValueError):
    pass


def utcnow() -> datetime:
    return datetime.now(UTC)


class DormStore:
    def __init__(self, settings: Settings) -> None:
        self._lock = threading.Lock()
        self.dorm: Dorm = build_dorm(settings)
        self._residents: dict[str, Resident] = {r.id: r for r in build_residents(settings)}
        self._statuses: dict[str, ResidentStatus] = {}  # latest per resident
        self._status_history: list[ResidentStatus] = []
        self._incidents: dict[str, DormIncident] = {}
        self._reports: list[IncidentReport] = []
        self._access: dict[str, BuildingAccessPoint] = {
            p.id: p for p in build_access_points(settings, utcnow())
        }

    # ------------------------------------------------------------ residents

    def residents(self, floor: int | None = None) -> list[Resident]:
        return [r for r in self._residents.values() if floor is None or r.floor == floor]

    def statuses(self) -> list[ResidentStatus]:
        """Recorded statuses only. Residents missing from this list are `unknown`."""
        with self._lock:
            return list(self._statuses.values())

    def status_history(self) -> list[ResidentStatus]:
        with self._lock:
            return list(self._status_history)

    def record_status(self, body: ResidentStatusCreate) -> ResidentStatus:
        if body.resident_id not in self._residents:
            raise NotFoundError(f"unknown resident_id '{body.resident_id}'")
        self._check_floor(body.floor)
        reported_by = body.reported_by
        if body.confirmation_type == "self":
            if reported_by not in (None, body.resident_id):
                raise ValidationError("confirmation_type 'self' must be reported by the resident")
            reported_by = body.resident_id
        elif body.confirmation_type == "peer":
            if reported_by is None:
                raise ValidationError("confirmation_type 'peer' requires reported_by")
            if reported_by == body.resident_id:
                raise ValidationError("a peer confirmation must come from someone else")
        status = ResidentStatus(
            resident_id=body.resident_id,
            state=body.state,
            confirmation_type=body.confirmation_type,
            reported_by=reported_by,
            floor=body.floor,
            room=body.room,
            note=body.note,
            updated_at=utcnow(),
        )
        with self._lock:
            self._statuses[status.resident_id] = status
            self._status_history.append(status)
        return status

    # ------------------------------------------------------------ incidents

    def incidents(self) -> list[DormIncident]:
        with self._lock:
            return list(self._incidents.values())

    def reports(self, incident_id: str | None = None) -> list[IncidentReport]:
        with self._lock:
            return [r for r in self._reports if incident_id in (None, r.incident_id)]

    def create_incident(self, body: IncidentCreate) -> DormIncident:
        self._check_floor(body.floor)
        now = utcnow()
        with self._lock:
            incident = DormIncident(
                id=f"inc-{len(self._incidents) + 1:04d}",
                dorm_id=self.dorm.id,
                incident_type=body.incident_type,
                floor=body.floor,
                room=body.room,
                location_label=body.location_label,
                description=body.description,
                verification_state=body.verification_state,
                created_at=now,
                updated_at=now,
            )
            self._incidents[incident.id] = incident
            if body.description:
                self._reports.append(
                    IncidentReport(
                        id=f"rep-{len(self._reports) + 1:04d}",
                        incident_id=incident.id,
                        reporter_id=body.reporter_id,
                        description=body.description,
                        created_at=now,
                    )
                )
        return incident

    # ------------------------------------------------------------ building access

    def access_points(self) -> list[BuildingAccessPoint]:
        with self._lock:
            return list(self._access.values())

    def update_access(self, body: BuildingAccessUpdate) -> BuildingAccessPoint:
        with self._lock:
            current = self._access.get(body.access_point_id)
            if current is None:
                raise NotFoundError(f"unknown access_point_id '{body.access_point_id}'")
            updated = current.model_copy(
                update={
                    "state": body.state,
                    "verification_state": body.verification_state,
                    "updated_at": utcnow(),
                }
            )
            self._access[updated.id] = updated
            return updated

    # ------------------------------------------------------------ helpers

    def _check_floor(self, floor: int | None) -> None:
        if floor is not None and floor not in self.dorm.floors:
            raise ValidationError(f"floor {floor} does not exist in {self.dorm.id}")
