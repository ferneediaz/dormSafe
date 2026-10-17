"""Deterministic demo fixture: 1 dorm, simulated residents, stairwells and exits.

Default (8 floors x 6 rooms x 2 residents): 96 residents, 2 stairwells segmented per floor
(16 access points) and 2 ground-floor exits. All residents are fictional: ids start with
'sim-' and display names with '[SIM]'.
"""

from __future__ import annotations

from datetime import datetime

from dormsafe.config import Settings
from dormsafe.dorm.models import BuildingAccessPoint, Dorm, Resident

SIMULATED_PREFIX = "[SIM] "

# Fictional name parts, combined deterministically. Any resemblance to real people is chance.
_SURNAMES = ["Chen", "Lin", "Huang", "Chang", "Lee", "Wang", "Wu", "Liu", "Tsai", "Yang", "Hsu"]
_GIVEN = [
    "Yu-ting", "Chia-hao", "Wei-lun", "Hsin-yi", "Po-han", "Yi-chen", "Tzu-yu", "Kuan-ting",
    "Shu-fen", "Chih-wei", "Pei-shan", "Yu-hsuan", "Cheng-en", "Ya-ting", "Jun-jie", "Mei-ling",
    "Bo-yu",
]  # fmt: skip

STAIRWELLS = (("east", "East Stairwell"), ("west", "West Stairwell"))
EXITS = (("exit-main", "Main Entrance (North)"), ("exit-rear", "Rear Exit (South)"))


def build_dorm(settings: Settings) -> Dorm:
    return Dorm(
        id=settings.dorm_id,
        name=settings.dorm_name,
        address=settings.dorm_address,
        latitude=settings.dorm_latitude,
        longitude=settings.dorm_longitude,
        floors=list(range(1, settings.dorm_floor_count + 1)),
    )


def room_label(floor: int, room_index: int) -> str:
    """Floor 7, room 3 -> '703'."""
    return f"{floor}{room_index:02d}"


def build_residents(settings: Settings) -> list[Resident]:
    residents: list[Resident] = []
    for floor in range(1, settings.dorm_floor_count + 1):
        for room_index in range(1, settings.dorm_rooms_per_floor + 1):
            room = room_label(floor, room_index)
            for bed in range(settings.dorm_residents_per_room):
                n = len(residents)
                name = f"{_SURNAMES[n % len(_SURNAMES)]} {_GIVEN[(n * 7) % len(_GIVEN)]}"
                residents.append(
                    Resident(
                        id=f"sim-r{room}-{chr(ord('a') + bed)}",
                        display_name=SIMULATED_PREFIX + name,
                        dorm_id=settings.dorm_id,
                        floor=floor,
                        room=room,
                    )
                )
    return residents


def build_access_points(settings: Settings, now: datetime) -> list[BuildingAccessPoint]:
    """Initial state: everything 'unknown' and unverified ('reported' is the weakest level)."""
    points: list[BuildingAccessPoint] = []
    for key, name in STAIRWELLS:
        for floor in range(1, settings.dorm_floor_count + 1):
            points.append(
                BuildingAccessPoint(
                    id=f"stair-{key}-f{floor}",
                    dorm_id=settings.dorm_id,
                    name=name,
                    kind="stairwell",
                    floor=floor,
                    state="unknown",
                    verification_state="reported",
                    updated_at=now,
                )
            )
    for exit_id, name in EXITS:
        points.append(
            BuildingAccessPoint(
                id=exit_id,
                dorm_id=settings.dorm_id,
                name=name,
                kind="exit",
                floor=1,
                state="unknown",
                verification_state="reported",
                updated_at=now,
            )
        )
    return points
