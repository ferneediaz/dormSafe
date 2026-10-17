# DormSafe (宿安) — Team Handover & Architecture Specification

> **Real-time dormitory emergency accountability and coordination for Taiwan universities.**
>
> Designed for earthquake, fire, and multi-hazard response combining resident self-reporting, roommate confirmation, building route monitoring, priority triage, and live integration with Taiwan National Open Data (NCDR Disaster Alerts & NFA Shelter Registry).

---

## 1. 3-Man Team Division of Responsibilities

DormSafe is developed by a 3-engineer team designed to cover the full lifecycle of an emergency event:

```
┌────────────────────────────────────────────────────────────────────────┐
│                          DORMSAFE SYSTEM                               │
├──────────────────────────┬─────────────────────────┬───────────────────┤
│ Dev A: Resident Frontend │ Dev B: Coordinator View │ Dev C: Python API │
│ • 1-tap emergency checkin│ • 12-floor live grid    │ • FastAPI backend │
│ • Roommate confirmation  │ • Live roll call stream │ • NCDR CAP alerts │
│ • 1-tap SOS + location   │ • Priority triage list  │ • NFA open data   │
│ • Photo hazard reports   │ • Evac route monitoring │ • Haversine calc  │
│ • Offline sync queue     │ • 1-click responder PDF │ • Frozen snapshot │
│ • 4-language i18n        │ • RBAC + Audit logs     │ • Fallback cache  │
└──────────────────────────┴─────────────────────────┴───────────────────┘
```

### Dev A — Resident & Evacuee Mobile Experience
- **1-Tap Emergency Check-in**: Status selection (`SAFE` 🟢, `INSIDE` 🟡, `HELP` 🔴, `UNKNOWN` ⚪) with event-driven location capture (`Room 912, 9F`).
- **Peer Confirmation**: Verification of roommate safety (`PEER_CONFIRMED` provenance) leveraging dorm social structure.
- **Immediate SOS Panic**: High-visibility SOS broadcast with instant priority escalation for emergency wardens.
- **Hazard & Maintenance Reporting**: Multimedia reports with floor, area, severity (`Critical`, `High`, `Medium`, `Low`), description, and photo capture (e.g. stairwell debris, gas leaks).
- **Offline Resilience**: Local client queue (`localStorage`) with automatic background dispatch upon network reconnection.
- **Multilingual Support**: Real-time language switching across **Traditional Chinese (繁體中文)**, **English**, **Filipino (Tagalog)**, and **Indonesian (Bahasa Indonesia)**.
- **Taiwan Emergency Hotlines**: 1-tap dialing for `119` (Fire/Ambulance), `110` (Police), `1999` (Citizen Hotline), `1925` (Mental Health), and `1957` (Social Welfare).

### Dev B — Dorm Coordinator, Floor Warden & First Responder Dashboard
- **Building Accountability Matrix**: Live 12-floor interactive grid displaying room-by-room status, assistance flags, and occupant counts (812 total residents across 203 rooms in Dorm A).
- **Emergency Roll Call Simulation**: Live streaming simulator processing batch check-ins and calculating real-time accountability percentages.
- **Priority Assistance Triage**: Automated filtering highlighting vulnerable residents (e.g. wheelchair users, medical needs) needing stairwell evacuation.
- **Evacuation Route & Stairwell Management**: Live status monitoring (`OPEN`, `BLOCKED`, `HAZARD`) for building stairwells and elevators with staff verification stamps.
- **Incident Management**: Incident board linking user hazard reports with status tracking (`NEW`, `INVESTIGATING`, `RESOLVED`).
- **First Responder Handoff**: 1-click operational briefing generator exporting concise text, clipboard summary, or printable incident report for arriving New Taipei / Taipei Fire Bureaus.
- **Role-Based Access Control (RBAC)**: Enforces Taiwan Personal Data Protection Act (PDPA) boundaries across `COORDINATOR`, `FLOOR_WARDEN` (scoped to Floor 9), `FIRST_RESPONDER`, and `RESIDENT` with internal audit logging.

