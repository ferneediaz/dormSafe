# DormSafe — Tech Stack

One TypeScript codebase that ships to **iOS, Android, and Web**, with a 3D dorm building and 3D disaster simulation in the dashboards.

---

## TL;DR

| Layer | Choice |
|---|---|
| App framework | **Expo (React Native) + Expo Router**, one app for iOS / Android / Web |
| Language | **TypeScript** everywhere (app, simulation, backend functions) |
| 3D engine | **three.js** via **React Three Fiber (R3F)** + **drei** |
| 3D on mobile | **Expo DOM components** (`"use dom"`): the same R3F scene runs as real web on Web and inside a native WebView on iOS/Android |
| 3D assets | Procedurally generated building from floor/room data; optional **glTF/GLB** model made in Blender |
| Disaster simulation | Custom grid simulation in TypeScript, run in a **Web Worker**, rendered with instanced meshes and particles |
| Physics (optional) | **@react-three/rapier** for earthquake debris |
| 2D maps | **MapLibre** + OpenStreetMap tiles (`react-map-gl` on web, `@maplibre/maplibre-react-native` on mobile) |
| Styling / UI | **NativeWind** (Tailwind for React Native) |
| Client state | **Zustand** (works inside and outside the R3F canvas) |
| Server state | **TanStack Query** |
| Backend | **Supabase**: Postgres, Auth, Realtime, Row Level Security, Edge Functions, Cron |
| Taiwan open data | Supabase Edge Function + `pg_cron` polling NCDR CAP alerts, NFA shelters, NHI hospitals, AED data |
| i18n | **i18next** + `expo-localization` (繁體中文 / English) |
| Handoff export | `expo-print` (PDF) + share sheet |
| Push alerts | **Expo Notifications** |
| Hosting | **EAS Build** for mobile, **EAS Hosting** or Vercel for web |

---

## Why this stack

### Expo instead of bare React Native

Plain React Native doesn't target the web. Expo with Expo Router gives one codebase, file-based routing, and `react-native-web` for the browser build. You can run it on a real phone in seconds with Expo Go or a dev build, which matters at a hackathon.

### React Three Fiber for 3D

R3F is the standard way to do three.js in React. The scene is a component tree, so live Supabase data (resident status, blocked stairwells) maps directly to props on 3D objects. `drei` supplies cameras, controls, HTML labels, outlines, and instancing helpers.

### The cross-platform 3D problem, and the fix

R3F has a native renderer (`@react-three/fiber/native` + `expo-gl`), but many `drei` helpers, postprocessing effects, and HTML overlays don't work there. Maintaining two 3D scenes would cost too much time.

**Fix: Expo DOM components.** Put the 3D scene in a file that starts with `"use dom"`:

```tsx
// components/three/BuildingScene.tsx
"use dom";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

export default function BuildingScene({ floors, incidents }: Props) {
  return (
    <Canvas camera={{ position: [30, 40, 30], fov: 45 }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} />
      <Building floors={floors} incidents={incidents} />
      <OrbitControls />
    </Canvas>
  );
}
```

- **Web:** renders as a normal React DOM component, full WebGL with no compromises.
- **iOS/Android:** Expo renders it in a WebView, so the full R3F/drei/three ecosystem is available.
- Props pass in from native, and callbacks such as `onRoomPress` call back out to native.

A dorm building plus particle effects runs comfortably in a mobile WebView. If profiling later shows a hot path, only that scene needs porting to `@react-three/fiber/native`.

---

## App structure

```text
dormSafe/
├── app/                          # Expo Router routes (shared by all platforms)
│   ├── (student)/                # check-in, peer confirm, report hazard
│   ├── (ra)/                     # floor dashboard, tasks, verify hazards
│   ├── (command)/                # full dorm 3D dashboard, priority list, handoff
│   └── _layout.tsx               # role-based routing after auth
├── components/
│   ├── three/                    # "use dom" 3D scenes
│   │   ├── BuildingScene.tsx
│   │   ├── FloorView.tsx
│   │   └── DisasterSim.tsx
│   ├── map/                      # MapLibre campus / shelter / AED layers
│   └── ui/
├── lib/
│   ├── supabase.ts
│   ├── store.ts                  # Zustand
│   └── i18n/
├── sim/                          # pure-TS simulation (no React)
│   ├── fire.ts
│   ├── smoke.ts
│   ├── earthquake.ts
│   └── worker.ts
├── supabase/
│   ├── migrations/
│   ├── functions/                # ncdr-poll, handoff-summary, ...
│   └── seed.sql                  # SIMULATED roster, rooms, staff
└── assets/models/                # optional .glb files
```

Responsive layout: the **student** flow is mobile-first. The **RA** dashboard works on phones and tablets. The **command** dashboard targets laptop/tablet web but still runs on phones.

---

## 3D building

**Recommended for the MVP: generate the building procedurally from data.**

```ts
type Floor = { level: number; rooms: Room[]; stairwells: Route[] };
```

Each floor is a slab, each room an extruded box, each stairwell a vertical shaft. Benefits:

- No modeling needed, and it scales to any dorm in the seed data.
- Every mesh corresponds to a database row, so coloring room 912 red is just a prop change.
- Instanced meshes (`<Instances>` from drei) handle hundreds of rooms cheaply.

**Status visuals:**

| State | Visual |
|---|---|
| Floor with unknown residents | Amber pulsing slab |
| Assistance request | Red beacon + floating `<Html>` label at the room |
| Blocked stairwell | Red shaft segment with hatch texture |
| Verified open route | Green animated path |
| Hazard (gas, smoke) | Particle volume on that floor |

