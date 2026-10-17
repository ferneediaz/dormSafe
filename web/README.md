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

## Demo (matches readme.md / HANDOVER.md §11)

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

## How state works (and how to move to Supabase)

`src/data/store.ts` keeps one state object in `localStorage` and broadcasts changes to other tabs with `BroadcastChannel`. That's why the demo needs no backend, but **it only syncs within one browser**. To sync a real phone with the laptop, replace `commit()`/`load()` with Supabase tables (schema in `HANDOVER.md` §8) + Realtime; the `actions` API used by the screens can stay the same.

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
