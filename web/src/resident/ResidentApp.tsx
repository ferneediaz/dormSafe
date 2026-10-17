import { useEffect, useMemo, useRef, useState } from 'react';
import { actions, latestStatus, useStore } from '../data/store';
import { EMERGENCY_NUMBERS, compressImage, getLocation, haversineKm, knownLocation, mapsLink, primeLocation, timeAgo } from '../data/external';
import type { ReportCategory, StatusValue } from '../data/types';

type Tab = 'home' | 'report' | 'shelters' | 'call';

export const STATUS_LABEL: Record<StatusValue, string> = {
  safe: 'Safe / evacuated',
  inside: 'Safe, still inside',
  need_help: 'Need help',
  unknown: 'Not checked in',
  out: 'Out of dorm',
};

export default function ResidentApp({ residentId }: { residentId: string }) {
  const s = useStore();
  const me = s.residents.find((r) => r.id === residentId);
  const [tab, setTab] = useState<Tab>('home');
  useEffect(() => primeLocation(), []);
  const [toast, setToast] = useState('');
  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 2500);
  };

  if (!me) return <div className="card" style={{ margin: 24 }}>Resident not found. <a href="#/">Back</a></div>;

  return (
    <div className="phone">
      <header className="phone-head">
        <a href="#/" className="back">‹</a>
        <div>
          <div className="phone-title">{s.building.name} · Room {me.room}</div>
          <div className="muted small">{me.name}</div>
        </div>
        <span className={`dot dot-${latestStatus(s, me.id)}`} title={STATUS_LABEL[latestStatus(s, me.id)]} />
      </header>

      {s.rollCall?.active && (
        <div className="banner banner-danger">
          <b>⚠ {s.alert?.title ?? s.rollCall.reason}</b>
          <div className="small">Roll call in progress. Tell your dorm admin you're safe.</div>
        </div>
      )}
      {s.announcements[0] && (
        <div className="banner banner-info small">📢 {s.announcements[0].text} <span className="muted">· {timeAgo(s.announcements[0].at)}</span></div>
      )}

      <main className="phone-body">
        {tab === 'home' && <Home residentId={me.id} flash={flash} />}
        {tab === 'report' && <ReportForm residentId={me.id} flash={flash} done={() => setTab('home')} />}
        {tab === 'shelters' && <Shelters />}
        {tab === 'call' && <Numbers />}
      </main>

      <nav className="tabbar">
        {([
          ['home', '🏠', 'Status'],
          ['report', '📝', 'Report'],
          ['shelters', '⛺', 'Shelters'],
          ['call', '📞', 'Call'],
        ] as [Tab, string, string][]).map(([t, icon, label]) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </nav>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Home({ residentId, flash }: { residentId: string; flash: (m: string) => void }) {
  const s = useStore();
  const me = s.residents.find((r) => r.id === residentId)!;
  const mine = s.statuses[me.id];
  const roommates = s.residents.filter((r) => r.room === me.room && r.id !== me.id);
  const [busy, setBusy] = useState(false);

  const set = async (status: StatusValue, note?: string) => {
    setBusy(true);
    const loc = knownLocation();
    actions.setStatus(me.id, { status, source: 'self', note, lat: loc?.lat, lon: loc?.lon });
    setTimeout(() => setBusy(false), 300);
    flash(status === 'need_help' ? 'Help request sent to dorm admins' : 'Status sent ✓');
  };

  return (
    <>
      <section className="card">
        <div className="muted small">My status</div>
        <div className={`status-big st-${mine?.status ?? 'unknown'}`}>{STATUS_LABEL[mine?.status ?? 'unknown']}</div>
        {mine && <div className="muted small">Updated {timeAgo(mine.at)} · {mine.source === 'self' ? 'by you' : `${mine.source} confirmed`}{mine.lat ? ' · location shared' : ''}</div>}
      </section>

      <section className="checkin">
        <button disabled={busy} className="big big-safe" onClick={() => set('safe')}>✅ I'm safe<small>evacuated / outside</small></button>
        <button disabled={busy} className="big big-inside" onClick={() => set('inside')}>🟡 Safe, still inside<small>not in danger</small></button>
        <button disabled={busy} className="big big-help" onClick={() => set('need_help', me.vulnerableNote)}>🔴 I need help<small>injured / trapped / can't use stairs</small></button>
      </section>

      <SosButton onFire={() => set('need_help', 'SOS')} />

      {roommates.length > 0 && (
        <section className="card">
          <h3>Roommates</h3>
          <p className="muted small">Are they with you? Confirm them so admins can stop searching.</p>
          {roommates.map((r) => {
            const st = latestStatus(s, r.id);
            return (
              <div key={r.id} className="row">
                <span className={`dot dot-${st}`} />
                <span className="grow">{r.name}<div className="muted small">{STATUS_LABEL[st]}{s.statuses[r.id]?.source === 'peer' ? ' (peer confirmed)' : ''}</div></span>
                {st === 'unknown' && (
                  <button className="btn btn-sm" onClick={() => { actions.setStatus(r.id, { status: 'safe', source: 'peer', by: me.id }); flash(`${r.name.split(' ')[0]} confirmed safe`); }}>
                    With me & safe
                  </button>
                )}
              </div>
            );
          })}
        </section>
      )}

      {!s.rollCall?.active && (
        <section className="card">
          <h3>In / out</h3>
          <div className="row gap">
            <button className="btn grow" onClick={() => { actions.setStatus(me.id, { status: 'out', source: 'self' }); flash('Marked as out of dorm'); }}>🚶 Leaving dorm</button>
            <button className="btn grow" onClick={() => { actions.setStatus(me.id, { status: 'inside', source: 'self' }); flash('Welcome back'); }}>🏠 I'm back</button>
          </div>
        </section>
      )}
    </>
  );
}

function SosButton({ onFire }: { onFire: () => void }) {
  const [p, setP] = useState(0);
  const timer = useRef<number | null>(null);
  const start = () => {
    const t0 = Date.now();
    timer.current = window.setInterval(() => {
      const v = Math.min(1, (Date.now() - t0) / 1500);
      setP(v);
      if (v >= 1) {
        stop();
        onFire();
      }
    }, 30);
  };
  const stop = () => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    setP(0);
  };
  return (
    <button
      className="sos"
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      style={{ background: `linear-gradient(90deg, #7f1d1d ${p * 100}%, var(--help) ${p * 100}%)` }}
    >
      SOS · hold 1.5s
    </button>
  );
}

const CATS: [ReportCategory, string][] = [
  ['fire', '🔥 Fire'], ['smoke', '💨 Smoke'], ['gas', '⛽ Gas smell'], ['leak', '💧 Water leak'],
  ['electrical', '⚡ Electrical'], ['structural', '🧱 Structural damage'], ['blocked_route', '🚧 Blocked stairs / exit'],
  ['injury', '🩹 Someone injured'], ['broken', '🔧 Needs fixing'], ['other', '❓ Other'],
];
const EMERGENCY_CATS: ReportCategory[] = ['fire', 'smoke', 'gas', 'structural', 'blocked_route', 'injury'];

function ReportForm({ residentId, flash, done }: { residentId: string; flash: (m: string) => void; done: () => void }) {
  const s = useStore();
  const me = s.residents.find((r) => r.id === residentId)!;
  const [cat, setCat] = useState<ReportCategory | null>(null);
  const [floor, setFloor] = useState(me.floor);
  const [room, setRoom] = useState(me.room);
  const [desc, setDesc] = useState('');
  const [routeId, setRouteId] = useState('');
  const routeOpts = s.routes.filter((r) => floor >= r.floorFrom && floor <= r.floorTo);
  const pickedRoute = routeOpts.find((r) => r.id === routeId) ?? routeOpts[0];
  const [photo, setPhoto] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const mine = s.reports.filter((r) => r.residentId === me.id);

  const submit = async () => {
    if (!cat) return;
    setSending(true);
    const loc = knownLocation();
    actions.addReport({
      residentId: me.id, category: cat, description: desc, photo, floor, room,
      routeId: cat === 'blocked_route' ? pickedRoute?.id : undefined,
      urgency: EMERGENCY_CATS.includes(cat) ? 'emergency' : 'normal',
      lat: loc?.lat, lon: loc?.lon,
    });
    setSending(false);
    flash('Report sent to dorm admins');
    done();
  };

  return (
    <>
      <section className="card">
        <h3>What's the problem?</h3>
        <div className="chips">
          {CATS.map(([c, l]) => (
            <button key={c} className={`chip ${cat === c ? 'on' : ''} ${EMERGENCY_CATS.includes(c) ? 'chip-em' : ''}`} onClick={() => setCat(c)}>{l}</button>
          ))}
        </div>
      </section>
      {cat && (
        <section className="card form">
          {cat === 'blocked_route' && (
            <label className="field"><span>Which route?</span>
              <select value={pickedRoute?.id ?? ''} onChange={(e) => setRouteId(e.target.value)}>
                {routeOpts.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
          )}
          <div className="row gap">
            <label className="field grow"><span>Floor</span>
              <select value={floor} onChange={(e) => setFloor(Number(e.target.value))}>
                {Array.from({ length: s.building.floors }, (_, i) => i + 1).map((f) => <option key={f} value={f}>{f}F</option>)}
              </select>
            </label>
            <label className="field grow"><span>Room / spot</span><input value={room} onChange={(e) => setRoom(e.target.value)} /></label>
          </div>
          <label className="field"><span>Details</span>
            <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. debris between 9F and 10F" />
          </label>
          <label className="field"><span>Photo</span>
            <input type="file" accept="image/*" capture="environment" onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setPhoto(await compressImage(f));
            }} />
          </label>
          {photo && <img src={photo} className="preview" alt="preview" />}
          <button className={`btn ${EMERGENCY_CATS.includes(cat) ? 'btn-danger' : 'btn-primary'}`} disabled={sending} onClick={submit}>
            {sending ? 'Sending…' : EMERGENCY_CATS.includes(cat) ? 'Send emergency report' : 'Send report'}
          </button>
          {EMERGENCY_CATS.includes(cat) && <p className="small muted">If anyone is in danger, also call <a href="tel:119">119</a>.</p>}
        </section>
      )}
      {mine.length > 0 && (
        <section className="card">
          <h3>My reports</h3>
          {mine.map((r) => (
            <div key={r.id} className="row">
              <span className="grow">{CATS.find((c) => c[0] === r.category)?.[1]} · {r.floor}F<div className="muted small">{timeAgo(r.at)}</div></span>
              <span className={`tag tag-${r.status}`}>{r.status.replace('_', ' ')}</span>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

function Shelters() {
  const s = useStore();
  const [loc, setLoc] = useState<{ lat: number; lon: number } | null>(null);
  const [asking, setAsking] = useState(false);
  const origin = loc ?? { lat: s.building.lat, lon: s.building.lon };
  const list = useMemo(
    () => s.shelters
      .filter((x) => x.status !== 'closed')
      .map((x) => ({ ...x, km: haversineKm(origin.lat, origin.lon, x.lat, x.lon) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 6),
    [s.shelters, origin.lat, origin.lon],
  );
  const isSample = s.shelters.some((x) => x.sample);
  return (
    <>
      <section className="card">
        <h3>Nearest evacuation shelters</h3>
        <p className="muted small">From {loc ? 'your location' : `${s.building.name}`}. Source: {isSample ? <b>SAMPLE data (admin can import NFA 73242)</b> : `NFA 避難收容處所 (data.gov.tw 73242)${s.backend?.sheltersMode === 'frozen_real' ? ', real snapshot 2026-10-14' : ''}`}</p>
        {!loc && (
          <button className="btn btn-sm" disabled={asking} onClick={async () => { setAsking(true); setLoc(await getLocation(6000)); setAsking(false); }}>
            📍 {asking ? 'Locating…' : 'Use my location'}
          </button>
        )}
      </section>
      {list.map((x) => (
        <section key={x.id} className="card shelter">
          <div className="row">
            <b className="grow">{x.name}</b>
            <span className={`tag tag-sh-${x.status}`}>{x.status === 'designated' ? 'official shelter' : x.status}</span>
          </div>
          <div className="muted small">{x.address}</div>
          <div className="row small gap">
            <span>📏 {x.km < 1 ? `${Math.round(x.km * 1000)} m` : `${x.km.toFixed(1)} km`}</span>
            <span>👥 capacity {x.capacity || '?'}</span>
            <span>{x.disasterTypes}</span>
          </div>
          <div className="row gap">
            <a className="btn btn-sm btn-primary" href={mapsLink(x.lat, x.lon)} target="_blank" rel="noreferrer">Open in Maps</a>
            {x.phone && <a className="btn btn-sm" href={`tel:${x.phone}`}>Call</a>}
          </div>
        </section>
      ))}
    </>
  );
}

function Numbers() {
  return (
    <section className="card">
      <h3>Taiwan emergency numbers</h3>
      {EMERGENCY_NUMBERS.map((n) => (
        <a key={n.num} className="num-row" href={`tel:${n.num}`}>
          <span className={`num ${['119', '110', '112'].includes(n.num) ? 'num-red' : ''}`}>{n.num}</span>
          <span className="grow">{n.label}<div className="muted small">{n.zh}</div></span>
          <span>📞</span>
        </a>
      ))}
    </section>
  );
}
