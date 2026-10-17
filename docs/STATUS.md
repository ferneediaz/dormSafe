# DormSafe: integration status and open problems

*Checked 2026-10-17 against `main` at `1ea6ca9` (Dan's 3D building view), merged into branch `ale`.*

## What works

| Part | Where | State |
|---|---|---|
| Backend (FastAPI) | `src/dormsafe/`, branch `ale` | 63/63 tests pass. Real NCDR alerts + CWA earthquake reports, real NFA shelters + open/full status, live with frozen fallback |
| Frontend (Lovable, React 19 + TanStack Start) | `frontend/` on `main` | 8/8 tests, type-check clean, builds; `/` and `/admin` (with 3D building) load |
| Frontend ↔ backend | Vite proxy `/external` → `localhost:8000` | Alerts and shelters arrive with `X-Data-Mode: frozen_real` |

Run locally:

```bash
uvicorn dormsafe.api:app --port 8000          # repo root, Python venv with `pip install -e ".[dev]"`
cd frontend && npm ci && npm run dev          # http://localhost:5173 and /admin
```

## Problems, most important first

### 1. Check-ins never reach the backend
`frontend/` calls only `GET /external/alerts` and `GET /external/shelters`. Residents, statuses, roll
call, reports, stairwells and the simulator live in the browser (`lib/dorm-store.tsx`, localStorage).
A resident tapping "I'm safe" on a phone **does not appear** on the coordinator dashboard on the
projector laptop; it only works between tabs of the same browser. The readme's core demo moment
(the counter going up live) depends on this.

The backend already has what's needed: `POST /resident-statuses`, `POST /incidents`,
`POST /building-access`, `POST /roll-call`, `POST /demo/simulate-check-ins`, `GET /summary`.
Luke's `web/` app (branch `Luke`) already calls these, so its `src/data/api.ts` can be reused.

### 2. The frontend's built-in fallback presents fake data as real
If the backend is off, `frontend/src/lib/external-api.ts` shows `FALLBACK_ALERTS` and
`FALLBACK_SHELTERS`, labelled "NCDR CAP (built-in snapshot)" / "NFA dataset 73242 (built-in
snapshot)" with provenance `frozen`.

* The "M5.8 earthquake off Hualien, intensity 4 in Taipei" never happened (the real snapshot has an
  M4.3 at 花蓮縣豐濱鄉).
* The fallback shelters include manager phone numbers that look like real Taipei / New Taipei numbers,
  with tap-to-call. The real NFA data deliberately drops manager phones (personal data).

Fix: label them **SAMPLE**, or ship the real frozen snapshot from `data/frozen/` instead.

### 3. Frontend and backend describe different dorms
| | Frontend | Backend |
|---|---|---|
| Floors / residents | 12 / 812 | 8 / 96 |
| Scenario | Room 912 needs mobility help, East Stairwell B blocked 9–10F | fire F7, east stairwell F7 blocked, room 803 needs help |
| Stairwells | East B, West A, elevator, main exit | east/west, one record per floor, 2 exits |

Once #1 is fixed the dashboard shows the backend's dorm, so the backend should switch to the
812-resident readme scenario (settings + scenario seed).

### 4. The newest backend work was not on GitHub
Fixed by this push. Branch `ale` now also has: `GET /external/earthquakes(/latest)`,
`GET /external/shelters/nearest`, shelter open/full status (NFA 12849), roll call
(`/roll-call`), demo simulator (`/demo/*`), `GET /summary`. See `docs/API.md`.
The frontend still fakes its own versions locally; for example its "Simulate earthquake" doesn't use
the real NCDR quake from `/external/earthquakes/latest`.

### 5. Shelter request ignores its location
The frontend calls `/external/shelters?lat=…&lon=…`; that endpoint ignores `lat`/`lon` and always uses
the dorm's location. It works for the demo dorm only. Switch to
`/external/shelters/nearest?latitude=…&longitude=…&disaster_type=earthquake`, which also sorts by
distance and filters by disaster type.

### 6. Two frontends on two branches
`main` has `frontend/` (Lovable + Dan's 3D view). Branch `Luke` has a separate `web/` app that is the
one connected to the backend for check-ins. We should pick one. Suggestion: keep `frontend/`, port
Luke's backend connection into it.

### 7. Privacy features exist in code, not in practice
`lib/privacy.ts` has role permissions and data-retention purge, but there is no login: anyone can open
`/admin`. Fine for a hackathon; in the pitch say "designed for", not "has".

### 8. Smaller things
* `HANDOVER.md` describes the fallback snapshot as a feature without saying it is sample data.
* Every shelter's real status is currently `withdrawn` (撤除, also the default for never-opened
  shelters, **not** "closed"), in the frozen snapshot and live today. The demo will show no "open"
  shelter unless one is simulated and clearly labelled.
* No CI runs the frontend or backend tests.

## Suggested order
1. ~~Push `ale`~~ (done with this file)
2. Backend: switch to the 812-resident readme scenario (#3)
3. Frontend: send check-ins, roll call, reports and the simulator to the backend (#1). This is
   the biggest job (~1 h) and touches the frontend teammates' code, so agree on it first.
4. Relabel the fallback data as SAMPLE (#2), switch to `/external/shelters/nearest` (#5)
