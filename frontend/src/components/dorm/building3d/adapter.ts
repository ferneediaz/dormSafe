import type {
  EvacRoute,
  Report,
  Resident,
  RouteStatus as StoreRouteStatus,
  Status,
} from "@/lib/dorm-data";

import { FLOORS, SLOTS, LOBBY_SLOT, roomAt, roomIndex } from "./geometry";
import type {
  RoomStatus,
  RouteStatus,
  SceneFloor,
  SceneMarker,
  SceneRoute,
} from "./types";

/** Worst-first, matching the coordinator's room-by-room view. */
const RANK: Record<Status, number> = {
  HELP: 3,
  UNKNOWN: 2,
  INSIDE: 1,
  SAFE: 0,
};
const ROOM: Record<Status, RoomStatus> = {
  HELP: "help",
  UNKNOWN: "unknown",
  INSIDE: "inside",
  SAFE: "safe",
};
const ROUTE: Record<StoreRouteStatus, RouteStatus> = {
  OPEN: "open",
  BLOCKED: "blocked",
  UNKNOWN: "unverified",
};

const needsHelp = (r: Resident) => r.sos || r.status === "HELP";

/** One entry per floor (index = level - 1). Floors with no visible residents have no lit rooms. */
export function sceneFloors(residents: Resident[]): SceneFloor[] {
  const floors: SceneFloor[] = Array.from({ length: FLOORS }, (_, i) => ({
    level: i + 1,
    rooms: Array<RoomStatus | null>(SLOTS * 2).fill(null),
    unknown: 0,
    help: 0,
  }));
  const worst = new Map<string, Status>();
  for (const r of residents) {
    const f = floors[r.floor - 1];
    if (!f) continue;
    const s: Status = r.sos ? "HELP" : r.status;
    const key = `${r.floor}:${roomIndex(r.room)}`;
    const prev = worst.get(key);
    if (!prev || RANK[s] > RANK[prev]) worst.set(key, s);
    if (r.status === "UNKNOWN") f.unknown++;
    if (needsHelp(r)) f.help++;
  }
  for (const [key, s] of worst) {
    const [level, idx] = key.split(":").map(Number) as [number, number];
    floors[level - 1]!.rooms[idx] = ROOM[s];
  }
  return floors;
}

/** Help beacons (one per room with SOS / Need help) and pulses for open hazard reports. */
export function sceneMarkers(
  residents: Resident[],
  reports: Report[],
): SceneMarker[] {
  const out: SceneMarker[] = [];
  const rooms = new Map<number, Resident[]>();
  for (const r of residents)
    if (needsHelp(r)) rooms.set(r.room, [...(rooms.get(r.room) ?? []), r]);
  for (const [room, rs] of [...rooms].sort((a, b) => a[0] - b[0])) {
    const { side, slot } = roomAt(roomIndex(room));
    const tags = [
      rs.some((r) => r.sos) && "SOS",
      rs.some((r) => r.mobility) && "♿",
    ].filter(Boolean);
    out.push({
      id: `help-${room}`,
      floor: rs[0]!.floor,
      slot,
      side,
      kind: "help",
      label: [`Room ${room}`, ...tags].join(" · "),
    });
  }
  for (const rp of reports) {
    if (rp.status === "RESOLVED" || rp.status === "VERIFIED") continue;
    out.push({
      id: `hazard-${rp.id}`,
      floor: rp.floor,
      slot: hazardSlot(rp.area),
      side: "corridor",
      kind: "hazard",
      label: `${rp.category} · ${rp.floor}F`,
    });
  }
  return out;
}

/** Best-effort placement from the free-text area: a room number, a stairwell, or mid-corridor. */
function hazardSlot(area: string) {
  const room = area.match(/\b(\d{3,4})\b/);
  if (room) return roomAt(roomIndex(Number(room[1]))).slot;
  if (/east|stair(well)?\s*b\b/i.test(area)) return SLOTS - 1;
  if (/west|stair(well)?\s*a\b/i.test(area)) return 0;
  return LOBBY_SLOT;
}

/** Stairwells only; the elevator isn't drawn. "9–10F" on a blocked stair limits the red to those floors. */
export function sceneRoutes(routes: EvacRoute[]): SceneRoute[] {
  const out: SceneRoute[] = [];
  for (const r of routes) {
    const label = `${r.id} ${r.name}`;
    if (!/stair/i.test(label)) continue;
    const side = /east|-b\b/i.test(label) ? "east" : "west";
    const range = r.floors?.match(/(\d+)\s*[–-]\s*(\d+)/);
    if (r.status === "BLOCKED" && range) {
      out.push({
        side,
        status: "blocked",
        blocked: [Number(range[1]), Number(range[2])],
      });
    } else {
      out.push({ side, status: ROUTE[r.status] });
    }
  }
  return out;
}

/** The floor that most needs eyes: help requests, then hazards, then unaccounted residents. */
export function focusFloor(floors: SceneFloor[], markers: SceneMarker[]) {
  let best = floors[floors.length - 1]?.level ?? 1;
  let bestScore = -1;
  for (const f of floors) {
    const hazards = markers.filter(
      (m) => m.kind === "hazard" && m.floor === f.level,
    ).length;
    const score = f.help * 1000 + hazards * 100 + f.unknown;
    if (score >= bestScore) {
      best = f.level;
      bestScore = score;
    }
  }
  return best;
}
