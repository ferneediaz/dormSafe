import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ClipboardCopy, FileText, Printer, RotateCcw, Siren, ShieldCheck, Square, UserCheck, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDorm } from "@/lib/dorm-store";
import { STATUS_META, counts, priorityList, type ReportStatus, type RouteStatus, type Status } from "@/lib/dorm-data";
import { Card, Chip, StatusBadge, ago, toneBg } from "@/components/dorm/ui";
import { cn } from "@/lib/utils";
import { useT, type TKey } from "@/lib/i18n";
import { ACCESS_PERMS, ROLE_META, can, type AccessRole } from "@/lib/privacy";
import { BuildingView } from "@/components/dorm/building3d/BuildingView";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "DormSafe — Coordinator Dashboard 管理端" },
      { name: "description", content: "Live headcount, floor accountability matrix, hazard inbox and 119 responder handoff for dorm coordinators." },
      { property: "og:title", content: "DormSafe — Coordinator Dashboard" },
      { property: "og:description", content: "Live dormitory headcount and responder handoff for Taiwan dorms." },
    ],
  }),
  component: AdminPage,
});

const TABS = [
  ["overview", "live"],
  ["reports", "reports"],
  ["roster", "roster"],
  ["building", "building"],
  ["privacy", "privacy"],
] as const satisfies readonly (readonly [string, TKey])[];

