import type React from "react";
import { type ReactNode } from "react";
import { STATUS_META, type Status, type Tone } from "@/lib/dorm-data";
import { cn } from "@/lib/utils";

export const toneBg: Record<Tone, string> = {
  safe: "bg-safe/15 text-safe border-safe/30",
  inside: "bg-inside/15 text-inside border-inside/30",
  warn: "bg-warn/20 text-warn-foreground border-warn/40",
  danger: "bg-danger/15 text-danger border-danger/30",
  unknown: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ s, size = "md" }: { s: Status; size?: "sm" | "md" | "lg" }) {
  const m = STATUS_META[s];
  const sz = size === "lg" ? "px-3 py-1.5 text-base font-bold" : size === "sm" ? "px-1.5 py-0.5 text-xs font-semibold" : "px-2 py-1 text-sm font-semibold";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border", toneBg[m.tone], sz)}>
      <span className={cn("h-2 w-2 rounded-full", m.tone === "safe" ? "bg-safe" : m.tone === "inside" ? "bg-inside" : m.tone === "danger" ? "bg-danger animate-pulse" : "bg-muted-foreground")} />
      {m.emoji} {m.en}
    </span>
  );
}

export function Chip({ tone = "unknown", children }: { tone?: "safe" | "inside" | "warn" | "danger" | "unknown"; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", toneBg[tone])}>
      {children}
    </span>
  );
}

export function Card({ title, zh, action, children, className }: { title?: string; zh?: string | undefined; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border bg-card p-4 shadow-sm sm:p-5", className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2 border-b pb-2">
          {title && <h2 className="font-display text-base font-bold tracking-tight">{title}{zh && <span className="ml-1.5 text-sm font-medium text-muted-foreground">{zh}</span>}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, tone = "unknown" }: { label: string; value: ReactNode; sub?: string; tone?: "safe" | "inside" | "warn" | "danger" | "unknown" }) {
  const col = tone === "safe" ? "text-safe" : tone === "inside" ? "text-inside" : tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn-foreground" : "text-foreground";
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={cn("font-display text-2xl font-black", col)}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function ago(ts?: number) {
  if (!ts) return "—";
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 45) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}
