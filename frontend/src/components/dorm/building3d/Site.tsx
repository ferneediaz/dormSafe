import { Instance, Instances } from "@react-three/drei";
import { BackSide, Color } from "three";

import { C, DEPTH, LENGTH, STAIR_X, mulberry32 } from "./geometry";
import { Anchor } from "./labels";

const ASSEMBLY: [number, number] = [-9, 19];
const ENTRANCE_Z = DEPTH / 2 + 1.6;

function trees() {
  const rand = mulberry32(11);
  const out: { x: number; z: number; s: number; tint: Color }[] = [];
  while (out.length < 34) {
    const a = rand() * Math.PI * 2;
    const r = 15 + rand() * 30;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.abs(x) < STAIR_X + 4 && Math.abs(z) < DEPTH / 2 + 5) continue;
    if (Math.hypot(x - ASSEMBLY[0], z - ASSEMBLY[1]) < 6) continue;
    if (z > -21 && z < -15) continue; // road
    if (Math.abs(x) < 2.5 && z > 0 && z < 20) continue; // front path
    out.push({
      x,
      z,
      s: 0.8 + rand() * 0.7,
      tint: new Color().setHSL(
        0.36 + rand() * 0.05,
        0.35,
        0.16 + rand() * 0.08,
      ),
    });
  }
  return out;
}

const TREES = trees();

const NEIGHBORS: {
  pos: [number, number, number];
  size: [number, number, number];
}[] = [
  { pos: [-38, 4, -6], size: [12, 8, 18] },
  { pos: [34, 3, 8], size: [10, 6, 22] },
  { pos: [6, 5, -38], size: [26, 10, 9] },
  { pos: [-24, 2.5, 34], size: [14, 5, 8] },
];

const LAMPS: [number, number][] = [
  [2, 8],
  [2, 14],
  [-6, 17],
  [-12, 22],
  [12, 6],
  [-12, 6],
];

/** Campus around the dorm: lawn, plaza, paths, road, trees, lamps, nearby buildings, assembly point. */
export function Site({ dim }: { dim: boolean }) {
  return (
    <group>
      <SkyDome />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[220, 220]} />
        <meshStandardMaterial color={C.grass} roughness={1} />
      </mesh>
      {/* Plaza around the building */}
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[LENGTH + 9, 0.04, DEPTH + 6]} />
        <meshStandardMaterial color={C.plaza} roughness={0.95} />
      </mesh>
      {/* Front path to the assembly point */}
      <mesh position={[0, 0.03, (ENTRANCE_Z + 15) / 2]} receiveShadow>
        <boxGeometry args={[2.4, 0.04, 15 - ENTRANCE_Z]} />
        <meshStandardMaterial color={C.path} roughness={0.95} />
      </mesh>
      <mesh
        position={[ASSEMBLY[0] / 2, 0.03, (ASSEMBLY[1] + 15) / 2]}
        rotation={[0, Math.atan2(ASSEMBLY[1] - 15, -ASSEMBLY[0]), 0]}
        receiveShadow
      >
        <boxGeometry
          args={[Math.hypot(ASSEMBLY[0], ASSEMBLY[1] - 15) + 2, 0.04, 2]}
        />
        <meshStandardMaterial color={C.path} roughness={0.95} />
      </mesh>
      {/* Road */}
      <mesh position={[0, 0.02, -18]} receiveShadow>
        <boxGeometry args={[220, 0.03, 6]} />
        <meshStandardMaterial color={C.asphalt} roughness={0.9} />
      </mesh>
      <Instances limit={40}>
        <boxGeometry args={[1.6, 0.01, 0.15]} />
        <meshBasicMaterial color="#c9b458" />
        {Array.from({ length: 40 }, (_, i) => (
          <Instance key={i} position={[-78 + i * 4, 0.045, -18]} />
        ))}
      </Instances>

      {/* Trees */}
      <Instances limit={TREES.length} castShadow>
        <cylinderGeometry args={[0.12, 0.18, 1.4, 6]} />
        <meshStandardMaterial color="#3b2f25" roughness={1} />
        {TREES.map((t, i) => (
          <Instance key={i} position={[t.x, 0.7 * t.s, t.z]} scale={t.s} />
        ))}
      </Instances>
      <Instances limit={TREES.length} castShadow receiveShadow>
        <icosahedronGeometry args={[1.2, 0]} />
        <meshStandardMaterial roughness={0.9} flatShading />
        {TREES.map((t, i) => (
          <Instance
            key={i}
            position={[t.x, 2 * t.s, t.z]}
            scale={[t.s, t.s * 1.25, t.s]}
            color={t.tint}
          />
        ))}
      </Instances>

      {/* Neighbouring campus buildings */}
      {NEIGHBORS.map((b, i) => (
        <mesh key={i} position={b.pos} castShadow receiveShadow>
          <boxGeometry args={b.size} />
          <meshStandardMaterial color="#262c34" roughness={0.9} />
        </mesh>
      ))}

      {/* Lamps */}
      {LAMPS.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.04, 0.05, 2.2, 6]} />
            <meshStandardMaterial color="#2a2f35" />
          </mesh>
          <mesh position={[0, 2.25, 0]}>
            <sphereGeometry args={[0.14, 10, 10]} />
            <meshBasicMaterial color={[3, 2.3, 1.4]} toneMapped={false} />
          </mesh>
        </group>
      ))}

      <AssemblyPoint dim={dim} />
    </group>
  );
}

function AssemblyPoint({ dim }: { dim: boolean }) {
  return (
    <group position={[ASSEMBLY[0], 0, ASSEMBLY[1]]}>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[4, 48]} />
        <meshStandardMaterial color="#1f3a2a" roughness={1} />
      </mesh>
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.8, 4.05, 64]} />
        <meshBasicMaterial color={[0.4, 2.2, 0.9]} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 2.4, 8]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
      <mesh position={[0.35, 2.15, 0]}>
        <boxGeometry args={[0.7, 0.45, 0.04]} />
        <meshBasicMaterial color={[0.3, 1.8, 0.7]} toneMapped={false} />
      </mesh>
      {!dim ? <Anchor id="assembly" position={[0, 3, 0]} /> : null}
    </group>
  );
}

function SkyDome() {
  return (
    <mesh>
      <sphereGeometry args={[180, 32, 16]} />
      <shaderMaterial
        side={BackSide}
        depthWrite={false}
        fog={false}
        uniforms={{
          top: { value: new Color(C.sky) },
          bottom: { value: new Color(C.horizon) },
        }}
        vertexShader={`
          varying vec3 vPos;
          void main() {
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 top;
          uniform vec3 bottom;
          varying vec3 vPos;
          void main() {
            float h = clamp(normalize(vPos).y * 2.2, 0.0, 1.0);
            gl_FragColor = vec4(mix(bottom, top, pow(h, 0.7)), 1.0);
          }
        `}
      />
    </mesh>
  );
}
