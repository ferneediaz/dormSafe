import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, mono, space, statusColor } from '@/constants/theme';
import type { Counts } from '@/lib/selectors';
import type { Incident, ResidentStatus } from '@/lib/types';

import { Card } from './Card';

const ORDER: ResidentStatus[] = ['safe', 'inside', 'help', 'unknown'];

export function FloorOverview({
  byFloor,
  incidents,
  selected,
  onSelect,
}: {
  byFloor: Record<number, Counts>;
  incidents: Incident[];
  selected: number | null;
  onSelect: (f: number | null) => void;
}) {
  const levels = Object.keys(byFloor)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <Card title="Floors">
      <View style={styles.list}>
        {levels.map((f) => {
          const c = byFloor[f];
          const hazards = incidents.filter((i) => i.floor === f).length;
          const active = selected === f;
          return (
            <Pressable
              key={f}
              onPress={() => onSelect(active ? null : f)}
              style={(state) => [styles.row, (state as { hovered?: boolean }).hovered && styles.hover, active && styles.active]}>
              <Text style={[styles.level, mono]}>{String(f).padStart(2, ' ')}F</Text>
              <View style={styles.bar}>
                {ORDER.map((s) =>
                  c[s] > 0 ? <View key={s} style={{ flex: c[s], backgroundColor: statusColor[s] }} /> : null,
                )}
              </View>
              <View style={styles.badges}>
                {c.help > 0 ? <Text style={[styles.badge, { color: colors.help }]}>● {c.help}</Text> : null}
                {hazards > 0 ? <Text style={[styles.badge, { color: colors.hazard }]}>▲ {hazards}</Text> : null}
                <Text style={[styles.unknown, mono, c.unknown === 0 && { color: colors.safe }]}>
                  {c.unknown === 0 ? '✓' : `${c.unknown}?`}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  hover: { backgroundColor: colors.panelRaised },
  active: { backgroundColor: '#0c2a3d', borderColor: colors.accent },
  level: { color: colors.muted, fontSize: 12, width: 30 },
  bar: {
    flex: 1,
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 92, justifyContent: 'flex-end' },
  badge: { fontSize: 12, fontWeight: '700' },
  unknown: { color: colors.muted, fontSize: 12, minWidth: 30, textAlign: 'right' },
});