function AdminPage() {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("overview");
  const [handoff, setHandoff] = useState(false);
  const { reports, role, setRole, emergency, streaming, startRollCall, endEmergency } = useDorm();
  const { t } = useT();
  const newReports = reports.filter((r) => r.status === "NEW").length;
  return (
    <main className="mx-auto max-w-7xl space-y-4 px-4 py-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1">
          {TABS.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={cn("rounded-md px-3 py-1.5 text-sm font-medium", tab === k ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
              {t(l)}{k === "reports" && newReports > 0 && <span className="ml-1.5 rounded-full bg-danger px-1.5 text-xs text-danger-foreground">{newReports}</span>}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm">{t("role")}
          <select value={role} onChange={(e) => setRole(e.target.value as AccessRole)} className="rounded-md border bg-card px-2 py-1.5 text-sm">
            {(Object.keys(ROLE_META) as AccessRole[]).map((r) => <option key={r} value={r}>{ROLE_META[r].en} {ROLE_META[r].zh}</option>)}
          </select>
        </label>
        {ACCESS_PERMS[role].canTriggerRollCall && (
          <div className="flex gap-1">
            <button onClick={startRollCall} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              {emergency ? <RotateCcw className="h-4 w-4" /> : <Zap className="h-4 w-4" />} {t(emergency ? "restart" : "simulate")}
            </button>
            {emergency && (
              <button onClick={endEmergency} className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm font-semibold hover:bg-muted">
                <Square className="h-3.5 w-3.5" /> {t("endDrill")}{streaming && <span className="h-2 w-2 animate-pulse rounded-full bg-danger" />}
              </button>
            )}
          </div>
        )}
        <button onClick={() => setHandoff(true)} className=" inline-flex items-center gap-2 rounded-md bg-danger px-4 py-2 text-sm font-semibold text-danger-foreground hover:bg-danger/90">
          <FileText className="h-4 w-4" /> {t("handoff")}
        </button>
      </div>
      {tab === "overview" && <Overview />}
      {tab === "reports" && <Reports />}
      {tab === "roster" && (can(role, "viewContacts") ? <Roster /> : <Denied />)}
      {tab === "building" && (can(role, "manageBuilding") ? <BuildingCfg /> : <Denied />)}
      {tab === "privacy" && <PrivacyPanel />}
      <Handoff open={handoff} onOpenChange={setHandoff} />
    </main>
  );
}

function Overview() {
  const { residents: all, routes, setRoute, verifyRoute, emergency, role, wardenFloor } = useDorm();
  const { t } = useT();
  const residents = can(role, "viewAllFloors") ? all : all.filter((r) => r.floor === wardenFloor);
  const c = counts(residents);
  const canRoutes = can(role, "manageRoutes");
  const [floor, setFloor] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(can(role, "viewAllFloors") ? null : wardenFloor);
  const prio = priorityList(residents);
  const floors = useMemo(() => Array.from({ length: 12 }, (_, i) => 12 - i).filter((f) => residents.some((r) => r.floor === f)).map((f) => {
    const rs = residents.filter((r) => r.floor === f);
    return { f, total: rs.length, c: counts(rs), flags: rs.filter((r) => r.sos || r.status === "HELP" || (r.mobility && r.status !== "SAFE")).length };
  }), [residents]);

  const tiles: [string, number, string, string][] = [
    [t("total"), residents.length, "", "bg-primary text-primary-foreground"],
    [t("safeShort"), c.SAFE, "", toneBg.safe], [t("insideShort"), c.INSIDE, "", toneBg.warn],
    [t("helpShort"), c.HELP, "", toneBg.danger], [t("unacc"), c.UNKNOWN, "", toneBg.unknown],
  ];
  return (
    <div className="space-y-4">
      {!emergency && <p className="rounded-lg border border-dashed bg-card p-3 text-sm text-muted-foreground">{t("noEmergency")}</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {tiles.map(([l, n, zh, cls]) => (
          <div key={l} className={cn("rounded-xl p-4 shadow-sm", cls)}>
            <div className="text-xs font-medium uppercase tracking-wide opacity-90">{l}{zh}</div>
            <div className="font-display text-4xl font-bold tabular-nums">{n}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-4">
        <Card title={t("view3d")} zh={can(role, "viewAllFloors") ? undefined : `(${wardenFloor}F only)`}>
          <BuildingView residents={residents} selectedFloor={selected} onSelectFloor={setSelected} onOpenFloor={setFloor} />
        </Card>
        <Card title={t("matrix")} zh={can(role, "viewAllFloors") ? undefined : `(${wardenFloor}F only)`} action={<span className="text-xs text-muted-foreground">Click a floor 點選樓層</span>}>
          <div className="space-y-1.5">
            {floors.map(({ f, total, c, flags }) => (
              <button key={f} onClick={() => { setSelected(f); setFloor(f); }} className={cn("flex w-full items-center gap-3 rounded-lg border p-2 text-left hover:bg-muted", selected === f && "border-primary ring-1 ring-primary")}>
                <span className="w-10 font-display text-lg font-bold">{f}F</span>
                <div className="flex h-5 flex-1 overflow-hidden rounded bg-muted">
                  {(["SAFE", "INSIDE", "HELP", "UNKNOWN"] as Status[]).map((s) => (
                    <div key={s} className={toneBg[STATUS_META[s].tone]} style={{ width: `${(c[s] / total) * 100}%` }} title={`${STATUS_META[s].en}: ${c[s]}`} />
                  ))}
                </div>
                <span className="w-24 text-right text-xs"><strong className="tabular-nums">{c.UNKNOWN}</strong> unaccounted</span>
                <span className="w-20 text-right">{flags > 0 ? <Chip tone="danger">⚑ {flags} assist</Chip> : <span className="text-xs text-muted-foreground">—</span>}</span>
              </button>
            ))}
          </div>
        </Card>
        </div>

        <div className="space-y-4">
          <Card title={t("priority")}>
            {prio.length === 0 ? <p className="text-sm text-muted-foreground">No assistance flags. 目前無求助。</p> : (
              <ul className="max-h-72 space-y-2 overflow-auto">
                {prio.map((r) => (
                  <li key={r.id} className={cn("rounded-lg border p-2 text-sm", r.sos && "border-danger bg-danger/5")}>
                    <div className="flex items-center justify-between">
                      <strong>Room {r.room} · {r.name}</strong>
                      {r.sos ? <Chip tone="danger"><Siren className="mr-1 h-3 w-3" />SOS</Chip> : <StatusBadge s={r.status} />}
                    </div>
                    {r.mobility && <p className="mt-1 text-xs font-medium text-danger">♿ {r.mobility}</p>}
                    <p className="text-xs text-muted-foreground">{r.lang}{can(role, "viewContacts") && ` · ☎ ${r.contact}`}{can(role, "viewLocations") && r.location && ` · 📍 ${r.location}`}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={t("stairs")}>
            <ul className="space-y-3">
              {routes.map((r) => (
                <li key={r.id} className="text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{r.name} <span className="text-muted-foreground">{r.zh}</span></span>
                    {r.verified === "STAFF"
                      ? <span className="inline-flex items-center gap-1 text-xs text-safe"><ShieldCheck className="h-3 w-3" />Staff verified</span>
                      : <button disabled={!canRoutes} onClick={() => verifyRoute(r.id)} className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs text-warn-foreground hover:bg-muted"><UserCheck className="h-3 w-3" />Resident report · verify</button>}
                  </div>
                  {r.floors && <p className="text-xs text-muted-foreground">{r.floors}</p>}
                  <div className="mt-1 flex gap-1">
                    {(["OPEN", "BLOCKED", "UNKNOWN"] as RouteStatus[]).map((s) => (
                      <button key={s} disabled={!canRoutes} onClick={() => setRoute(r.id, s)} className={cn("flex-1 rounded border py-1 text-xs font-bold", r.status === s ? toneBg[s === "OPEN" ? "safe" : s === "BLOCKED" ? "danger" : "unknown"] : "hover:bg-muted")}>{s}</button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
      <FloorModal floor={floor} onClose={() => setFloor(null)} />
    </div>
  );
}

function FloorModal({ floor, onClose }: { floor: number | null; onClose: () => void }) {
  const { residents } = useDorm();
  const rooms = useMemo(() => {
    const m = new Map<number, typeof residents>();
    residents.filter((r) => r.floor === floor).forEach((r) => m.set(r.room, [...(m.get(r.room) ?? []), r]));
    return [...m.entries()];
  }, [residents, floor]);
  return (
    <Dialog open={floor !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-auto">
        <DialogHeader><DialogTitle>Floor {floor} · room-by-room 逐房狀態</DialogTitle></DialogHeader>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map(([room, rs]) => {
            const worst = rs.some((r) => r.status === "HELP") ? "danger" : rs.some((r) => r.status === "UNKNOWN") ? "unknown" : rs.some((r) => r.status === "INSIDE") ? "warn" : "safe";
            return (
              <div key={room} className="rounded-lg border p-2">
                <div className="mb-1 flex items-center justify-between"><strong>Room {room}</strong><Chip tone={worst}>{rs.length} beds</Chip></div>
                <ul className="space-y-1 text-xs">
                  {rs.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-1">
                      <span className="truncate">{r.mobility && "♿ "}{r.sos && "🆘 "}{r.name}</span>
                      <span title={STATUS_META[r.status].en}>{STATUS_META[r.status].emoji}{r.provenance === "PEER_CONFIRMED" && <span className="ml-1 text-[10px] text-muted-foreground">peer</span>}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Reports() {
  const { reports, setReportStatus, role } = useDorm();
  const next: Record<ReportStatus, ReportStatus[]> = { NEW: ["IN_PROGRESS"], IN_PROGRESS: ["RESOLVED", "VERIFIED"], RESOLVED: ["VERIFIED"], VERIFIED: [] };
  const tone = (s: ReportStatus) => (s === "NEW" ? "danger" : s === "IN_PROGRESS" ? "warn" : "safe");
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {reports.map((r) => (
        <Card key={r.id}>
          <div className="flex gap-3">
            {r.photo && (
              <figure className="w-36 shrink-0">
                <img src={r.photo} alt={`${r.category} photo`} loading="lazy" className="h-28 w-36 rounded-md object-cover" />
                {r.photoCredit && <figcaption className="mt-0.5 text-[9px] leading-tight text-muted-foreground">{r.photoCredit}</figcaption>}
              </figure>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip tone={r.urgency === "Critical" || r.urgency === "High" ? "danger" : "warn"}>{r.urgency}</Chip>
                <span className="rounded-full border px-2 py-0.5 text-xs font-medium">{r.category}</span>
                <Chip tone={tone(r.status)}>{r.status.replace("_", " ")}</Chip>
              </div>
              <p className="mt-1 font-semibold">{r.floor}F · {r.area}</p>
              <p className="text-sm">{r.description}</p>
              <p className="mt-1 text-xs text-muted-foreground">{r.by} · {ago(r.at)}</p>
              <div className="mt-2 flex gap-1.5">
                {can(role, "manageReports") && next[r.status].map((n) => (
                  <button key={n} onClick={() => setReportStatus(r.id, n)} className="rounded-md border px-2.5 py-1 text-xs font-semibold hover:bg-muted">→ {n.replace("_", " ")}</button>
                ))}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Roster() {
  const { residents } = useDorm();
  const [q, setQ] = useState("");
  const [vuln, setVuln] = useState(false);
  const list = residents.filter((r) => (!vuln || r.mobility) && (`${r.name} ${r.room} ${r.lang}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <Card title="Resident roster" zh="住民名冊" action={<span className="text-xs text-muted-foreground">{list.length} shown</span>}>
      <div className="mb-3 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name / room / language 搜尋" className="flex-1 rounded-md border bg-background px-3 py-2 text-sm" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={vuln} onChange={(e) => setVuln(e.target.checked)} /> Vulnerable only 弱勢住民</label>
      </div>
      <div className="max-h-[60vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground"><tr><th className="py-2">Room</th><th>Name</th><th>Language</th><th>Emergency contact</th><th>Notes</th><th>Status</th></tr></thead>
          <tbody>
            {list.slice(0, 200).map((r) => (
              <tr key={r.id} className="border-t">
                <td className="py-1.5 font-semibold">{r.room}</td><td>{r.name}</td><td>{r.lang}</td><td>{r.contact}</td>
                <td className="text-xs text-danger">{r.mobility}</td><td><StatusBadge s={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length > 200 && <p className="py-2 text-center text-xs text-muted-foreground">Showing first 200 — refine search.</p>}
      </div>
    </Card>
  );
}

function BuildingCfg() {
  const { building, setBuilding } = useDorm();
  const [b, setB] = useState(building);
  const [saved, setSaved] = useState(false);
  const f = "mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm";
  return (
    <Card title="Building configuration" zh="建築設定" className="max-w-xl">
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); setBuilding(b); setSaved(true); }}>
        <label className="block text-sm">Name 名稱<input className={f} value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} /></label>
        <label className="block text-sm">Address 地址<input className={f} value={b.address} onChange={(e) => setB({ ...b, address: e.target.value })} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">Floors 樓層<input type="number" className={f} value={b.floors} onChange={(e) => setB({ ...b, floors: +e.target.value })} /></label>
          <label className="block text-sm">Rooms 房間數<input type="number" className={f} value={b.rooms} onChange={(e) => setB({ ...b, rooms: +e.target.value })} /></label>
        </div>
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save 儲存</button>
        {saved && <span className="ml-3 text-sm text-safe">Saved</span>}
      </form>
    </Card>
  );
}

function Handoff({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { residents, routes, reports, building, role } = useDorm();
  const c = counts(residents);
  const showContact = can(role, "viewContacts");
  const help = priorityList(residents);
  const blocked = routes.filter((r) => r.status !== "OPEN");
  const hazards = reports.filter((r) => r.status !== "RESOLVED" && r.status !== "VERIFIED");
  const time = new Date().toLocaleTimeString("zh-TW", { hour12: false });
  const text = [
    `DORMSAFE RESPONDER HANDOFF 救援交接 — ${building.name} — ${time}`,
    `${building.address}`,
    `HEADCOUNT: ${residents.length} registered | ${c.SAFE} safe | ${c.INSIDE} inside | ${c.HELP} need help | ${c.UNKNOWN} UNACCOUNTED`,
    ``,
    `RESCUE / MOBILITY 需救援:`,
    ...(help.length ? help.map((r) => `- Room ${r.room} (${r.floor}F) ${r.name}${r.sos ? " [SOS]" : ""} — ${r.mobility ?? STATUS_META[r.status].en} — ${r.lang}${showContact ? ` — ${r.contact}` : ""}`) : ["- none reported"]),
    ``,
    `ROUTES 路線:`,
    ...routes.map((r) => `- ${r.name}: ${r.status}${r.floors ? ` (${r.floors})` : ""} [${r.verified === "STAFF" ? "staff verified" : "resident report"}]`),
    ``,
    `HAZARDS 危害:`,
    ...(hazards.length ? hazards.map((h) => `- F${h.floor} ${h.category} @ ${h.area} — ${h.urgency}`) : ["- none open"]),
  ].join("\n");
  const [copied, setCopied] = useState(false);
  const print = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<pre style="font:14px/1.5 monospace;white-space:pre-wrap">${text.replace(/</g, "&lt;")}</pre>`);
    w.document.close(); w.print();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-auto">
        <DialogHeader><DialogTitle>Responder handoff 119 救援交接</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className={cn("rounded-lg p-2", toneBg.unknown)}><div className="font-display text-3xl font-bold">{c.UNKNOWN}</div><div className="text-xs">Unaccounted 未回報</div></div>
          <div className={cn("rounded-lg p-2", toneBg.danger)}><div className="font-display text-3xl font-bold">{help.length}</div><div className="text-xs">Rescue rooms 需救援</div></div>
          <div className={cn("rounded-lg p-2", toneBg.warn)}><div className="font-display text-3xl font-bold">{blocked.length + hazards.length}</div><div className="text-xs">Blocked / hazards</div></div>
        </div>
        <pre className="whitespace-pre-wrap rounded-lg border bg-muted p-3 text-xs leading-relaxed">{text}</pre>
        <div className="flex gap-2">
          <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); }} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"><ClipboardCopy className="h-4 w-4" />{copied ? "Copied 已複製" : "Copy 複製"}</button>
          <button onClick={print} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold"><Printer className="h-4 w-4" />Print / PDF</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Denied() {
  const { t } = useT();
  return <p className="rounded-lg border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">🔒 {t("denied")}</p>;
}

function PrivacyPanel() {
  const { role, retentionHours, setRetentionHours, locationEvents, runPurge, residents } = useDorm();
  const [msg, setMsg] = useState("");
  const manage = can(role, "managePrivacy");
  const name = (id: string) => residents.find((r) => r.id === id);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Taiwan PDPA controls" zh="個人資料保護法">
        <ul className="space-y-2 text-sm">
          <li>📍 <strong>Event-based location only</strong> — captured solely at check-in or SOS, never continuous tracking. 僅於回報時記錄位置。</li>
          <li>🔐 <strong>Role-based access</strong> — contacts and health notes limited by role. 依角色限制存取。</li>
          <li>🗑️ <strong>Automatic retention</strong> — location events, reports and stored locations are deleted after the retention window (checked every minute). 逾期自動刪除。</li>
        </ul>
        <div className="mt-4 rounded-lg border p-3">
          <label className="text-sm font-medium">Retention window 保存期限
            <select disabled={!manage} value={retentionHours} onChange={(e) => setRetentionHours(+e.target.value)} className="ml-2 rounded-md border bg-background px-2 py-1">
              {[24, 72, 168, 720].map((h) => <option key={h} value={h}>{h < 168 ? `${h} h` : `${h / 24} days`}</option>)}
            </select>
          </label>
          {manage ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => setMsg(`Purged ${runPurge()} expired records`)} className="rounded-md border px-3 py-1.5 text-sm font-semibold hover:bg-muted">Run purge now</button>
              <button onClick={() => setMsg(`Simulated +${retentionHours + 1}h: purged ${runPurge(Date.now() + (retentionHours + 1) * 3600_000)} records`)} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">Fast-forward past retention (demo)</button>
            </div>
          ) : <p className="mt-2 text-xs text-muted-foreground">Only coordinators can change retention.</p>}
          {msg && <p className="mt-2 text-sm text-safe">{msg}</p>}
        </div>
      </Card>
      <Card title="Role permissions" zh="角色權限">
        <table className="w-full text-xs">
          <thead><tr className="text-left text-muted-foreground"><th className="py-1">Role</th><th>Floors</th><th>Contacts</th><th>Locations</th><th>Settings</th></tr></thead>
          <tbody>
            {(Object.keys(ROLE_META) as AccessRole[]).map((r) => (
              <tr key={r} className={cn("border-t", r === role && "bg-muted font-semibold")}>
                <td className="py-1.5">{ROLE_META[r].en} {ROLE_META[r].zh}</td>
                <td>{can(r, "viewAllFloors") ? "All" : "Own"}</td><td>{can(r, "viewContacts") ? "✓" : "—"}</td>
                <td>{can(r, "viewLocations") ? "✓" : "—"}</td><td>{can(r, "managePrivacy") ? "✓" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted-foreground">{ROLE_META[role].desc}</p>
      </Card>
      <Card title="Location capture log" zh="位置紀錄" className="lg:col-span-2">
        {!can(role, "viewLocations") ? <Denied /> : locationEvents.length === 0 ? <p className="text-sm text-muted-foreground">No location events stored. 無紀錄。</p> : (
          <ul className="max-h-64 space-y-1 overflow-auto text-sm">
            {locationEvents.map((e, i) => (
              <li key={i} className="flex justify-between border-b py-1"><span>{e.kind} · {name(e.residentId)?.name} · {e.location}</span><span className="text-xs text-muted-foreground">{new Date(e.at).toLocaleString("zh-TW")} · expires in {retentionHours}h</span></li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
