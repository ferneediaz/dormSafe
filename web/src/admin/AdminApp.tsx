import { useMemo, useState } from 'react';
import { actions, connectBackend, disconnectBackend, latestStatus, useStore } from '../data/store';
import { cwaKey, fetchLatestQuake, parseShelterCsv, timeAgo } from '../data/external';
import type { Report, Resident, State, StatusValue } from '../data/types';
import { STATUS_LABEL } from '../resident/ResidentApp';

type Tab = 'dash' | 'reports' | 'residents' | 'handoff' | 'data';
const ORDER: StatusValue[] = ['safe', 'inside', 'need_help', 'unknown', 'out'];

function counts(s: State, list: Resident[]) {
  const c: Record<StatusValue, number> = { safe: 0, inside: 0, need_help: 0, unknown: 0, out: 0 };
  for (const r of list) c[latestStatus(s, r.id)]++;
  return c;
}

const CAT_LABEL: Record<string, string> = {
  fire: '🔥 Fire', smoke: '💨 Smoke', gas: '⛽ Gas smell', leak: '💧 Water leak', electrical: '⚡ Electrical',
  structural: '🧱 Structural', blocked_route: '🚧 Blocked route', injury: '🩹 Injury', broken: '🔧 Needs fixing', other: '❓ Other',
};

export default function AdminApp() {
  const s = useStore();
  const [tab, setTab] = useState<Tab>('dash');
  const [busy, setBusy] = useState(false);
  const newReports = s.reports.filter((r) => r.status === 'new').length;

  const quake = async () => {
    setBusy(true);
    // Prefer the real NCDR alert from the backend (Alessandro's API); else CWA key; else SAMPLE.
    const fromApi = s.backend?.connected ? s.backend.alerts.find((a) => a.title.startsWith('Earthquake')) ?? s.backend.alerts[0] : undefined;
    const alert = fromApi ? { ...fromApi, at: Date.now() } : await fetchLatestQuake();
    actions.startRollCall('Earthquake', alert);
    setBusy(false);
  };

  return (
    <div className="admin">
      <header className="admin-head">
        <a href="#/" className="logo small-logo">DS</a>
        <div className="grow">
          <div className="admin-title">{s.building.name} · Command dashboard</div>
          <div className="muted small">{s.building.floors} floors · {s.residents.length} residents · {s.building.address}</div>
        </div>
        <span className={`tag ${s.backend?.connected && !s.backend.error ? 'tag-r-open' : s.backend?.error ? 'tag-r-blocked' : ''}`} title={s.backend?.error ?? ''}>
          {s.backend?.connected ? (s.backend.error ? 'API error' : `API · synced ${s.backend.lastSync ? timeAgo(s.backend.lastSync) : ''}`) : 'Local demo mode'}
        </span>
        <div className="row gap wrap">
          {!s.rollCall?.active ? (
            <>
              <button className="btn btn-danger" disabled={busy} onClick={quake}>{busy ? 'Fetching alert…' : '⚠ Simulate earthquake'}</button>
              <button className="btn" onClick={() => actions.startRollCall('Fire drill', { title: 'DRILL: Fire evacuation drill', detail: 'Scheduled drill', source: 'Admin', at: Date.now() })}>Start drill</button>
            </>
          ) : (
            <>
              <button className="btn" onClick={() => actions.simulateCheckIns()}>▶ Simulate check-ins</button>
              <button className="btn" onClick={() => actions.endRollCall()}>End roll call</button>
            </>
          )}
        </div>
      </header>

      {s.rollCall?.active && s.alert && (
        <div className="banner banner-danger admin-banner">
          <b>⚠ {s.alert.title}</b> · Roll call started {timeAgo(s.rollCall.startedAt)}
          <div className="small">{s.alert.detail} <span className="muted">Source: {s.alert.source}</span></div>
        </div>
      )}

      <nav className="admin-tabs">
        {([['dash', 'Dashboard'], ['reports', `Reports${newReports ? ` (${newReports})` : ''}`], ['residents', 'Residents'], ['handoff', 'Responder handoff'], ['data', 'Data & settings']] as [Tab, string][]).map(([t, l]) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{l}</button>
        ))}
      </nav>

      <main className="admin-body">
        {tab === 'dash' && <Dashboard />}
        {tab === 'reports' && <Reports />}
        {tab === 'residents' && <Residents />}
        {tab === 'handoff' && <Handoff />}
        {tab === 'data' && <DataTab />}
      </main>
    </div>
  );
}

