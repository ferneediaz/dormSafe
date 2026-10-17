// Client + mappers for Alessandro's FastAPI backend (branch `ale`, docs/API.md).
// The UI keeps its own types; everything is converted here.
import type { Alert, Building, Report, ReportCategory, Resident, Route, Shelter, StatusEntry, StatusValue } from './types';

// ---------- API types (subset of docs/API.md) ----------
export interface ApiDorm { id: string; name: string; address: string | null; latitude: number; longitude: number; floors: number[] }
export interface ApiResident { id: string; display_name: string; dorm_id: string; floor: number; room: string }
export type ApiState = 'unknown' | 'safe' | 'still_inside' | 'needs_help';
export interface ApiStatus { resident_id: string; state: ApiState; confirmation_type: 'self' | 'peer' | 'staff'; reported_by: string | null; floor: number | null; room: string | null; note: string | null; updated_at: string }
export type ApiIncidentType = 'fire' | 'smoke' | 'gas_leak' | 'blocked_stairwell' | 'blocked_corridor' | 'structural_damage' | 'electrical_hazard' | 'injured_person' | 'trapped_person' | 'other';
export type ApiVerification = 'reported' | 'corroborated' | 'staff_verified' | 'resolved';
export interface ApiIncident { id: string; dorm_id: string; incident_type: ApiIncidentType; floor: number | null; room: string | null; location_label: string | null; description: string | null; verification_state: ApiVerification; created_at: string; updated_at: string }
export interface ApiAccess { id: string; dorm_id: string; name: string; kind: 'stairwell' | 'exit' | 'corridor'; floor: number | null; state: 'unknown' | 'usable' | 'blocked'; verification_state: ApiVerification; updated_at: string }
export interface ApiAlert { id: string; event_type: string; headline: string | null; description: string | null; severity: string | null; effective_at: string | null; expires_at: string | null; affected_areas: string[]; source: string; data_mode: string }
export interface ApiShelter { id: string; name: string; address: string | null; latitude: number; longitude: number; status: string | null; planned_capacity: number | null; suitable_for_vulnerable_people: boolean | null; disaster_types: string[]; source: string }

