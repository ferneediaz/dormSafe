export type StatusValue = 'safe' | 'inside' | 'need_help' | 'unknown' | 'out';
export type Source = 'self' | 'peer' | 'staff' | 'simulated';

export interface Building {
  id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  floors: number;
  roomsPerFloor: number;
}

export interface Resident {
  id: string;
  name: string;
  floor: number;
  room: string;
  phone: string;
  language: string;
  emergencyContact: string;
  vulnerable: boolean;
  vulnerableNote?: string;
}

export interface StatusEntry {
  status: StatusValue;
  source: Source;
  by?: string; // resident id of reporter (peer/staff)
  note?: string;
  lat?: number;
  lon?: number;
  at: number;
}

export type ReportCategory =
  | 'fire' | 'smoke' | 'gas' | 'leak' | 'electrical' | 'structural'
  | 'blocked_route' | 'injury' | 'broken' | 'other';

export interface Report {
  id: string;
  residentId: string;
  category: ReportCategory;
  description: string;
  photo?: string; // data URL (compressed)
  floor: number;
  room: string;
  routeId?: string;
  urgency: 'normal' | 'emergency';
  status: 'new' | 'in_progress' | 'resolved';
  lat?: number;
  lon?: number;
  at: number;
}

export interface Route {
  id: string;
  name: string;
  floorFrom: number;
  floorTo: number;
  status: 'open' | 'blocked' | 'unknown';
  verification: 'reported' | 'corroborated' | 'staff_verified';
  updatedAt: number;
}

export interface RollCall {
  active: boolean;
  reason: string;
  startedAt: number;
  endedAt?: number;
}

export interface Alert {
  title: string;
  detail: string;
  source: string; // 'CWA E-A0015-001' | 'SAMPLE'
  at: number;
  lat?: number;
  lon?: number;
}

export interface Shelter {
  id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  capacity: number;
  disasterTypes: string;
  phone: string;
  status: 'open' | 'full' | 'closed' | 'unknown';
  sample?: boolean;
}

export interface Announcement {
  id: string;
  text: string;
  at: number;
}

export interface State {
  version: number;
  building: Building;
  residents: Resident[];
  statuses: Record<string, StatusEntry>;
  reports: Report[];
  routes: Route[];
  rollCall: RollCall | null;
  alert: Alert | null;
  shelters: Shelter[];
  announcements: Announcement[];
}
