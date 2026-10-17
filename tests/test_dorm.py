from __future__ import annotations

import pytest

from dormsafe.dorm.fixtures import build_residents
from dormsafe.dorm.models import (
    BuildingAccessUpdate,
    IncidentCreate,
    ResidentStatusCreate,
)
from dormsafe.dorm.scenario import seed_demo_scenario
from dormsafe.dorm.store import DormStore, NotFoundError, ValidationError


@pytest.fixture
def store(settings) -> DormStore:
    return DormStore(settings)


def test_fixture_shape(store):
    assert len(store.dorm.floors) in range(6, 9)
    residents = store.residents()
    assert 60 <= len(residents) <= 100
    assert len({r.id for r in residents}) == len(residents)
    assert all(r.id.startswith("sim-") for r in residents)
    assert all(r.display_name.startswith("[SIM] ") for r in residents)
    assert all(r.dorm_id == store.dorm.id and r.floor in store.dorm.floors for r in residents)

    points = store.access_points()
    stairwells = {p.name for p in points if p.kind == "stairwell"}
    exits = [p for p in points if p.kind == "exit"]
    assert stairwells == {"East Stairwell", "West Stairwell"}
    assert len(exits) == 2


def test_fixture_is_deterministic(settings):
    assert build_residents(settings) == build_residents(settings)


def test_initial_state(store):
    assert store.statuses() == []  # everyone unknown
    assert store.incidents() == []
    assert {p.state for p in store.access_points()} <= {"unknown", "usable"}


def test_scenario_is_opt_in(settings, store):
    assert store.incidents() == []
    seeded = seed_demo_scenario(store)
    assert seeded.fire.incident_type == "fire"
    assert seeded.blocked_stairwell.state == "blocked"
    assert seeded.blocked_stairwell.verification_state == "staff_verified"
    assert seeded.needs_help.state == "needs_help"
    assert len(store.incidents()) == 1
    assert len(store.reports(seeded.fire.id)) == 1


def test_no_roommate_inference(store):
    store.record_status(
        ResidentStatusCreate(resident_id="sim-r703-a", state="safe", confirmation_type="self")
    )
    ids = {s.resident_id for s in store.statuses()}
    assert ids == {"sim-r703-a"}  # sim-r703-b (same room) stays unknown


def test_latest_status_wins_history_kept(store):
    for state in ("still_inside", "safe"):
        store.record_status(
            ResidentStatusCreate(resident_id="sim-r101-a", state=state, confirmation_type="self")
        )
    assert [s.state for s in store.statuses()] == ["safe"]
    assert [s.state for s in store.status_history()] == ["still_inside", "safe"]


def test_self_report_sets_reporter(store):
    s = store.record_status(
        ResidentStatusCreate(resident_id="sim-r101-a", state="safe", confirmation_type="self")
    )
    assert s.reported_by == "sim-r101-a"


@pytest.mark.parametrize(
    ("body", "error"),
    [
        ({"resident_id": "nobody", "confirmation_type": "self"}, NotFoundError),
        ({"resident_id": "sim-r101-a", "confirmation_type": "peer"}, ValidationError),
        (
            {"resident_id": "sim-r101-a", "confirmation_type": "peer", "reported_by": "sim-r101-a"},
            ValidationError,
        ),
        (
            {"resident_id": "sim-r101-a", "confirmation_type": "self", "reported_by": "sim-r101-b"},
            ValidationError,
        ),
        ({"resident_id": "sim-r101-a", "confirmation_type": "staff", "floor": 99}, ValidationError),
    ],
)
def test_invalid_status_reports(store, body, error):
    with pytest.raises(error):
        store.record_status(ResidentStatusCreate(state="safe", **body))


def test_incident_with_report(store):
    inc = store.create_incident(
        IncidentCreate(
            incident_type="smoke",
            floor=7,
            location_label="East corridor floor 7",
            description="Smoke near the east end",
            reporter_id="sim-r702-a",
        )
    )
    assert inc.verification_state == "reported"
    assert inc.dorm_id == store.dorm.id
    (report,) = store.reports(inc.id)
    assert report.reporter_id == "sim-r702-a"
    assert report.description == "Smoke near the east end"


def test_incident_without_description_has_no_report(store):
    inc = store.create_incident(IncidentCreate(incident_type="other"))
    assert store.reports(inc.id) == []


def test_access_update(store):
    p = store.update_access(
        BuildingAccessUpdate(access_point_id="stair-west-f3", state="usable")
    )
    assert p.state == "usable" and p.verification_state == "reported"
    with pytest.raises(NotFoundError):
        store.update_access(BuildingAccessUpdate(access_point_id="nope", state="blocked"))
