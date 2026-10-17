"""Optional demo scenario. NOT applied by default.

Enable at startup with DORMSAFE_SEED_SCENARIO=true, or call `seed_demo_scenario(store)`.
Creates: 1 fire incident (floor 7 laundry room), 1 blocked stairwell (east, floor 7),
1 resident needing help (room 803). All of it is simulated.
"""

from __future__ import annotations

from dataclasses import dataclass

from dormsafe.dorm.models import (
    BuildingAccessPoint,
    BuildingAccessUpdate,
    DormIncident,
    IncidentCreate,
    ResidentStatus,
    ResidentStatusCreate,
)
from dormsafe.dorm.store import DormStore


@dataclass
class SeededScenario:
    fire: DormIncident
    blocked_stairwell: BuildingAccessPoint
    needs_help: ResidentStatus


def seed_demo_scenario(store: DormStore) -> SeededScenario:
    top = max(store.dorm.floors)
    fire_floor = max(1, top - 1)
    fire_reporter = store.residents(floor=fire_floor)[0]
    helper_target = store.residents(floor=top)[4]  # e.g. room 803, bed a

    fire = store.create_incident(
        IncidentCreate(
            incident_type="fire",
            floor=fire_floor,
            location_label=f"Floor {fire_floor} laundry room",
            description="Smoke and flames coming from the laundry room door.",
            reporter_id=fire_reporter.id,
        )
    )
    blocked = store.update_access(
        BuildingAccessUpdate(
            access_point_id=f"stair-east-f{fire_floor}",
            state="blocked",
            verification_state="staff_verified",
        )
    )
    needs_help = store.record_status(
        ResidentStatusCreate(
            resident_id=helper_target.id,
            state="needs_help",
            confirmation_type="self",
            floor=helper_target.floor,
            room=helper_target.room,
            note="Cannot use the stairs (sprained ankle). Waiting in room.",
        )
    )
    return SeededScenario(fire=fire, blocked_stairwell=blocked, needs_help=needs_help)
