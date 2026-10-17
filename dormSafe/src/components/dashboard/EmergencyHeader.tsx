import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, mono, space } from '@/constants/theme';
import { formatClock } from '@/lib/selectors';

export function EmergencyHeader({
  seconds,
  running,
  compact,
  onToggle,
  onReplay,
}: {
  seconds: number;
  running: boolean;
  compact: boolean;
  onToggle: () => void;
  onReplay: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.left}>
        <View style={styles.alert}>
          <View style={styles.alertDot} />
          <Text style={styles.alertText}>EARTHQUAKE</Text>
        </View>
        <View>
          <Text style={styles.title}>DormSafe · Dorm A Command</Text>
          {!compact ? <Text style={styles.sub}>Emergency mode active · 12 floors · 812 registered residents</Text> : null}
        </View>
      </View>
      <View style={styles.right}>
        <View style={styles.sim}>
          <Text style={styles.simText}>SIMULATED</Text>
        </View>
        <Text style={[styles.clock, mono]}>{formatClock(seconds)}</Text>
        <Pressable onPress={onToggle} style={styles.btn}>
          <Text style={styles.btnText}>{running ? 'Pause' : 'Resume'}</Text>
        </Pressable>
        <Pressable onPress={onReplay} style={styles.btn}>
          <Text style={styles.btnText}>Replay</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.panel,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexShrink: 1 },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3b0d0d',
    borderColor: colors.help,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  alertDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.help },
  alertText: { color: '#fecaca', fontWeight: '800', fontSize: 12, letterSpacing: 1.5 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sim: { borderColor: colors.inside, borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  simText: { color: colors.inside, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  clock: { color: colors.text, fontSize: 15, fontWeight: '700', minWidth: 72, textAlign: 'center' },
  btn: {
    backgroundColor: colors.panelRaised,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  btnText: { color: colors.text, fontSize: 13, fontWeight: '600' },
});
