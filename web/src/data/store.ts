// Tiny shared store. Persists to localStorage and syncs live across browser tabs
// (resident tab ↔ admin tab) via BroadcastChannel. Swap for Supabase later:
// keep the same `actions` API and replace `commit()` with DB writes + realtime.
import { useSyncExternalStore } from 'react';
import { initialState, rng } from './seed';
import type { Report, Route, Shelter, State, StatusEntry, StatusValue, Alert } from './types';

const KEY = 'dormsafe-state-v1';
let state: State = load();
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;
try {
  channel = new BroadcastChannel('dormsafe');
  channel.onmessage = () => {
    state = load();
    listeners.forEach((l) => l());
  };
} catch {
  /* no BroadcastChannel */
}
window.addEventListener('storage', (e) => {
  if (e.key === KEY) {
    state = load();
    listeners.forEach((l) => l());
  }
});

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as State;
      if (s.version === 1) return s;
    }
  } catch {
    /* ignore */
  }
  return initialState();
}

function commit(next: State) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Quota exceeded (too many photos) – drop photos from oldest reports and retry.
    try {
      const slim = { ...next, reports: next.reports.map((r, i) => (i < next.reports.length - 5 ? { ...r, photo: undefined } : r)) };
      localStorage.setItem(KEY, JSON.stringify(slim));
    } catch {
      /* give up persisting */
    }
  }
  listeners.forEach((l) => l());
  channel?.postMessage('changed');
}

export function useStore(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

const uid = () => Math.random().toString(36).slice(2, 10);

export const actions = {
  setStatus(residentId: string, entry: Omit<StatusEntry, 'at'>) {
    commit({ ...state, statuses: { ...state.statuses, [residentId]: { ...entry, at: Date.now() } } });
  },

  addReport(r: Omit<Report, 'id' | 'at' | 'status'>) {
    let routes = state.routes;
    if (r.category === 'blocked_route' && r.routeId) {
      routes = routes.map((rt) => {
        if (rt.id !== r.routeId) return rt;
        const alreadyBlocked = rt.status === 'blocked' && rt.verification !== 'staff_verified';
        return {
          ...rt,
          status: 'blocked',
          floorFrom: r.floor,
          floorTo: Math.min(r.floor + 1, state.building.floors),
          verification: rt.verification === 'staff_verified' ? rt.verification : alreadyBlocked ? 'corroborated' : 'reported',
          updatedAt: Date.now(),
        } satisfies Route;
      });
    }
    commit({ ...state, routes, reports: [{ ...r, id: uid(), at: Date.now(), status: 'new' }, ...state.reports] });
  },

  setReportStatus(id: string, status: Report['status']) {
    commit({ ...state, reports: state.reports.map((r) => (r.id === id ? { ...r, status } : r)) });
  },

  setRoute(id: string, patch: Partial<Route>) {
    commit({ ...state, routes: state.routes.map((r) => (r.id === id ? { ...r, ...patch, updatedAt: Date.now() } : r)) });
  },

  startRollCall(reason: string, alert: Alert | null) {
    commit({ ...state, statuses: {}, rollCall: { active: true, reason, startedAt: Date.now() }, alert });
  },

  endRollCall() {
    if (!state.rollCall) return;
    commit({ ...state, rollCall: { ...state.rollCall, active: false, endedAt: Date.now() } });
  },

  announce(text: string) {
    commit({ ...state, announcements: [{ id: uid(), text, at: Date.now() }, ...state.announcements] });
  },

  setShelters(shelters: Shelter[]) {
    commit({ ...state, shelters });
  },

  setShelterStatus(id: string, status: Shelter['status']) {
    commit({ ...state, shelters: state.shelters.map((s) => (s.id === id ? { ...s, status } : s)) });
  },

  /** Demo helper: fill in check-ins to roughly match the README scenario. */
  simulateCheckIns(excludeIds: string[] = []) {
    const r = rng(Date.now() % 100000);
    const statuses = { ...state.statuses };
    const pool = state.residents.filter((x) => !statuses[x.id] && !excludeIds.includes(x.id) && x.room !== '912');
    // Upper floors (10–12) stay more "unknown" to match the scenario.
    const targets: Record<StatusValue, number> = { safe: 623, inside: 43, need_help: 4, unknown: 0, out: 0 };
    const counts: Record<string, number> = { safe: 0, inside: 0, need_help: 0 };
    for (const v of Object.values(statuses)) counts[v.status] = (counts[v.status] ?? 0) + 1;
    const shuffled = [...pool].sort(() => r() - 0.5).sort((a, b) => (a.floor >= 10 ? 1 : 0) - (b.floor >= 10 ? 1 : 0));
    for (const res of shuffled) {
      let pick: StatusValue | null = null;
      if (counts.need_help < targets.need_help && r() < 0.02) pick = 'need_help';
      else if (counts.inside < targets.inside && r() < 0.07) pick = 'inside';
      else if (counts.safe < targets.safe) pick = 'safe';
      else if (counts.inside < targets.inside) pick = 'inside';
      if (!pick) break;
      counts[pick]++;
      statuses[res.id] = { status: pick, source: 'simulated', at: Date.now() - Math.floor(r() * 300000) };
    }
    commit({ ...state, statuses });
  },

  reset() {
    commit(initialState());
  },
};

export function latestStatus(s: State, id: string): StatusValue {
  return s.statuses[id]?.status ?? 'unknown';
}
