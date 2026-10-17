"""Roll call, demo simulator, reset and summary."""

from __future__ import annotations

import pytest

from dormsafe.dorm.models import ResidentStatusCreate, SimulateCheckIns
from dormsafe.dorm.scenario import seed_demo_scenario
from dormsafe.dorm.store import DormStore, NotFoundError, ValidationError


@pytest.fixture
def store(settings) -> DormStore:
    return DormStore(settings)


def _safe(store: DormStore, resident_id: str):
    return store.record_status(
        ResidentStatusCreate(resident_id=resident_id, state="safe", confirmation_type="self")
    )


def test_roll_call_resets_everyone_and_tags_statuses(store):
    _safe(store, "sim-r101-a")
    rc = store.start_roll_call("Earthquake drill")
    assert rc.active and rc.id == "rc-0001"
    assert store.statuses() == []  # everyone unknown again
    assert len(store.status_history()) == 1  # history kept

    s = _safe(store, "sim-r101-a")
    assert s.roll_call_id == rc.id
    ended = store.end_roll_call()
    assert not ended.active and ended.ended_at is not None
    assert _safe(store, "sim-r101-b").roll_call_id is None
    with pytest.raises(NotFoundError):
        store.end_roll_call()


def test_new_roll_call_ends_previous(store):
    first = store.start_roll_call("one")
    second = store.start_roll_call("two")
    assert second.id != first.id
    assert store.roll_call() == second


def test_simulator_targets_and_provenance(store):
    written = store.simulate_check_ins(SimulateCheckIns())
    summary = store.summary()
    total = summary.residents.total
    assert written == total - summary.residents.unknown
    assert summary.residents.safe == round(total * 623 / 812)
    assert summary.residents.still_inside == round(total * 43 / 812)
    assert summary.residents.needs_help == round(total * 5 / 812)
    for s in store.statuses():
        assert s.confirmation_type == "simulated"
        assert s.reported_by == "simulator"


def test_simulator_leaves_unknowns_on_upper_floors(store):
    store.simulate_check_ins(SimulateCheckIns())
    floors = {f.floor: f for f in store.summary().floors}
    top = max(floors)
    upper_unknown = floors[top].unknown + floors[top - 1].unknown
    assert upper_unknown == store.summary().residents.unknown


def test_simulator_never_overwrites_real_status(store):
    real = store.record_status(
        ResidentStatusCreate(
            resident_id="sim-r803-a", state="needs_help", confirmation_type="self"
        )
    )
    store.simulate_check_ins(SimulateCheckIns(safe=1.0, still_inside=0, needs_help=0))
    by_id = {s.resident_id: s for s in store.statuses()}
    assert by_id["sim-r803-a"] == real
    assert store.summary().residents.unknown == 0


def test_simulator_is_deterministic(settings):
    a, b = DormStore(settings), DormStore(settings)
    a.simulate_check_ins(SimulateCheckIns(seed=7))
    b.simulate_check_ins(SimulateCheckIns(seed=7))
    assert {s.resident_id: s.state for s in a.statuses()} == {
        s.resident_id: s.state for s in b.statuses()
    }


def test_simulator_rejects_impossible_shares(store):
    with pytest.raises(ValidationError):
        store.simulate_check_ins(SimulateCheckIns(safe=0.9, still_inside=0.2, needs_help=0))


def test_simulated_confirmation_cannot_be_posted(store):
    with pytest.raises(ValidationError):
        store.record_status(
            ResidentStatusCreate(
                resident_id="sim-r101-a", state="safe", confirmation_type="simulated"
            )
        )


def test_summary_floors_and_hazards(store):
    seeded = seed_demo_scenario(store)
    summary = store.summary()
    assert [f.floor for f in summary.floors] == sorted(store.dorm.floors, reverse=True)
    assert summary.residents.needs_help == 1
    assert summary.residents.unknown == summary.residents.total - 1
    assert summary.open_incidents == 1
    assert [p.id for p in summary.blocked_access_points] == [seeded.blocked_stairwell.id]
    fire_floor = next(f for f in summary.floors if f.floor == seeded.fire.floor)
    assert fire_floor.open_incident_ids == [seeded.fire.id]
    assert fire_floor.blocked_access_point_ids == [seeded.blocked_stairwell.id]


def test_reset(store):
    seed_demo_scenario(store)
    store.start_roll_call("x")
    store.reset()
    summary = store.summary()
    assert summary.residents.unknown == summary.residents.total
    assert summary.open_incidents == 0 and summary.blocked_access_points == []
    assert summary.roll_call is None
