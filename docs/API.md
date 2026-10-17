# DormSafe API — data foundation (v0.1)

Base URL (local): `http://localhost:8000` · Interactive docs: `/docs` · OpenAPI: `/openapi.json`

```bash
python -m venv .venv && .venv/Scripts/activate   # Windows (macOS/Linux: source .venv/bin/activate)
pip install -e ".[dev]"
uvicorn dormsafe.api:app --reload
pytest
```

CORS is open (`*`) for local frontend development. All timestamps are ISO 8601 with offset.

## Two separate worlds

| | Source | Endpoints |
|---|---|---|
| **External real data** | NCDR CAP alerts, NFA shelter list | `/external/alerts`, `/external/shelters` |
| **Local dorm data** | in-memory, **simulated** residents | `/dorm`, `/residents`, `/resident-statuses`, `/incidents`, `/building-access` |

External responses carry provenance headers: `X-Data-Mode` (`live` · `cached_real` · `frozen_real`),
`X-Source`, `X-Source-Url`, `X-Retrieved-At`. Default mode is `frozen_real` (bundled real snapshot,
2026-10-14); set `DORMSAFE_EXTERNAL_DATA_MODE=live` for live data (cached 5 min, falls back to frozen).

Local state is in memory and resets on restart. `DORMSAFE_SEED_SCENARIO=true` pre-loads the demo
scenario (fire on floor 7, east stairwell floor 7 blocked, room 803 needs help).

## Rules for the frontend

* **A resident with no entry in `/resident-statuses` is `unknown`.** The API never fabricates statuses.
* A status applies to one resident only — never infer roommates.
* Resident ids start with `sim-`, display names with `[SIM]`: all residents are fictional.
* `Shelter.status == "designated"` means "on the official list", **not** "open".
* Errors: `404` unknown id, `422` invalid body (FastAPI `{"detail": ...}`).

## Enumerations

```text
ResidentState      unknown | safe | still_inside | needs_help
ConfirmationType   self | peer | staff
IncidentType       fire | smoke | gas_leak | blocked_stairwell | blocked_corridor |
                   structural_damage | electrical_hazard | injured_person | trapped_person | other
VerificationState  reported | corroborated | staff_verified | resolved
AccessState        unknown | usable | blocked
AccessKind         stairwell | exit | corridor
ExternalAlert.event_type   earthquake | heavy_rain | flood | typhoon | other
ExternalAlert.data_mode    live | cached_real | frozen_real
```

## Endpoints

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/dorm` | – | `Dorm` |
| GET | `/residents?floor=` | – | `Resident[]` |
| GET | `/resident-statuses` | – | `ResidentStatus[]` (latest per resident) |
| POST | `/resident-statuses` | `ResidentStatusCreate` | `201 ResidentStatus` |
| GET | `/incidents` | – | `DormIncident[]` |
| POST | `/incidents` | `IncidentCreate` | `201 DormIncident` |
| GET | `/building-access` | – | `BuildingAccessPoint[]` |
| POST | `/building-access` | `BuildingAccessUpdate` | `200 BuildingAccessPoint` |
| GET | `/external/alerts` | – | `ExternalAlert[]` |
| GET | `/external/shelters?radius_km=` | – | `Shelter[]` (default 5 km around the dorm; `0` = all) |

## Schemas

```ts
Dorm                 { id: string; name: string; address: string|null; latitude: number; longitude: number; floors: number[] }
Resident             { id: string; display_name: string; dorm_id: string; floor: number; room: string }

ResidentStatus       { resident_id: string; state: ResidentState; confirmation_type: ConfirmationType;
                       reported_by: string|null; floor: number|null; room: string|null; note: string|null;
                       updated_at: datetime }
ResidentStatusCreate { resident_id: string; state: ResidentState; confirmation_type: ConfirmationType;
                       reported_by?: string|null;   // required for "peer"; must differ from resident_id
                                                    // "self": omitted or == resident_id (server fills it)
                       floor?: number|null; room?: string|null; note?: string|null /* ≤500 */ }

DormIncident         { id: string; dorm_id: string; incident_type: IncidentType; floor: number|null;
                       room: string|null; location_label: string|null; description: string|null;
                       verification_state: VerificationState; created_at: datetime; updated_at: datetime }
IncidentCreate       { incident_type: IncidentType; floor?: number|null; room?: string|null;
                       location_label?: string|null; description?: string|null; reporter_id?: string|null;
                       verification_state?: VerificationState /* default "reported" */ }
                     // a description also creates the first IncidentReport (stored, not yet exposed)
IncidentReport       { id: string; incident_id: string; reporter_id: string|null; description: string; created_at: datetime }

BuildingAccessPoint  { id: string; dorm_id: string; name: string; kind: AccessKind; floor: number|null;
                       state: AccessState; verification_state: VerificationState; updated_at: datetime }
BuildingAccessUpdate { access_point_id: string; state: AccessState; verification_state?: VerificationState /* default "reported" */ }

ExternalAlert        { id: string; event_type: string; headline: string|null; description: string|null;
                       severity: string|null /* extreme|severe|moderate|minor|unknown */;
                       effective_at: datetime|null; expires_at: datetime|null; affected_areas: string[];
                       source: string; data_mode: DataMode }
Shelter              { id: string; name: string; address: string|null; latitude: number; longitude: number;
                       status: string|null; planned_capacity: number|null;
                       suitable_for_vulnerable_people: boolean|null; disaster_types: string[]; source: string }
```

## Demo fixture

* 1 dorm (`demo-dorm-a`), floors 1–8, 6 rooms per floor (`101`…`806`), 2 residents per room → **96 residents**
  (`sim-r101-a`, `sim-r101-b`, …).
* Access points (18): `stair-east-f1`…`stair-east-f8`, `stair-west-f1`…`stair-west-f8`, `exit-main`, `exit-rear`.
  Initially all `unknown` / `reported`.
* No statuses, no incidents.
