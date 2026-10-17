export type ResidentStatus = 'safe' | 'inside' | 'help' | 'unknown';

export type Provenance = 'SELF_CONFIRMED' | 'PEER_CONFIRMED' | 'STAFF_CONFIRMED' | 'UNKNOWN';

export type Verification = 'REPORTED' | 'CORROBORATED' | 'STAFF_VERIFIED';

export type Resident = {
  id: string;
  floor: number;
  room: string;
  status: ResidentStatus;
  provenance: Provenance;
  /** Simulated: resident never responds (away, phone dead, ...). */
  silent: boolean;
  note?: string;
};

export type Room = {
  id: string; // "912"
  floor: number;
  /** Slot along the corridor, 0..16. */
  slot: number;
  side: 'north' | 'south';
};

export type RouteKind = 'stair' | 'elevator';
export type RouteStatus = 'open' | 'blocked' | 'unavailable' | 'unverified';

export type Route = {
  id: string;
  name: string;
  kind: RouteKind;
  side: 'west' | 'east' | 'center';
  status: RouteStatus;
  verification: Verification;
  /** Inclusive floor range that is blocked, if any. */
  blocked?: [number, number];
};

export type IncidentType = 'gas' | 'smoke' | 'debris' | 'fire' | 'injury' | 'mobility';

export type Incident = {
  id: string;
  type: IncidentType;
  floor: number;
  /** Corridor slot (0..16) the incident is closest to. */
  slot: number;
  label: string;
  verification: Verification;
  reports: number;
  at: number; // sim seconds
};

export type FeedEvent = {
  id: string;
  at: number; // sim seconds
  tone: 'info' | 'warn' | 'critical' | 'good';
  text: string;
};

/** Serializable per-floor snapshot passed into the 3D scene. */
export type SceneFloor = {
  level: number;
  /** Worst status per room, indexed `side * 17 + slot` (null = no room / lobby). */
  rooms: (ResidentStatus | null)[];
  unknown: number;
  help: number;
};

export type ViewMode = 'exterior' | 'xray' | 'exploded' | 'plan';

export type SceneMarker = {
  id: string;
  floor: number;
  slot: number;
  side: 'north' | 'south' | 'corridor';
  kind: 'hazard' | 'help';
  label: string;
};

export type SceneRoute = {
  side: 'west' | 'east';
  status: RouteStatus;
  blocked?: [number, number];
};