function Kpis() {
  const s = useStore();
  const c = counts(s, s.residents);
  const total = s.residents.length;
  const accounted = c.safe + c.inside + c.need_help + c.out;
  return (
    <>
      <div className="kpis">
        <div className="kpi"><div className="kpi-n">{accounted}<span className="muted"> / {total}</span></div><div className="kpi-l">accounted for</div></div>
        <div className="kpi k-safe"><div className="kpi-n">{c.safe}</div><div className="kpi-l">safe / evacuated</div></div>
        <div className="kpi k-inside"><div className="kpi-n">{c.inside}</div><div className="kpi-l">still inside</div></div>
        <div className="kpi k-help"><div className="kpi-n">{c.need_help}</div><div className="kpi-l">need help</div></div>
        <div className="kpi k-unknown"><div className="kpi-n">{c.unknown}</div><div className="kpi-l">unknown</div></div>
        {c.out > 0 && <div className="kpi"><div className="kpi-n">{c.out}</div><div className="kpi-l">out of dorm</div></div>}
      </div>
      <div className="progress">
        {ORDER.map((k) => <div key={k} className={`seg seg-${k}`} style={{ width: `${(c[k] / total) * 100}%` }} />)}
      </div>
    </>
  );
}

function Dashboard() {
  const s = useStore();
  const [open, setOpen] = useState<number | null>(null);
  const floors = Array.from({ length: s.building.floors }, (_, i) => s.building.floors - i);
  return (
    <>
      <Kpis />
      <div className="dash-grid">
        <section className="card">
          <h3>Floors</h3>
          <div className="floors">
            {floors.map((f) => {
              const res = s.residents.filter((r) => r.floor === f);
              const c = counts(s, res);
              const blocked = s.routes.filter((r) => r.status === 'blocked' && f >= r.floorFrom && f <= r.floorTo);
              const hazards = s.reports.filter((r) => r.floor === f && r.urgency === 'emergency' && r.status !== 'resolved' && r.category !== 'blocked_route');
              return (
                <div key={f}>
                  <button className={`floor ${c.need_help ? 'f-help' : hazards.length || blocked.length ? 'f-haz' : c.unknown === 0 ? 'f-ok' : ''}`} onClick={() => setOpen(open === f ? null : f)}>
                    <span className="fl">{f}F</span>
                    <span className="fbar">
                      {ORDER.map((k) => <span key={k} className={`seg seg-${k}`} style={{ width: `${(c[k] / Math.max(1, res.length)) * 100}%` }} />)}
                    </span>
                    <span className="fcounts small">
                      {c.need_help > 0 && <b className="c-help">{c.need_help} help</b>}
                      {c.unknown > 0 && <span className="muted">{c.unknown} unknown</span>}
                    </span>
                    <span className="fchips">
                      {blocked.map((r) => <span key={r.id} className="tag tag-blocked">🚧 {r.name}</span>)}
                      {hazards.map((h) => <span key={h.id} className="tag tag-haz">{CAT_LABEL[h.category]}</span>)}
                    </span>
                  </button>
                  {open === f && <Rooms floor={f} />}
                </div>
              );
            })}
          </div>
          <div className="legend small">
            {ORDER.map((k) => <span key={k}><i className={`seg-${k}`} /> {STATUS_LABEL[k]}</span>)}
          </div>
        </section>

        <div className="side">
          <Priority />
          <RoutesPanel />
        </div>
      </div>
    </>
  );
}

function Rooms({ floor }: { floor: number }) {
  const s = useStore();
  const rooms = Array.from(new Set(s.residents.filter((r) => r.floor === floor).map((r) => r.room)));
  return (
    <div className="rooms">
      {rooms.map((room) => {
        const res = s.residents.filter((r) => r.room === room);
        return (
          <div key={room} className="room" title={res.map((r) => `${r.name}: ${STATUS_LABEL[latestStatus(s, r.id)]}`).join('\n')}>
            <div className="small"><b>{room}</b></div>
            <div className="beds">{res.map((r) => <span key={r.id} className={`dot dot-${latestStatus(s, r.id)} ${r.vulnerable ? 'dot-v' : ''}`} />)}</div>
          </div>
        );
      })}
    </div>
  );
}

