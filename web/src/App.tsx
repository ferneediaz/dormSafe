import { useEffect, useMemo, useState } from 'react';
import { useStore } from './data/store';
import ResidentApp from './resident/ResidentApp';
import AdminApp from './admin/AdminApp';

function useHash() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

export default function App() {
  const hash = useHash();
  const [, role, id] = hash.replace(/^#/, '').split('/');
  if (role === 'admin') return <AdminApp />;
  if (role === 'resident' && id) return <ResidentApp residentId={id} />;
  return <Landing />;
}

function Landing() {
  const s = useStore();
  const [q, setQ] = useState('905');
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return s.residents.filter((r) => r.room.startsWith(t) || r.name.toLowerCase().includes(t)).slice(0, 8);
  }, [q, s.residents]);

  return (
    <div className="landing">
      <header className="landing-head">
        <div className="logo">DS</div>
        <div>
          <h1>DormSafe</h1>
          <p className="muted">Dormitory safety & accountability for every dorm in Taiwan</p>
        </div>
      </header>

      <div className="landing-grid">
        <section className="card">
          <h2>I live here</h2>
          <p className="muted">Resident app: check in, SOS, report problems, shelters, emergency numbers.</p>
          <label className="field">
            <span>Find yourself by room or name</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. 905 or Maria" />
          </label>
          <ul className="pick-list">
            {matches.map((r) => (
              <li key={r.id}>
                <a href={`#/resident/${r.id}`}>
                  <b>Room {r.room}</b> · {r.name}
                  {r.vulnerable && <span className="tag tag-warn">needs assistance</span>}
                </a>
              </li>
            ))}
            {q && matches.length === 0 && <li className="muted">No match</li>}
          </ul>
        </section>

        <section className="card">
          <h2>Admin / Coordinator</h2>
          <p className="muted">Live headcount per floor and room, reports inbox, stairwell status, roll call, responder handoff.</p>
          <a className="btn btn-primary" href="#/admin">Open command dashboard →</a>
          <p className="hint">
            Demo tip: open the admin dashboard in one tab and a resident in another (or on a phone on the same browser profile).
            Changes sync live between tabs.
          </p>
        </section>
      </div>
      <p className="foot muted">All residents and events here are <b>SIMULATED</b> demo data.</p>
    </div>
  );
}
