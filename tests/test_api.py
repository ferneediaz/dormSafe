from __future__ import annotations

from fastapi.testclient import TestClient

from dormsafe.api import create_app
from tests.conftest import make_settings


def test_get_dorm(client):
    body = client.get("/dorm").json()
    assert set(body) == {"id", "name", "address", "latitude", "longitude", "floors"}


def test_get_residents(client):
    residents = client.get("/residents").json()
    assert 60 <= len(residents) <= 100
    assert set(residents[0]) == {"id", "display_name", "dorm_id", "floor", "room"}
    assert {r["floor"] for r in client.get("/residents", params={"floor": 3}).json()} == {3}


def test_resident_status_roundtrip(client):
    assert client.get("/resident-statuses").json() == []
    r = client.post(
        "/resident-statuses",
        json={
            "resident_id": "sim-r101-b",
            "state": "safe",
            "confirmation_type": "peer",
            "reported_by": "sim-r101-a",
            "note": "With me at the assembly point",
        },
    )
    assert r.status_code == 201
    assert r.json()["confirmation_type"] == "peer"
    statuses = client.get("/resident-statuses").json()
    assert [s["resident_id"] for s in statuses] == ["sim-r101-b"]


def test_resident_status_errors(client):
    bad = {"resident_id": "x", "state": "safe", "confirmation_type": "self"}
    assert client.post("/resident-statuses", json=bad).status_code == 404
    bad = {"resident_id": "sim-r101-a", "state": "fine", "confirmation_type": "self"}
    assert client.post("/resident-statuses", json=bad).status_code == 422


def test_incidents_roundtrip(client):
    assert client.get("/incidents").json() == []
    r = client.post(
        "/incidents",
        json={"incident_type": "trapped_person", "floor": 8, "room": "803"},
    )
    assert r.status_code == 201
    assert r.json()["id"] == "inc-0001"
    assert len(client.get("/incidents").json()) == 1
    assert client.post("/incidents", json={"incident_type": "meteor"}).status_code == 422


def test_building_access_roundtrip(client):
    points = client.get("/building-access").json()
    assert len(points) == 18
    r = client.post(
        "/building-access",
        json={
            "access_point_id": "stair-east-f7",
            "state": "blocked",
            "verification_state": "staff_verified",
        },
    )
    assert r.status_code == 200
    assert r.json()["state"] == "blocked"
    bad = {"access_point_id": "nope", "state": "blocked"}
    assert client.post("/building-access", json=bad).status_code == 404


def test_external_alerts(client):
    r = client.get("/external/alerts")
    assert r.status_code == 200
    assert r.headers["X-Data-Mode"] == "frozen_real"
    assert r.headers["X-Source"] == "NCDR"
    alerts = r.json()
    assert alerts and alerts[0]["data_mode"] == "frozen_real"


def test_external_shelters(client):
    r = client.get("/external/shelters")
    assert r.status_code == 200
    assert r.headers["X-Data-Mode"] == "frozen_real"
    nearby = r.json()
    assert nearby
    everything = client.get("/external/shelters", params={"radius_km": 0}).json()
    assert len(everything) > len(nearby)


def test_summary_endpoint(client):
    body = client.get("/summary").json()
    assert body["residents"]["unknown"] == body["residents"]["total"] == 96
    assert len(body["floors"]) == 8 and body["floors"][0]["floor"] == 8
    assert body["roll_call"] is None


def test_roll_call_from_real_earthquake(client):
    assert client.get("/roll-call").json() is None
    quake = client.get("/external/earthquakes/latest").json()
    r = client.post("/roll-call", json={"alert_id": quake["id"]})
    assert r.status_code == 201
    assert r.json()["reason"] == "Earthquake M4.3 花蓮縣豐濱鄉"
    assert client.get("/roll-call").json()["active"] is True
    assert client.post("/roll-call", json={"alert_id": "ncdr:nope"}).status_code == 404
    assert client.post("/roll-call/end").json()["active"] is False
    assert client.post("/roll-call/end").status_code == 404


def test_demo_endpoints(client):
    body = client.post("/demo/simulate-check-ins").json()
    assert body["residents"]["safe"] > 0
    assert client.post("/demo/simulate-check-ins", json={"safe": 2}).status_code == 422
    body = client.post("/demo/scenario").json()
    assert body["open_incidents"] == 1
    body = client.post("/demo/reset").json()
    assert body["residents"]["unknown"] == 96 and body["open_incidents"] == 0
    bad = {"resident_id": "sim-r101-a", "state": "safe", "confirmation_type": "simulated"}
    assert client.post("/resident-statuses", json=bad).status_code == 422


def test_external_earthquakes(client):
    r = client.get("/external/earthquakes")
    assert r.status_code == 200 and r.headers["X-Data-Mode"] == "frozen_real"
    assert r.json()[0]["magnitude"] == 4.3


def test_nearest_shelters_endpoint(client):
    r = client.get(
        "/external/shelters/nearest", params={"disaster_type": "earthquake", "limit": 3}
    )
    assert r.status_code == 200 and r.headers["X-Source"] == "NFA"
    got = r.json()
    assert len(got) == 3
    assert [s["distance_km"] for s in got] == sorted(s["distance_km"] for s in got)
    assert all("earthquake" in s["disaster_types"] for s in got)
    assert client.get("/external/shelters/nearest", params={"latitude": 25}).status_code == 422


def test_scenario_flag_seeds_at_startup():
    client = TestClient(create_app(make_settings(seed_demo_scenario=True)))
    assert len(client.get("/incidents").json()) == 1
    statuses = client.get("/resident-statuses").json()
    assert [s["state"] for s in statuses] == ["needs_help"]
    blocked = [p for p in client.get("/building-access").json() if p["state"] == "blocked"]
    assert len(blocked) == 1
