export type Status = "SAFE" | "INSIDE" | "HELP" | "UNKNOWN";
export type Provenance = "SELF" | "PEER_CONFIRMED" | "STAFF" | "SIM";

export interface Resident {
  id: string;
  name: string;
  room: number;
  floor: number;
  lang: string;
  contact: string;
  mobility?: string | undefined;
  status: Status;
  provenance?: Provenance | undefined;
  sos: boolean;
  updatedAt?: number | undefined;
  location?: string | undefined;
}

export type RouteStatus = "OPEN" | "BLOCKED" | "UNKNOWN";
export interface EvacRoute {
  id: string;
  name: string;
  zh: string;
  status: RouteStatus;
  floors?: string;
  verified: "RESIDENT" | "STAFF";
}

export type ReportStatus = "NEW" | "IN_PROGRESS" | "RESOLVED" | "VERIFIED";
export interface Report {
  id: string;
  category: string;
  floor: number;
  area: string;
  urgency: "Low" | "Medium" | "High" | "Critical";
  description: string;
  photo?: string | undefined;
  /** Attribution for stock / open-data photos used in the demo seed. */
  photoCredit?: string | undefined;
  status: ReportStatus;
  at: number;
  by: string;
}

export const FLOORS = 12;
export const ROOMS_PER_FLOOR = 17;
export const TOTAL_RESIDENTS = 812;
export const SIM_TARGETS = { SAFE: 623, INSIDE: 43, HELP: 5, UNKNOWN: 141 } as const;

export type Tone = "safe" | "inside" | "warn" | "danger" | "unknown";

export const STATUS_META: Record<Status, { en: string; zh: string; emoji: string; tone: Tone }> = {
  SAFE: { en: "Safe / Evacuated", zh: "安全／已撤離", emoji: "✅", tone: "safe" },
  INSIDE: { en: "Safe, Still Inside", zh: "安全但仍在室內", emoji: "🟡", tone: "warn" },
  HELP: { en: "Need Help", zh: "需要協助", emoji: "🔴", tone: "danger" },
  UNKNOWN: { en: "Unknown", zh: "未知", emoji: "❓", tone: "unknown" },
};

export const CATEGORIES = [
  { en: "Fire", zh: "火災" },
  { en: "Smoke", zh: "煙霧" },
  { en: "Gas Smell", zh: "瓦斯味" },
  { en: "Water Leak", zh: "漏水" },
  { en: "Blocked Route/Staircase", zh: "通道／樓梯受阻" },
  { en: "Structural Damage", zh: "結構損壞" },
  { en: "Broken Item", zh: "物品損壞" },
  { en: "Other", zh: "其他" },
];

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const SURN = ["Chen", "Lin", "Huang", "Chang", "Li", "Wang", "Wu", "Liu", "Tsai", "Yang", "Nguyen", "Tran", "Santos", "Reyes", "Wijaya", "Saputra", "Suwan"];
const GIVEN = ["Yu-Ting", "Wei", "Hsin-Yi", "Chia-Hao", "Pei-Shan", "Jun", "Van An", "Thi Mai", "Maria", "Jose", "Budi", "Siti", "Somchai", "Yi-Chen", "Kai", "Mei-Ling"];
const LANGS = ["中文", "中文", "中文", "English", "Tiếng Việt", "Bahasa Indonesia", "Tagalog", "ไทย"];

export function seedResidents(): Resident[] {
  const r = rng(42);
  const list: Resident[] = [];
  let n = 0;
  for (let f = 1; f <= FLOORS; f++) {
    for (let k = 1; k <= ROOMS_PER_FLOOR; k++) {
      for (let b = 0; b < 4; b++) {
        if (n >= TOTAL_RESIDENTS) break;
        const room = f * 100 + k;
        // drop 4 beds on floor 1 (lobby rooms) to land on 812
        if (f === 1 && k === ROOMS_PER_FLOOR) continue;
        n++;
        list.push({
          id: `R${String(n).padStart(4, "0")}`,
          name: `${SURN[Math.floor(r() * SURN.length)]!} ${GIVEN[Math.floor(r() * GIVEN.length)]!}`,
          room,
          floor: f,
          lang: LANGS[Math.floor(r() * LANGS.length)]!,
          contact: `09${Math.floor(10000000 + r() * 89999999)}`,
          status: "UNKNOWN",
          sos: false,
        });
      }
    }
  }
  const r912 = list.find((x) => x.room === 912)!;
  r912.name = "Nguyen Van An";
  r912.lang = "Tiếng Việt";
  r912.mobility = "Cannot use stairs — wheelchair user 無法使用樓梯（輪椅）";
  const me = list.filter((x) => x.room === 905);
  me[0]!.name = "Lin Yu-Ting";
  me[0]!.lang = "中文";
  me[1]!.name = "Maria Santos";
  me[1]!.lang = "Tagalog";
  list.find((x) => x.room === 1203)!.mobility = "Hearing impaired — needs visual alert 聽障";
  return list;
}

