import type React from "react";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import debris from "@/assets/debris-f9.jpg";
import {
  ME_ID, ROOMMATE_ID, seedResidents, seedRoutes, simulationPlan,
  type EvacRoute, type Report, type ReportStatus, type Resident, type RouteStatus, type Status,
} from "./dorm-data";
import { purgeExpired, type AccessRole, type LocationEvent } from "./privacy";

interface Building { name: string; address: string; floors: number; rooms: number }
export type QueuedAction = { kind: "checkin" | "sos" | "peer"; id: string; status?: Status | undefined; location?: string | undefined; at: number };

interface Store {
  residents: Resident[];
  routes: EvacRoute[];
  reports: Report[];
  building: Building;
  emergency: boolean;
  streaming: boolean;
  meId: string;
  roommateId: string;
  online: boolean;
  queue: QueuedAction[];
  lastSync?: number | undefined;
  setOffline: (off: boolean) => void;
  role: AccessRole;
  setRole: (r: AccessRole) => void;
  wardenFloor: number;
  retentionHours: number;
  setRetentionHours: (h: number) => void;
  locationEvents: LocationEvent[];
  accessLog: { at: number; role: AccessRole; what: string }[];
  logAccess: (what: string) => void;
  runPurge: (nowOverride?: number) => number;
  startRollCall: () => void;
  endEmergency: () => void;
  checkIn: (id: string, s: Status, location?: string) => void;
  sos: (id: string, location?: string) => void;
  peerConfirm: (id: string) => void;
  addReport: (r: Omit<Report, "id" | "at" | "status">) => void;
  setReportStatus: (id: string, s: ReportStatus) => void;
  setRoute: (id: string, s: RouteStatus) => void;
  verifyRoute: (id: string) => void;
  setBuilding: (b: Building) => void;
}

// Keep one context instance across hot reloads so the provider and consumers always match.
const g = globalThis as unknown as { __dormCtx?: React.Context<Store | null> };
const Ctx = (g.__dormCtx ??= createContext<Store | null>(null));
const QKEY = "dormsafe-offline-queue";

const now = Date.now();
const seedReports = (): Report[] => [
  { id: "rp1", category: "Gas Smell", floor: 6, area: "Corridor near Room 608 / Pantry", urgency: "Critical", description: "Strong gas smell near shared kitchen after shaking. 地震後共用廚房附近有強烈瓦斯味。", status: "NEW", at: now - 4 * 60000, by: "Resident R0412" },
  { id: "rp2", category: "Blocked Route/Staircase", floor: 9, area: "East Stairwell B, 9F–10F landing", urgency: "High", description: "Ceiling debris blocking stairs between 9F and 10F. 9-10樓之間天花板掉落阻擋樓梯。", photo: debris, status: "NEW", at: now - 2 * 60000, by: "Resident R0598" },
];

