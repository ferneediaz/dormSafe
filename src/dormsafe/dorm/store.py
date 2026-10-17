"""In-memory store for LOCAL dorm state (single process; resets on restart).

Rules enforced here:
* A resident without a recorded status is `unknown`; the store never fabricates statuses
  (the demo simulator writes statuses explicitly marked `simulated`).
* A status applies to exactly one resident: nothing is inferred for roommates.
* Starting a roll call resets everyone to `unknown`; the full history is kept.
"""

from __future__ import annotations

import random
import threading
from collections import Counter
from datetime import UTC, datetime

from dormsafe.config import Settings
from dormsafe.dorm.fixtures import build_access_points, build_dorm, build_residents
from dormsafe.dorm.models import (
    BuildingAccessPoint,
    BuildingAccessUpdate,
    Dorm,
    DormIncident,
    DormSummary,
    FloorSummary,
    IncidentCreate,
    IncidentReport,
    Resident,
    ResidentState,
    ResidentStatus,
    ResidentStatusCreate,
    RollCall,
    SimulateCheckIns,
    StatusCounts,
)

SIMULATOR_ID = "simulator"


class NotFoundError(LookupError):
    pass


class ValidationError(ValueError):
    pass


def utcnow() -> datetime:
    return datetime.now(UTC)