export const ME_ID = (rs: Resident[]) => rs.find((x) => x.room === 905)!.id;
export const ROOMMATE_ID = (rs: Resident[]) => rs.filter((x) => x.room === 905)[1]!.id;

/** Deterministic simulated outcome; returns ordered check-ins (UNKNOWN residents omitted). */
export function simulationPlan(residents: Resident[], excludeIds: string[] = []) {
  const r = rng(7);
  const pool = residents.filter((x) => !excludeIds.includes(x.id));
  const shuffled = [...pool].sort(() => r() - 0.5);
  const special = shuffled.find((x) => x.room === 912 && x.mobility)!;
  const rest = shuffled.filter((x) => x !== special);
  const plan: { id: string; status: Status }[] = [{ id: special.id, status: "HELP" }];
  let i = 0;
  for (let k = 1; k < SIM_TARGETS.HELP; k++) plan.push({ id: rest[i++]!.id, status: "HELP" });
  for (let k = 0; k < SIM_TARGETS.INSIDE; k++) plan.push({ id: rest[i++]!.id, status: "INSIDE" });
  const safeCount = SIM_TARGETS.SAFE - excludeIds.length; // excluded residents decide themselves
  for (let k = 0; k < safeCount; k++) plan.push({ id: rest[i++]!.id, status: "SAFE" });
  // shuffle order of arrival but keep it deterministic
  return plan.sort(() => r() - 0.5);
}

export const seedRoutes = (): EvacRoute[] => [
  { id: "east-b", name: "East Stairwell B", zh: "東側B樓梯", status: "BLOCKED", floors: "9–10F", verified: "RESIDENT" },
  { id: "west-a", name: "West Stairwell A", zh: "西側A樓梯", status: "OPEN", verified: "STAFF" },
  { id: "elev-1", name: "Elevator 1", zh: "1號電梯", status: "BLOCKED", floors: "All floors (unavailable)", verified: "STAFF" },
];

export const DORM = { lat: 25.0136, lng: 121.4637 };

export function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, d = Math.PI / 180;
  const x = Math.sin(((b.lat - a.lat) * d) / 2) ** 2 + Math.cos(a.lat * d) * Math.cos(b.lat * d) * Math.sin(((b.lng - a.lng) * d) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export const HOTLINES = [
  { n: "119", en: "Fire / Ambulance", zh: "消防／救護" },
  { n: "110", en: "Police", zh: "警察" },
  { n: "112", en: "International SOS", zh: "國際緊急求救" },
  { n: "1955", en: "Labor Hotline (24h, multilingual)", zh: "外籍勞工諮詢專線" },
  { n: "1999", en: "Citizen Hotline", zh: "市民當家熱線" },
  { n: "113", en: "Protection Hotline", zh: "保護專線" },
  { n: "165", en: "Anti-Fraud", zh: "反詐騙專線" },
  { n: "1925", en: "Mental Health Line", zh: "安心專線" },
];

export function counts(rs: Resident[]) {
  const c = { SAFE: 0, INSIDE: 0, HELP: 0, UNKNOWN: 0 } as Record<Status, number>;
  for (const x of rs) c[x.status]++;
  return c;
}

/** SOS first, then Need Help, then mobility-limited unknowns. */
export function priorityList(rs: Resident[]) {
  const score = (r: Resident) => (r.sos ? 0 : r.status === "HELP" ? 1 : r.mobility && r.status !== "SAFE" ? 2 : 9);
  return rs.filter((r) => score(r) < 9).sort((a, b) => score(a) - score(b) || a.room - b.room);
}
