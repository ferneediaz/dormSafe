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
| **External real data** | NCDR CAP alerts (incl. CWA earthquake reports), NFA shelter list + status | `/external/*` |
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
* `Shelter.status` comes from NFA dataset 12849 when a status record matches the shelter:
  `open` · `full` · `withdrawn` · `unknown`; otherwise `designated` (on the official list, no
  status published). **`withdrawn` (撤除) is not "closed"**: it is the apparent default for
  shelters that were never opened (every record had it on 2026-10-14 and 2026-10-17).
* Statuses with `confirmation_type: "simulated"` come from the demo simulator, never from a person.
* Starting a roll call resets every resident to unknown (`/resident-statuses` becomes `[]`).
* Errors: `404` unknown id, `422` invalid body (FastAPI `{"detail": ...}`).

## Enumerations

```text
ResidentState      unknown | safe | still_inside | needs_help
ConfirmationType   self | peer | staff | simulated   (simulated: demo simulator only, rejected on POST)
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
| GET | `/summary` | – | `DormSummary` (totals, per floor top-first, blocked access points) |
| GET | `/roll-call` | – | `RollCall \| null` (current or last ended) |
| POST | `/roll-call` | `RollCallStart` | `201 RollCall` (everyone → unknown; `404` unknown alert_id) |
| POST | `/roll-call/end` | – | `RollCall` (`404` if none active) |
| POST | `/demo/simulate-check-ins` | `SimulateCheckIns?` | `DormSummary` |
| POST | `/demo/scenario` | – | `DormSummary` (fire F7, east stairwell F7 blocked, room 803 needs help) |
| POST | `/demo/reset` | – | `DormSummary` |
| GET | `/external/alerts` | – | `ExternalAlert[]` |
| GET | `/external/earthquakes` | – | `Earthquake[]` newest first |
| GET | `/external/earthquakes/latest` | – | `Earthquake` (`404` if none) |
| GET | `/external/shelters?radius_km=` | – | `Shelter[]` (default 5 km around the dorm; `0` = all) |
| GET | `/external/shelters/nearest?latitude=&longitude=&disaster_type=&limit=&exclude_status=` | – | `NearestShelter[]` closest first (default: from the dorm, 5 results) |

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
NearestShelter       Shelter & { distance_km: number }   // straight line, not a walking route
                     // disaster_type filter drops shelters with no published disaster types
Earthquake           { id: string /* same id as the ExternalAlert */; origin_time: datetime|null;
                       magnitude: number|null; depth_km: number|null;
                       epicenter_latitude: number|null; epicenter_longitude: number|null;
                       epicenter_location: string|null; description: string|null; max_intensity: string|null;
                       county_intensities: { county: string; intensity: string }[]  // strongest first
                       report_url: string|null; publisher: string|null; source: string; data_mode: DataMode }

ResidentStatus       + roll_call_id: string|null
RollCall             { id: string; dorm_id: string; reason: string; alert_id: string|null;
                       started_at: datetime; ended_at: datetime|null; active: boolean }
RollCallStart        { reason?: string|null; alert_id?: string|null }   // reason defaults to e.g. "Earthquake M4.3 花蓮縣豐濱鄉"
StatusCounts         { total: number; safe: number; still_inside: number; needs_help: number; unknown: number }
FloorSummary         StatusCounts & { floor: number; blocked_access_point_ids: string[]; open_incident_ids: string[] }
DormSummary          { dorm_id: string; roll_call: RollCall|null; residents: StatusCounts;
                       floors: FloorSummary[] /* top floor first */; blocked_access_points: BuildingAccessPoint[];
                       open_incidents: number; generated_at: datetime }
SimulateCheckIns     { safe?: number; still_inside?: number; needs_help?: number; seed?: number }
                     // shares of the whole roster, default 623/812, 43/812, 5/812 (readme scenario);
                     // only fills residents with no status; upper floors are left unknown first
```

## Demo flow with the API

```text
GET  /external/earthquakes/latest            → real CWA report via NCDR (no API key)
POST /roll-call {"alert_id": "<its id>"}     → everyone unknown
POST /resident-statuses ...                  → real check-ins from the app
POST /demo/simulate-check-ins                → fill the rest with SIMULATED statuses
POST /demo/scenario                          → fire, blocked stairwell, needs-help resident
GET  /summary                                → dashboard numbers
GET  /external/shelters/nearest?disaster_type=earthquake
```

## Demo fixture

* 1 dorm (`demo-dorm-a`), floors 1–8, 6 rooms per floor (`101`…`806`), 2 residents per room → **96 residents**
  (`sim-r101-a`, `sim-r101-b`, …).
* Access points (18): `stair-east-f1`…`stair-east-f8`, `stair-west-f1`…`stair-west-f8`, `exit-main`, `exit-rear`.
  Initially all `unknown` / `reported`.
* No statuses, no incidents.
