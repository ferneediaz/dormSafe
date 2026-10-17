import { Edges, Instance, Instances, useCursor } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import type { Group } from "three";

import type {
  RouteStatus,
  SceneFloor,
  SceneMarker,
  SceneRoute,
  ViewMode,
} from "./types";

import {
  C,
  CORRIDOR,
  DEPTH,
  FLOOR_H,
  LENGTH,
  LOBBY_SLOT,
  PITCH,
  ROOM_D,
  SLAB_T,
  SLOTS,
  STAIR,
  STAIR_COLOR,
  STAIR_GLOW,
  STAIR_X,
  STATUS,
  WALL_H,
  WINDOW,
  facadeZ,
  floorBase,
  roomAt,
  routeStatusAt,
  sideZ,
  slotX,
} from "./geometry";
import { Anchor } from "./labels";
import { Marker } from "./Marker";

/** How a floor is drawn: realistic shell, cut open, see-through, faint outline, or not at all. */
export type FloorStyle = "exterior" | "interior" | "xray" | "ghost" | "hidden";

type Props = {
  floor: SceneFloor;
  mode: ViewMode;
  style: FloorStyle;
  selected: boolean;
  dimmed: boolean;
  routes: SceneRoute[];
  markers: SceneMarker[];
  onSelect: () => void;
};

