import { FLOORS, SLOTS_PER_SIDE } from './mock';
import type {
  Incident,
  Resident,
  ResidentStatus,
  Room,
  Route,
  SceneFloor,
  SceneMarker,
  SceneRoute,
} from './types';

export type Counts = Record<ResidentStatus, number> & { total: number };

const SEVERITY: Record<ResidentStatus, number> = { help: 3, unknown: 2, inside: 1, safe: 0 };

export function emptyCounts(): Counts {
  return { safe: 0, inside: 0, help: 0, unknown: 0, total: 0 };
}

export function countAll(residents: Resident[]): Counts {
  const c = emptyCounts();
  for (const r of residents) {
    c[r.status]++;
    c.total++;
  }
  return c;
}

export function countByFloor(residents: Resident[]): Record<number, Counts> {
  const out: Record<number, Counts> = {};
  for (let f = 1; f <= FLOORS; f++) out[f] = emptyCounts();
  for (const r of residents) {
    out[r.floor][r.status]++;
    out[r.floor].total++;
  }
  return out;
}

export function sceneFloors(rooms: Room[], residents: Resident[]): SceneFloor[] {
  const worst = new Map<string, ResidentStatus>();
  for (const r of residents) {
    const cur = worst.get(r.room);
    if (!cur || SEVERITY[r.status] > SEVERITY[cur]) worst.set(r.room, r.status);
  }
  const floors: SceneFloor[] = [];
  for (let f = 1; f <= FLOORS; f++) {
    floors.push({ level: f, rooms: Array(SLOTS_PER_SIDE * 2).fill(null), unknown: 0, help: 0 });
  }
  for (const r of residents) {
    if (r.status === 'unknown') floors[r.floor - 1].unknown++;
    if (r.status === 'help') floors[r.floor - 1].help++;
  }
  for (const room of rooms) {
    const idx = (room.side === 'north' ? 0 : SLOTS_PER_SIDE) + room.slot;
    floors[room.floor - 1].rooms[idx] = worst.get(room.id) ?? 'unknown';
  }
  return floors;
}

export function sceneMarkers(rooms: Room[], residents: Resident[], incidents: Incident[]): SceneMarker[] {
  const byId = new Map(rooms.map((r) => [r.id, r]));
  const markers: SceneMarker[] = incidents.map((i) => ({
    id: i.id,
    floor: i.floor,
    slot: i.slot,
    side: 'corridor',
    kind: 'hazard',
    label: i.label,
  }));
  for (const r of residents) {
    if (r.status !== 'help') continue;
    const room = byId.get(r.room);
    if (!room) continue;
    markers.push({
      id: r.id,
      floor: room.floor,
      slot: room.slot,
      side: room.side,
      kind: 'help',
      label: `Room ${room.id}`,
    });
  }
  return markers;
}

export function sceneRoutes(routes: Route[]): SceneRoute[] {
  return routes
    .filter((r) => r.kind === 'stair')
    .map((r) => ({ side: r.side as 'west' | 'east', status: r.status, blocked: r.blocked }));
}

export type PriorityItem = {
  id: string;
  level: 'critical' | 'high' | 'medium';
  title: string;
  detail: string;
  floor: number | null;
};

export function priorities(residents: Resident[], incidents: Incident[], byFloor: Record<number, Counts>): PriorityItem[] {
  const items: PriorityItem[] = [];
  for (const r of residents) {
    if (r.status === 'help') {
      items.push({
        id: r.id,
        level: 'critical',
        title: `Room ${r.room}`,
        detail: `${r.note ?? 'Assistance requested'} · ${r.provenance.replace('_', ' ').toLowerCase()}`,
        floor: r.floor,
      });
    }
  }
  for (const i of incidents) {
    items.push({
      id: i.id,
      level: i.type === 'gas' || i.type === 'fire' ? 'critical' : 'high',
      title: i.label,
      detail: `${i.verification.replace('_', ' ').toLowerCase()} · ${i.reports} report${i.reports > 1 ? 's' : ''}`,
      floor: i.floor,
    });
  }
  const upper = [10, 11, 12].reduce((n, f) => n + byFloor[f].unknown, 0);
  if (upper > 0) {
    items.push({
      id: 'upper-unknown',
      level: 'medium',
      title: 'Floors 10–12',
      detail: `${upper} residents still unaccounted for`,
      floor: null,
    });
  }
  const rank = { critical: 0, high: 1, medium: 2 };
  return items.sort((a, b) => rank[a.level] - rank[b.level]);
}

/** Floor that most needs attention: help requests, then hazards, then unknowns. */
export function focusFloor(byFloor: Record<number, Counts>, incidents: Incident[]): number {
  let best = FLOORS;
  let bestScore = -1;
  for (let f = 1; f <= FLOORS; f++) {
    const hazards = incidents.filter((i) => i.floor === f).length;
    const score = byFloor[f].help * 1000 + hazards * 100 + byFloor[f].unknown;
    if (score > bestScore) {
      best = f;
      bestScore = score;
    }
  }
  return best;
}

export function formatClock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `T+${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
