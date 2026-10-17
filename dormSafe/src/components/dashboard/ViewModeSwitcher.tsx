import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import type { ViewMode } from '@/lib/types';

const MODES: { id: ViewMode; label: string }[] = [
  { id: 'exterior', label: 'Exterior' },
  { id: 'xray', label: 'X-ray' },
  { id: 'exploded', label: 'Exploded' },
  { id: 'plan', label: 'Plan' },
];

export function ViewModeSwitcher({ value, onChange }: { value: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <View style={styles.wrap}>
      {MODES.map((m) => {
        const active = m.id === value;
        return (
          <Pressable
            key={m.id}
            onPress={() => onChange(m.id)}
            style={(state) => [
              styles.btn,
              (state as { hovered?: boolean }).hovered && !active && styles.hover,
              active && styles.active,
            ]}>
            <Text style={[styles.label, active && styles.activeLabel]}>{m.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    padding: 3,
    gap: 2,
    backgroundColor: 'rgba(17, 24, 33, 0.88)',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
  },
  btn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 7 },
  hover: { backgroundColor: colors.panelRaised },
  active: { backgroundColor: colors.accent },
  label: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  activeLabel: { color: '#06131d' },
});
