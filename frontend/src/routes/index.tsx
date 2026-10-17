import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Camera, MapPin, Phone, Siren, Users, Navigation } from "lucide-react";
import { useDorm } from "@/lib/dorm-store";
import { CATEGORIES, DORM, HOTLINES, STATUS_META, type Status } from "@/lib/dorm-data";
import { useQuery } from "@tanstack/react-query";
import { DISASTER_TYPES, fetchShelters, type DisasterType } from "@/lib/external-api";
import { Card, Chip, StatusBadge, toneBg, ago } from "@/components/dorm/ui";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DormSafe — Resident Check-in 住民安全回報" },
      { name: "description", content: "One-tap emergency check-in, SOS, hazard reporting, shelters and Taiwan hotlines for dorm residents." },
      { property: "og:title", content: "DormSafe — Resident Check-in" },
      { property: "og:description", content: "One-tap emergency check-in, SOS and hazard reporting for Taiwan dormitories." },
    ],
  }),
  component: ResidentPage,
});

function ResidentPage() {
  const { residents, meId, roommateId, checkIn, sos, peerConfirm, routes, queue } = useDorm();
  const queued = queue.length;
  const me = residents.find((r) => r.id === meId)!;
  const mate = residents.find((r) => r.id === roommateId)!;
  const { t } = useT();
  // Optional: only needed when the resident is somewhere other than their own room.
  const [where, setWhere] = useState("");
  const loc = where.trim() || `Room ${me.room}, ${me.floor}F`;

  return (
    <main className="mx-auto grid max-w-5xl gap-4 px-4 py-5 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Dorm A · Room {me.room} · {me.floor}F</p>
              <h1 className="text-2xl font-bold">{t("hi")}, {me.name}</h1>
            </div>
            <div className="text-right">
              <StatusBadge s={me.status} />
              <p className="mt-1 text-xs text-muted-foreground">{me.provenance ? `${me.provenance} · ${ago(me.updatedAt)}` : t("notReported")}</p>
            </div>
          </div>

          <h2 className="mt-4 text-sm font-semibold">{t("checkin")}</h2>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(["SAFE", "INSIDE", "HELP"] as Status[]).map((s) => {
              const m = STATUS_META[s];
              return (
                <button key={s} onClick={() => checkIn(me.id, s, loc)}
                  className={cn("rounded-xl border-2 p-3 text-left transition active:scale-[.98]", me.status === s ? cn(toneBg[m.tone], "border-transparent") : "bg-card hover:bg-muted")}>
                  <div className="text-2xl">{m.emoji}</div>
                  <div className="font-semibold">{t(s)}</div>
                </button>
              );
            })}
          </div>
          <label className="mt-3 flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <input value={where} onChange={(e) => setWhere(e.target.value)} placeholder={t("locPlaceholder")} className="w-full bg-transparent outline-none placeholder:text-muted-foreground" aria-label="Current location" />
          </label>
          <p className="mt-1 text-xs text-muted-foreground">🔒 {t("locNote")}</p>
          {queued > 0 && <p className="mt-1 text-xs font-semibold text-warn-foreground">⏳ {queued} {t("queued")}</p>}

          <button onClick={() => sos(me.id, loc)} className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl bg-danger py-5 text-xl font-bold text-danger-foreground shadow-lg hover:bg-danger/90 active:scale-[.99]">
            <Siren className="h-7 w-7" /> {t("sos")}
          </button>
          {me.sos && <p className="mt-2 text-center text-sm font-semibold text-danger">{t("sosSent")}</p>}

          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border bg-muted/50 p-3">
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-5 w-5" />
              <div><div className="font-medium">{t("roommate")}: {mate.name}</div><StatusBadge s={mate.status} /></div>
            </div>
            <button onClick={() => peerConfirm(mate.id)} className="rounded-md bg-safe px-3 py-2 text-sm font-semibold text-safe-foreground">{t("peer")}</button>
          </div>
        </Card>

        <ReportForm defaultFloor={me.floor} />
      </div>

      <aside className="space-y-4">
        <Card title={t("routes")}>
          <ul className="space-y-2 text-sm">
            {routes.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <span>{r.name} <span className="text-muted-foreground">{r.zh}</span>{r.floors && <span className="block text-xs text-muted-foreground">{r.floors}</span>}</span>
                <Chip tone={r.status === "OPEN" ? "safe" : r.status === "BLOCKED" ? "danger" : "unknown"}>{r.status}</Chip>
              </li>
            ))}
          </ul>
        </Card>
        <Card title={t("numbers")}>
          <div className="grid grid-cols-2 gap-2">
            {HOTLINES.map((h) => (
              <a key={h.n} href={`tel:${h.n}`} className={cn("rounded-lg border p-2 hover:bg-muted", h.n === "119" && "border-danger bg-danger/5")}>
                <div className="flex items-center gap-1 font-display text-xl font-bold"><Phone className="h-4 w-4" />{h.n}</div>
                <div className="text-xs leading-tight">{h.en}</div>
                <div className="text-xs text-muted-foreground">{h.zh}</div>
              </a>
            ))}
          </div>
        </Card>
        <Shelters />
      </aside>
    </main>
  );
}

