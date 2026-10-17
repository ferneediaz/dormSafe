import { Link } from "@tanstack/react-router";
import { AlertTriangle, Globe, Wifi, WifiOff } from "lucide-react";
import { AlertBanner } from "./AlertBanner";
import { useDorm } from "@/lib/dorm-store";
import { DORM } from "@/lib/dorm-data";
import { LANGS, useT } from "@/lib/i18n";
import { ACCESS_PERMS, ROLES, type AccessRole } from "@/lib/privacy";

export function AppHeader() {
  const { emergency, online, setOffline, queue, role, setRole } = useDorm();
  const { t, lang, setLang } = useT();

  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-black tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-black">DS</span>
          <span>DormSafe <span className="text-xs font-normal text-muted-foreground hidden sm:inline">宿安</span></span>
        </Link>

        {emergency && (
          <span className="flex items-center gap-1.5 rounded-full bg-danger px-3 py-1 text-xs font-bold text-danger-foreground animate-pulse">
            <AlertTriangle className="h-3.5 w-3.5" /> {t("activeAlert")}
          </span>
        )}

        <div className="flex items-center gap-2">
          {/* Role switcher for the hackathon / demo */}
          <label className="text-xs text-muted-foreground hidden md:flex items-center gap-1">
            <span className="font-semibold text-foreground">Role:</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AccessRole)}
              className="rounded border bg-background px-1.5 py-0.5 text-xs text-foreground font-medium"
              title={ACCESS_PERMS[role].description}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>

          {/* Network toggle for testing offline queue */}
          <button
            onClick={() => setOffline(online)}
            title={online ? "Click to simulate offline network" : "Click to reconnect and sync"}
            className="flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium hover:bg-muted"
          >
            {online ? (
              <><Wifi className="h-3 w-3 text-safe" /><span className="hidden sm:inline">Online</span></>
            ) : (
              <><WifiOff className="h-3 w-3 text-warn-foreground" /><span className="font-semibold text-warn-foreground">{queue.length ? `${queue.length}q` : "Offline"}</span></>
            )}
          </button>

          {/* 4-language switcher */}
          <div className="flex items-center gap-1 rounded-md border bg-background p-0.5 text-xs">
            <Globe className="h-3 w-3 ml-1 text-muted-foreground" />
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={`rounded px-1.5 py-0.5 font-medium transition ${lang === l.code ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                title={l.label}
              >
                {l.flag} <span className="hidden sm:inline">{l.label.split(" ")[0]}</span>
              </button>
            ))}
          </div>

          <nav className="flex gap-1 text-xs font-semibold">
            <Link to="/" className="rounded-md px-2.5 py-1 text-muted-foreground hover:bg-muted [&.active]:bg-primary [&.active]:text-primary-foreground">{t("resident")}</Link>
            <Link to="/admin" className="rounded-md px-2.5 py-1 text-muted-foreground hover:bg-muted [&.active]:bg-primary [&.active]:text-primary-foreground">{t("coordinator")}</Link>
          </nav>
        </div>
      </div>
      <AlertBanner lat={DORM.lat} lng={DORM.lng} />
    </header>
  );
}
