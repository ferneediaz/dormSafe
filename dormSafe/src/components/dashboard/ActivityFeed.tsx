import { StyleSheet, Text, View } from 'react-native';

import { colors, mono, space } from '@/constants/theme';
import { formatClock } from '@/lib/selectors';
import type { FeedEvent } from '@/lib/types';

import { Card } from './Card';

const TONE: Record<FeedEvent['tone'], string> = {
  info: colors.accent,
  warn: colors.hazard,
  critical: colors.help,
  good: colors.safe,
};

export function ActivityFeed({ feed }: { feed: FeedEvent[] }) {
  return (
    <Card title="Live activity">
      {feed.slice(0, 8).map((e) => (
        <View key={e.id} style={styles.row}>
          <View style={[styles.dot, { backgroundColor: TONE[e.tone] }]} />
          <Text style={[styles.time, mono]}>{formatClock(e.at)}</Text>
          <Text style={styles.text}>{e.text}</Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 6 },
  time: { color: colors.faint, fontSize: 12, marginTop: 1 },
  text: { color: colors.text, fontSize: 13, flex: 1, lineHeight: 18 },
});
