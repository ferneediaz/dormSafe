// Shared store with two modes:
//  • LOCAL (default): state in localStorage, live sync between tabs of ONE browser (BroadcastChannel).
//  • API: connected to the FastAPI backend (branch `ale`, docs/API.md). Residents, statuses, incidents,
//    stairwells/exits, NCDR alerts and NFA shelters come from the server and are polled every 2 s,
//    so a phone and a laptop stay in sync. Things the API doesn't store yet (photos, report workflow
//    status, roll call, announcements, "out of dorm") stay local in this browser.
import { useSyncExternalStore } from 'react';
import { initialState, rng } from './seed';
import { api, mapAccess, mapAlert, mapBuilding, mapIncident, mapResident, mapShelter, mapStatuses, reportToIncident, routeToApi, toApiState } from './api';
import type { Alert, Report, Route, Shelter, State, StatusEntry, StatusValue } from './types';

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

function commit(next: State, broadcast = true) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Quota exceeded (too many photos): drop photos from older reports and retry.
    try {
      const slim = { ...next, reports: next.reports.map((r, i) => (i > 5 ? { ...r, photo: undefined } : r)) };
      localStorage.setItem(KEY, JSON.stringify(slim));
    } catch {
      /* give up persisting */
    }
  }
  listeners.forEach((l) => l());
  if (broadcast) channel?.postMessage('changed');
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
const base = () => (state.backend?.connected ? state.backend.url : null);

// ---------------------------------------------------------------- API sync

let pollTimer: number | null = null;
let rawStatuses: Awaited<ReturnType<typeof api.statuses>> = [];
// "Out of dorm" isn't an API state yet; kept locally and overridden by any newer API status.
let localOut: Record<string, number> = {};

function mergedStatuses(): Record<string, StatusEntry> {
  const since = state.rollCall?.active ? state.rollCall.startedAt : undefined;
  const m = mapStatuses(rawStatuses, since);
  for (const [id, at] of Object.entries(localOut)) {
    if (!m[id] || m[id].at < at) m[id] = { status: 'out', source: 'self', at };
  }
  return m;
}

async function pull() {
  const b = base();
  if (!b) return;
  try {
    const [st, inc, acc] = await Promise.all([api.statuses(b), api.incidents(b), api.access(b)]);
    rawStatuses = st;
    const overlay = state.overlay ?? {};
    const reports = inc.map((i) => mapIncident(i, overlay[i.id])).sort((a, b2) => b2.at - a.at);
    commit({
      ...state,
      statuses: mergedStatuses(),
      reports,
      routes: acc.map(mapAccess),
      backend: { ...state.backend!, connected: true, error: undefined, lastSync: Date.now() },
    }, false);
  } catch (e) {
    commit({ ...state, backend: { ...state.backend!, error: (e as Error).message } }, false);
  }
}

function startPolling() {
  if (pollTimer) window.clearInterval(pollTimer);
  pollTimer = window.setInterval(pull, 2000);
}

export async function connectBackend(url: string): Promise<string | null> {
  const b = url.trim().replace(/\/$/, '');
  try {
    const [dorm, residents] = await Promise.all([api.dorm(b), api.residents(b)]);
    const [alerts, shelters] = await Promise.all([
      api.alerts(b).catch(() => null),
      api.shelters(b).catch(() => null),
    ]);
    const alertsMode = alerts?.headers.get('X-Data-Mode') ?? undefined;
    const sorted = (alerts?.data ?? []).slice().sort((x, y) => Number(y.event_type === 'earthquake') - Number(x.event_type === 'earthquake'));
    commit({
      ...state,
      building: mapBuilding(dorm, residents),
      residents: residents.map(mapResident),
      statuses: {},
      reports: [],
      routes: [],
      rollCall: null,
      alert: null,
      shelters: shelters ? shelters.data.map(mapShelter) : state.shelters,
      overlay: {},
      backend: {
        url: b, connected: true, alerts: sorted.map((a) => mapAlert(a, alertsMode ?? '')),
        alertsMode, sheltersMode: shelters?.headers.get('X-Data-Mode') ?? undefined, lastSync: Date.now(),
      },
    });
    localOut = {};
    await pull();
    startPolling();
    return null;
  } catch (e) {
    return `Could not reach ${b}: ${(e as Error).message}`;
  }
}

export function disconnectBackend() {
  if (pollTimer) window.clearInterval(pollTimer);
  pollTimer = null;
  commit(initialState());
}

// Resume API mode after reload (or when VITE_API_URL is set at build time).
{
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  const saved = state.backend?.url;
  if (saved) {
    startPolling();
    pull();
  } else if (envUrl) {
    connectBackend(envUrl);
  }
}

const apiErr = (e: unknown) => {
  commit({ ...state, backend: state.backend ? { ...state.backend, error: (e as Error).message } : state.backend }, false);
};

// ---------------------------------------------------------------- actions

