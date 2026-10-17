import {
  Suspense,
  lazy,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { DoorOpen, X } from "lucide-react";
import { useDorm } from "@/lib/dorm-store";
import type { Resident } from "@/lib/dorm-data";
import { useT, type TKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { focusFloor, sceneFloors, sceneMarkers, sceneRoutes } from "./adapter";
import type { ViewMode } from "./types";

// three.js is large and needs WebGL: load it on the client only, after first paint.
const BuildingScene = lazy(() => import("./BuildingScene"));

const MODES = [
  ["exterior", "viewExterior"],
  ["xray", "viewXray"],
  ["exploded", "viewExploded"],
  ["plan", "viewPlan"],
] as const satisfies readonly (readonly [ViewMode, TKey])[];

const LEGEND = [
  ["#22c55e", "SAFE"],
  ["#f59e0b", "INSIDE"],
  ["#ef4444", "HELP"],
  ["#64748b", "UNKNOWN"],
] as const satisfies readonly (readonly [string, TKey])[];

/**
 * Live 3D model of the dorm for the coordinator: window glow per room status, help beacons,
 * hazard pulses and stairwell status. Selecting a floor here (or in the matrix) cuts the building open.
 */
export function BuildingView({
  residents,
  selectedFloor,
  onSelectFloor,
  onOpenFloor,
}: {
  residents: Resident[];
  selectedFloor: number | null;
  onSelectFloor: (floor: number | null) => void;
  onOpenFloor: (floor: number) => void;
}) {
  const { routes, reports } = useDorm();
  const { t } = useT();
  const [mode, setMode] = useState<ViewMode>("exterior");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Roll call streams check-ins every ~200ms; let the scene lag a frame behind instead of blocking input.
  const live = useDeferredValue(residents);
  const floors = useMemo(() => sceneFloors(live), [live]);
  const markers = useMemo(() => sceneMarkers(live, reports), [live, reports]);
  const stairs = useMemo(() => sceneRoutes(routes), [routes]);
  const focus = useMemo(() => focusFloor(floors, markers), [floors, markers]);
  const safe = useMemo(
    () => live.filter((r) => r.status === "SAFE").length,
    [live],
  );

  const shown = mode === "plan" ? (selectedFloor ?? focus) : selectedFloor;
  const info = shown ? floors[shown - 1] : undefined;
  const beds = shown ? live.filter((r) => r.floor === shown).length : 0;

  return (
    <div className="relative isolate h-[440px] overflow-hidden rounded-xl bg-[#0b1220] sm:h-[520px]">
      {mounted ? (
        <Suspense fallback={<SceneFallback label={t("loading3d")} />}>
          <BuildingScene
            floors={floors}
            markers={markers}
            routes={stairs}
            mode={mode}
            selectedFloor={selectedFloor}
            focusFloor={focus}
            safeCount={safe}
            onSelectFloor={onSelectFloor}
          />
        </Suspense>
      ) : (
        <SceneFallback label={t("loading3d")} />
      )}

      <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
        <div className="pointer-events-auto flex rounded-lg border border-white/10 bg-slate-950/80 p-0.5 backdrop-blur">
          {MODES.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setMode(k)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-semibold transition",
                mode === k
                  ? "bg-sky-400 text-slate-950"
                  : "text-slate-300 hover:bg-white/10 hover:text-white",
              )}
            >
              {t(label)}
            </button>
          ))}
        </div>

        {info ? (
          <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/80 py-1 pl-3 pr-1 text-xs text-slate-200 backdrop-blur">
            <span className="font-display text-sm font-bold text-white">
              {info.level}F
            </span>
            <span className="tabular-nums">{beds} beds</span>
            <span className="tabular-nums text-slate-400">
              · {info.unknown} unaccounted
            </span>
            {info.help > 0 && (
              <span className="font-semibold tabular-nums text-red-400">
                · {info.help} help
              </span>
            )}
            <button
              onClick={() => onOpenFloor(info.level)}
              className="ml-1 inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 font-semibold text-white hover:bg-white/20"
            >
              <DoorOpen className="h-3 w-3" />
              {t("roomList")}
            </button>
            {selectedFloor !== null && (
              <button
                onClick={() => onSelectFloor(null)}
                aria-label="Clear floor selection"
                className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : (
          <span className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-1.5 text-xs text-slate-300 backdrop-blur">
            {t("tapFloor")}
          </span>
        )}
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-x-3 gap-y-1 rounded-lg border border-white/10 bg-slate-950/75 px-3 py-1.5 text-[11px] text-slate-300 backdrop-blur">
        {LEGEND.map(([color, key]) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-sm"
              style={{ background: color }}
            />
            {t(key)}
          </span>
        ))}
      </div>
    </div>
  );
}

function SceneFallback({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
      <span className="animate-pulse">{label}</span>
    </div>
  );
}
