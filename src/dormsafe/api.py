"""DormSafe HTTP API (data foundation only).

Run:  uvicorn dormsafe.api:app --reload      (OpenAPI docs at /docs)

External endpoints return plain lists and add provenance headers:
    X-Data-Mode: live | cached_real | frozen_real
    X-Source, X-Source-Url, X-Retrieved-At
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware

from dormsafe.config import Settings, get_settings
from dormsafe.dorm.models import (
    BuildingAccessPoint,
    BuildingAccessUpdate,
    Dorm,
    DormIncident,
    DormSummary,
    IncidentCreate,
    Resident,
    ResidentStatus,
    ResidentStatusCreate,
    RollCall,
    RollCallStart,
    SimulateCheckIns,
)
from dormsafe.dorm.scenario import seed_demo_scenario
from dormsafe.dorm.store import DormStore, NotFoundError, ValidationError
from dormsafe.external.models import Earthquake, ExternalAlert, NearestShelter, Shelter
from dormsafe.external.nfa import nearest, within_radius
from dormsafe.external.service import ExternalDataService, ExternalResult


def _provenance_headers(response: Response, result: ExternalResult) -> None:
    response.headers["X-Data-Mode"] = result.data_mode
    response.headers["X-Source"] = result.source
    response.headers["X-Source-Url"] = result.source_url
    if result.retrieved_at:
        response.headers["X-Retrieved-At"] = result.retrieved_at.isoformat()


def create_app(
    settings: Settings | None = None, external: ExternalDataService | None = None
) -> FastAPI:
    settings = settings or get_settings()
    store = DormStore(settings)
    if settings.seed_demo_scenario:
        seed_demo_scenario(store)
    external = external or ExternalDataService(settings)

    app = FastAPI(title="DormSafe API", version="0.1.0")
    app.state.store = store
    app.state.external = external
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Data-Mode", "X-Source", "X-Source-Url", "X-Retrieved-At"],
    )

    def _guard(fn, *args):
        try:
            return fn(*args)
        except NotFoundError as exc:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
        except ValidationError as exc:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc

    # ---------------------------------------------------------------- local dorm data

    @app.get("/dorm", response_model=Dorm, tags=["dorm"])
    def get_dorm() -> Dorm:
        return store.dorm

    @app.get("/residents", response_model=list[Resident], tags=["dorm"])
    def get_residents(floor: int | None = None) -> list[Resident]:
        """All SIMULATED residents (optionally one floor)."""
        return store.residents(floor)

    @app.get("/resident-statuses", response_model=list[ResidentStatus], tags=["dorm"])
    def get_resident_statuses() -> list[ResidentStatus]:
        """Latest status per resident. A resident absent from this list is `unknown`."""
        return store.statuses()

    @app.post(
        "/resident-statuses",
        response_model=ResidentStatus,
        status_code=status.HTTP_201_CREATED,
        tags=["dorm"],
    )
    def post_resident_status(body: ResidentStatusCreate) -> ResidentStatus:
        return _guard(store.record_status, body)

    @app.get("/incidents", response_model=list[DormIncident], tags=["dorm"])
    def get_incidents() -> list[DormIncident]:
        return store.incidents()

    @app.post(
        "/incidents",
        response_model=DormIncident,
        status_code=status.HTTP_201_CREATED,
        tags=["dorm"],
    )
    def post_incident(body: IncidentCreate) -> DormIncident:
        return _guard(store.create_incident, body)

    @app.get("/building-access", response_model=list[BuildingAccessPoint], tags=["dorm"])
    def get_building_access() -> list[BuildingAccessPoint]:
        return store.access_points()

    @app.post("/building-access", response_model=BuildingAccessPoint, tags=["dorm"])
    def post_building_access(body: BuildingAccessUpdate) -> BuildingAccessPoint:
        return _guard(store.update_access, body)

    @app.get("/summary", response_model=DormSummary, tags=["dorm"])
    def get_summary() -> DormSummary:
        """Headcount totals and per-floor counts (top floor first), blocked access points."""
        return store.summary()

    # ---------------------------------------------------------------- roll call

    @app.get("/roll-call", response_model=RollCall | None, tags=["roll call"])
    def get_roll_call() -> RollCall | None:
        """The current roll call (active, or the last one ended); null if none yet."""
        return store.roll_call()

    @app.post(
        "/roll-call",
        response_model=RollCall,
        status_code=status.HTTP_201_CREATED,
        tags=["roll call"],
    )
    def post_roll_call(body: RollCallStart) -> RollCall:
        """Start a roll call: every resident becomes `unknown` until they report again."""
        reason = body.reason
        if body.alert_id is not None:
            alert_reason = _alert_reason(body.alert_id)
            if alert_reason is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, f"unknown alert '{body.alert_id}'")
            reason = reason or alert_reason
        return store.start_roll_call(reason or "Roll call", body.alert_id)

    @app.post("/roll-call/end", response_model=RollCall, tags=["roll call"])
    def post_roll_call_end() -> RollCall:
        return _guard(store.end_roll_call)

    def _alert_reason(alert_id: str) -> str | None:
        for quake in external.earthquakes().items:
            if quake.id == alert_id:
                parts = ["Earthquake"]
                if quake.magnitude is not None:
                    parts.append(f"M{quake.magnitude:g}")
                if quake.epicenter_location:
                    parts.append(quake.epicenter_location)
                return " ".join(parts)
        for alert in external.alerts().items:
            if alert.id == alert_id:
                return alert.headline or alert.event_type
        return None

    # ---------------------------------------------------------------- demo (SIMULATED)

    @app.post("/demo/simulate-check-ins", response_model=DormSummary, tags=["demo"])
    def post_simulate_check_ins(body: SimulateCheckIns | None = None) -> DormSummary:
        """Fill SIMULATED statuses (confirmation_type 'simulated') for residents without one."""
        _guard(store.simulate_check_ins, body or SimulateCheckIns())
        return store.summary()

    @app.post("/demo/scenario", response_model=DormSummary, tags=["demo"])
    def post_demo_scenario() -> DormSummary:
        """Add the demo scenario: fire, blocked stairwell, resident needing help."""
        seed_demo_scenario(store)
        return store.summary()

    @app.post("/demo/reset", response_model=DormSummary, tags=["demo"])
    def post_demo_reset() -> DormSummary:
        """Back to the initial fixture (everyone unknown, nothing reported, no roll call)."""
        store.reset()
        return store.summary()

    # ---------------------------------------------------------------- external real data

    @app.get("/external/alerts", response_model=list[ExternalAlert], tags=["external"])
    def get_external_alerts(response: Response) -> list[ExternalAlert]:
        """Official NCDR alerts (superseded/cancelled removed). Provenance in X-* headers."""
        result = external.alerts()
        _provenance_headers(response, result)
        return result.items

    @app.get("/external/earthquakes", response_model=list[Earthquake], tags=["external"])
    def get_external_earthquakes(response: Response) -> list[Earthquake]:
        """CWA earthquake reports from the NCDR feed, newest first. No API key needed."""
        result = external.earthquakes()
        _provenance_headers(response, result)
        return result.items

    @app.get("/external/earthquakes/latest", response_model=Earthquake, tags=["external"])
    def get_latest_earthquake(response: Response) -> Earthquake:
        result = external.earthquakes()
        _provenance_headers(response, result)
        if not result.items:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "no current earthquake report")
        return result.items[0]

    @app.get(
        "/external/shelters/nearest", response_model=list[NearestShelter], tags=["external"]
    )
    def get_nearest_shelters(
        response: Response,
        latitude: float | None = Query(default=None, ge=-90, le=90, description="Default: dorm"),
        longitude: float | None = Query(default=None, ge=-180, le=180),
        disaster_type: str | None = Query(
            default=None, description="e.g. earthquake, flood, typhoon (NFA vocabulary)"
        ),
        limit: int = Query(default=5, ge=1, le=50),
        exclude_status: list[str] = Query(
            default=[], description="Repeatable, e.g. exclude_status=full"
        ),
    ) -> list[NearestShelter]:
        """Closest official shelters by straight-line distance (not walking routes)."""
        if (latitude is None) != (longitude is None):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, "give both latitude and longitude"
            )
        result = external.shelters()
        _provenance_headers(response, result)
        return nearest(
            result.items,
            store.dorm.latitude if latitude is None else latitude,
            store.dorm.longitude if longitude is None else longitude,
            limit=limit,
            disaster_type=disaster_type,
            exclude_status=set(exclude_status),
        )

    @app.get("/external/shelters", response_model=list[Shelter], tags=["external"])
    def get_external_shelters(
        response: Response,
        radius_km: float | None = Query(
            default=None, ge=0, description="Around the dorm; 0 = all of Taiwan. "
            "Default: DORMSAFE_SHELTER_RADIUS_KM (5 km). Filter only, not ranked.",
        ),
    ) -> list[Shelter]:
        result = external.shelters()
        _provenance_headers(response, result)
        radius = settings.shelter_radius_km if radius_km is None else radius_km
        return within_radius(result.items, store.dorm.latitude, store.dorm.longitude, radius)

    return app


app = create_app()
