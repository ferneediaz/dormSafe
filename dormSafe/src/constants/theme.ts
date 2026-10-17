import { Platform } from 'react-native';

import type { ResidentStatus, RouteStatus } from '@/lib/types';

export const colors = {
  bg: '#0a0e14',
  panel: '#111821',
  panelRaised: '#16202c',
  border: '#1f2b3a',
  text: '#e6edf3',
  muted: '#8b98a8',
  faint: '#5a6878',
  accent: '#38bdf8',
  safe: '#22c55e',
  inside: '#f59e0b',
  help: '#ef4444',
  unknown: '#64748b',
  hazard: '#f97316',
};

export const statusColor: Record<ResidentStatus, string> = {
  safe: colors.safe,
  inside: colors.inside,
  help: colors.help,
  unknown: colors.unknown,
};

export const statusLabel: Record<ResidentStatus, string> = {
  safe: 'Safe',
  inside: 'Still inside',
  help: 'Needs help',
  unknown: 'Unknown',
};

export const routeColor: Record<RouteStatus, string> = {
  open: colors.safe,
  blocked: colors.help,
  unavailable: colors.unknown,
  unverified: colors.inside,
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 6, md: 10, lg: 14 };

export const mono = {
  fontFamily: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  }),
};
