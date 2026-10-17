import { useState } from "react";
import { AlertOctagon, ChevronDown, ChevronUp, ExternalLink, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchAlerts, type AlertItem } from "@/lib/external-api";
import { ago } from "./ui";
import { useT } from "@/lib/i18n";

export function AlertBanner({ lat, lng }: { lat: number; lng: number }) {
  void lat; void lng;
  const [open, setOpen] = useState(false);
  const { t } = useT();
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["ncdr-alerts"],
    queryFn: fetchAlerts,
    refetchInterval: 60000,
  });

  const alerts = data?.items ?? [];
  const top = alerts[0];
  if (!top && !isLoading) return null;

  return (
    <aside aria-label="Taiwan disaster emergency banner" className="border-b bg-danger/10 text-danger-foreground">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2 text-xs">
        <div className="flex min-w-0 items-center gap-2">
          <AlertOctagon className="h-4 w-4 shrink-0 text-danger animate-pulse" />
          <span className="rounded bg-danger px-1.5 py-0.5 font-bold uppercase tracking-wider text-[10px] text-danger-foreground">
            {top?.severity ?? "ALERT"}
          </span>
          <span className="font-semibold truncate">
            {top ? `${top.eventType}: ${top.headline}` : t("loadingAlerts")}
          </span>
          {top?.areas && top.areas.length > 0 && (
            <span className="hidden md:inline rounded bg-danger/20 px-1 text-[11px]">
              {top.areas.slice(0, 3).join(", ")}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden sm:inline text-muted-foreground text-[11px]" title={`Source: ${data?.source} (${data?.provenance})`}>
            {data ? `${data.source} · ${data.provenance.toUpperCase()}${top?.sent ? ` · ${ago(Date.parse(top.sent))}` : ""}` : "NCDR CAP"}
          </span>
          <button
            onClick={() => refetch()}
            className="rounded p-1 hover:bg-danger/20"
            title="Refresh NCDR feed"
            aria-label="Refresh alerts"
          >
            <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
          </button>
          {alerts.length > 1 && (
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-0.5 rounded px-1.5 py-0.5 hover:bg-danger/20 font-medium"
              aria-expanded={open}
            >
              +{alerts.length - 1} {t("moreAlerts")} {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
        </div>
      </div>
      {open && alerts.length > 1 && (
        <div className="border-t border-danger/20 bg-danger/5 px-4 py-2 text-xs">
          <div className="mx-auto max-w-5xl space-y-1.5">
            {alerts.slice(1).map((a: AlertItem) => (
              <div key={a.id} className="flex items-center justify-between gap-2">
                <div className="truncate">
                  <span className="font-semibold">{a.eventType}</span> — {a.headline}
                  {a.areas?.length > 0 && <span className="text-muted-foreground"> ({a.areas.join(", ")})</span>}
                </div>
                <span className="text-muted-foreground shrink-0">{a.sent ? ago(Date.parse(a.sent)) : ""}</span>
              </div>
            ))}
            <div className="pt-1 text-[11px] text-muted-foreground flex items-center gap-2">
              <span>National Science and Technology Center for Disaster Reduction (NCDR) Atom CAP</span>
              <a
                href="https://alerts.ncdr.nat.gov.tw/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 underline hover:text-foreground"
              >
                alerts.ncdr.nat.gov.tw <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