const span = (r: { floorFrom: number; floorTo: number }) => (r.floorFrom === r.floorTo ? `${r.floorFrom}F` : `${r.floorFrom}–${r.floorTo}F`);

export function priorities(s: State) {
  const items: { level: 'p1' | 'p2' | 'p3'; text: string; sub?: string }[] = [];
  const help = s.residents.filter((r) => latestStatus(s, r.id) === 'need_help')
    .sort((a, b) => Number(b.vulnerable) - Number(a.vulnerable));
  for (const r of help) {
    const st = s.statuses[r.id];
    items.push({ level: 'p1', text: `Room ${r.room}: ${r.vulnerableNote ? `assistance required (${r.vulnerableNote})` : 'help requested'}`, sub: `${r.name} · ${st?.note && st.note !== r.vulnerableNote ? st.note + ' · ' : ''}${timeAgo(st!.at)}` });
  }
  for (const rep of s.reports.filter((x) => x.urgency === 'emergency' && x.status !== 'resolved' && x.category !== 'blocked_route')) {
    items.push({ level: 'p1', text: `${rep.floor}F: ${CAT_LABEL[rep.category]}`, sub: `${rep.description || 'no details'} · ${timeAgo(rep.at)}` });
  }
  for (const rt of s.routes.filter((x) => x.status === 'blocked')) {
    items.push({ level: 'p2', text: `${rt.name} BLOCKED (${span(rt)})`, sub: rt.verification.replace('_', ' ') });
  }
  if (s.rollCall?.active) {
    for (const r of s.residents.filter((x) => x.vulnerable && ['unknown', 'inside'].includes(latestStatus(s, x.id)))) {
      items.push({ level: 'p2', text: `Room ${r.room}: vulnerable resident ${latestStatus(s, r.id)}`, sub: `${r.name} · ${r.vulnerableNote}` });
    }
    const byFloor = Array.from({ length: s.building.floors }, (_, i) => i + 1)
      .map((f) => ({ f, n: s.residents.filter((r) => r.floor === f && latestStatus(s, r.id) === 'unknown').length }))
      .filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 3);
    for (const x of byFloor) items.push({ level: 'p3', text: `Floor ${x.f}: ${x.n} residents unaccounted for` });
  }
  return items;
}