async function req<T>(base: string, path: string, init?: RequestInit): Promise<{ data: T; headers: Headers }> {
  const res = await fetch(base.replace(/\/$/, '') + path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status} ${await res.text().catch(() => '')}`);
  return { data: (await res.json()) as T, headers: res.headers };
}

export const api = {
  dorm: (b: string) => req<ApiDorm>(b, '/dorm').then((r) => r.data),
  residents: (b: string) => req<ApiResident[]>(b, '/residents').then((r) => r.data),
  statuses: (b: string) => req<ApiStatus[]>(b, '/resident-statuses').then((r) => r.data),
  incidents: (b: string) => req<ApiIncident[]>(b, '/incidents').then((r) => r.data),
  access: (b: string) => req<ApiAccess[]>(b, '/building-access').then((r) => r.data),
  alerts: (b: string) => req<ApiAlert[]>(b, '/external/alerts'),
  shelters: (b: string) => req<ApiShelter[]>(b, '/external/shelters'),
  postStatus: (b: string, body: { resident_id: string; state: ApiState; confirmation_type: 'self' | 'peer' | 'staff'; reported_by?: string; floor?: number; room?: string; note?: string }) =>
    req<ApiStatus>(b, '/resident-statuses', { method: 'POST', body: JSON.stringify(body) }).then((r) => r.data),
  postIncident: (b: string, body: { incident_type: ApiIncidentType; floor?: number; room?: string; location_label?: string; description?: string; reporter_id?: string }) =>
    req<ApiIncident>(b, '/incidents', { method: 'POST', body: JSON.stringify(body) }).then((r) => r.data),
  postAccess: (b: string, body: { access_point_id: string; state: 'unknown' | 'usable' | 'blocked'; verification_state: ApiVerification }) =>
    req<ApiAccess>(b, '/building-access', { method: 'POST', body: JSON.stringify(body) }).then((r) => r.data),
};

// ---------- mappers ----------
export const toApiState: Record<StatusValue, ApiState | null> = { safe: 'safe', inside: 'still_inside', need_help: 'needs_help', unknown: 'unknown', out: null };
const fromApiState: Record<ApiState, StatusValue> = { safe: 'safe', still_inside: 'inside', needs_help: 'need_help', unknown: 'unknown' };

export function mapBuilding(d: ApiDorm, residents: ApiResident[]): Building {
  const perFloor = Math.max(1, ...d.floors.map((f) => new Set(residents.filter((r) => r.floor === f).map((r) => r.room)).size));
  return { id: d.id, name: d.name, address: d.address ?? '', lat: d.latitude, lon: d.longitude, floors: Math.max(...d.floors), roomsPerFloor: perFloor };
}

export function mapResident(r: ApiResident): Resident {
  return { id: r.id, name: r.display_name, floor: r.floor, room: r.room, phone: '', language: '', emergencyContact: '', vulnerable: false };
}

/** Statuses recorded before `since` (roll call start) count as unknown. */
export function mapStatuses(list: ApiStatus[], since?: number): Record<string, StatusEntry> {
  const out: Record<string, StatusEntry> = {};
  for (const s of list) {
    const at = Date.parse(s.updated_at);
    if (since && at < since) continue;
    if (s.state === 'unknown') continue;
    out[s.resident_id] = { status: fromApiState[s.state], source: s.confirmation_type, by: s.reported_by ?? undefined, note: s.note ?? undefined, at };
  }
  return out;
}

// Categories the API has no type for are sent as `other` with a "[category]" prefix in the description.
const CAT_TO_API: Record<ReportCategory, ApiIncidentType> = {
  fire: 'fire', smoke: 'smoke', gas: 'gas_leak', leak: 'other', electrical: 'electrical_hazard', structural: 'structural_damage',
  blocked_route: 'blocked_stairwell', injury: 'injured_person', broken: 'other', other: 'other',
};
const API_TO_CAT: Record<ApiIncidentType, ReportCategory> = {
  fire: 'fire', smoke: 'smoke', gas_leak: 'gas', blocked_stairwell: 'blocked_route', blocked_corridor: 'blocked_route',
  structural_damage: 'structural', electrical_hazard: 'electrical', injured_person: 'injury', trapped_person: 'injury', other: 'other',
};
const EMERGENCY: ReportCategory[] = ['fire', 'smoke', 'gas', 'structural', 'blocked_route', 'injury'];

export function reportToIncident(r: { category: ReportCategory; description: string; floor: number; room: string; residentId: string }) {
  const type = CAT_TO_API[r.category];
  const prefix = type === 'other' && r.category !== 'other' ? `[${r.category}] ` : '';
  return { incident_type: type, floor: r.floor, room: r.room || undefined, description: (prefix + r.description).trim() || prefix.trim() || undefined, reporter_id: r.residentId };
}

export interface ReportOverlay { photo?: string; status?: Report['status']; residentId?: string; routeId?: string }

export function mapIncident(i: ApiIncident, o: ReportOverlay = {}): Report {
  let desc = i.description ?? '';
  let cat = API_TO_CAT[i.incident_type];
  const m = desc.match(/^\[(leak|broken)\]\s*/);
  if (cat === 'other' && m) {
    cat = m[1] as ReportCategory;
    desc = desc.slice(m[0].length);
  }
  return {
    id: i.id, residentId: o.residentId ?? '', category: cat, description: desc, photo: o.photo,
    floor: i.floor ?? 0, room: i.room ?? i.location_label ?? '', routeId: o.routeId,
    urgency: EMERGENCY.includes(cat) ? 'emergency' : 'normal',
    status: o.status ?? (i.verification_state === 'resolved' ? 'resolved' : 'new'),
    at: Date.parse(i.created_at),
  };
}

export function mapAccess(a: ApiAccess): Route {
  const f = a.floor ?? 1;
  return {
    id: a.id,
    name: a.kind === 'stairwell' && a.floor ? `${a.name} ${a.floor}F` : a.name,
    floorFrom: f, floorTo: f,
    status: a.state === 'usable' ? 'open' : a.state,
    verification: a.verification_state === 'resolved' ? 'staff_verified' : a.verification_state,
    updatedAt: Date.parse(a.updated_at),
  };
}

export const routeToApi = (s: Route['status']) => (s === 'open' ? 'usable' : s) as ApiAccess['state'];

export function mapShelter(s: ApiShelter): Shelter {
  return {
    id: s.id, name: s.name, address: s.address ?? '', lat: s.latitude, lon: s.longitude,
    capacity: s.planned_capacity ?? 0, disasterTypes: s.disaster_types.join(', '), phone: '',
    status: s.status === 'designated' ? 'designated' : s.status === 'open' || s.status === 'full' || s.status === 'closed' ? s.status : 'unknown',
  };
}

const EVENT_LABEL: Record<string, string> = { earthquake: 'Earthquake', heavy_rain: 'Heavy rain', flood: 'Flood', typhoon: 'Typhoon' };
export function mapAlert(a: ApiAlert, mode: string): Alert {
  return {
    title: `${EVENT_LABEL[a.event_type] ?? 'Alert'}: ${a.headline ?? ''}`.trim(),
    detail: [a.description, a.affected_areas.length ? `Areas: ${a.affected_areas.slice(0, 6).join(', ')}` : ''].filter(Boolean).join(' · '),
    source: `${a.source} (${mode === 'frozen_real' ? 'real snapshot, replayed' : mode})`,
    at: Date.now(),
  };
}
