'use dom';

import { Canvas } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';

import type { CSSProperties } from 'react';

import type { SceneFloor, SceneMarker, SceneRoute, ViewMode } from '@/lib/types';

import { CameraRig } from './building/CameraRig';
import { Floor, type FloorStyle } from './building/Floor';
import { C, STAIR_COLOR, roomNumber, routeStatusAt } from './building/geometry';
import { Label, LabelDriver } from './building/labels';
import { Roof } from './building/Roof';
import { Site } from './building/Site';

type Props = {
  floors: SceneFloor[];
  markers: SceneMarker[];
  routes: SceneRoute[];
  mode: ViewMode;
  selectedFloor: number | null;
  /** Floor shown in plan mode when nothing is selected. */
  focusFloor: number;
  safeCount: number;
  onSelectFloor: (floor: number | null) => void | Promise<void>;
  dom?: import('expo/dom').DOMProps;
};

function floorStyle(level: number, mode: ViewMode, selected: number | null, focus: number): FloorStyle {
  if (mode === 'plan') return level === (selected ?? focus) ? 'interior' : 'hidden';
  if (mode === 'exterior') {
    // Selecting a floor cuts the building open: floors above become a faint outline.
    if (selected === null || level < selected) return 'exterior';
    return level === selected ? 'interior' : 'ghost';
  }
  return 'xray';
}

export default function BuildingScene({
  floors,
  markers,
  routes,
  mode,
  selectedFloor,
  focusFloor,
  safeCount,
  onSelectFloor,
}: Props) {
  const planFloor = selectedFloor ?? focusFloor;
  const dimsOthers = (mode === 'xray' || mode === 'exploded') && selectedFloor !== null;

  return (
    <div style={{ position: 'absolute', inset: 0, background: C.sky }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [22, 11, 40], fov: 40, near: 0.5, far: 400 }}
        onPointerMissed={() => onSelectFloor(null)}>
        <fog attach="fog" args={[C.fog, 70, 170]} />
        <hemisphereLight args={['#8aa4c8', '#1a2016', 0.75]} />
        <directionalLight
          position={[-26, 34, 22]}
          intensity={1.5}
          color="#ffd7ad"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-camera-left={-40}
          shadow-camera-right={40}
          shadow-camera-top={40}
          shadow-camera-bottom={-40}
          shadow-camera-far={120}
        />
        <directionalLight position={[24, 12, -20]} intensity={0.35} color="#7dd3fc" />

        <Site dim={mode === 'plan'} />

        {floors.map((f) => (
          <Floor
            key={f.level}
            floor={f}
            mode={mode}
            style={floorStyle(f.level, mode, selectedFloor, focusFloor)}
            selected={mode === 'plan' ? f.level === planFloor : selectedFloor === f.level}
            dimmed={dimsOthers && selectedFloor !== f.level}
            routes={routes}
            markers={markers.filter((m) => m.floor === f.level)}
            onSelect={() => onSelectFloor(selectedFloor === f.level ? null : f.level)}
          />
        ))}
        {mode === 'exterior' && selectedFloor === null ? <Roof /> : null}

        <CameraRig mode={mode} selected={mode === 'plan' ? null : selectedFloor} focus={planFloor} />

        <LabelDriver />

        <EffectComposer multisampling={4}>
          <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.9} />
          <Vignette offset={0.3} darkness={0.55} />
        </EffectComposer>
      </Canvas>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <SceneLabels
          floors={floors}
          markers={markers}
          routes={routes}
          mode={mode}
          selectedFloor={selectedFloor}
          planFloor={planFloor}
          safeCount={safeCount}
        />
      </div>
    </div>
  );
}

/** DOM labels; each one follows an <Anchor> with the same id placed in the scene. */
function SceneLabels({
  floors,
  markers,
  routes,
  mode,
  selectedFloor,
  planFloor,
  safeCount,
}: {
  floors: SceneFloor[];
  markers: SceneMarker[];
  routes: SceneRoute[];
  mode: ViewMode;
  selectedFloor: number | null;
  planFloor: number;
  safeCount: number;
}) {
  const plan = floors[planFloor - 1];
  return (
    <>
      {markers.map((m) => (
        <Label key={m.id} id={`m:${m.id}`} style={m.kind === 'help' ? helpTag : hazardTag}>
          {m.kind === 'help' ? '⚠ ' : '▲ '}
          {m.label}
        </Label>
      ))}

      <Label id="assembly" style={assemblyTag}>
        Assembly Point A · {safeCount} safe
      </Label>

      {mode === 'exploded'
        ? floors.map((f) => {
            const active = selectedFloor === f.level;
            return (
              <Label key={f.level} id={`tag:${f.level}`} style={active ? { ...floorTag, ...floorTagActive } : floorTag}>
                <span>{f.level}F</span>
                {f.help > 0 ? <span style={{ marginLeft: 8, color: active ? '#7f1d1d' : '#f87171' }}>● {f.help}</span> : null}
                <span style={{ marginLeft: 8, opacity: 0.75 }}>{f.unknown ? `${f.unknown}?` : '✓'}</span>
              </Label>
            );
          })
        : null}

      {mode === 'plan' && plan
        ? plan.rooms.map((status, idx) =>
            status ? (
              <Label key={idx} id={`room:${plan.level}:${idx}`} style={roomTag}>
                {roomNumber(plan.level, idx)}
              </Label>
            ) : null,
          )
        : null}
      {mode === 'plan' && plan
        ? routes.map((r) => {
            const status = routeStatusAt(r, plan.level);
            return (
              <Label key={r.side} id={`stair:${r.side}:${plan.level}`} style={{ ...roomTag, background: STAIR_COLOR[status] }}>
                Stair {r.side === 'west' ? 'A' : 'B'} · {status.toUpperCase()}
              </Label>
            );
          })
        : null}
    </>
  );
}

const tag: CSSProperties = {
  padding: '3px 8px',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  color: '#fff',
  boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
};
const helpTag: CSSProperties = { ...tag, background: 'rgba(185, 28, 28, 0.92)', border: `1px solid ${C.help}` };
const hazardTag: CSSProperties = { ...tag, background: 'rgba(194, 65, 12, 0.92)', border: `1px solid ${C.hazard}` };
const assemblyTag: CSSProperties = {
  ...tag,
  fontWeight: 700,
  color: '#dcfce7',
  background: 'rgba(20, 83, 45, 0.92)',
  border: `1px solid ${C.safe}`,
};
const floorTag: CSSProperties = {
  ...tag,
  fontSize: 13,
  fontWeight: 700,
  padding: '4px 10px',
  background: 'rgba(17, 24, 33, 0.9)',
  color: '#e6edf3',
  border: '1px solid #2b3b4e',
};
const floorTagActive: CSSProperties = { background: 'rgba(56, 189, 248, 0.95)', color: '#0a0e14' };
const roomTag: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#0a0e14',
  background: 'rgba(255, 255, 255, 0.88)',
  borderRadius: 4,
  padding: '1px 5px',
};
