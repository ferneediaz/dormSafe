import { StyleSheet, Text, View } from 'react-native';

import { colors, space, statusColor, statusLabel } from '@/constants/theme';
import type { Counts } from '@/lib/selectors';
import type { ResidentStatus } from '@/lib/types';

import { Card } from './Card';

const ORDER: ResidentStatus[] = ['safe', 'inside', 'help', 'unknown'];

export function AccountabilityCard({ counts }: { counts: Counts }) {
  const accounted = counts.total - counts.unknown;
  const pct = counts.total ? Math.round((accounted / counts.total) * 100) : 0;

  return (
    <Card title="Accountability">
      <View style={styles.hero}>
        <Text style={styles.big}>{accounted}</Text>
        <Text style={styles.of}>/ {counts.total} accounted for</Text>
        <Text style={styles.pct}>{pct}%</Text>
      </View>
      <View style={styles.bar}>
        {ORDER.map((s) =>
          counts[s] > 0 ? (
            <View key={s} style={{ flex: counts[s], backgroundColor: statusColor[s] }} />
          ) : null,
        )}
      </View>
      <View style={styles.grid}>
        {ORDER.map((s) => (
          <View key={s} style={styles.tile}>
            <View style={styles.tileHead}>
              <View style={[styles.dot, { backgroundColor: statusColor[s] }]} />
              <Text style={styles.tileLabel}>{statusLabel[s]}</Text>
            </View>
            <Text style={[styles.tileValue, s === 'help' && counts.help > 0 && { color: colors.help }]}>
              {counts[s]}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  big: { color: colors.text, fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'] },
  of: { color: colors.muted, fontSize: 14, flex: 1 },
  pct: { color: colors.accent, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  bar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: colors.border,
    gap: 2,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.panelRaised,
    borderRadius: 10,
    padding: space.md,
    gap: 4,
  },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  tileLabel: { color: colors.muted, fontSize: 12 },
  tileValue: { color: colors.text, fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
