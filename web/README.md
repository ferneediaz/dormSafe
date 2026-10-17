# DormSafe web app (resident + admin)

One React app, two sides:

| URL | Who | What |
|---|---|---|
| `/#/` | everyone | Pick a role (search resident by room or name) |
| `/#/resident/<id>` (e.g. `r-905-1`) | Resident (phone-sized layout) | Check-in (Safe / Inside / Need help), SOS (hold 1.5s), roommate confirm, in/out, report with photo, nearest shelters, emergency numbers |
| `/#/admin` | Admin / coordinator | Live headcount, floor grid (click a floor for rooms), priority list, stairwells & exits, reports inbox, residents table, responder handoff, data & settings |

## Run

```bash
cd web
npm install
npm run dev          # http://localhost:5173  (add --host to open it from a phone on the same Wi-Fi)
npm run build        # type-check + production build in dist/
```

## Two modes

| Mode | When | What syncs |
|---|---|---|
| **Local demo** (default) | No backend running | Tabs in **one browser** (localStorage + BroadcastChannel). 812 simulated residents, sample shelters. |
| **API** | Admin → Data & settings → **Connect** to the backend from branch `ale` | Every device connected to the same API (polls every 2 s). Real NCDR alerts + 187 real NFA shelters near the dorm. 96 simulated residents (Alessandro's fixture). |

## Demo on localhost (no hosting needed)

**Laptop only (simplest, works on any Wi-Fi):**
```bash
# terminal 1: backend (branch ale)
pip install -e ".[dev]" && uvicorn dormsafe.api:app --port 8000
# terminal 2: this app (branch Luke)
cd web && npm install && npm run dev
```
Open `http://localhost:5173/#/admin` → Data & settings → Connect (`http://localhost:8000`).
Open a second window (phone-sized) at `http://localhost:5173/#/resident/sim-r803-a`.

**Real phone + laptop (same Wi-Fi):**
```bash
uvicorn dormsafe.api:app --host 0.0.0.0 --port 8000
cd web && npm run dev -- --host
```
On the phone open `http://<laptop-ip>:5173`, go to `#/admin` → Data & settings → Connect to `http://<laptop-ip>:8000`, then open a resident page.
Caveats: phones only allow GPS on https/localhost, so over the LAN location is simply skipped (check-ins still work).
Venue Wi-Fi often blocks device-to-device traffic. If the phone can't reach the laptop, use a phone hotspot, or fall back to two windows on the laptop.

## Demo (local mode, matches readme.md / HANDOVER.md §11)

1. Open `/#/admin` in one tab and `/#/resident/r-905-1` in another. **Tabs in the same browser sync live.**
2. Admin → **⚠ Simulate earthquake** → roll call starts, everyone Unknown.
3. Resident → **I'm safe**. The admin counter updates.
4. Admin → **▶ Simulate check-ins** → ~623 safe · 43 inside · need-help · ~140 unknown (upper floors).
5. `/#/resident/r-912-1` → **I need help** (seeded vulnerable: cannot use stairs) → top of Priority.
6. Resident → Report → **Blocked stairs / exit** → East Stairwell B, floor 9 → 9F/10F get a red chip. Admin → **Verify report**.
7. Resident → Report → **Gas smell**, floor 6.
8. Resident → **Shelters**. Admin → **Responder handoff** → Copy / Print.

Reset everything: Admin → Data & settings → **Reset demo data**.

## Data

- **All residents/events are SIMULATED.** Dorm A: 12 floors × 17 rooms × 4 beds, 812 residents, deterministic seed (`src/data/seed.ts`).
- **Earthquake**: with a CWA key (Admin → Data, or `VITE_CWA_API_KEY` in `.env`), "Simulate earthquake" replays the latest real report from CWA `E-A0015-001`. Without a key it uses a clearly labelled SAMPLE event.
- **Shelters**: ships with 5 **SAMPLE** shelters (not real). Download NFA dataset **73242** (避難收容處所點位檔) CSV from data.gov.tw and import it on Admin → Data; the parser finds the 經度/緯度/名稱/地址/人數 columns (UTF-8 or Big5). Shelter open/full/closed (dataset 12849 `openstatus`) can be set per shelter there.

## How it connects to the backend (`src/data/api.ts`)

| App feature | API (branch `ale`) | Notes |
|---|---|---|
| Building, residents | `GET /dorm`, `GET /residents` | API has no phone / emergency contact / vulnerable flag yet → shown as "—" |
| Check-in, SOS, roommate & staff confirm | `GET/POST /resident-statuses` | safe ↔ `safe`, inside ↔ `still_inside`, need help ↔ `needs_help`; self / peer / staff map 1:1 |
| Reports | `GET/POST /incidents` | Water leak / needs fixing go as `other` with a `[leak]`/`[broken]` prefix |
| Stairwells & exits | `GET/POST /building-access` | per-floor access points (`stair-east-f7` …) |
| Earthquake button | `GET /external/alerts` | real NCDR CAP alert (frozen 2026-10-14 snapshot, or live) |
| Shelters | `GET /external/shelters` | real NFA 73242, 5 km radius; `designated` = on official list |

**Kept local in the admin's browser (API has no endpoint yet):** report photos, report workflow status (new / in progress / resolved), roll call start/end, announcements, "out of dorm". A roll call is done client-side: statuses older than the roll-call start count as unknown.

**Asks for the backend** (would make the API demo complete):
1. `POST /roll-calls` + `GET /roll-calls/active` so phones see the "Are you safe?" banner.
2. `PATCH /incidents/{id}` (verification_state / resolved) and expose `reporter_id`.
3. Photo upload on incidents (`POST /incidents/{id}/photo` or a base64 field).
4. Resident profile fields: phone, language, emergency contact, assistance needs.
5. `GET/POST /announcements`.
6. Optional: `out` resident state; dorm size 12 floors to match the README's 812-resident story.

## Files

```
src/App.tsx                    landing + hash routing
src/resident/ResidentApp.tsx   resident screens
src/admin/AdminApp.tsx         admin screens, priority + handoff logic
src/data/store.ts              shared state, actions, demo simulator
src/data/seed.ts               Dorm A, residents, routes, sample shelters
src/data/external.ts           emergency numbers, CWA fetch, NFA CSV parser, geo helpers
src/data/types.ts              data model
```
