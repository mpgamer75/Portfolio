'use client';

import { useRef } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { GRAPH } from './skillsGraph';

/*
 * This module is only ever loaded on the client (the gate imports it with
 * `ssr: false`), so module-scope `document` access and the single shared scene
 * buffers below are safe. The constellation is a singleton, so keeping the
 * per-frame working buffers at module scope (rather than in hook state/refs)
 * keeps render pure — render only reads these constants; `useFrame` mutates them.
 */

const NODES = GRAPH.nodes;
const NODE_COUNT = NODES.length;
const CLUSTER_COLORS = GRAPH.clusters.map((c) => new THREE.Color(c.color));

const NODE_POSITIONS = new Float32Array(NODE_COUNT * 3);
const CLUSTER_OF = new Int16Array(NODE_COUNT);
const IS_HUB = new Uint8Array(NODE_COUNT);
NODES.forEach((node, i) => {
  NODE_POSITIONS[i * 3] = node.position[0];
  NODE_POSITIONS[i * 3 + 1] = node.position[1];
  NODE_POSITIONS[i * 3 + 2] = node.position[2];
  CLUSTER_OF[i] = node.cluster;
  IS_HUB[i] = node.isHub ? 1 : 0;
});

const LINE_POSITIONS = new Float32Array(GRAPH.links.length * 6);
GRAPH.links.forEach((link, i) => {
  const a = NODES[link.a].position;
  const b = NODES[link.b].position;
  LINE_POSITIONS[i * 6] = a[0];
  LINE_POSITIONS[i * 6 + 1] = a[1];
  LINE_POSITIONS[i * 6 + 2] = a[2];
  LINE_POSITIONS[i * 6 + 3] = b[0];
  LINE_POSITIONS[i * 6 + 4] = b[1];
  LINE_POSITIONS[i * 6 + 5] = b[2];
});

const restIntensity = (i: number) => (IS_HUB[i] ? 0.9 : 0.6);

/** Mutable per-frame working buffers (shared singleton). */
const INTENSITY = new Float32Array(NODE_COUNT);
const COLORS = new Float32Array(NODE_COUNT * 3);
for (let i = 0; i < NODE_COUNT; i++) {
  const it = restIntensity(i);
  const c = CLUSTER_COLORS[CLUSTER_OF[i]];
  INTENSITY[i] = it;
  COLORS[i * 3] = c.r * it;
  COLORS[i * 3 + 1] = c.g * it;
  COLORS[i * 3 + 2] = c.b * it;
}

/** Soft round sprite for the node points (canvas-generated — no external asset, CSP-safe). */
function makeNodeSprite(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.3)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

const SPRITE = makeNodeSprite();

function Scene() {
  const parallax = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const colorAttr = useRef<THREE.BufferAttribute>(null);
  const hoverCluster = useRef<number | null>(null);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05); // clamp to avoid jumps after a pause
    if (spin.current) spin.current.rotation.y += dt * 0.06;
    if (parallax.current) {
      const tx = -state.pointer.y * 0.2;
      const ty = state.pointer.x * 0.25;
      parallax.current.rotation.x += (tx - parallax.current.rotation.x) * 0.05;
      parallax.current.rotation.y += (ty - parallax.current.rotation.y) * 0.05;
    }

    const hc = hoverCluster.current;
    for (let i = 0; i < NODE_COUNT; i++) {
      const target = hc === null ? restIntensity(i) : CLUSTER_OF[i] === hc ? 1.0 : 0.16;
      INTENSITY[i] += (target - INTENSITY[i]) * 0.12;
      const c = CLUSTER_COLORS[CLUSTER_OF[i]];
      COLORS[i * 3] = c.r * INTENSITY[i];
      COLORS[i * 3 + 1] = c.g * INTENSITY[i];
      COLORS[i * 3 + 2] = c.b * INTENSITY[i];
    }
    if (colorAttr.current) colorAttr.current.needsUpdate = true;
  });

  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.index != null) hoverCluster.current = NODES[e.index].cluster;
  };

  return (
    <group ref={parallax}>
      <group ref={spin} scale={0.82}>
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[LINE_POSITIONS, 3]} />
          </bufferGeometry>
          <lineBasicMaterial
            color="#10B981"
            transparent
            opacity={0.16}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </lineSegments>

        <points onPointerMove={handleMove} onPointerOut={() => (hoverCluster.current = null)}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[NODE_POSITIONS, 3]} />
            <bufferAttribute ref={colorAttr} attach="attributes-color" args={[COLORS, 3]} />
          </bufferGeometry>
          <pointsMaterial
            vertexColors
            size={0.42}
            sizeAttenuation
            map={SPRITE}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            alphaTest={0.01}
          />
        </points>
      </group>
    </group>
  );
}

interface SkillsConstellationProps {
  /** When false the render loop hard-stops (frameloop="never") so the GPU idles offscreen. */
  active: boolean;
}

export default function SkillsConstellation({ active }: SkillsConstellationProps) {
  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 12], fov: 50 }}
      gl={{
        antialias: false,
        alpha: true,
        depth: true,
        stencil: false,
        powerPreference: 'high-performance',
      }}
      onCreated={({ raycaster }) => {
        raycaster.params.Points.threshold = 0.45;
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <Scene />
    </Canvas>
  );
}