export function Floor({
  floor,
  mode,
  style,
  selected,
  dimmed,
  routes,
  markers,
  onSelect,
}: Props) {
  const ref = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered && style !== "hidden");

  const lifted = selected && (mode === "xray" || mode === "exploded");
  const goalY = floorBase(floor.level, mode) + (lifted ? 0.5 : 0);

  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.y += (goalY - ref.current.position.y) * 0.1;
  });

  return (
    <group
      ref={ref}
      position={[0, goalY, 0]}
      visible={style !== "hidden"}
      onClick={(e) => {
        if (style === "hidden") return;
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {style === "exterior" ? (
        <ExteriorShell floor={floor} hovered={hovered} />
      ) : null}
      {style === "interior" ? (
        <InteriorCut floor={floor} labels={mode === "plan"} />
      ) : null}
      {style === "xray" ? (
        <XrayFloor
          floor={floor}
          selected={selected}
          dimmed={dimmed}
          hovered={hovered}
        />
      ) : null}
      {style === "ghost" ? <GhostShell opacity={0.05} /> : null}

      {style !== "hidden"
        ? routes.map((r) => (
            <StairSegment
              key={r.side}
              side={r.side}
              level={floor.level}
              status={routeStatusAt(r, floor.level)}
              style={style}
              dimmed={dimmed}
              label={mode === "plan"}
            />
          ))
        : null}

      {style !== "hidden" && style !== "ghost"
        ? markers.map((m) => (
            <Marker
              key={m.id}
              marker={m}
              dimmed={dimmed}
              exterior={style === "exterior"}
            />
          ))
        : null}

      {mode === "exploded" && style !== "hidden" ? (
        <Anchor
          id={`tag:${floor.level}`}
          position={[-(LENGTH / 2 + STAIR + 1.6), 0.5, 0]}
        />
      ) : null}
    </group>
  );
}

function ExteriorShell({
  floor,
  hovered,
}: {
  floor: SceneFloor;
  hovered: boolean;
}) {
  const rooms = floor.rooms
    .map((status, idx) => ({ status, ...roomAt(idx) }))
    .filter((r) => r.status !== null);
  const winY = SLAB_T + WALL_H * 0.56;
  const winH = WALL_H * 0.52;

  return (
    <group>
      <mesh position={[0, SLAB_T / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[LENGTH + 0.3, SLAB_T, DEPTH + 0.3]} />
        <meshStandardMaterial
          color={hovered ? "#bfe3ff" : C.band}
          roughness={0.75}
        />
      </mesh>
      <mesh position={[0, SLAB_T + WALL_H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[LENGTH, WALL_H, DEPTH]} />
        <meshStandardMaterial color={C.tile} roughness={0.9} />
      </mesh>

      {/* Window frames, two per room */}
      <Instances limit={SLOTS * 4} castShadow>
        <boxGeometry args={[PITCH * 0.36, winH + 0.1, 0.04]} />
        <meshStandardMaterial color="#3a4048" roughness={0.5} metalness={0.4} />
        {rooms.flatMap((r) =>
          PANES.map((dx) => (
            <Instance
              key={`${r.side}${r.slot}${dx}`}
              position={[
                slotX(r.slot) + dx,
                winY,
                facadeZ(r.side) + (r.side === "north" ? -0.02 : 0.02),
              ]}
            />
          )),
        )}
      </Instances>
      {/* Glowing glass, tinted by the room's status */}
      <Instances limit={SLOTS * 4}>
        <boxGeometry args={[PITCH * 0.3, winH, 0.03]} />
        <meshBasicMaterial toneMapped={false} />
        {rooms.flatMap((r) =>
          PANES.map((dx) => (
            <Instance
              key={`${r.side}${r.slot}${dx}`}
              position={[
                slotX(r.slot) + dx,
                winY,
                facadeZ(r.side) + (r.side === "north" ? -0.045 : 0.045),
              ]}
              color={WINDOW[r.status!]}
            />
          )),
        )}
      </Instances>
      {/* Vertical fins between bays */}
      <Instances limit={(SLOTS + 1) * 2} castShadow>
        <boxGeometry args={[0.09, WALL_H, 0.22]} />
        <meshStandardMaterial color={C.fin} roughness={0.85} />
        {(["north", "south"] as const).flatMap((side) =>
          Array.from({ length: SLOTS + 1 }, (_, i) => (
            <Instance
              key={`${side}${i}`}
              position={[
                -LENGTH / 2 + i * PITCH,
                SLAB_T + WALL_H / 2,
                facadeZ(side) + (side === "north" ? -0.11 : 0.11),
              ]}
            />
          )),
        )}
      </Instances>
      {/* Wall-mounted AC units */}
      <Instances limit={SLOTS * 2} castShadow>
        <boxGeometry args={[0.34, 0.2, 0.2]} />
        <meshStandardMaterial color={C.ac} roughness={0.6} />
        {rooms.map((r) => (
          <Instance
            key={`${r.side}${r.slot}`}
            position={[
              slotX(r.slot) + PITCH * 0.36,
              SLAB_T + 0.16,
              facadeZ(r.side) + (r.side === "north" ? -0.13 : 0.13),
            ]}
          />
        ))}
      </Instances>

      <Lobby level={floor.level} />
    </group>
  );
}

const PANES = [-PITCH / 4, PITCH / 4];

/** Lounge glazing on every floor's south lobby bay; the ground floor gets the entrance and canopy. */
function Lobby({ level }: { level: number }) {
  const x = slotX(LOBBY_SLOT);
  const z = facadeZ("south");
  if (level > 1) {
    return (
      <mesh position={[x, SLAB_T + WALL_H * 0.56, z + 0.04]}>
        <boxGeometry args={[PITCH * 0.8, WALL_H * 0.52, 0.03]} />
        <meshBasicMaterial color={[0.55, 0.62, 0.72]} toneMapped={false} />
      </mesh>
    );
  }
  return (
    <group>
      <mesh position={[x, SLAB_T + WALL_H * 0.45, z + 0.04]}>
        <boxGeometry args={[PITCH - 0.1, WALL_H * 0.88, 0.04]} />
        <meshBasicMaterial color={[1.6, 1.25, 0.8]} toneMapped={false} />
      </mesh>
      <mesh position={[x, FLOOR_H - 0.12, z + 0.8]} castShadow>
        <boxGeometry args={[PITCH * 1.7, 0.1, 1.6]} />
        <meshStandardMaterial color={C.band} roughness={0.6} />
      </mesh>
      {[-1, 1].map((k) => (
        <mesh
          key={k}
          position={[x + k * PITCH * 0.75, (FLOOR_H - 0.12) / 2, z + 1.45]}
          castShadow
        >
          <cylinderGeometry args={[0.06, 0.06, FLOOR_H - 0.12, 10]} />
          <meshStandardMaterial
            color={C.steel}
            metalness={0.6}
            roughness={0.35}
          />
        </mesh>
      ))}
    </group>
  );
}

function RoomBlocks({
  floor,
  opacity,
  labels,
}: {
  floor: SceneFloor;
  opacity: number;
  labels?: boolean;
}) {
  const h = 0.9;
  return (
    <>
      <Instances limit={SLOTS * 2} castShadow={opacity === 1}>
        <boxGeometry args={[PITCH - 0.12, h, ROOM_D - 0.12]} />
        <meshStandardMaterial
          transparent={opacity < 1}
          opacity={opacity}
          depthWrite={opacity === 1}
          roughness={0.55}
        />
        {floor.rooms.map((status, idx) => {
          if (!status) return null;
          const { side, slot } = roomAt(idx);
          return (
            <Instance
              key={idx}
              position={[slotX(slot), SLAB_T + h / 2, sideZ(side)]}
              color={STATUS[status]}
            />
          );
        })}
      </Instances>
      {labels
        ? floor.rooms.map((status, idx) => {
            if (!status) return null;
            const { side, slot } = roomAt(idx);
            return (
              <Anchor
                key={idx}
                id={`room:${floor.level}:${idx}`}
                position={[slotX(slot), SLAB_T + h + 0.05, sideZ(side)]}
              />
            );
          })
        : null}
    </>
  );
}

function InteriorCut({
  floor,
  labels,
}: {
  floor: SceneFloor;
  labels: boolean;
}) {
  const wallH = 0.35;
  return (
    <group>
      <mesh position={[0, SLAB_T / 2, 0]} receiveShadow>
        <boxGeometry args={[LENGTH + 0.3, SLAB_T, DEPTH + 0.3]} />
        <meshStandardMaterial color="#d9dde2" roughness={0.9} />
      </mesh>
      {/* Corridor */}
      <mesh position={[0, SLAB_T + 0.005, 0]}>
        <boxGeometry args={[LENGTH - 0.1, 0.01, CORRIDOR - 0.1]} />
        <meshStandardMaterial color="#9aa3ad" roughness={0.9} />
      </mesh>
      {/* Low cut walls around the perimeter */}
      {(
        [
          [0, -DEPTH / 2, LENGTH, 0.12],
          [0, DEPTH / 2, LENGTH, 0.12],
          [-LENGTH / 2, 0, 0.12, DEPTH],
          [LENGTH / 2, 0, 0.12, DEPTH],
        ] as const
      ).map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, SLAB_T + wallH / 2, z]} castShadow>
          <boxGeometry args={[w, wallH, d]} />
          <meshStandardMaterial color={C.tile} roughness={0.9} />
        </mesh>
      ))}
      <RoomBlocks floor={floor} opacity={1} labels={labels} />
    </group>
  );
}

