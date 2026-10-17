import { create } from 'zustand';

import { buildResidents, buildRooms, buildRoutes, mulberry32 } from './mock';
import type { FeedEvent, Incident, Resident, Room, Route, ViewMode } from './types';

/** Simulated seconds that pass per tick. */
const SIM_STEP = 10;
const TICK_MS = 1000;
const MAX_TICKS = 90;

type State = {
  rooms: Room[];
  residents: Resident[];
  routes: Route[];
  incidents: Incident[];
  feed: FeedEvent[];
  tick: number;
  running: boolean;
  selectedFloor: number | null;
  viewMode: ViewMode;
  selectFloor: (floor: number | null) => void;
  setViewMode: (mode: ViewMode) => void;
  start: () => void;
  stop: () => void;
  reset: () => void;
};

const rooms = buildRooms();
let rand = mulberry32(7);
let timer: ReturnType<typeof setInterval> | null = null;

function initial() {
  return {
    residents: buildResidents(rooms),
    routes: buildRoutes(),
    incidents: [] as Incident[],
    feed: [
      { id: 'f0', at: 0, tone: 'critical', text: 'Earthquake detected — Dorm A emergency mode activated' },
      { id: 'f1', at: 0, tone: 'info', text: 'Elevator locked out (staff)' },
    ] as FeedEvent[],
    tick: 0,
  };
}

type Draft = ReturnType<typeof initial>;

function setResident(d: Draft, id: string, patch: Partial<Resident>) {
  const i = d.residents.findIndex((r) => r.id === id);
  if (i >= 0) d.residents[i] = { ...d.residents[i], ...patch, silent: false };
}

function setRoute(d: Draft, id: string, patch: Partial<Route>) {
  d.routes = d.routes.map((r) => (r.id === id ? { ...r, ...patch } : r));
}

function log(d: Draft, tone: FeedEvent['tone'], text: string) {
  d.feed = [{ id: `f${d.feed.length}-${d.tick}`, at: d.tick * SIM_STEP, tone, text }, ...d.feed];
}

/** Scripted storyline from the README demo flow. */
const script: Record<number, (d: Draft) => void> = {
  4: (d) => {
    d.incidents = [
      ...d.incidents,
      { id: 'i-stair-b', type: 'debris', floor: 9, slot: 16, label: 'Debris · East Stair B', verification: 'REPORTED', reports: 1, at: d.tick * SIM_STEP },
    ];
    setRoute(d, 'stair-b', { status: 'blocked', blocked: [9, 10], verification: 'REPORTED' });
    log(d, 'warn', 'Resident reports debris in East Stairwell B, floor 9');
  },
  6: (d) => {
    setResident(d, '912-1', { status: 'help', provenance: 'SELF_CONFIRMED', note: 'Cannot descend stairs · mobility' });
    log(d, 'critical', 'Room 912 requests assistance — cannot descend stairs');
  },
  7: (d) => {
    d.incidents = d.incidents.map((i) => (i.id === 'i-stair-b' ? { ...i, reports: 3, verification: 'CORROBORATED' } : i));
    log(d, 'info', 'Stair B blockage corroborated by 2 more reports');
  },
  9: (d) => {
    d.incidents = [
      ...d.incidents,
      { id: 'i-gas-6', type: 'gas', floor: 6, slot: 5, label: 'Gas smell · F6', verification: 'REPORTED', reports: 1, at: d.tick * SIM_STEP },
    ];
    log(d, 'warn', 'Possible gas smell reported on floor 6');
  },
  12: (d) => {
    setRoute(d, 'stair-a', { status: 'open', verification: 'STAFF_VERIFIED' });
    setRoute(d, 'stair-b', { verification: 'STAFF_VERIFIED' });
    d.incidents = d.incidents.map((i) => (i.id === 'i-stair-b' ? { ...i, verification: 'STAFF_VERIFIED' } : i));
    log(d, 'good', 'Floor leader confirms West Stairwell A usable');
    log(d, 'warn', 'Floor leader verifies East Stairwell B blocked F9–10');
  },
  14: (d) => {
    setResident(d, '1104-2', { status: 'help', provenance: 'PEER_CONFIRMED', note: 'Injury reported · severity unknown' });
    log(d, 'critical', 'Roommate reports injury in Room 1104');
  },
  19: (d) => {
    d.incidents = [
      ...d.incidents,
      { id: 'i-smoke-11', type: 'smoke', floor: 11, slot: 13, label: 'Smoke · F11 corridor', verification: 'REPORTED', reports: 1, at: d.tick * SIM_STEP },
    ];
    log(d, 'warn', 'Light smoke reported in floor 11 corridor');
  },
  24: (d) => {
    setResident(d, '707-1', { status: 'help', provenance: 'SELF_CONFIRMED', note: 'Panic attack · needs escort' });
    log(d, 'critical', 'Room 707 requests an escort');
  },
};

function step(d: Draft) {
  d.tick += 1;
  const t = d.tick;
  // Check-in rate ramps up, then tails off.
  const rate = Math.min(0.14, 0.03 + t * 0.012) * (t > 30 ? 0.6 : 1);
  d.residents = d.residents.map((r) => {
    if (r.silent || r.status === 'help') return r;
    if (r.status === 'unknown') {
      const floorPenalty = r.floor >= 10 ? 0.55 : 1;
      if (rand() > rate * floorPenalty) return r;
      const x = rand();
      if (x < 0.86) return { ...r, status: 'safe', provenance: x < 0.72 ? 'SELF_CONFIRMED' : 'PEER_CONFIRMED' };
      return { ...r, status: 'inside', provenance: 'SELF_CONFIRMED' };
    }
    if (r.status === 'inside' && rand() < 0.04) {
      return { ...r, status: 'safe', provenance: 'SELF_CONFIRMED' };
    }
    return r;
  });
  script[t]?.(d);
}

export const useDorm = create<State>((set, get) => ({
  rooms,
  ...initial(),
  running: false,
  selectedFloor: null,
  viewMode: 'exterior',
  selectFloor: (floor) => set({ selectedFloor: floor }),
  setViewMode: (mode) => set({ viewMode: mode }),
  start: () => {
    if (timer) return;
    set({ running: true });
    timer = setInterval(() => {
      const s = get();
      if (s.tick >= MAX_TICKS) return get().stop();
      const d: Draft = { residents: s.residents, routes: s.routes, incidents: s.incidents, feed: s.feed, tick: s.tick };
      step(d);
      set(d);
    }, TICK_MS);
  },
  stop: () => {
    if (timer) clearInterval(timer);
    timer = null;
    set({ running: false });
  },
  reset: () => {
    get().stop();
    rand = mulberry32(7);
    set({ ...initial(), selectedFloor: null });
    get().start();
  },
}));

export const simSeconds = (tick: number) => tick * SIM_STEP;
