/** Scene-level types: what the 3D building needs, derived from the dorm store by ./adapter. */

export type RoomStatus = "safe" | "inside" | "help" | "unknown";
export type RouteStatus = "open" | "blocked" | "unavailable" | "unverified";

export type SceneFloor = {
  level: number;
  /** Worst status per room, indexed by geometry's roomIndex() (null = no room here). */
  rooms: (RoomStatus | null)[];
  unknown: number;
  help: number;
};

export type ViewMode = "exterior" | "xray" | "exploded" | "plan";

export type SceneMarker = {
  id: string;
  floor: number;
  slot: number;
  side: "north" | "south" | "corridor";
  kind: "hazard" | "help";
  label: string;
};

export type SceneRoute = {
  side: "west" | "east";
  status: RouteStatus;
  /** Floors (inclusive) where a partially blocked stairwell is impassable. */
  blocked?: [number, number];
};