class DormStore:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._lock = threading.RLock()
        self.reset()

    def reset(self) -> None:
        """Back to the initial fixture: everyone unknown, no incidents, no roll call."""
        with self._lock:
            self.dorm: Dorm = build_dorm(self._settings)
            self._residents: dict[str, Resident] = {
                r.id: r for r in build_residents(self._settings)
            }
            self._statuses: dict[str, ResidentStatus] = {}  # latest per resident
            self._status_history: list[ResidentStatus] = []
            self._incidents: dict[str, DormIncident] = {}
            self._reports: list[IncidentReport] = []
            self._access: dict[str, BuildingAccessPoint] = {
                p.id: p for p in build_access_points(self._settings, utcnow())
            }
            self._roll_calls: list[RollCall] = []

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
        if body.confirmation_type == "simulated":
            raise ValidationError("confirmation_type 'simulated' is reserved for the simulator")
        if body.confirmation_type == "self":
            if reported_by not in (None, body.resident_id):
                raise ValidationError("confirmation_type 'self' must be reported by the resident")
            reported_by = body.resident_id
        elif body.confirmation_type == "peer":
            if reported_by is None:
                raise ValidationError("confirmation_type 'peer' requires reported_by")
            if reported_by == body.resident_id:
                raise ValidationError("a peer confirmation must come from someone else")
        with self._lock:
            status = ResidentStatus(
                resident_id=body.resident_id,
                state=body.state,
                confirmation_type=body.confirmation_type,
                reported_by=reported_by,
                floor=body.floor,
                room=body.room,
                note=body.note,
                updated_at=utcnow(),
                roll_call_id=self._active_roll_call_id(),
            )
            self._save_status(status)
        return status

    def _save_status(self, status: ResidentStatus) -> None:
        self._statuses[status.resident_id] = status
        self._status_history.append(status)

    def state_of(self, resident_id: str) -> ResidentState:
        status = self._statuses.get(resident_id)
        return status.state if status else "unknown"

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

    # ------------------------------------------------------------ roll call

    def roll_call(self) -> RollCall | None:
        """The current roll call (active, or the last one ended), or None."""
        with self._lock:
            return self._roll_calls[-1] if self._roll_calls else None

    def start_roll_call(self, reason: str, alert_id: str | None = None) -> RollCall:
        with self._lock:
            self._end_active()
            roll_call = RollCall(
                id=f"rc-{len(self._roll_calls) + 1:04d}",
                dorm_id=self.dorm.id,
                reason=reason,
                alert_id=alert_id,
                started_at=utcnow(),
                active=True,
            )
            self._roll_calls.append(roll_call)
            self._statuses = {}  # everyone back to unknown; history is kept
            return roll_call

    def end_roll_call(self) -> RollCall:
        with self._lock:
            ended = self._end_active()
            if ended is None:
                raise NotFoundError("no active roll call")
            return ended

    def _end_active(self) -> RollCall | None:
        if not self._roll_calls or not self._roll_calls[-1].active:
            return None
        ended = self._roll_calls[-1].model_copy(update={"active": False, "ended_at": utcnow()})
        self._roll_calls[-1] = ended
        return ended

    def _active_roll_call_id(self) -> str | None:
        current = self._roll_calls[-1] if self._roll_calls else None
        return current.id if current and current.active else None

    # ------------------------------------------------------------ demo simulator

    def simulate_check_ins(self, body: SimulateCheckIns) -> int:
        """Fill in SIMULATED statuses for residents who have none, towards the target shares
        of the whole roster. Upper floors are filled last, so most remaining `unknown`
        residents are there (as in the readme scenario). Never overwrites a real status.
        Returns the number of statuses written."""
        if body.safe + body.still_inside + body.needs_help > 1 + 1e-9:
            raise ValidationError("safe + still_inside + needs_help must not exceed 1")
        rng = random.Random(body.seed)
        with self._lock:
            total = len(self._residents)
            have = Counter(s.state for s in self._statuses.values())
            wanted: list[ResidentState] = []
            for state, share in (
                ("needs_help", body.needs_help),
                ("still_inside", body.still_inside),
                ("safe", body.safe),
            ):
                wanted += [state] * max(0, round(total * share) - have[state])

            pool = [r for r in self._residents.values() if r.id not in self._statuses]
            rng.shuffle(pool)
            upper_from = max(self.dorm.floors) - max(1, len(self.dorm.floors) // 4) + 1
            pool.sort(key=lambda r: r.floor >= upper_from)  # stable: upper floors last
            wanted = wanted[: len(pool)]
            rng.shuffle(wanted)

            now = utcnow()
            roll_call_id = self._active_roll_call_id()
            for resident, state in zip(pool, wanted, strict=False):
                self._save_status(
                    ResidentStatus(
                        resident_id=resident.id,
                        state=state,
                        confirmation_type="simulated",
                        reported_by=SIMULATOR_ID,
                        note="[SIM] simulated check-in",
                        updated_at=now,
                        roll_call_id=roll_call_id,
                    )
                )
            return len(wanted)

    # ------------------------------------------------------------ summary

    def summary(self) -> DormSummary:
        with self._lock:
            counts = _counts(self.state_of(r.id) for r in self._residents.values())
            blocked = [p for p in self._access.values() if p.state == "blocked"]
            open_incidents = [
                i for i in self._incidents.values() if i.verification_state != "resolved"
            ]
            floors = []
            for floor in sorted(self.dorm.floors, reverse=True):
                floor_counts = _counts(
                    self.state_of(r.id) for r in self._residents.values() if r.floor == floor
                )
                floors.append(
                    FloorSummary(
                        floor=floor,
                        **floor_counts.model_dump(),
                        blocked_access_point_ids=[p.id for p in blocked if p.floor == floor],
                        open_incident_ids=[i.id for i in open_incidents if i.floor == floor],
                    )
                )
            return DormSummary(
                dorm_id=self.dorm.id,
                roll_call=self.roll_call(),
                residents=counts,
                floors=floors,
                blocked_access_points=blocked,
                open_incidents=len(open_incidents),
                generated_at=utcnow(),
            )

    # ------------------------------------------------------------ helpers

    def _check_floor(self, floor: int | None) -> None:
        if floor is not None and floor not in self.dorm.floors:
            raise ValidationError(f"floor {floor} does not exist in {self.dorm.id}")


def _counts(states) -> StatusCounts:
    c = Counter(states)
    return StatusCounts(
        total=sum(c.values()),
        safe=c["safe"],
        still_inside=c["still_inside"],
        needs_help=c["needs_help"],
        unknown=c["unknown"],
    )