### Dev C — Backend, Data Pipeline & Taiwan Open Data Integration (Branch `ale`)
- **FastAPI External Data Microservice**: Lightweight, high-throughput asynchronous Python service (`src/dormsafe/`).
- **NCDR Atom CAP Feed Ingestion**: Ingests official Common Alerting Protocol (CAP) disaster feeds from the National Science and Technology Center for Disaster Reduction (`GET /external/alerts`).
- **NFA Shelter Registry Processing**: Ingests and indexes Taiwan National Fire Agency Open Dataset `73242` (`data/frozen/nfa_shelters.csv`), computing live Haversine distances from dorm coordinates to all municipal shelters (`GET /external/shelters`).
- **Data Mode Provenance**: Provides transparent data source headers (`X-Data-Mode: live | cached_real | frozen_real`, `X-Source`, `X-Retrieved-At`).
- **Reliable Fallback Cache**: Local frozen datasets guarantee 100% demo and emergency reliability even during severe telecommunications outages.

---

## 2. System Architecture & Repository Layout

The repository is structured as a unified monorepo:

```text
dormSafe/
├── HANDOVER.md                     # Comprehensive architecture and runbook
├── readme.md                       # Project background and problem statement
├── pyproject.toml                  # Python backend dependencies and packaging
├── src/
│   └── dormsafe/                   # Python FastAPI service (Dev C)
│       ├── api.py                  # API endpoints (/external/alerts, /external/shelters)
│       ├── config.py               # Dorm coordinates, timeouts, and cache settings
│       ├── dorm/                   # Core dorm domain models
│       └── external/               # Government open data ingestion engines
│           ├── models.py           # Pydantic schemas (ExternalAlert, Shelter)
│           ├── ncdr.py             # NCDR Atom CAP XML parser with rate limiting
│           └── nfa.py              # NFA CSV 73242 parser with Haversine distance
├── data/
│   └── frozen/                     # Fallback snapshots for offline operation
│       ├── ncdr_feed.xml           # Sample NCDR CAP alert feed
│       ├── nfa_shelters.csv        # Complete NFA shelter registry (939 KB)
│       └── metadata.json           # Ingestion provenance and timestamps
├── frontend/                       # React 19 + TanStack + Vite SPA (Dev A & B)
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── routes/
│   │   │   ├── __root.tsx          # Root layout, i18n and context providers
│   │   │   ├── index.tsx           # Resident check-in, SOS, report & shelter UI
│   │   │   └── admin.tsx           # Coordinator matrix, triage, routes & handoff
│   │   ├── components/
│   │   │   ├── dorm/
│   │   │   │   ├── AppHeader.tsx   # Header with language/role/offline toggles
│   │   │   │   ├── AlertBanner.tsx # NCDR disaster alert ticker
│   │   │   │   └── ui.tsx          # Reusable design tokens, badges & cards
│   │   │   └── ui/
│   │   │       └── dialog.tsx      # Radix UI accessible modal primitive
│   │   ├── lib/
│   │   │   ├── dorm-data.ts        # Seed data (812 residents, 12 floors, routes)
│   │   │   ├── dorm-store.tsx      # State management, offline queue, roll call sim
│   │   │   ├── external-api.ts     # Client adapter for /external/* endpoints
│   │   │   ├── i18n.tsx            # 4-language dictionary (zh-TW, en, tl, id)
│   │   │   └── privacy.ts          # RBAC definitions and PDPA data purge engine
│   │   └── assets/
│   │       └── debris-f9.jpg       # Stairwell B obstruction incident image
│   └── test/
│       ├── dorm-data.test.ts       # Domain logic and retention tests
│       └── app-routing.test.tsx    # Routing integrity tests
└── tests/                          # Backend test suite (pytest)
    ├── test_api.py
    ├── test_dorm.py
    └── test_external.py
```

---

## 3. Taiwan Government Open Data Integration

