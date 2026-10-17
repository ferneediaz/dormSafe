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
    IncidentCreate,
    Resident,
    ResidentStatus,
    ResidentStatusCreate,
)
from dormsafe.dorm.scenario import seed_demo_scenario
from dormsafe.dorm.store import DormStore, NotFoundError, ValidationError
from dormsafe.external.models import ExternalAlert, Shelter
from dormsafe.external.nfa import within_radius
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

    # ---------------------------------------------------------------- external real data

    @app.get("/external/alerts", response_model=list[ExternalAlert], tags=["external"])
    def get_external_alerts(response: Response) -> list[ExternalAlert]:
        """Official NCDR alerts (superseded/cancelled removed). Provenance in X-* headers."""
        result = external.alerts()
        _provenance_headers(response, result)
        return result.items

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