function XrayFloor({
  floor,
  selected,
  dimmed,
  hovered,
}: {
  floor: SceneFloor;
  selected: boolean;
  dimmed: boolean;
  hovered: boolean;
}) {
  return (
    <group>
      <mesh position={[0, SLAB_T / 2, 0]}>
        <boxGeometry args={[LENGTH + 0.3, SLAB_T, DEPTH + 0.3]} />
        <meshStandardMaterial
          color={selected ? "#24405c" : C.slabDark}
          transparent
          opacity={dimmed ? 0.08 : 0.9}
          depthWrite={!dimmed}
        />
        <Edges
          color={selected || hovered ? C.accent : C.edge}
          transparent
          opacity={dimmed ? 0.15 : 1}
        />
      </mesh>
      <GhostShell opacity={dimmed ? 0.02 : 0.06} />
      <RoomBlocks floor={floor} opacity={dimmed ? 0.1 : 1} />
    </group>
  );
}

function GhostShell({ opacity }: { opacity: number }) {
  return (
    <mesh position={[0, SLAB_T + WALL_H / 2, 0]}>
      <boxGeometry args={[LENGTH, WALL_H, DEPTH]} />
      <meshStandardMaterial
        color={C.ghost}
        transparent
        opacity={opacity}
        depthWrite={false}
      />
      <Edges color="#2b4a66" transparent opacity={0.5} />
    </mesh>
  );
}

function StairSegment({
  side,
  level,
  status,
  style,
  dimmed,
  label,
}: {
  side: "west" | "east";
  level: number;
  status: RouteStatus;
  style: FloorStyle;
  dimmed: boolean;
  label: boolean;
}) {
  const s = side === "west" ? -1 : 1;
  const x = s * STAIR_X;

  if (style === "exterior") {
    return (
      <group position={[x, 0, 0]}>
        <mesh position={[0, FLOOR_H / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[STAIR, FLOOR_H, STAIR]} />
          <meshStandardMaterial color={C.core} roughness={0.9} />
        </mesh>
        {/* Slit windows show stairwell status */}
        <mesh position={[0, FLOOR_H * 0.5, STAIR / 2 + 0.01]}>
          <boxGeometry args={[0.32, FLOOR_H * 0.62, 0.03]} />
          <meshBasicMaterial color={STAIR_GLOW[status]} toneMapped={false} />
        </mesh>
        <mesh position={[s * (STAIR / 2 + 0.01), FLOOR_H * 0.5, 0]}>
          <boxGeometry args={[0.03, FLOOR_H * 0.62, 0.32]} />
          <meshBasicMaterial color={STAIR_GLOW[status]} toneMapped={false} />
        </mesh>
      </group>
    );
  }

  const blocked = status === "blocked";
  const color = STAIR_COLOR[status];
  const opacity = style === "ghost" || dimmed ? 0.05 : blocked ? 0.8 : 0.3;
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, FLOOR_H / 2, 0]}>
        <boxGeometry args={[STAIR, FLOOR_H * 0.94, STAIR]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={opacity}
          emissive={color}
          emissiveIntensity={blocked ? 0.7 : 0.2}
          depthWrite={false}
        />
      </mesh>
      {label ? (
        <Anchor
          id={`stair:${side}:${level}`}
          position={[0, FLOOR_H, STAIR / 2 + 0.7]}
        />
      ) : null}
    </group>
  );
}
