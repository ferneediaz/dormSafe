# DormSafe — Team Handover

> **Read this first.** This is the working plan for our 3-person, **3-hour hackathon** build.
> `readme.md` is the long-form vision/pitch. This file is **what we actually build today, who builds it, and how**.

---

## 0. TL;DR

- **What:** A dormitory safety & management **phone app (+ web)** for any dorm in Taiwan: school dorms, company/factory dorms, migrant-worker dorms managed by coordinators (管理員 / 仲介 coordinators).
- **Two sides, one app:**
  - **Resident** (phone): "I'm safe" check-in, SOS, report problems with text and photos, emergency numbers, nearest shelter.
  - **Admin / Coordinator** (web or phone): building → floors → rooms → residents, live headcount (who's in, who's out, who's unaccounted for), incoming reports, emergency roll call.
- **Taiwan open data:** earthquake/disaster alerts (NCDR / CWA) plus NFA evacuation shelters (locations, capacity, open/full status).
- **Stack:** Expo (React Native + TypeScript) for **one codebase that runs on iOS, Android and web**, with Supabase (Postgres, Auth, Storage, Realtime) as the backend.
- **Rule for today:** if it isn't in the demo script (§11), we don't build it.
- **One story everywhere:** the pitch (`readme.md`), the seed data and the live demo all use the same scenario: **Dorm A, 12 floors, 812 residents, Room 912 needs mobility help, East Stairwell B blocked on 9F, West Stairwell A usable, possible gas leak on 6F.**

---

## 1. Can it be a phone app and a web app from the same code? Yes.

| Option | Phone | Web | Verdict for a 3-hr hackathon |
|---|---|---|---|
| **Expo (React Native + react-native-web)** | ✅ real app via Expo Go | ✅ `npx expo start --web` | **Use this.** One codebase, file-based routing (expo-router), and you can scan a QR code to run it on any phone. |
| Next.js PWA | ⚠️ "Add to home screen" only | ✅ | Weaker on camera, location and push |
| Flutter | ✅ | ✅ | Fine, but only if the whole team already knows Dart |

**Demo setup:** resident app on a real phone (Expo Go) and the admin dashboard in a laptop browser (same code, web build), both talking to the same Supabase project. Realtime updates show up live on the projector.

---

## 2. Roles

| Role | Where | Can do |
|---|---|---|
| **Resident** | Phone | Check in/out, mark self safe / need help, SOS, report issues (text + photo), confirm roommate safe, view emergency numbers and shelters |
| **Admin / Coordinator** | Web (also works on phone) | Set up building, floors and rooms; assign residents; see live headcount per building, floor and room; manage reports; trigger emergency roll call; generate responder handoff |
| *(later)* Floor leader / RA | Phone | Floor-scoped admin: verify hazards, confirm residents |
| *(later)* Org super-admin | Web | Many buildings (e.g. one agency managing 10 dorms) |

For the hackathon we use **2 hard-coded demo accounts** (1 admin + 1 resident) plus **seeded fake residents**. Auth polish is not a demo item.

---

## 3. Feature list with priority

**P0 = must be in the demo. P1 = only if P0 is done. P2 = say it in the pitch, don't build it.**

### Resident side
| # | Feature | P |
|---|---|---|
| R1 | **Emergency check-in**: big buttons ✅ Safe / 🟡 Still inside / 🔴 Need help, with location captured once at tap time | P0 |
| R2 | **Report a problem**: category (fire, smoke, gas, water leak, electrical, structural, broken item, other) + text + **photo** + floor/room | P0 |
| R3 | **SOS button**: long-press sends a "Need help" status with location to admins | P0 |
| R4 | **Emergency numbers** (tap to call), see §5 | P0 (static screen, 15 min) |
| R5 | **Nearest shelters**: list sorted by distance, with capacity and status | P0 |
| R6 | Earthquake/disaster alert banner (from NCDR/CWA) | P1 |
| R7 | Peer confirm: "My roommate is safe with me" | P1 |
| R8 | In/out presence: tap "I'm leaving / I'm back" (manual, or a QR code at the entrance) | P1 |
| R9 | Multilingual UI: 中文 / English / Filipino / Bahasa Indonesia / Tiếng Việt / ไทย | P2 (pitch) |
| R10 | Background geofence (auto in/out) | P2 (pitch; privacy + battery) |

### Admin side
| # | Feature | P |
|---|---|---|
| A1 | **Building setup**: name, address, number of floors, rooms per floor | P0 (can be seeded) |
| A2 | **Residents**: name, room, phone, emergency contact, nationality/language, mobility/medical note | P0 (seeded + simple list) |
| A3 | **Live headcount dashboard**: totals (Safe / Inside / Need help / Unknown) plus a **floor grid** colored by status, updating in realtime | P0, **the hero screen** |
| A4 | **Reports inbox**: list with photo, category, floor/room, status (New → In progress → Resolved) | P0 |
| A5 | **Start emergency roll call**: resets everyone to Unknown and pushes "Are you safe?" | P0 (the push can be faked with an in-app banner) |
| A6 | **Responder handoff summary**: one screen/text block with unaccounted count, people who need help, hazards by floor, stairwell status | P1 |
| A9 | **Stairwell / exit status**: each stairwell, exit and elevator marked Open / Blocked / Unknown, with a "Reported" vs "Staff verified" tag; shown as chips on the floor grid. Residents set it from the report screen (category "blocked route"); admin verifies with one tap | **P0** (small: 1 table + chips; it's the README's core idea) |
| A7 | Announcements/broadcast to all residents | P1 |
| A8 | Drill mode, fire-equipment inspection checklist, visitor log, audit log, CSV import of residents | P2 |

---

## 4. What I'd add to make it the best dorm safety app (pitch material)

1. **Roll call, not just tracking.** Continuous GPS tracking is a privacy and battery problem and residents will turn it off. The strongest version is **event-triggered accountability**: an alert or admin starts a roll call, everyone gets "Are you safe?", and the dashboard fills in. Location is captured only when the resident responds or presses SOS.
2. **Multilingual from day 1.** Taiwan's company dorms house hundreds of thousands of migrant workers (Filipino, Indonesian, Vietnamese, Thai). Emergency messages they can't read are useless. This is a strong differentiator for judges.
3. **Vulnerable-resident flag.** Mobility issue, pregnancy or medical condition. These residents go to the top of the priority list in an emergency, and admins can only see the flag during an emergency.
4. **Status provenance.** Self-confirmed vs. roommate-confirmed vs. staff-confirmed, as in `readme.md`.
5. **Responder handoff.** One-tap summary for firefighters (119) when they arrive.
6. **Offline-first check-in.** Cell networks get congested after big quakes. Queue the check-in locally and send it when the connection returns; SMS fallback later.
7. **Daily-use features keep the app installed:** maintenance tickets, announcements, curfew/in-out, drills. A safety app that's only opened during disasters won't be on anyone's phone when the disaster comes.
8. **Fire-safety compliance.** Extinguisher expiry dates and a monthly inspection checklist for the admin.
9. **Worker-protection hotlines** (1955) shown in the resident's language, which is relevant for company and migrant-worker dorms.
10. **Privacy by design.** Taiwan's Personal Data Protection Act (個人資料保護法): role-based access, minimal data, retention limits, audit log.

---

## 5. Taiwan emergency numbers (R4: static data)

| Number | What |
|---|---|
| **119** | Fire / ambulance / rescue |
| **110** | Police |
| **112** | International emergency number on mobile (works without a SIM or with a locked phone, routes to 110/119) |
| **1955** | Ministry of Labor hotline for foreign workers (24h, multilingual, free) |
| **113** | Domestic violence / sexual assault / child protection |
| **165** | Anti-fraud hotline |
| **1999** | City government hotline (Taipei and others) |
| **1925** | Mental-health / suicide-prevention line (安心專線) |
| **0800-024-111** | Taiwan tourist & foreigner info hotline |

> Double-check each number before demo day and keep them in `src/data/emergencyNumbers.ts`.

---

## 6. Government data integration

### ⚠️ Important: we cannot read the phone's emergency SMS
The alerts Taiwanese phones receive are **cell broadcast (PWS / 國家級警報 / 地震速報)**, not normal SMS. iOS does not let apps read them, and Android effectively doesn't either. **So we get the same events from the government's open data feeds instead**, which is what the plan below does.

### 6.1 Disaster alerts: NCDR (國家災害防救科技中心)
- Platform: **民生示警公開資料平台** https://alerts.ncdr.nat.gov.tw/
- Format: **CAP (Common Alerting Protocol) XML**, published as an ATOM feed (commonly `https://alerts.ncdr.nat.gov.tw/RssAtomFeed.ashx`). **Verify the exact URL in the first 10 minutes.**
- Covers earthquakes, heavy rain, typhoons, floods, etc. Use it for the alert banner (R6) and to **auto-start a roll call** (A5).

### 6.2 Earthquake details: CWA (中央氣象署) open data, optional but nicer
- `GET https://opendata.cwa.gov.tw/api/v1/rest/datastore/E-A0015-001?Authorization=<KEY>&format=JSON&limit=1`
- Needs a **free API key**. Register at opendata.cwa.gov.tw **before the hackathon starts**.
- Useful fields: `records.Earthquake[].EarthquakeInfo.{OriginTime, FocalDepth, EarthquakeMagnitude.MagnitudeValue, Epicenter.{Location, EpicenterLatitude, EpicenterLongitude}}` and `Intensity.ShakingArea[].{AreaDesc, AreaIntensity}`, which tells you if the dorm's county felt it.
- Swagger: https://opendata.cwa.gov.tw/dist/opendata-swagger.html

### 6.3 NFA shelter locations: data.gov.tw **73242** (避難收容處所點位檔)
- CSV. Fields: county/district, village, address, **lon/lat**, shelter name, villages served, **expected capacity**, **disaster types** it's for, manager name & phone, indoor/outdoor, suitable for vulnerable people.
- **Hackathon approach:** download the CSV now, convert it to JSON, filter to the demo county, and **bundle it in the app**. No live API call is needed.
- Mirror if data.gov.tw is slow: https://scidm.nchc.org.tw/en/dataset/best_wish73242

### 6.4 NFA shelter status: data.gov.tw **12849** (避難收容處所開設情形)
- XML. Fields: `shelterId, shelterCode, name, address, county, town, village, lat, lon, twd97x, twd97y, disastertype, isIndoor, isOutdoor, adaptForWeaker, peopleno, openstatus`
- `openstatus` = open / full / closed. `peopleno` = **planned** capacity, not live occupancy.
- ⚠️ The portal lists the update frequency as yearly, so it may not be truly live during an event. In the pitch say "status when published"; for the demo, join 12849 onto 73242 by name/ID and **simulate** one shelter going "full".

### 6.5 Nearest-shelter logic (R5)
1. Get the user's lat/lon once (`expo-location`).
2. Filter shelters by `disastertype` matching the current alert (earthquake) and `openstatus != closed`.
3. Sort by Haversine distance and show the top 5 with distance, capacity, status, a call-manager button and an **Open in Google Maps** link (`https://www.google.com/maps/dir/?api=1&destination=lat,lon`).
4. Use the WGS84 `lat/lon` fields, not TWD97 x/y.

### 6.6 Fallback rule
Every external call has a **bundled sample JSON** fallback (`src/data/samples/`). If a gov API is down during judging, the demo still works. Mark simulated data as **SIMULATED** in the UI.

---

## 7. Tech stack & setup

| Layer | Choice | Why |
|---|---|---|
| App (phone + web) | **Expo SDK (latest) + TypeScript + expo-router** | One codebase for iOS, Android and web |
| UI | React Native Paper (or plain StyleSheet) | Fast, works on web |
| Backend | **Supabase** (Postgres, Auth, Storage, Realtime) | No server to write; realtime dashboard for free |
| Photos | Supabase Storage bucket `reports` | Simple upload from `expo-image-picker` |
| Location | `expo-location` (foreground, one-shot) | No background permission headaches |
| Maps | Skip a map component; use a list + Google Maps deep link | `react-native-maps` doesn't work on web; saves 30+ min |
| Gov data fetch | Client-side fetch with bundled fallback (a Supabase Edge Function cron later) | Simplest path |

### First-10-minutes setup (one person does it, others pull)
```bash
npx create-expo-app@latest dormsafe-app --template tabs   # TypeScript + expo-router
cd dormsafe-app
npx expo install @supabase/supabase-js expo-location expo-image-picker react-native-url-polyfill @react-native-async-storage/async-storage
npx expo install react-dom react-native-web @expo/metro-runtime   # web support
npx expo start            # press w for web, scan the QR code with Expo Go for phone
```
`.env` (do NOT commit, put a copy in `.env.example` with blank values):
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_CWA_API_KEY=
```

### Suggested folder layout
```
app/
  (resident)/index.tsx        # check-in + SOS (home)
  (resident)/report.tsx       # report problem
  (resident)/shelters.tsx     # nearest shelters
  (resident)/numbers.tsx      # emergency numbers
  (admin)/index.tsx           # live headcount + floor grid  ← hero
  (admin)/reports.tsx         # reports inbox
  (admin)/residents.tsx       # resident list
  (admin)/handoff.tsx         # responder summary (P1)
  login.tsx                   # pick demo role
src/
  lib/supabase.ts
  lib/geo.ts                  # haversine, nearest shelters
  lib/alerts.ts               # NCDR / CWA fetch + fallback
  data/emergencyNumbers.ts
  data/shelters.json          # from 73242 + 12849, filtered
  data/samples/*.json         # fallback API responses
supabase/
  schema.sql
  seed.sql                    # Dorm A: 12 floors, 812 fake residents, routes
```

---

## 8. Data model (`supabase/schema.sql`)

```sql
create table buildings (
  id uuid primary key default gen_random_uuid(),
  name text not null, address text, lat float8, lon float8,
  floors int not null
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  building_id uuid references buildings on delete cascade,
  floor int not null, number text not null, capacity int default 4
);

create table residents (
  id uuid primary key default gen_random_uuid(),
  building_id uuid references buildings, room_id uuid references rooms,
  name text not null, phone text, language text default 'en',
  emergency_contact text, vulnerable boolean default false, vulnerable_note text,
  role text default 'resident'            -- 'resident' | 'admin'
);

create table statuses (                   -- one row per check-in; latest wins
  id bigserial primary key,
  resident_id uuid references residents,
  status text not null,                   -- 'safe' | 'inside' | 'need_help' | 'unknown' | 'out'
  source text default 'self',             -- 'self' | 'peer' | 'staff'
  reported_by uuid references residents,
  lat float8, lon float8,
  roll_call_id uuid,
  created_at timestamptz default now()
);

create table roll_calls (
  id uuid primary key default gen_random_uuid(),
  building_id uuid references buildings,
  reason text,                            -- 'earthquake M5.8 Hualien' | 'drill' | 'fire'
  started_at timestamptz default now(), ended_at timestamptz
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  building_id uuid references buildings, resident_id uuid references residents,
  category text not null,                 -- fire|smoke|gas|leak|electrical|structural|blocked_route|broken|other
  description text, photo_url text, floor int, room text,
  urgency text default 'normal',          -- 'normal' | 'emergency'
  status text default 'new',              -- new|in_progress|resolved
  created_at timestamptz default now()
);

create table routes (                     -- stairwells, exits, elevators
  id uuid primary key default gen_random_uuid(),
  building_id uuid references buildings,
  name text not null,                     -- 'East Stairwell B' | 'West Stairwell A' | 'Elevator 1' | 'Main exit'
  floor_from int, floor_to int,           -- affected span, e.g. 9 → 10
  status text default 'unknown',          -- 'open' | 'blocked' | 'unknown'
  verification text default 'reported',  -- 'reported' | 'corroborated' | 'staff_verified'
  updated_by uuid references residents,
  updated_at timestamptz default now()
);

create view latest_status as
  select distinct on (resident_id) * from statuses order by resident_id, created_at desc;
```
For the hackathon, **turn RLS off** (or allow all to anon) and say so in the pitch. Turn on Realtime for `statuses`, `reports` and `routes`.

**Seeding 812 residents is one query**, so match the README's numbers exactly:
```sql
-- 12 floors × 17 rooms × 4 beds ≈ 816 → take 812
insert into residents (building_id, room_id, name, language)
select b.id, r.id, 'Resident ' || row_number() over (), (array['zh','en','fil','id','vi'])[1 + (random()*4)::int]
from buildings b join rooms r on r.building_id = b.id cross join generate_series(1,4)
limit 812;
```
Also seed: Room 912 resident with `vulnerable = true, vulnerable_note = 'cannot use stairs'`, plus routes `East Stairwell B (9–10)`, `West Stairwell A`, `Elevator 1`, `Main exit`, all `unknown`.

---

## 9. Team split (3 people)

| Person | Owns | Files |
|---|---|---|
| **Dev A: Resident app** | R1 check-in + SOS, R2 report + photo upload, R4 numbers | `app/(resident)/*` |
| **Dev B: Admin dashboard** | A3 live headcount + floor grid (realtime), A9 stairwell chips, A4 reports inbox, A5 roll call button, A6 handoff | `app/(admin)/*` |
| **Dev C: Backend + gov data + slides** | Supabase project, `schema.sql`, `seed.sql`, R5 shelters (CSV→JSON + haversine), R6 alerts, then **builds the PPT** from §11 | `supabase/*`, `src/lib/*`, `src/data/*` |

**Git rules (to avoid merge hell in 3 hours):**
- Dev C pushes the Expo scaffold + `src/lib/supabase.ts` to `main` in the first 15 min. Everyone pulls.
- Each dev works on their own branch (`resident`, `admin`, `data`) and only touches their own folders.
- Merge to `main` at **1:30** and **2:30**. Small commits, `git pull --rebase` before pushing.
- Shared types go in `src/lib/types.ts`. Announce in chat before editing it.

---

## 10. 3-hour timeline

| Time | Everyone | Checkpoint |
|---|---|---|
| **0:00–0:15** | C: scaffold + Supabase project + schema + push. A/B: read this doc, sketch screens on paper | App runs on web + a phone |
| **0:15–0:30** | C: seed data (Dorm A, 12F, 812 residents, routes, a "simulate check-ins" script). A/B: start screens with mock data | |
| **0:30–1:30** | A: check-in, SOS, report + photo. B: dashboard + floor grid + realtime. C: shelters JSON + nearest list, alerts fetch + fallback | |
| **1:30** | **Merge #1.** Resident check-in shows up live on the admin dashboard | 🎯 Core loop works |
| **1:30–2:15** | A: numbers screen, peer confirm. B: reports inbox, roll call, handoff. C: alert banner → roll call; **start slides** | |
| **2:15–2:30** | **Feature freeze.** Merge #2. Bug fixes only | |
| **2:30–2:50** | Rehearse demo (§11) twice on the real devices; finish slides; screenshots | |
| **2:50–3:00** | Buffer. Don't touch code | |

---

## 11. Demo script + PPT outline

### Live demo (≈3 min)
This follows the README's demo flow so the pitch and the demo tell the same story.

1. Admin dashboard on the projector: **Dorm A, 12 floors, 812 residents**, normal day.
2. Press **"Simulate earthquake"**: this replays a real CWA/NCDR earthquake event. Banner: *M5.x earthquake. Roll call started.* Dashboard: **0 / 812 accounted for**, every floor grey.
3. On the phone (resident): **"Are you safe?"** → tap ✅ Safe. The counter ticks up **live**.
4. Run the "simulate check-ins" script: numbers climb to roughly **623 safe · 43 inside · 5 need help · 141 unknown**.
5. Resident reports **"East stairwell blocked, debris between 9F and 10F"** with a photo. The 9F row gets a red **East Stairwell B: BLOCKED (reported)** chip.
6. **Room 912** presses **SOS: cannot descend stairs**. It jumps to the top of the priority list (flagged vulnerable).
7. Admin (as floor leader) verifies: **East B blocked ✔ staff verified**, **West Stairwell A open ✔**.
8. Another report: **possible gas smell, 6F**.
9. Resident opens **Nearest shelters**: real NFA shelters sorted by distance, capacity, open/full, and an **Open in Maps** link.
10. Admin taps **Responder handoff**: *"27 unaccounted · Room 912 mobility assistance · East Stairwell B blocked 9–10F · West Stairwell A usable · possible gas leak 6F."*

### Slide outline (8–10 slides)
1. **Title**: DormSafe, one-line pitch.
2. **Problem**: after a quake, the dorm manager doesn't know who is safe, who is missing or who needs help. QR attendance only works in drills. Mention migrant-worker dorms and the language barrier.
3. **Who it's for**: school, company and migrant-worker dorms; coordinators; residents.
4. **Solution**: two sides, one app (screenshots of the resident home + admin dashboard).
5. **Live demo**.
6. **Taiwan open data**: NCDR alerts, CWA earthquakes, NFA shelters (73242) + status (12849). Logos and dataset IDs.
7. **How it works**: architecture diagram (Expo app on phone + web → Supabase → gov feeds).
8. **Everyday value**: maintenance reports, announcements, in/out, drills (why people keep the app installed).
9. **Privacy & safety**: PDPA, roll call instead of constant tracking, vulnerable flags only visible during emergencies, not a replacement for 119.
10. **Roadmap + team**: multilingual, offline/SMS fallback, push notifications, floor plans, multi-building orgs.

> Grab screenshots at 2:30 for slides 4 and 6 in case the live demo fails.

---

## 12. Out of scope today (say "roadmap" if judges ask)
Real auth/onboarding · push notifications (fake with an in-app banner) · background location/geofencing · floor-plan maps · offline queue · translations beyond 1–2 languages · multi-building orgs · RLS/security hardening · App Store builds.

---

## 13. Open decisions (decide in the first 5 minutes)
- [ ] Which real dorm/address do we use for the demo? (It decides which county's shelters we bundle.)
- [ ] Who registers the CWA API key (do it **before** the start)?
- [ ] Demo languages: English + 中文? Add Filipino for the migrant-worker angle?
- [x] ~~Rename "university" → "dormitory" in `readme.md`~~: done; intro now covers school, company and migrant-worker dorms.

---

## 14. Current repo status
- `readme.md`: full vision / pitch (the "why"): resident states, peer confirmation, floor-leader view, stairwell status, incident grouping, tasks, responder handoff, privacy, non-goals. Examples use a university dorm; scope is all dorms.
- `HANDOVER.md`: this file.
- No code yet. **Next step:** Dev C runs §7 setup and pushes the scaffold.
