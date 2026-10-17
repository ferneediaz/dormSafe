import { useFrame } from '@react-three/fiber';
import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef } from 'react';
import { type Group, type Object3D, Vector3 } from 'three';

/*
 * Lightweight 3D labels. drei's <Html> mounts a React root per label, which breaks
 * when dozens mount/unmount at once. Instead, scene code places invisible <Anchor>s and
 * a plain DOM overlay renders <Label>s; <LabelDriver> positions each label over its
 * anchor every frame. A label with no (visible) anchor is hidden.
 */

const anchors = new Map<string, Object3D>();
const labels = new Map<string, HTMLDivElement>();

export function Anchor({ id, position }: { id: string; position: [number, number, number] }) {
  const ref = useRef<Group>(null);
  useEffect(() => {
    const obj = ref.current;
    if (!obj) return;
    anchors.set(id, obj);
    return () => {
      if (anchors.get(id) === obj) anchors.delete(id);
    };
  }, [id]);
  return <group ref={ref} position={position} />;
}

export function Label({ id, children, style }: { id: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      ref={(el) => {
        if (!el) return;
        labels.set(id, el);
        return () => {
          if (labels.get(id) === el) labels.delete(id);
        };
      }}
      style={{ ...base, ...style }}>
      {children}
    </div>
  );
}

function worldVisible(obj: Object3D) {
  for (let o: Object3D | null = obj; o; o = o.parent) if (!o.visible) return false;
  return true;
}

export function LabelDriver() {
  const v = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const [id, el] of labels) {
      const obj = anchors.get(id);
      if (!obj || !worldVisible(obj)) {
        el.style.display = 'none';
        continue;
      }
      obj.getWorldPosition(v);
      const dist = v.distanceTo(camera.position);
      v.project(camera);
      if (v.z > 1) {
        el.style.display = 'none';
        continue;
      }
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      const scale = Math.min(1.1, Math.max(0.65, 34 / dist));
      el.style.display = 'block';
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${scale.toFixed(3)})`;
      el.style.zIndex = String(Math.max(1, Math.round(1000 - dist * 5)));
    }
  });
  return null;
}

const base: CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  display: 'none',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
  willChange: 'transform',
};
