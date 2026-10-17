import { CameraControls } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';

import type { ViewMode } from '@/lib/types';

import { FLOOR_H, FLOORS, floorBase } from './geometry';

type Pose = [number, number, number, number, number, number];

function pose(mode: ViewMode, selected: number | null, focus: number): Pose {
  if (mode === 'plan') {
    const y = floorBase(focus, mode);
    return [0, y + 30, 0.01, 0, y, 0];
  }
  if (selected !== null) {
    const y = floorBase(selected, mode) + 0.8;
    return [17, y + 9, 21, 0, y, 0];
  }
  if (mode === 'exploded') {
    const mid = (floorBase(FLOORS, mode) + FLOOR_H) / 2;
    return [44, mid + 12, 46, 0, mid, 0];
  }
  if (mode === 'xray') return [28, 20, 30, 0, 8, 0];
  return [22, 11, 40, 0, 7.5, 0];
}

const IDLE_BEFORE_ROTATE = 8;

export function CameraRig({ mode, selected, focus }: { mode: ViewMode; selected: number | null; focus: number }) {
  const ref = useRef<CameraControls>(null);
  const lastInput = useRef(0);
  const clockNow = useRef(0);

  useEffect(() => {
    lastInput.current = clockNow.current;
    ref.current?.setLookAt(...pose(mode, selected, focus), true);
  }, [mode, selected, focus]);

  useFrame(({ clock }, dt) => {
    clockNow.current = clock.elapsedTime;
    const c = ref.current;
    if (!c || mode === 'plan' || selected !== null) return;
    if (clock.elapsedTime - lastInput.current > IDLE_BEFORE_ROTATE) c.azimuthAngle += dt * 0.04;
  });

  const plan = mode === 'plan';
  return (
    <CameraControls
      ref={ref}
      makeDefault
      smoothTime={0.6}
      minDistance={6}
      maxDistance={95}
      minPolarAngle={plan ? 0 : 0.15}
      maxPolarAngle={plan ? 0.35 : Math.PI * 0.47}
      onControlStart={() => {
        lastInput.current = clockNow.current;
      }}
      onControl={() => {
        lastInput.current = clockNow.current;
      }}
    />
  );
}
