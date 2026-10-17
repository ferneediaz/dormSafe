import { StyleSheet, Text, View } from 'react-native';

import { colors, routeColor, space } from '@/constants/theme';
import type { Route } from '@/lib/types';

import { Card, Pill } from './Card';

export function RouteStatus({ routes }: { routes: Route[] }) {
  return (
    <Card title="Evacuation routes">
      {routes.map((r) => (
        <View key={r.id} style={styles.row}>
          <View style={styles.body}>
            <Text style={styles.name}>{r.name}</Text>
            <Text style={styles.meta}>
              {r.blocked ? `Floors ${r.blocked[0]}–${r.blocked[1]} · ` : ''}
              {r.verification.replace('_', ' ').toLowerCase()}
            </Text>
          </View>
          <Pill color={routeColor[r.status]} label={r.status.toUpperCase()} />
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  body: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: 14, fontWeight: '600' },
  meta: { color: colors.muted, fontSize: 12 },
});
