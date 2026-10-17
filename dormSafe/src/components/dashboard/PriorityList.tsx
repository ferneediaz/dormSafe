import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, space } from '@/constants/theme';
import type { PriorityItem } from '@/lib/selectors';

import { Card, Pill } from './Card';

const LEVEL_COLOR: Record<PriorityItem['level'], string> = {
  critical: colors.help,
  high: colors.hazard,
  medium: colors.inside,
};

export function PriorityList({ items, onSelectFloor }: { items: PriorityItem[]; onSelectFloor: (f: number) => void }) {
  return (
    <Card title="Priority" right={<Pill color={colors.help} label={`${items.length} open`} />}>
      {items.length === 0 ? <Text style={styles.empty}>No priority items yet.</Text> : null}
      {items.map((item, i) => (
        <Pressable
          key={item.id}
          onPress={() => item.floor !== null && onSelectFloor(item.floor)}
          style={(state) => [styles.row, (state as { hovered?: boolean }).hovered && item.floor !== null && styles.rowHover]}>
          <Text style={styles.rank}>{i + 1}</Text>
          <View style={[styles.bar, { backgroundColor: LEVEL_COLOR[item.level] }]} />
          <View style={styles.body}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.detail}>{item.detail}</Text>
          </View>
          {item.floor !== null ? <Text style={styles.floor}>{item.floor}F</Text> : null}
        </Pressable>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.faint, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 6, borderRadius: 8 },
  rowHover: { backgroundColor: colors.panelRaised },
  rank: { color: colors.faint, width: 16, textAlign: 'right', fontSize: 12, fontWeight: '700' },
  bar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  body: { flex: 1, gap: 2 },
  title: { color: colors.text, fontSize: 14, fontWeight: '600' },
  detail: { color: colors.muted, fontSize: 12 },
  floor: { color: colors.muted, fontSize: 12, fontWeight: '700', paddingRight: 4 },
});
