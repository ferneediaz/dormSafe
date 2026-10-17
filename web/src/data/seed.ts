import type { Building, Resident, Route, Shelter, State } from './types';

// SIMULATED demo data. Scenario matches readme.md: Dorm A, 12 floors, 812 residents.
export const DORM_A: Building = {
  id: 'dorm-a',
  name: 'Dorm A',
  address: 'Demo location, Da\'an District, Taipei (SIMULATED)',
  lat: 25.0143,
  lon: 121.5385,
  floors: 12,
  roomsPerFloor: 17,
};

const FIRST = [
  'Wei', 'Yu-Ting', 'Chen', 'Hsin', 'Jia-Hao', 'Mei', 'Kai', 'Pei-Shan', 'Yi-Chen', 'Hao',
  'Maria', 'Jose', 'Angel', 'Mark', 'Joy', 'Rhea', 'Paolo', 'Grace',
  'Siti', 'Budi', 'Dewi', 'Agus', 'Putri',
  'Linh', 'Minh', 'Thao', 'Duc', 'Lan',
  'Somchai', 'Nok', 'Ploy', 'Anan',
];
const LAST = [
  'Lin', 'Chen', 'Wang', 'Huang', 'Chang', 'Liu', 'Tsai', 'Yang',
  'Santos', 'Reyes', 'Cruz', 'Garcia', 'Mendoza', 'Bautista',
  'Rahayu', 'Saputra', 'Wijaya', 'Nguyen', 'Tran', 'Pham', 'Le',
  'Srisuk', 'Chaiyaporn', 'Boonmee',
];
const LANG_BY_FIRST: Record<string, string> = {
  Maria: 'fil', Jose: 'fil', Angel: 'fil', Mark: 'fil', Joy: 'fil', Rhea: 'fil', Paolo: 'fil', Grace: 'fil',
  Siti: 'id', Budi: 'id', Dewi: 'id', Agus: 'id', Putri: 'id',
  Linh: 'vi', Minh: 'vi', Thao: 'vi', Duc: 'vi', Lan: 'vi',
  Somchai: 'th', Nok: 'th', Ploy: 'th', Anan: 'th',
};

// Deterministic PRNG so every teammate gets the same seed.
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export function seedResidents(b: Building, total = 812): Resident[] {
  const r = rng(42);
  const out: Resident[] = [];
  for (let f = 1; f <= b.floors; f++) {
    for (let n = 1; n <= b.roomsPerFloor; n++) {
      for (let bed = 1; bed <= 4; bed++) {
        if (out.length >= total) break;
        const room = `${f}${String(n).padStart(2, '0')}`;
        const first = FIRST[Math.floor(r() * FIRST.length)];
        const last = LAST[Math.floor(r() * LAST.length)];
        out.push({
          id: `r-${room}-${bed}`,
          name: `${first} ${last}`,
          floor: f,
          room,
          phone: `09${String(Math.floor(r() * 1e8)).padStart(8, '0')}`,
          language: LANG_BY_FIRST[first] ?? 'zh',
          emergencyContact: `${LAST[Math.floor(r() * LAST.length)]} family · 09${String(Math.floor(r() * 1e8)).padStart(8, '0')}`,
          vulnerable: false,
        });
      }
    }
  }
  // Scenario: Room 912 resident cannot use stairs.
  const r912 = out.find((x) => x.room === '912');
  if (r912) {
    r912.vulnerable = true;
    r912.vulnerableNote = 'Cannot use stairs (leg injury)';
  }
  // A few more vulnerable residents for realism.
  for (const room of ['304', '715', '1108']) {
    const x = out.find((y) => y.room === room);
    if (x) {
      x.vulnerable = true;
      x.vulnerableNote = room === '304' ? 'Pregnant' : room === '715' ? 'Asthma' : 'Wheelchair user';
    }
  }
  return out;
}

export function seedRoutes(): Route[] {
  const now = Date.now();
  return [
    { id: 'east-b', name: 'East Stairwell B', floorFrom: 1, floorTo: 12, status: 'unknown', verification: 'reported', updatedAt: now },
    { id: 'west-a', name: 'West Stairwell A', floorFrom: 1, floorTo: 12, status: 'unknown', verification: 'reported', updatedAt: now },
    { id: 'elev-1', name: 'Elevator 1', floorFrom: 1, floorTo: 12, status: 'unknown', verification: 'reported', updatedAt: now },
    { id: 'main-exit', name: 'Main exit (1F)', floorFrom: 1, floorTo: 1, status: 'unknown', verification: 'reported', updatedAt: now },
  ];
}

// SAMPLE shelters (NOT real). Replace by importing NFA dataset 73242 CSV on the Admin → Data tab.
export function sampleShelters(b: Building): Shelter[] {
  const pts: [string, number, number, number][] = [
    ['Sample Shelter A (school gym)', 0.006, 0.004, 800],
    ['Sample Shelter B (community center)', -0.009, 0.007, 300],
    ['Sample Shelter C (elementary school)', 0.012, -0.010, 1200],
    ['Sample Shelter D (park, outdoor)', -0.015, -0.006, 2000],
    ['Sample Shelter E (district office)', 0.020, 0.015, 250],
  ];
  return pts.map(([name, dlat, dlon, cap], i) => ({
    id: `sample-${i}`,
    name,
    address: 'SAMPLE: import NFA 73242 for real shelters',
    lat: b.lat + dlat,
    lon: b.lon + dlon,
    capacity: cap,
    disasterTypes: i === 3 ? 'earthquake' : 'earthquake, flood',
    phone: '',
    status: 'open',
    sample: true,
  }));
}

export function initialState(): State {
  return {
    version: 1,
    building: DORM_A,
    residents: seedResidents(DORM_A),
    statuses: {},
    reports: [],
    routes: seedRoutes(),
    rollCall: null,
    alert: null,
    shelters: sampleShelters(DORM_A),
    announcements: [],
  };
}