export function DormProvider({ children }: { children: ReactNode }) {
  const [residents, setResidents] = useState<Resident[]>(seedResidents);
  const [routes, setRoutes] = useState(seedRoutes);
  const [reports, setReports] = useState(seedReports);
  const [building, setBuilding] = useState<Building>({ name: "Dorm A 宿舍A棟", address: "新北市板橋區文化路一段 (New Taipei City)", floors: 12, rooms: 203 });
  const [emergency, setEmergency] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [forcedOffline, setForcedOffline] = useState(false);
  const [netOnline, setNetOnline] = useState(true);
  const [queue, setQueue] = useState<QueuedAction[]>([]);
  const [lastSync, setLastSync] = useState<number>();
  const [role, setRole] = useState<AccessRole>("COORDINATOR");
  const [retentionHours, setRetentionHours] = useState(72);
  const [locationEvents, setLocationEvents] = useState<LocationEvent[]>([]);
  const [accessLog, setAccessLog] = useState<Store["accessLog"]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const meId = ME_ID(residents);
  const roommateId = ROOMMATE_ID(residents);
  const online = netOnline && !forcedOffline;

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  // network + persisted queue
  useEffect(() => {
    setNetOnline(navigator.onLine);
    try { setQueue(JSON.parse(localStorage.getItem(QKEY) ?? "[]")); } catch { /* ignore */ }
    const on = () => setNetOnline(true), off = () => setNetOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  useEffect(() => { localStorage.setItem(QKEY, JSON.stringify(queue)); }, [queue]);

  const patch = (id: string, p: Partial<Resident>) =>
    setResidents((rs) => rs.map((r) => (r.id === id ? { ...r, ...p, updatedAt: p.updatedAt ?? Date.now() } : r)));

  const recordLocation = (id: string, location: string | undefined, at: number, kind: LocationEvent["kind"]) => {
    if (!location) return;
    setLocationEvents((ev) => [{ residentId: id, location, at, kind }, ...ev]);
  };

  const apply = (a: QueuedAction) => {
    if (a.kind === "checkin") { patch(a.id, { status: a.status!, provenance: "SELF", location: a.location, sos: false, updatedAt: a.at }); recordLocation(a.id, a.location, a.at, "CHECK_IN"); }
    if (a.kind === "sos") { patch(a.id, { status: "HELP", sos: true, provenance: "SELF", location: a.location, updatedAt: a.at }); recordLocation(a.id, a.location, a.at, "SOS"); }
    if (a.kind === "peer") patch(a.id, { status: "SAFE", provenance: "PEER_CONFIRMED", sos: false, updatedAt: a.at });
  };
  const dispatch = (a: QueuedAction) => (online ? apply(a) : setQueue((q) => [...q, a]));

  // auto-sync when connectivity returns
  useEffect(() => {
    if (online && queue.length) {
      queue.forEach(apply);
      setQueue([]);
      setLastSync(Date.now());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  const runPurge = (nowOverride?: number) => {
    const t = nowOverride ?? Date.now();
    const res = purgeExpired({ locationEvents, reports, residents }, retentionHours, t);
    setLocationEvents(res.locationEvents);
    setReports(res.reports);
    setResidents(res.residents);
    return res.removed;
  };
  // automatic retention enforcement every minute
  const purgeRef = useRef(runPurge);
  purgeRef.current = runPurge;
  useEffect(() => { const i = setInterval(() => purgeRef.current(), 60000); return () => clearInterval(i); }, []);

  const startRollCall = () => {
    if (timer.current) clearInterval(timer.current);
    const base = residents.map((r) => ({ ...r, status: "UNKNOWN" as Status, sos: false, provenance: undefined, updatedAt: undefined, location: undefined }));
    setResidents(base);
    setEmergency(true);
    setStreaming(true);
    const plan = simulationPlan(base, [meId, roommateId]);
    let i = 0;
    timer.current = setInterval(() => {
      const batch = plan.slice(i, i + 22);
      i += 22;
      const map = new Map(batch.map((b) => [b.id, b.status]));
      const t = Date.now();
      setResidents((rs) => rs.map((r) => {
        const s = map.get(r.id);
        return s && r.status === "UNKNOWN" ? { ...r, status: s, provenance: "SIM", updatedAt: t } : r;
      }));
      if (i >= plan.length) { clearInterval(timer.current!); timer.current = null; setStreaming(false); }
    }, 220);
  };

  const store: Store = {
    residents, routes, reports, building, emergency, streaming, meId, roommateId,
    online, queue, lastSync, setOffline: setForcedOffline,
    role, setRole, wardenFloor: 9, retentionHours, setRetentionHours, locationEvents, accessLog,
    logAccess: (what) => setAccessLog((l) => [{ at: Date.now(), role, what }, ...l].slice(0, 50)),
    runPurge,
    startRollCall,
    endEmergency: () => { if (timer.current) clearInterval(timer.current); setStreaming(false); setEmergency(false); },
    checkIn: (id, s, location) => dispatch({ kind: "checkin", id, status: s, location, at: Date.now() }),
    sos: (id, location) => dispatch({ kind: "sos", id, location, at: Date.now() }),
    peerConfirm: (id) => dispatch({ kind: "peer", id, at: Date.now() }),
    addReport: (r) => setReports((rs) => [{ ...r, id: `rp${Date.now()}`, at: Date.now(), status: "NEW" }, ...rs]),
    setReportStatus: (id, s) => setReports((rs) => rs.map((r) => (r.id === id ? { ...r, status: s } : r))),
    setRoute: (id, s) => setRoutes((rs) => rs.map((r) => (r.id === id ? { ...r, status: s, verified: "STAFF" } : r))),
    verifyRoute: (id) => setRoutes((rs) => rs.map((r) => (r.id === id ? { ...r, verified: "STAFF" } : r))),
    setBuilding,
  };
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useDorm() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDorm outside provider");
  return c;
}