export const actions = {
  setStatus(residentId: string, entry: Omit<StatusEntry, 'at'>) {
    const b = base();
    if (b) {
      if (entry.status === 'out') {
        localOut[residentId] = Date.now();
        commit({ ...state, statuses: mergedStatuses() });
        return;
      }
      const r = state.residents.find((x) => x.id === residentId);
      const src = entry.source === 'simulated' ? 'self' : entry.source;
      api.postStatus(b, {
        resident_id: residentId,
        state: toApiState[entry.status]!,
        confirmation_type: src,
        reported_by: src === 'self' ? undefined : entry.by ?? 'staff-admin',
        floor: r?.floor,
        room: r?.room,
        note: entry.source === 'simulated' ? 'SIMULATED check-in' : entry.note,
      }).then(pull, apiErr);
      // optimistic
      commit({ ...state, statuses: { ...state.statuses, [residentId]: { ...entry, at: Date.now() } } });
      return;
    }
    commit({ ...state, statuses: { ...state.statuses, [residentId]: { ...entry, at: Date.now() } } });
  },

  addReport(r: Omit<Report, 'id' | 'at' | 'status'>) {
    const b = base();
    if (b) {
      api.postIncident(b, reportToIncident(r)).then((inc) => {
        commit({ ...state, overlay: { ...(state.overlay ?? {}), [inc.id]: { photo: r.photo, residentId: r.residentId, routeId: r.routeId } } });
        pull();
      }, apiErr);
      if (r.category === 'blocked_route' && r.routeId) {
        const cur = state.routes.find((x) => x.id === r.routeId);
        const verification = cur?.verification === 'staff_verified' ? 'staff_verified' : cur?.status === 'blocked' ? 'corroborated' : 'reported';
        api.postAccess(b, { access_point_id: r.routeId, state: 'blocked', verification_state: verification }).then(pull, apiErr);
      }
      return;
    }
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
    // The API has no incident update endpoint yet → workflow status is local in both modes.
    const overlay = { ...(state.overlay ?? {}), [id]: { ...(state.overlay?.[id] ?? {}), status } };
    commit({ ...state, overlay, reports: state.reports.map((r) => (r.id === id ? { ...r, status } : r)) });
  },

  setRoute(id: string, patch: Partial<Route>) {
    const b = base();
    if (b) {
      const cur = state.routes.find((r) => r.id === id);
      const st = patch.status ?? cur?.status ?? 'unknown';
      api.postAccess(b, { access_point_id: id, state: routeToApi(st), verification_state: patch.verification ?? cur?.verification ?? 'reported' }).then(pull, apiErr);
    }
    commit({ ...state, routes: state.routes.map((r) => (r.id === id ? { ...r, ...patch, updatedAt: Date.now() } : r)) });
  },

  startRollCall(reason: string, alert: Alert | null) {
    const rollCall = { active: true, reason, startedAt: Date.now() };
    if (base()) {
      // API keeps statuses; we treat anything older than the roll call start as unknown.
      state = { ...state, rollCall, alert };
      commit({ ...state, statuses: mergedStatuses() });
      return;
    }
    commit({ ...state, statuses: {}, rollCall, alert });
  },

  endRollCall() {
    if (!state.rollCall) return;
    state = { ...state, rollCall: { ...state.rollCall, active: false, endedAt: Date.now() } };
    commit(base() ? { ...state, statuses: mergedStatuses() } : state);
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

  /** Demo helper: fill in check-ins in the README proportions (623 safe / 43 inside / ~5 help of 812). */
  async simulateCheckIns(excludeIds: string[] = []) {
    const r = rng(Date.now() % 100000);
    const total = state.residents.length;
    const targets = { safe: Math.round((total * 623) / 812), inside: Math.round((total * 43) / 812), need_help: Math.max(1, Math.round((total * 4) / 812)) };
    const counts: Record<string, number> = { safe: 0, inside: 0, need_help: 0 };
    for (const v of Object.values(state.statuses)) counts[v.status] = (counts[v.status] ?? 0) + 1;
    const top = state.building.floors;
    const pool = state.residents
      .filter((x) => !state.statuses[x.id] && !excludeIds.includes(x.id) && !x.vulnerable)
      .sort(() => r() - 0.5)
      .sort((a, b) => (a.floor >= top - 2 ? 1 : 0) - (b.floor >= top - 2 ? 1 : 0)); // top 3 floors stay more unknown
    const picks: [string, StatusValue][] = [];
    for (const res of pool) {
      let pick: 'safe' | 'inside' | 'need_help' | null = null;
      if (counts.need_help < targets.need_help && r() < 0.03) pick = 'need_help';
      else if (counts.inside < targets.inside && r() < 0.07) pick = 'inside';
      else if (counts.safe < targets.safe) pick = 'safe';
      else if (counts.inside < targets.inside) pick = 'inside';
      if (!pick) break;
      counts[pick]++;
      picks.push([res.id, pick]);
    }
    const b = base();
    if (b) {
      for (let i = 0; i < picks.length; i += 20) {
        await Promise.all(picks.slice(i, i + 20).map(([id, st]) => {
          const res = state.residents.find((x) => x.id === id)!;
          return api.postStatus(b, { resident_id: id, state: toApiState[st]!, confirmation_type: 'self', floor: res.floor, room: res.room, note: 'SIMULATED check-in' }).catch(() => null);
        }));
      }
      await pull();
      return;
    }
    const statuses = { ...state.statuses };
    for (const [id, st] of picks) statuses[id] = { status: st, source: 'simulated', at: Date.now() - Math.floor(r() * 300000) };
    commit({ ...state, statuses });
  },

  reset() {
    if (pollTimer) window.clearInterval(pollTimer);
    pollTimer = null;
    commit(initialState());
  },
};

export function latestStatus(s: State, id: string): StatusValue {
  return s.statuses[id]?.status ?? 'unknown';
}