function Shelters() {
  const { t } = useT();
  const [radius, setRadius] = useState(3);
  const [type, setType] = useState<DisasterType | "all">("earthquake");
  const { data, isLoading } = useQuery({ queryKey: ["nfa-shelters", radius], queryFn: () => fetchShelters(DORM.lat, DORM.lng, radius) });
  const list = (data?.items ?? []).filter((s) => type === "all" || s.disasterTypes.includes(type));
  return (
    <Card title={t("shelters")}>
      <p className="-mt-2 mb-2 text-xs text-muted-foreground">{data ? `${data.source} · ${data.provenance.toUpperCase()}` : "NFA 73242"}</p>
      <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
        <label>{t("disasterType")}
          <select value={type} onChange={(e) => setType(e.target.value as DisasterType | "all")} className="mt-1 w-full rounded-md border bg-background px-2 py-1.5">
            <option value="all">{t("all")}</option>
            {DISASTER_TYPES.map((d) => <option key={d} value={d}>{t(d)}</option>)}
          </select>
        </label>
        <label>{t("radius")}: {radius} km
          <input type="range" min={1} max={10} value={radius} onChange={(e) => setRadius(+e.target.value)} className="mt-2 w-full" />
        </label>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">…</p> : list.length === 0 ? <p className="text-sm text-muted-foreground">{t("noShelters")}</p> : (
        <ul className="space-y-3">
          {list.map((s) => (
            <li key={s.id} className="rounded-lg border p-2.5 text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{s.name}</span>
                <span className="shrink-0 font-display font-bold">{s.distanceKm.toFixed(1)} km</span>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">{s.address}</div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {s.disasterTypes.map((d) => <span key={d} className="rounded-full border px-1.5 text-[11px]">{t(d)}</span>)}
                {s.vulnerableFriendly && <Chip tone="safe">♿ {t("vulnerableOk")}</Chip>}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 text-xs">
                <span>{t("capacity")} {s.capacity.toLocaleString()}</span>
                {s.phone && <a href={`tel:${s.phone}`} className="underline">☎ {s.phone}</a>}
              </div>
              <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}`} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary underline">
                <Navigation className="h-3 w-3" /> {t("maps")}
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ReportForm({ defaultFloor }: { defaultFloor: number }) {
  const { addReport } = useDorm();
  const { t } = useT();
  const [cat, setCat] = useState(CATEGORIES[0]!.en);
  const [floor, setFloor] = useState(defaultFloor);
  const [area, setArea] = useState("");
  const [urgency, setUrgency] = useState<"Low" | "Medium" | "High" | "Critical">("High");
  const [desc, setDesc] = useState("");
  const [photo, setPhoto] = useState<string>();
  const [sent, setSent] = useState(false);

  const onFile = (f?: File) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setPhoto(r.result as string);
    r.readAsDataURL(f);
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    addReport({ category: cat, floor, area: area || "—", urgency, description: desc, photo, by: "Resident (you)" });
    setSent(true); setArea(""); setDesc(""); setPhoto(undefined);
    setTimeout(() => setSent(false), 3000);
  };
  const field = "w-full rounded-md border bg-background px-3 py-2 text-sm";
  return (
    <Card title={t("report")}>
      <form onSubmit={submit} className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button type="button" key={c.en} onClick={() => setCat(c.en)} className={cn("rounded-full border px-3 py-1 text-xs font-medium", cat === c.en ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
              {c.en} {c.zh}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="text-xs">{t("floor")}<select className={field} value={floor} onChange={(e) => setFloor(+e.target.value)}>{Array.from({ length: 12 }, (_, i) => i + 1).map((f) => <option key={f}>{f}</option>)}</select></label>
          <label className="col-span-2 text-xs">{t("area")}<input className={field} value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. 9F east stairwell" /></label>
        </div>
        <div className="flex gap-1.5">
          {(["Low", "Medium", "High", "Critical"] as const).map((u) => (
            <button type="button" key={u} onClick={() => setUrgency(u)} className={cn("flex-1 rounded-md border py-1.5 text-xs font-semibold", urgency === u && (u === "Critical" || u === "High" ? "bg-danger text-danger-foreground" : "bg-warn text-warn-foreground"))}>{u}</button>
          ))}
        </div>
        <textarea required className={field} rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t("describe")} />
        <div className="flex items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
            <Camera className="h-4 w-4" /> {t("photo")}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          {photo && <img src={photo} alt="Report preview" className="h-14 w-20 rounded object-cover" />}
        </div>
        <button className="w-full rounded-md bg-primary py-2.5 font-semibold text-primary-foreground">{t("submit")}</button>
        {sent && <p className="text-center text-sm font-medium text-safe">{t("sent")}</p>}
      </form>
    </Card>
  );
}
