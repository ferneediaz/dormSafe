import { km } from "./dorm-data";

/** Base URL of the DormSafe backend (branch "ale"). Override with VITE_DORMSAFE_API_URL. */
export const API_BASE: string = (import.meta.env['VITE_DORMSAFE_API_URL'] as string | undefined) ?? "http://localhost:8000";

export type Provenance = "live" | "cached" | "frozen";
export type DisasterType = "earthquake" | "flood" | "landslide" | "typhoon" | "tsunami" | "fire";
export const DISASTER_TYPES: DisasterType[] = ["earthquake", "flood", "landslide", "typhoon", "tsunami", "fire"];

export interface AlertItem {
  id: string;
  eventType: string;
  headline: string;
  severity: "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown";
  areas: string[];
  sent: string;
  source: string;
  dataMode?: Provenance | undefined;
}
export interface Shelter {
  id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  capacity: number;
  disasterTypes: DisasterType[];
  vulnerableFriendly: boolean;
  phone?: string | undefined;
  distanceKm: number;
}
export interface Feed<T> { items: T[]; provenance: Provenance; source: string; fetchedAt: number }

type Raw = Record<string, unknown>;
const str = (o: Raw, ...k: string[]) => { for (const x of k) if (o[x] != null && o[x] !== "") return String(o[x]); return ""; };
const num = (o: Raw, ...k: string[]) => { for (const x of k) { const n = Number(o[x]); if (o[x] != null && !Number.isNaN(n)) return n; } return 0; };
const listOf = (body: unknown): Raw[] => {
  if (Array.isArray(body)) return body as Raw[];
  const b = body as Raw;
  for (const k of ["items", "alerts", "shelters", "data", "results", "features"]) if (Array.isArray(b?.[k])) return b[k] as Raw[];
  return [];
};
/** Map backend data modes (live / cached_real / frozen_real) to UI provenance. */
export function mapDataMode(v: unknown): Provenance | undefined {
  const p = String(v ?? "").trim().toLowerCase();
  if (p === "live") return "live";
  if (p === "cached" || p === "cached_real") return "cached";
  if (p === "frozen" || p === "frozen_real") return "frozen";
  return undefined;
}
export function provOf(body: unknown, header: string | null | undefined, fallback: Provenance): Provenance {
  const b = body as Raw;
  const first = listOf(body)[0];
  return mapDataMode(header) ?? mapDataMode(b?.['data_mode']) ?? mapDataMode(b?.['provenance']) ?? mapDataMode(b?.['mode'])
    ?? mapDataMode(b?.['status']) ?? mapDataMode(first?.['data_mode']) ?? fallback;
}

const DT_MAP: Record<string, DisasterType> = {
  地震: "earthquake", earthquake: "earthquake", 水災: "flood", 淹水: "flood", flood: "flood",
  土石流: "landslide", landslide: "landslide", debris: "landslide", 颱風: "typhoon", typhoon: "typhoon",
  海嘯: "tsunami", tsunami: "tsunami", 火災: "fire", fire: "fire",
};
export function parseDisasterTypes(v: unknown): DisasterType[] {
  const parts = Array.isArray(v) ? v.map(String) : String(v ?? "").split(/[,、;/\s]+/);
  const out = new Set<DisasterType>();
  for (const p of parts) { const k = p.trim().toLowerCase(); for (const [key, t] of Object.entries(DT_MAP)) if (k.includes(key.toLowerCase())) out.add(t); }
  return [...out];
}

export function normalizeAlert(o: Raw, i: number): AlertItem {
  const sev = str(o, "severity", "Severity");
  const areasRaw = o['areas'] ?? o['area'] ?? o['areaDesc'] ?? o['affected_areas'];
  return {
    id: str(o, "id", "identifier") || `a${i}`,
    eventType: str(o, "event_type", "eventType", "event", "category") || "Alert",
    headline: str(o, "headline", "title", "description", "summary"),
    severity: (["Extreme", "Severe", "Moderate", "Minor"].find((s) => s.toLowerCase() === sev.toLowerCase()) ?? "Unknown") as AlertItem["severity"],
    areas: Array.isArray(areasRaw) ? areasRaw.map(String) : String(areasRaw ?? "").split(/[,、;]+/).map((s) => s.trim()).filter(Boolean),
    sent: str(o, "sent", "effective_at", "effective", "onset", "time", "issued_at"),
    source: str(o, "source", "sender", "senderName") || "NCDR",
    dataMode: mapDataMode(o['data_mode']),
  };
}

export function normalizeShelter(o: Raw, i: number, origin: { lat: number; lng: number }): Shelter {
  const lat = num(o, "lat", "latitude", "緯度"), lon = num(o, "lon", "lng", "longitude", "經度");
  const vuln = o['suitable_for_vulnerable_people'] ?? o['vulnerable_friendly'] ?? o['vulnerableFriendly'] ?? o['wheelchair'] ?? o['accessible'] ?? o["適合避難弱者安置"];
  const given = o['distance_km'] ?? o['distanceKm'];
  return {
    id: str(o, "id", "序號", "shelter_id") || `s${i}`,
    name: str(o, "name", "避難收容處所名稱", "shelter_name"),
    address: str(o, "address", "避難收容處所地址", "addr"),
    lat, lon,
    capacity: num(o, "capacity", "planned_capacity", "預計收容人數"),
    disasterTypes: parseDisasterTypes(o['disaster_types'] ?? o['disasterTypes'] ?? o["適用災害類別"]),
    vulnerableFriendly: vuln === true || /^(true|yes|是|y|1)$/i.test(String(vuln ?? "")),
    phone: str(o, "phone", "manager_phone", "管理人電話") || undefined,
    distanceKm: given != null ? Number(given) : km(origin, { lat, lng: lon }),
  };
}