### 3.1 NCDR Disaster Alert Feed
- **Endpoint**: `GET /external/alerts`
- **Source**: National Science and Technology Center for Disaster Reduction (NCDR) Atom CAP Feed (`https://alerts.ncdr.nat.gov.tw/`).
- **Data Normalization**:
  - Disaster Event Types: Earthquake (`地震`), Heavy Rain (`豪雨`), Flood (`淹水`), Typhoon (`颱風`), Landslide (`土石流`), Fire (`火災`).
  - Severity: `Extreme`, `Severe`, `Moderate`, `Minor`, `Unknown`.
  - Headers: Exposes `X-Data-Mode` (`live`, `cached_real`, `frozen_real`) to guarantee transparent provenance.

### 3.2 NFA Evacuation Shelter Registry
- **Endpoint**: `GET /external/shelters?radius_km={radius}`
- **Source**: National Fire Agency (NFA) Dataset `73242` (`避難收容處所資料`).
- **Features**:
  - Distance calculation using Haversine formula relative to Dorm coordinates (`25.0138° N, 121.4627° E`, Banqiao District, New Taipei City).
  - Planned capacity display (`預計收容人數`).
  - Accessibility for vulnerable individuals (`適合避難弱者安置` → `vulnerableFriendly: true`).
  - Direct 1-tap Google Maps walking directions (`https://www.google.com/maps/dir/?api=1&destination={lat},{lon}`).

### 3.3 Dual-Layer Reliability (Client & Server Fallbacks)
1. **Server Layer**: If the live NCDR API is unreachable, the FastAPI backend transparently serves cached responses or falls back to `data/frozen/` with `X-Data-Mode: frozen_real`.
2. **Client Layer**: If the FastAPI backend itself is offline or unreachable, `frontend/src/lib/external-api.ts` automatically switches to built-in fallback fixtures (`FALLBACK_ALERTS` and `FALLBACK_SHELTERS`), ensuring the application remains interactive during field operations.

---

## 4. Offline Resilience & Data Privacy (Taiwan PDPA)

### 4.1 Offline Queue & Auto-Synchronization
- When network connectivity drops (`navigator.onLine === false` or simulated via header toggle):
  - User check-ins, SOS triggers, and peer confirmations are placed into a local queue stored in `localStorage` (`dormsafe-offline-queue`).
  - The resident interface displays a pending queue indicator (e.g. `⏳ 1 action queued`).
  - Once connectivity is restored, the queue automatically drains and synchronizes with the central dorm state.

### 4.2 Privacy & Retention by Design (PDPA Compliance)
- **Zero Continuous Tracking**: DormSafe strictly rejects continuous GPS tracking. Location is only captured at discrete event timestamps (Check-in, SOS, Hazard report).
- **Automated Data Retention Limit**: Configurable retention window (default: 72 hours; selectable 24h, 72h, or 7 days). Location breadcrumbs and resolved incident reports older than the retention period are automatically purged via scheduled cleaner (`purgeExpired`).
- **Role-Based Access Control**:
  - `COORDINATOR`: Full building visibility, roll call controls, contact directory.
  - `FLOOR_WARDEN`: Scoped exclusively to designated floor (Floor 9).
  - `FIRST_RESPONDER`: Anonymized counts, priority medical/assistance list, blocked route statuses.
  - `RESIDENT`: Self and roommate check-in only; no access to other students' personal records.
- **Audit Logging**: Sensitive access actions (such as viewing medical assistance notes or exporting handoffs) are logged with timestamp and role.

---

## 5. Live Demo Presentation Script (Hackathon Walkthrough)

Follow this 6-step walkthrough to present DormSafe to judges:

### Step 1: Pre-Disaster Baseline
1. Open the **Resident View** (`/`). Show student `Chen Wei-Ting (陳偉庭)` in Room 412, Floor 4.
2. Demonstrate the **4-Language Switcher** in the top bar: click `繁中`, `EN`, `TL`, `ID`. Notice all hotlines, titles, and check-in options update smoothly.
3. Switch to the **Coordinator View** (`/admin`). Show the 12-floor grid of Dorm A: 812 residents currently listed.