function Priority() {
  const s = useStore();
  const items = priorities(s);
  return (
    <section className="card">
      <h3>Priority</h3>
      {items.length === 0 && <p className="muted small">Nothing urgent. {s.rollCall?.active ? '' : 'Start a roll call to begin accountability.'}</p>}
      <ol className="prio">
        {items.map((it, i) => (
          <li key={i} className={it.level}>
            <b>{it.text}</b>
            {it.sub && <div className="muted small">{it.sub}</div>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function RoutesPanel() {
  const s = useStore();
  return (
    <section className="card">
      <h3>Stairwells & exits</h3>
      <div style={{ maxHeight: 420, overflow: 'auto' }}>
      {[...s.routes].sort((a, b) => Number(b.status === 'blocked') - Number(a.status === 'blocked')).map((r) => (
        <div key={r.id} className="route">
          <div className="row">
            <b className="grow">{r.name}</b>
            <span className={`tag tag-r-${r.status}`}>{r.status}</span>
          </div>
          <div className="muted small">{r.status === 'blocked' ? `${span(r)} · ` : ''}{r.verification.replace('_', ' ')} · {timeAgo(r.updatedAt)}</div>
          <div className="row gap">
            <button className="btn btn-xs" onClick={() => actions.setRoute(r.id, { status: 'open', verification: 'staff_verified' })}>✔ Open</button>
            <button className="btn btn-xs" onClick={() => actions.setRoute(r.id, { status: 'blocked', verification: 'staff_verified' })}>✖ Blocked</button>
            {r.status === 'blocked' && r.verification !== 'staff_verified' && (
              <button className="btn btn-xs btn-primary" onClick={() => actions.setRoute(r.id, { verification: 'staff_verified' })}>Verify report</button>
            )}
          </div>
        </div>
      ))}
      </div>
    </section>
  );
}

function Reports() {
  const s = useStore();
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const list = s.reports.filter((r) => filter === 'all' || r.status !== 'resolved');
  const name = (id: string) => s.residents.find((r) => r.id === id)?.name ?? 'a resident';
  return (
    <section>
      <div className="row gap" style={{ marginBottom: 12 }}>
        <button className={`btn btn-sm ${filter === 'open' ? 'btn-primary' : ''}`} onClick={() => setFilter('open')}>Open</button>
        <button className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : ''}`} onClick={() => setFilter('all')}>All</button>
      </div>
      {list.length === 0 && <p className="muted">No reports yet. Residents send them from the Report tab.</p>}
      <div className="report-grid">
        {list.map((r: Report) => (
          <article key={r.id} className={`card report ${r.urgency === 'emergency' ? 'report-em' : ''}`}>
            <div className="row">
              <b className="grow">{CAT_LABEL[r.category]}</b>
              <span className={`tag tag-${r.status}`}>{r.status.replace('_', ' ')}</span>
            </div>
            <div className="small">{r.floor}F · {r.room} · {r.routeId ? s.routes.find((x) => x.id === r.routeId)?.name + ' · ' : ''}{timeAgo(r.at)}</div>
            {r.description && <p>{r.description}</p>}
            {r.photo && <img src={r.photo} alt="report" className="report-img" />}
            <div className="muted small">Reported by {name(r.residentId)}{r.lat ? ` · 📍 ${r.lat.toFixed(4)}, ${r.lon?.toFixed(4)}` : ''}</div>
            <div className="row gap">
              {r.status === 'new' && <button className="btn btn-sm" onClick={() => actions.setReportStatus(r.id, 'in_progress')}>Start</button>}
              {r.status !== 'resolved' && <button className="btn btn-sm btn-primary" onClick={() => actions.setReportStatus(r.id, 'resolved')}>Resolve</button>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Residents() {
  const s = useStore();
  const [q, setQ] = useState('');
  const [only, setOnly] = useState<StatusValue | 'all' | 'vulnerable'>('all');
  const list = useMemo(() => s.residents.filter((r) => {
    const t = q.toLowerCase();
    if (t && !r.name.toLowerCase().includes(t) && !r.room.startsWith(t)) return false;
    if (only === 'vulnerable') return r.vulnerable;
    if (only !== 'all') return latestStatus(s, r.id) === only;
    return true;
  }), [s, q, only]);
  return (
    <section className="card">
      <div className="row gap wrap">
        <input className="grow" placeholder="Search name or room" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={only} onChange={(e) => setOnly(e.target.value as typeof only)}>
          <option value="all">All ({s.residents.length})</option>
          {ORDER.map((k) => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
          <option value="vulnerable">Needs assistance profile</option>
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Room</th><th>Name</th><th>Status</th><th>Lang</th><th>Phone</th><th>Emergency contact</th><th>Notes</th><th></th></tr></thead>
          <tbody>
            {list.slice(0, 200).map((r) => {
              const st = s.statuses[r.id];
              return (
                <tr key={r.id}>
                  <td>{r.room}</td>
                  <td>{r.name}</td>
                  <td><span className={`dot dot-${st?.status ?? 'unknown'}`} /> {STATUS_LABEL[st?.status ?? 'unknown']}{st && st.source !== 'self' ? <span className="muted small"> ({st.source})</span> : ''}</td>
                  <td>{r.language || '—'}</td>
                  <td>{r.phone || '—'}</td>
                  <td className="small">{r.emergencyContact || '—'}</td>
                  <td>{r.vulnerable && <span className="tag tag-warn">{r.vulnerableNote}</span>}</td>
                  <td>{(st?.status ?? 'unknown') !== 'safe' && <button className="btn btn-xs" onClick={() => actions.setStatus(r.id, { status: 'safe', source: 'staff' })}>Staff: safe</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length > 200 && <p className="muted small">Showing 200 of {list.length}. Search to narrow.</p>}
      </div>
    </section>
  );
}

function handoffText(s: State) {
  const c = counts(s, s.residents);
  const total = s.residents.length;
  const lines: string[] = [];
  lines.push(`${s.building.name.toUpperCase()}: EMERGENCY HANDOFF`);
  lines.push(`${new Date().toLocaleString()}${s.alert ? ` · ${s.alert.title}` : ''}`);
  lines.push('');
  lines.push(`Registered residents: ${total}`);
  lines.push(`Accounted for: ${total - c.unknown}  (safe ${c.safe} · inside ${c.inside} · need help ${c.need_help}${c.out ? ` · out ${c.out}` : ''})`);
  lines.push(`UNKNOWN: ${c.unknown}`);
  lines.push('');
  lines.push('PRIORITY RESIDENTS');
  const help = s.residents.filter((r) => latestStatus(s, r.id) === 'need_help').sort((a, b) => Number(b.vulnerable) - Number(a.vulnerable));
  if (!help.length) lines.push('- none');
  for (const r of help) lines.push(`- Room ${r.room}: ${r.vulnerableNote ?? s.statuses[r.id]?.note ?? 'help requested'} (${r.name})`);
  const vu = s.residents.filter((r) => r.vulnerable && latestStatus(s, r.id) === 'unknown');
  for (const r of vu) lines.push(`- Room ${r.room}: UNKNOWN, has assistance profile (${r.vulnerableNote})`);
  lines.push('');
  lines.push('BUILDING CONDITIONS');
  for (const r of s.routes) {
    if (r.status === 'unknown') continue;
    lines.push(`- ${r.name}: ${r.status.toUpperCase()}${r.status === 'blocked' && !r.name.endsWith(`${r.floorFrom}F`) ? ` ${span(r)}` : ''} (${r.verification.replace('_', ' ')})`);
  }
  for (const rep of s.reports.filter((x) => x.urgency === 'emergency' && x.status !== 'resolved' && x.category !== 'blocked_route')) {
    lines.push(`- ${rep.floor}F: ${CAT_LABEL[rep.category].replace(/^\S+ /, '')}${rep.description ? `: ${rep.description}` : ''} (reported)`);
  }
  lines.push('');
  lines.push('UNKNOWN BY FLOOR');
  for (let f = s.building.floors; f >= 1; f--) {
    const n = s.residents.filter((r) => r.floor === f && latestStatus(s, r.id) === 'unknown').length;
    if (n) lines.push(`- ${f}F: ${n}`);
  }
  lines.push('');
  lines.push('Reports are resident/staff observations, not engineering assessments.');
  return lines.join('\n');
}

function Handoff() {
  const s = useStore();
  const text = handoffText(s);
  const [copied, setCopied] = useState(false);
  return (
    <section className="card">
      <div className="row gap">
        <h3 className="grow">Responder handoff</h3>
        <button className="btn btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } }}>{copied ? 'Copied ✓' : 'Copy'}</button>
      </div>
      <pre className="handoff">{text}</pre>
    </section>
  );
}

function DataTab() {
  const s = useStore();
  const [key, setKey] = useState(cwaKey.get());
  const [msg, setMsg] = useState('');
  const [ann, setAnn] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const isSample = s.shelters.some((x) => x.sample);
  const [url, setUrl] = useState(s.backend?.url ?? 'http://localhost:8000');
  const [connecting, setConnecting] = useState(false);
  return (
    <div className="dash-grid">
      <div>
        <section className="card form">
          <h3>Backend (DormSafe API)</h3>
          <p className="muted small">
            Connect to the FastAPI backend (branch <b>ale</b>: <code>uvicorn dormsafe.api:app --host 0.0.0.0</code>) so phones and laptops share
            one live state, with real NCDR alerts and NFA shelters. Without it, the app runs in local demo mode (one browser only).
          </p>
          {!['localhost', '127.0.0.1'].includes(location.hostname) && !/^(192\.168|10\.|172\.)/.test(location.hostname) && !s.backend?.connected && (
            <p className="small"><b>This is a hosted preview, so it can't reach a backend running on your laptop.</b> Run the app on your laptop (<code>npm run dev</code>) to connect.</p>
          )}
          {s.backend?.connected ? (
            <>
              <p className="small">Connected to <b>{s.backend.url}</b> · alerts: {s.backend.alertsMode ?? '?'} · shelters: {s.backend.sheltersMode ?? '?'} ({s.shelters.length} within radius){s.backend.error ? <><br /><b className="c-help">{s.backend.error}</b></> : null}</p>
              <button className="btn" onClick={() => disconnectBackend()}>Disconnect (back to local demo)</button>
            </>
          ) : (
            <>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://192.168.x.x:8000" />
              <button className="btn btn-primary" disabled={connecting} onClick={async () => { setConnecting(true); const err = await connectBackend(url); setConnecting(false); setMsg(err ?? 'Connected'); }}>
                {connecting ? 'Connecting…' : 'Connect'}
              </button>
            </>
          )}
        </section>

        <section className="card form">
          <h3>Announcement to all residents</h3>
          <textarea rows={2} value={ann} onChange={(e) => setAnn(e.target.value)} placeholder="e.g. Water shut-off 2–4pm today on floors 5–8" />
          <button className="btn btn-primary" disabled={!ann.trim()} onClick={() => { actions.announce(ann.trim()); setAnn(''); }}>Send</button>
        </section>

        <section className="card form">
          <h3>CWA earthquake API key</h3>
          <p className="muted small">Free key from opendata.cwa.gov.tw. Used by “Simulate earthquake” to replay the latest real report (E-A0015-001). Without a key, a SAMPLE event is used. Stored only in this browser.</p>
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="CWA-XXXXXXXX-…" />
          <button className="btn" onClick={() => { cwaKey.set(key.trim()); setMsg('Key saved'); }}>Save key</button>
        </section>

        <section className="card form">
          <h3>Shelters (NFA 避難收容處所)</h3>
          <p className="muted small">
            Currently: {isSample ? <b>{s.shelters.length} SAMPLE shelters (not real)</b> : s.backend?.connected ? `${s.shelters.length} real NFA shelters from the backend` : `${s.shelters.length} shelters imported from NFA CSV`}.
            Download the CSV for dataset <b>73242</b> (避難收容處所點位檔) from data.gov.tw and import it here.
          </p>
          <input type="file" accept=".csv,text/csv" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const buf = await f.arrayBuffer();
              let text = new TextDecoder('utf-8').decode(buf);
              if (!/緯度|經度|lat/i.test(text.slice(0, 2000))) text = new TextDecoder('big5').decode(buf);
              const list = parseShelterCsv(text);
              if (!list.length) throw new Error('No rows with coordinates found');
              actions.setShelters(list);
              setMsg(`Imported ${list.length} shelters`);
            } catch (err) {
              setMsg(`Import failed: ${(err as Error).message}`);
            }
          }} />
          {msg && <p className="small"><b>{msg}</b></p>}
        </section>

        <section className="card form">
          <h3>Demo</h3>
          {confirmReset ? (
            <div className="row gap wrap">
              <span className="small">Clear all check-ins, reports and settings?</span>
              <button className="btn btn-danger" onClick={() => { actions.reset(); setConfirmReset(false); setMsg('Demo data reset'); }}>Yes, reset</button>
              <button className="btn" onClick={() => setConfirmReset(false)}>Cancel</button>
            </div>
          ) : (
            <button className="btn btn-danger" onClick={() => setConfirmReset(true)}>Reset demo data</button>
          )}
        </section>
      </div>

      <section className="card">
        <h3>Shelter status (NFA 12849 openstatus)</h3>
        <p className="muted small">"designated" = on the official NFA list, not necessarily open. Set open / full / closed during an event; residents don't see closed shelters.</p>
        <div className="table-wrap" style={{ maxHeight: 520 }}>
          <table>
            <thead><tr><th>Name</th><th>Capacity</th><th>Status</th></tr></thead>
            <tbody>
              {[...s.shelters]
                .sort((a, b) => Math.hypot(a.lat - s.building.lat, a.lon - s.building.lon) - Math.hypot(b.lat - s.building.lat, b.lon - s.building.lon))
                .slice(0, 50)
                .map((x) => (
                  <tr key={x.id}>
                    <td>{x.name}</td>
                    <td>{x.capacity || '?'}</td>
                    <td>
                      <select value={x.status} onChange={(e) => actions.setShelterStatus(x.id, e.target.value as typeof x.status)}>
                        {['designated', 'open', 'full', 'closed', 'unknown'].map((v) => <option key={v}>{v}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
