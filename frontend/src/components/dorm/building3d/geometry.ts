import { Color } from "three";

import type { RoomStatus, RouteStatus, SceneRoute, ViewMode } from "./types";

export const FLOORS = 12;
/** Room bays per side of the corridor. 17 rooms per floor: 9 north, 8 south around the lounge/lobby bay. */
export const SLOTS = 9;
export const LOBBY_SLOT = 4;

export const PITCH = 2.4;
export const LENGTH = SLOTS * PITCH;
export const ROOM_D = 2.6;
export const CORRIDOR = 1.4;
export const DEPTH = ROOM_D * 2 + CORRIDOR;
export const FLOOR_H = 1.4;
export const SLAB_T = 0.16;
export const WALL_H = FLOOR_H - SLAB_T;
export const STAIR = 1.7;
export const STAIR_X = LENGTH / 2 + STAIR / 2;
export const EXPLODE = 2.4;

export const slotX = (slot: number) => (slot - (SLOTS - 1) / 2) * PITCH;
export const sideZ = (side: "north" | "south" | "corridor") =>
  side === "north"
    ? -(CORRIDOR / 2 + ROOM_D / 2)
    : side === "south"
      ? CORRIDOR / 2 + ROOM_D / 2
      : 0;
export const facadeZ = (side: "north" | "south") =>
  (side === "north" ? -1 : 1) * (DEPTH / 2);

export const floorBase = (level: number, mode: ViewMode) =>
  (level - 1) * FLOOR_H * (mode === "exploded" ? EXPLODE : 1);

export const roomAt = (idx: number) => ({
  side: (idx < SLOTS ? "north" : "south") as "north" | "south",
  slot: idx % SLOTS,
});

/** A partial blockage only blocks its floor range; the rest of that stair is unverified. */
export const routeStatusAt = (r: SceneRoute, level: number): RouteStatus => {
  if (!r.blocked) return r.status;
  return level >= r.blocked[0] && level <= r.blocked[1]
    ? "blocked"
    : "unverified";
};

/**
 * Room k (1–17) on each floor → bay index (`side * SLOTS + slot`). Rooms 1–9 run west→east along the
 * north side; 10–17 come back east→west along the south side, skipping the lobby bay.
 */
export const roomIndex = (room: number) => {
  const k = room % 100;
  if (k <= SLOTS) return k - 1;
  const slot = k <= 13 ? 18 - k : 17 - k;
  return SLOTS + slot;
};

export const roomNumber = (level: number, idx: number) => {
  const { side, slot } = roomAt(idx);
  const k =
    side === "north" ? slot + 1 : slot > LOBBY_SLOT ? 18 - slot : 17 - slot;
  return level * 100 + k;
};

export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const C = {
  sky: "#0b1220",
  horizon: "#1d2840",
  fog: "#141c2b",
  grass: "#18261b",
  plaza: "#2f343b",
  path: "#3d434b",
  asphalt: "#15181d",
  tile: "#d6d0c2",
  band: "#ece8df",
  fin: "#bfb8a8",
  plinth: "#4b5057",
  core: "#b3ac9c",
  roof: "#7c8289",
  steel: "#cdd4da",
  ac: "#e3e6ea",
  slabDark: "#1b2633",
  edge: "#3b4b5e",
  ghost: "#7dd3fc",
  accent: "#38bdf8",
  safe: "#22c55e",
  inside: "#f59e0b",
  help: "#ef4444",
  unknown: "#64748b",
  hazard: "#f97316",
};

export const STATUS: Record<RoomStatus, string> = {
  safe: C.safe,
  inside: C.inside,
  help: C.help,
  unknown: C.unknown,
};

/** Window glow per status. Values above 1 bloom. */
export const WINDOW: Record<RoomStatus, Color> = {
  help: new Color("#ff2a2a").multiplyScalar(3.2),
  inside: new Color("#ffb24a").multiplyScalar(1.7),
  safe: new Color("#1d5a3a").multiplyScalar(1.1),
  unknown: new Color("#3b4a5e").multiplyScalar(0.75),
};

export const STAIR_GLOW: Record<RouteStatus, Color> = {
  open: new Color("#34d399").multiplyScalar(1.6),
  blocked: new Color("#ff2a2a").multiplyScalar(3.2),
  unverified: new Color("#fbbf24").multiplyScalar(1.4),
  unavailable: new Color("#64748b"),
};

export const STAIR_COLOR: Record<RouteStatus, string> = {
  open: C.safe,
  blocked: C.help,
  unverified: C.inside,
  unavailable: C.unknown,
};