### Step 2: Simulated Earthquake & Emergency Roll Call
1. In Coordinator View, click **"🚨 Trigger Emergency Roll Call"**.
2. Notice the live status ticker start streaming:
   - Status updates arrive in real-time batches.
   - Headcount summary dynamically tallies `Safe`, `Inside`, `Needing Help`, and `Unknown`.
3. Point out the official **NCDR Disaster Alert Banner** at the top showing the simulated M5.8 Hualien earthquake with shaking intensity in Taipei/New Taipei.

### Step 3: Priority Assistance Request (Room 912)
1. Point to the **Priority Assistance Required** section on the coordinator dashboard.
2. Highlight resident **Nguyen Van An** (Room 912, Floor 9):
   - Status: `HELP` (SOS active).
   - Medical/Mobility Note: `Uses wheelchair; requires elevator or assistance down stairs`.

### Step 4: Building Hazard & Route Blockage
1. In the **Evacuation Routes** card, note:
   - `East Stairwell B (Floors 9–10)` is marked **BLOCKED**.
   - `West Stairwell A` is marked **OPEN (Verified by Staff)**.
   - `Elevator Bank` is marked **OUT OF SERVICE**.
2. Open the **Hazard Incidents** section and click on incident `RP2`:
   - View the photo of fallen ceiling debris between 9F and 10F.
   - Click "Mark Investigating" or "Resolve" to show incident workflow.

### Step 5: Offline Mode Simulation
1. Click the **Online/Offline** network pill in the top header to simulate cell tower failure.
2. Switch to Resident View (`/`). Click **"Safe / Evacuated"**.
3. Notice the badge shows `⏳ 1 action queued (offline)`.
4. Click the network pill again to restore connectivity: the action immediately syncs and clears the queue.

### Step 6: Arriving First Responder Handoff
1. Switch back to Coordinator View (`/admin`).
2. Set the Role dropdown to `FIRST_RESPONDER`. Notice the dashboard instantly filters down to emergency operations: names are masked, focusing purely on Room 912 assistance and Stairwell B blockage.
3. Click **"📋 Copy Handoff"** or **"🖨️ Print / Save PDF"**.
4. Show the clean, standardized emergency briefing generated for arriving New Taipei Fire Bureau personnel.

---

## 6. How to Run Locally

### Prerequisites
- Python 3.10+
- Node.js 20+ and npm 10+

### 6.1 Running the Backend Service
```bash
# From repository root:
# 1. (Optional) Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 2. Install dependencies
pip install fastapi uvicorn pydantic httpx pytest

# 3. Start FastAPI server
uvicorn src.dormsafe.api:app --reload --port 8000
```
- API will be accessible at: `http://localhost:8000`
- API documentation (Swagger): `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`
- NCDR alerts: `http://localhost:8000/external/alerts`
- NFA shelters: `http://localhost:8000/external/shelters?radius_km=5`

### 6.2 Running the Frontend Application
```bash
# In a separate terminal, navigate to frontend/:
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```
- Web application will be accessible at: `http://localhost:5173`
- Resident Portal: `http://localhost:5173/`
- Coordinator Command Center: `http://localhost:5173/admin`

### 6.3 Running Tests
```bash
# Run backend tests (from repo root):
pytest

# Run frontend tests (from frontend/):
cd frontend && npm test
```

---

## 7. Next Steps for Production Deployment

1. **Supabase / PostgreSQL Integration**:
   - Replace in-memory simulation store with persistent tables for `residents`, `checkins`, `routes`, and `incidents`.
   - Leverage Supabase Realtime (WebSockets) for instant multi-device synchronizations between students and coordinators.
2. **Campus Identity & Single Sign-On**:
   - Integrate with university student portal OAuth / SAML (e.g. NTU, NCCU, NTUST student accounts).
3. **SMS / LINE Beacon Broadcast**:
   - Add LINE Notify / LINE Bot webhook integration so Taiwanese students can check in directly through LINE without installing an app.
