// Taiwan open data: emergency numbers, earthquake alerts (CWA), shelters (NFA 73242 CSV).
import type { Alert, Shelter } from './types';

export const EMERGENCY_NUMBERS = [
  { num: '119', label: 'Fire / Ambulance / Rescue', zh: '消防 / 救護' },
  { num: '110', label: 'Police', zh: '警察' },
  { num: '112', label: 'Mobile emergency (works without SIM)', zh: '行動電話緊急求救' },
  { num: '1955', label: 'Foreign worker hotline (24h, multilingual)', zh: '外籍勞工諮詢保護專線' },
  { num: '113', label: 'Domestic violence / child protection', zh: '保護專線' },
  { num: '165', label: 'Anti-fraud', zh: '反詐騙專線' },
  { num: '1925', label: 'Mental health support (24h)', zh: '安心專線' },
  { num: '1999', label: 'City government hotline', zh: '市民熱線' },
  { num: '0800024111', label: 'Tourist & foreigner info hotline', zh: '觀光諮詢' },
];

export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function getLocation(timeoutMs = 4000): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    const t = setTimeout(() => resolve(null), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(t);
        resolve({ lat: p.coords.latitude, lon: p.coords.longitude });
      },
      () => {
        clearTimeout(t);
        resolve(null);
      },
      { timeout: timeoutMs, maximumAge: 60000 },
    );
  });
}

// Location is fetched once in the background; sends never wait for GPS.
let lastLoc: { lat: number; lon: number } | null = null;
export function primeLocation() {
  getLocation(8000).then((l) => { if (l) lastLoc = l; });
}
export const knownLocation = () => lastLoc;

export const SAMPLE_QUAKE: Alert = {
  title: 'SAMPLE EVENT: Earthquake M6.0',
  detail: 'Replay of a sample event (not live). Intensity 4 in Taipei City. Add a CWA API key on Admin → Data to use the latest real report.',
  source: 'SAMPLE',
  at: Date.now(),
};

const CWA_KEY_STORAGE = 'dormsafe-cwa-key';
export const cwaKey = {
  get: () => {
    try {
      return localStorage.getItem(CWA_KEY_STORAGE) || (import.meta.env.VITE_CWA_API_KEY as string | undefined) || '';
    } catch {
      return '';
    }
  },
  set: (k: string) => {
    try {
      localStorage.setItem(CWA_KEY_STORAGE, k);
    } catch {
      /* ignore */
    }
  },
};

/** Latest significant earthquake from CWA (E-A0015-001). Falls back to SAMPLE on any failure. */
export async function fetchLatestQuake(): Promise<Alert> {
  const key = cwaKey.get();
  if (!key) return { ...SAMPLE_QUAKE, at: Date.now() };
  try {
    const url = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/E-A0015-001?Authorization=${encodeURIComponent(key)}&format=JSON&limit=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const json = await res.json();
    const eq = json?.records?.Earthquake?.[0];
    const info = eq?.EarthquakeInfo;
    if (!info) throw new Error('no data');
    const mag = info.EarthquakeMagnitude?.MagnitudeValue;
    const loc = info.Epicenter?.Location ?? '';
    const areas = (eq.Intensity?.ShakingArea ?? [])
      .slice(0, 3)
      .map((a: { AreaDesc: string; AreaIntensity: string }) => `${a.AreaDesc} ${a.AreaIntensity}`)
      .join(' · ');
    return {
      title: `Earthquake M${mag}: ${loc}`,
      detail: `Origin ${info.OriginTime}, depth ${info.FocalDepth} km. ${areas}`,
      source: 'CWA E-A0015-001 (latest report, replayed)',
      at: Date.now(),
      lat: Number(info.Epicenter?.EpicenterLatitude),
      lon: Number(info.Epicenter?.EpicenterLongitude),
    };
  } catch {
    return { ...SAMPLE_QUAKE, detail: SAMPLE_QUAKE.detail + ' (CWA request failed.)', at: Date.now() };
  }
}

// --- NFA shelter CSV (data.gov.tw 73242, 避難收容處所點位檔) ---
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseShelterCsv(text: string): Shelter[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]);
  const find = (...keys: string[]) => header.findIndex((h) => keys.some((k) => h.toLowerCase().includes(k.toLowerCase())));
  const iName = find('名稱', 'name');
  const iAddr = find('地址', 'address');
  const iLon = find('經度', 'lon');
  const iLat = find('緯度', 'lat');
  const iCap = find('容納人數', '收容人數', '人數', 'peopleno', 'capacity');
  const iType = find('災害', 'disaster');
  const iPhone = find('電話', 'phone');
  const iCounty = find('縣市', 'county');
  if (iLat < 0 || iLon < 0) throw new Error('Could not find latitude/longitude columns (經度/緯度).');
  const out: Shelter[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = parseCsvLine(lines[i]);
    const lat = parseFloat(c[iLat]);
    const lon = parseFloat(c[iLon]);
    if (!isFinite(lat) || !isFinite(lon) || lat < 20 || lat > 27) continue;
    out.push({
      id: `nfa-${i}`,
      name: c[iName] ?? 'Shelter',
      address: [iCounty >= 0 ? c[iCounty] : '', iAddr >= 0 ? c[iAddr] : ''].join(' ').trim(),
      lat,
      lon,
      capacity: parseInt(c[iCap] ?? '0', 10) || 0,
      disasterTypes: iType >= 0 ? c[iType] : '',
      phone: iPhone >= 0 ? c[iPhone] : '',
      status: 'unknown',
    });
  }
  return out;
}

export const mapsLink = (lat: number, lon: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;

/** Compress an image file to a small JPEG data URL (keeps localStorage small). */
export function compressImage(file: File, max = 720): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.6));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function timeAgo(t: number) {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}