async function getJSON(path: string, timeoutMs = 4000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: ctrl.signal, headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { body: await res.json(), mode: res.headers.get("X-Data-Mode") };
  } finally { clearTimeout(t); }
}

export async function fetchAlerts(): Promise<Feed<AlertItem>> {
  try {
    const { body, mode } = await getJSON("/external/alerts");
    return { items: listOf(body).map(normalizeAlert), provenance: provOf(body, mode, "live"), source: "NCDR CAP", fetchedAt: Date.now() };
  } catch {
    return { items: FALLBACK_ALERTS, provenance: "frozen", source: "NCDR CAP (built-in snapshot)", fetchedAt: Date.now() };
  }
}

export async function fetchShelters(lat: number, lon: number, radiusKm: number): Promise<Feed<Shelter>> {
  const origin = { lat, lng: lon };
  try {
    const { body, mode } = await getJSON(`/external/shelters?lat=${lat}&lon=${lon}&radius_km=${radiusKm}`);
    const items = listOf(body).map((o, i) => normalizeShelter(o, i, origin)).filter((s) => s.distanceKm <= radiusKm).sort((a, b) => a.distanceKm - b.distanceKm);
    return { items, provenance: provOf(body, mode, "live"), source: "NFA dataset 73242", fetchedAt: Date.now() };
  } catch {
    const items = FALLBACK_SHELTERS.map((o, i) => normalizeShelter(o, i, origin)).filter((s) => s.distanceKm <= radiusKm).sort((a, b) => a.distanceKm - b.distanceKm);
    return { items, provenance: "frozen", source: "NFA dataset 73242 (built-in snapshot)", fetchedAt: Date.now() };
  }
}

// Snapshot shaped like the NCDR CAP feed, used when the backend is unreachable.
export const FALLBACK_ALERTS: AlertItem[] = [
  { id: "CWA-EQ-2026-1017", eventType: "地震 Earthquake", headline: "M5.8 earthquake off Hualien County; intensity 4 in Taipei / New Taipei. 花蓮縣近海規模5.8地震，雙北震度4級。", severity: "Severe", areas: ["花蓮縣", "宜蘭縣", "新北市", "臺北市"], sent: "2026-10-17T06:58:00+08:00", source: "NCDR / CWA" },
  { id: "CWA-RAIN-2026-1017", eventType: "豪雨 Heavy Rain", headline: "Heavy rain advisory for northern mountainous areas. 北部山區豪雨特報。", severity: "Moderate", areas: ["新北市", "桃園市"], sent: "2026-10-17T05:30:00+08:00", source: "NCDR / CWA" },
];

// Rows shaped like NFA open data 73242 (Chinese column names).
export const FALLBACK_SHELTERS: Raw[] = [
  { 序號: "F01", 避難收容處所名稱: "板橋國民運動中心", 避難收容處所地址: "新北市板橋區漢生東路278號", 緯度: 25.0186, 經度: 121.4706, 預計收容人數: 1200, 適用災害類別: "地震、水災", 適合避難弱者安置: "是", 管理人電話: "02-2960-3456" },
  { 序號: "F02", 避難收容處所名稱: "新埔國小", 避難收容處所地址: "新北市板橋區文化路二段182巷", 緯度: 25.0222, 經度: 121.4672, 預計收容人數: 650, 適用災害類別: "地震", 適合避難弱者安置: "否", 管理人電話: "02-2257-4371" },
  { 序號: "F03", 避難收容處所名稱: "板橋第一運動場", 避難收容處所地址: "新北市板橋區漢生東路278號", 緯度: 25.0167, 經度: 121.4689, 預計收容人數: 3000, 適用災害類別: "地震、颱風", 適合避難弱者安置: "是", 管理人電話: "02-2960-8899" },
  { 序號: "F04", 避難收容處所名稱: "江翠國中", 避難收容處所地址: "新北市板橋區松江街63號", 緯度: 25.0281, 經度: 121.4769, 預計收容人數: 800, 適用災害類別: "地震、水災、土石流", 適合避難弱者安置: "是", 管理人電話: "02-2253-1747" },
  { 序號: "F05", 避難收容處所名稱: "海山高中", 避難收容處所地址: "新北市板橋區漢生東路215號", 緯度: 25.0206, 經度: 121.4733, 預計收容人數: 1000, 適用災害類別: "水災、颱風", 適合避難弱者安置: "否", 管理人電話: "02-2951-7475" },
  { 序號: "F06", 避難收容處所名稱: "臺北市萬華區老松國小", 避難收容處所地址: "臺北市萬華區桂林路64號", 緯度: 25.0376, 經度: 121.5007, 預計收容人數: 900, 適用災害類別: "地震、水災", 適合避難弱者安置: "是", 管理人電話: "02-2308-6802" },
  { 序號: "F07", 避難收容處所名稱: "土城國民運動中心", 避難收容處所地址: "新北市土城區金城路二段247號", 緯度: 24.9839, 經度: 121.4487, 預計收容人數: 1100, 適用災害類別: "地震、颱風、水災", 適合避難弱者安置: "是", 管理人電話: "02-2266-6277" },
];