**Interaction:** click a floor to explode or isolate it, click a room for a resident/incident panel. Camera transitions use `drei`'s `CameraControls`.

**Optional realism:** model the real dorm in Blender from OSM building footprints, export GLB, compress with `gltf-transform` (Draco/Meshopt), and load with `useGLTF`. Name meshes `room_912`, `stair_B_9` so data binding still works.

---

## 3D disaster simulation

Keep the simulation logic in **pure TypeScript** (`sim/`), separate from rendering. It runs in a Web Worker and posts state snapshots to the scene.

| Disaster | Model | Rendering |
|---|---|---|
| **Fire** | Cellular automaton on a per-floor grid (ignition, spread probability, walls block, stairwells carry fire upward) | Emissive instanced tiles + flame particles |
| **Smoke** | Diffusion over the same grid, rising through open stairwells | Semi-transparent volume particles, density → opacity |
| **Earthquake** | Scripted intensity curve (replayable from a real NCDR event's magnitude/intensity) | Camera shake, per-floor sway offset, optional Rapier debris blocking stairwells |
| **Flooding** (nice to have) | Water level per floor over time | Animated transparent plane |

**The simulation feeds the real system.** When fire reaches a stairwell cell, the sim emits a simulated `IncidentReport`. That report goes through the same pipeline as a human report: dashboard update, priority engine, handoff. The demo shows the operational system reacting, not only an animation.

Particles: `three.quarks` or `drei`'s `<Sparkles>` / custom `InstancedMesh` shaders. Postprocessing (`@react-three/postprocessing`) adds bloom on fire and hazards.

Label all simulated output **SIMULATED** in the UI, as the README requires.

---

## Backend: Supabase

| Need from README | Supabase feature |
|---|---|
| Resident / Incident / Route / Task tables | Postgres + migrations |
| Live dashboards ("nice to have: WebSockets") | **Realtime** subscriptions on `resident_status`, `incident`, `building_route`, `task` |
| Student / RA / Manager roles | **Auth** + a `role` claim |
| "Public should not see room assignments or medical info" | **Row Level Security** policies per role |
| Incident grouping, priority list | Postgres views / SQL functions |
| Audit logs | Append-only `status_event` table with triggers |
| Taiwan open data | **Edge Functions** + **pg_cron** |

**Status provenance** (`SELF_CONFIRMED`, `PEER_CONFIRMED`, `STAFF_CONFIRMED`) and **verification** (`REPORTED`, `CORROBORATED`, `STAFF_VERIFIED`) are Postgres enums, so the database enforces them.

---

## Taiwan open data integration

| Source | Use | How |
|---|---|---|
| **NCDR CAP alerts** | Trigger emergency mode, show external context | Edge Function polls the CAP feed with `pg_cron` and parses XML into `external_alert` |
| **NFA shelters** | Off-campus evacuation layer | One-time import into PostGIS, shown on MapLibre |
| **NHI hospitals / clinics** | Medical resources layer | One-time import |
| **AED locations** | Nearby AED layer | One-time import |
| **OpenStreetMap** | Campus roads, building footprints, basemap | MapLibre tiles + Overpass extract for the dorm footprint |

Enable the **PostGIS** extension for "nearest shelter / AED" queries.

---

## Responder handoff

1. A SQL view assembles the structured handoff: counts, priority residents, route status, unknowns by floor.
2. *(Optional)* An Edge Function passes that JSON to the Claude API to write a short plain-language summary. The structured data stays the source of truth, and the generated text is labeled as a summary.
3. Export a PDF with `expo-print` on mobile or the browser print dialog on web, and share it through the native share sheet.

---

## Supporting libraries

| Purpose | Library |
|---|---|
| Forms / validation | `react-hook-form` + `zod` (shared schemas with Edge Functions) |
| Animation (2D UI) | `react-native-reanimated` |
| Charts on command view | `victory-native` (mobile) / `recharts` (web), or simple custom bars |
| QR check-in | `expo-camera` barcode scanning |
| Offline queue (nice to have) | TanStack Query persistence + `@react-native-async-storage/async-storage` |
| Linting / formatting | ESLint + Prettier |
| Testing | Jest + React Native Testing Library; Vitest for `sim/` |

---

## Getting started

```bash
npx create-expo-app@latest dormsafe --template tabs
cd dormsafe

# 3D
npx expo install three @react-three/fiber @react-three/drei @react-three/postprocessing
# "use dom" uses @expo/dom-webview by default on SDK 56+, nothing extra to install
npm i -D @types/three

# Backend + state
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage
npm i zustand @tanstack/react-query zod

# Styling, i18n, maps
npm i nativewind tailwindcss i18next react-i18next
npx expo install expo-localization @maplibre/maplibre-react-native
npm i react-map-gl maplibre-gl

# Supabase local dev
npx supabase init
npx supabase start
```

Run: `npx expo start`, then press `w` for web, `i` for iOS, or `a` for Android.

---

## Hackathon build order

1. Supabase schema + seed SIMULATED roster (Dorm A, 12 floors, 812 residents).
2. Student check-in screen writing to `resident_status`.
3. Procedural 3D building colored live from Realtime data (the biggest demo moment).
4. Hazard reporting that turns a stairwell red in 3D.
5. RA floor view + verification.
6. Priority list + handoff summary.
7. NCDR alert ingestion as the trigger.
8. Fire/smoke simulation feeding simulated incident reports.
9. Polish: earthquake shake, bloom, camera fly-throughs, zh-TW translations.
