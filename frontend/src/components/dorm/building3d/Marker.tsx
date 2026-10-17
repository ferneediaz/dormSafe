import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh, MeshBasicMaterial } from "three";

import type { SceneMarker } from "./types";

import { C, SLAB_T, facadeZ, sideZ, slotX } from "./geometry";
import { Anchor } from "./labels";

/** Help beacon or hazard pulse. Positioned relative to its floor's group. */
export function Marker({
  marker,
  dimmed,
  exterior,
}: {
  marker: SceneMarker;
  dimmed: boolean;
  exterior: boolean;
}) {
  const pulse = useRef<Mesh>(null);
  const isHelp = marker.kind === "help";
  const color = isHelp ? C.help : C.hazard;

  // Outside the building, help beacons sit just off the facade so they read through walls.
  const z =
    exterior && isHelp && marker.side !== "corridor"
      ? facadeZ(marker.side) + (marker.side === "north" ? -0.7 : 0.7)
      : sideZ(marker.side);
  const y = SLAB_T + 0.55;
  const top = isHelp ? 1.7 : 0;

  useFrame(({ clock }) => {
    if (!pulse.current) return;
    const t = (clock.elapsedTime * 1.1) % 1;
    pulse.current.scale.setScalar(1 + t * 2.4);
    (pulse.current.material as MeshBasicMaterial).opacity =
      (1 - t) * (dimmed ? 0.1 : 0.6);
  });

  return (
    <group position={[slotX(marker.slot), y, z]}>
      {isHelp ? (
        <mesh position={[0, top / 2, 0]} renderOrder={10}>
          <cylinderGeometry args={[0.05, 0.05, top, 8]} />
          <meshBasicMaterial
            color={[2.5, 0.3, 0.3]}
            toneMapped={false}
            transparent
            opacity={dimmed ? 0.1 : 0.9}
            depthTest={false}
          />
        </mesh>
      ) : null}
      <mesh position={[0, top, 0]} renderOrder={11}>
        <sphereGeometry args={[isHelp ? 0.2 : 0.3, 20, 20]} />
        <meshBasicMaterial
          color={isHelp ? [3, 0.4, 0.4] : [3, 1.2, 0.3]}
          toneMapped={false}
          transparent
          opacity={dimmed ? 0.12 : 1}
          depthTest={false}
        />
      </mesh>
      <mesh ref={pulse} position={[0, top, 0]} renderOrder={12}>
        <sphereGeometry args={[isHelp ? 0.2 : 0.3, 20, 20]} />
        <meshBasicMaterial
          color={color}
          transparent
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
      {!dimmed ? (
        <Anchor id={`m:${marker.id}`} position={[0, top + 0.55, 0]} />
      ) : null}
    </group>
  );
}
