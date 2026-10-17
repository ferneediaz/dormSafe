import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountabilityCard } from '@/components/dashboard/AccountabilityCard';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { EmergencyHeader } from '@/components/dashboard/EmergencyHeader';
import { FloorOverview } from '@/components/dashboard/FloorOverview';
import { PriorityList } from '@/components/dashboard/PriorityList';
import { RouteStatus } from '@/components/dashboard/RouteStatus';
import { ViewModeSwitcher } from '@/components/dashboard/ViewModeSwitcher';
import BuildingScene from '@/components/three/BuildingScene';
import { colors, space, statusColor, statusLabel } from '@/constants/theme';
import {
  countAll,
  countByFloor,
  focusFloor,
  priorities,
  sceneFloors,
  sceneMarkers,
  sceneRoutes,
} from '@/lib/selectors';
import { simSeconds, useDorm } from '@/lib/store';
import type { ResidentStatus, ViewMode } from '@/lib/types';

const WIDE = 900;

const HINT: Record<ViewMode, string> = {
  exterior: 'Tap a floor to cut away',
  xray: 'Tap a floor to isolate',
  exploded: 'Tap a floor to isolate',
  plan: '',
};

export default function CommandDashboard() {
  const { width, height } = useWindowDimensions();
  const wide = width >= WIDE;

  const { rooms, residents, routes, incidents, feed, tick, running, selectedFloor, viewMode } = useDorm();
  const { selectFloor, setViewMode, start, stop, reset } = useDorm.getState();

  useEffect(() => {
    start();
    return stop;
  }, [start, stop]);

  // Deep links, e.g. /?view=plan&floor=9
  const params = useLocalSearchParams<{ view?: string; floor?: string }>();
  useEffect(() => {
    if (params.view && params.view in HINT) setViewMode(params.view as ViewMode);
    if (params.floor) selectFloor(Number(params.floor));
  }, [params.view, params.floor, setViewMode, selectFloor]);

  const counts = useMemo(() => countAll(residents), [residents]);
  const byFloor = useMemo(() => countByFloor(residents), [residents]);
  const floors = useMemo(() => sceneFloors(rooms, residents), [rooms, residents]);
  const markers = useMemo(() => sceneMarkers(rooms, residents, incidents), [rooms, residents, incidents]);
  const stairs = useMemo(() => sceneRoutes(routes), [routes]);
  const items = useMemo(() => priorities(residents, incidents, byFloor), [residents, incidents, byFloor]);
  const focus = useMemo(() => focusFloor(byFloor, incidents), [byFloor, incidents]);

  const sceneWidth = wide ? width - 400 : width;
  const shownFloor = viewMode === 'plan' ? (selectedFloor ?? focus) : selectedFloor;
  const chip = shownFloor
    ? `${viewMode === 'plan' ? 'Plan · ' : ''}Floor ${shownFloor}${viewMode === 'exterior' ? ' cutaway' : ''} · ${byFloor[shownFloor].unknown} unknown${viewMode === 'plan' && selectedFloor === null ? ' · most urgent' : ''}`
    : HINT[viewMode];

  const scene = (
    <View style={wide ? styles.sceneWide : [styles.sceneNarrow, { height: Math.max(320, height * 0.5) }]}>
      <BuildingScene
        floors={floors}
        markers={markers}
        routes={stairs}
        mode={viewMode}
        selectedFloor={selectedFloor}
        focusFloor={focus}
        safeCount={counts.safe}
        onSelectFloor={selectFloor}
        dom={{ style: { flex: 1 }, scrollEnabled: false }}
      />
      <View style={styles.legend} pointerEvents="none">
        {(['safe', 'inside', 'help', 'unknown'] as ResidentStatus[]).map((s) => (
          <View key={s} style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: statusColor[s] }]} />
            <Text style={styles.legendText}>{statusLabel[s]}</Text>
          </View>
        ))}
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: colors.hazard, borderRadius: 6 }]} />
          <Text style={styles.legendText}>Hazard</Text>
        </View>
      </View>
      <View style={[styles.switcher, sceneWidth < 560 && styles.switcherNarrow]}>
        <ViewModeSwitcher value={viewMode} onChange={setViewMode} />
      </View>
      <View style={[styles.floorChip, sceneWidth < 560 && styles.floorChipNarrow]} pointerEvents="none">
        <Text style={styles.floorChipText}>{chip}</Text>
      </View>
    </View>
  );

  const widgets = (
    <>
      <AccountabilityCard counts={counts} />
      <PriorityList items={items} onSelectFloor={selectFloor} />
      <RouteStatus routes={routes} />
      <FloorOverview byFloor={byFloor} incidents={incidents} selected={selectedFloor} onSelect={selectFloor} />
      <ActivityFeed feed={feed} />
    </>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <EmergencyHeader
        seconds={simSeconds(tick)}
        running={running}
        compact={!wide}
        onToggle={running ? stop : start}
        onReplay={reset}
      />
      {wide ? (
        <View style={styles.row}>
          {scene}
          <ScrollView style={styles.sidebar} contentContainerStyle={styles.sidebarContent}>
            {widgets}
          </ScrollView>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.stackContent}>
          {scene}
          <View style={styles.stackWidgets}>{widgets}</View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  row: { flex: 1, flexDirection: 'row' },
  sceneWide: { flex: 1, position: 'relative', overflow: 'hidden' },
  sceneNarrow: { position: 'relative', overflow: 'hidden' },
  sidebar: { width: 400, flexGrow: 0, borderLeftWidth: 1, borderLeftColor: colors.border },
  sidebarContent: { padding: space.lg, gap: space.lg },
  stackContent: { paddingBottom: space.xl },
  stackWidgets: { padding: space.lg, gap: space.lg },
  legend: {
    position: 'absolute',
    left: space.lg,
    bottom: space.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
    backgroundColor: 'rgba(17, 24, 33, 0.85)',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    maxWidth: '92%',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 12, height: 12, borderRadius: 3 },
  legendText: { color: colors.muted, fontSize: 12 },
  floorChip: {
    position: 'absolute',
    left: space.lg,
    top: space.lg,
    backgroundColor: 'rgba(17, 24, 33, 0.85)',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  floorChipNarrow: { top: 62 },
  switcher: { position: 'absolute', right: space.lg, top: space.lg },
  switcherNarrow: { right: undefined, left: space.lg },
  floorChipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
});
