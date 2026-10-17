import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Mesh } from 'three';

import { C, DEPTH, FLOOR_H, FLOORS, LENGTH, STAIR, STAIR_X } from './geometry';

/** Rooftop: parapet, stair housings, stainless water tanks (a Taiwan rooftop staple), condensers, antenna. */
export function Roof() {
  const beacon = useRef<Mesh>(null);
  const y = FLOORS * FLOOR_H;
  const parapetH = 0.45;

  useFrame(({ clock }) => {
    if (beacon.current) beacon.current.visible = Math.floor(clock.elapsedTime * 1.2) % 2 === 0;
  });

  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[LENGTH + 0.3, 0.2, DEPTH + 0.3]} />
        <meshStandardMaterial color={C.roof} roughness={0.95} />
      </mesh>
      {(
        [
          [0, -DEPTH / 2 - 0.07, LENGTH + 0.3, 0.15],
          [0, DEPTH / 2 + 0.07, LENGTH + 0.3, 0.15],
          [-LENGTH / 2 - 0.07, 0, 0.15, DEPTH + 0.3],
          [LENGTH / 2 + 0.07, 0, 0.15, DEPTH + 0.3],
        ] as const
      ).map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, 0.2 + parapetH / 2, z]} castShadow>
          <boxGeometry args={[w, parapetH, d]} />
          <meshStandardMaterial color={C.band} roughness={0.8} />
        </mesh>
      ))}

      {/* Stair housings */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * STAIR_X, FLOOR_H / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[STAIR, FLOOR_H, STAIR]} />
          <meshStandardMaterial color={C.core} roughness={0.9} />
        </mesh>
      ))}

      {/* Water tanks on a steel stand */}
      <group position={[LENGTH / 2 - 3.2, 0.2, -1]}>
        <mesh position={[0, 0.25, 0]} castShadow>
          <boxGeometry args={[3.6, 0.5, 1.6]} />
          <meshStandardMaterial color="#5b6168" metalness={0.5} roughness={0.5} />
        </mesh>
        {[-1.15, 0, 1.15].map((x) => (
          <mesh key={x} position={[x, 1.05, 0]} castShadow>
            <cylinderGeometry args={[0.5, 0.5, 1.1, 24]} />
            <meshStandardMaterial color={C.steel} metalness={0.85} roughness={0.25} />
          </mesh>
        ))}
      </group>

      {/* Condensers */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[-LENGTH / 2 + 3 + (i % 3) * 1.3, 0.45, (i < 3 ? -1 : 1) * 1.2]} castShadow>
          <boxGeometry args={[0.9, 0.5, 0.7]} />
          <meshStandardMaterial color={C.ac} roughness={0.6} />
        </mesh>
      ))}

      {/* Antenna with aviation light */}
      <mesh position={[-2, 1.6, 0]}>
        <cylinderGeometry args={[0.03, 0.05, 2.8, 6]} />
        <meshStandardMaterial color="#9aa1a8" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh ref={beacon} position={[-2, 3.05, 0]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshBasicMaterial color={[4, 0.3, 0.3]} toneMapped={false} />
      </mesh>
    </group>
  );
}
