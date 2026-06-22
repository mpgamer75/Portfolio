'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
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
const CLUSTERS = GRAPH.clusters;
const LINKS = GRAPH.links;
const LINK_COUNT = LINKS.length;
const CLUSTER_COLORS = CLUSTERS.map((c) => new THREE.Color(c.color));
/** Skill count per domain = leaf nodes (the hub itself is not a skill). */
const CLUSTER_COUNTS = CLUSTERS.map(
  (_, ci) => NODES.filter((n) => n.cluster === ci && !n.isHub).length,
);

// ── Static per-node attribute buffers (constant for the scene's lifetime) ──
const NODE_POSITIONS = new Float32Array(NODE_COUNT * 3);
const CLUSTER_OF = new Int16Array(NODE_COUNT);
const IS_HUB = new Uint8Array(NODE_COUNT);
const A_COLOR = new Float32Array(NODE_COUNT * 3); // base cluster colour (working space)
const A_SIZE = new Float32Array(NODE_COUNT); // hubs read larger than leaves
const A_PHASE = new Float32Array(NODE_COUNT); // de-synced idle twinkle phase
NODES.forEach((node, i) => {
  NODE_POSITIONS[i * 3] = node.position[0];
  NODE_POSITIONS[i * 3 + 1] = node.position[1];
  NODE_POSITIONS[i * 3 + 2] = node.position[2];
  CLUSTER_OF[i] = node.cluster;
  IS_HUB[i] = node.isHub ? 1 : 0;
  const c = CLUSTER_COLORS[node.cluster];
  A_COLOR[i * 3] = c.r;
  A_COLOR[i * 3 + 1] = c.g;
  A_COLOR[i * 3 + 2] = c.b;
  A_SIZE[i] = node.isHub ? 2.7 : 1.35;
  A_PHASE[i] = i * 2.39996; // golden-angle stride → no visible beat pattern
});

const restIntensity = (i: number) => (IS_HUB[i] ? 0.9 : 0.5);

/** Mutable per-frame glow buffer (the only per-node data uploaded each frame). */
const GLOW = new Float32Array(NODE_COUNT);
for (let i = 0; i < NODE_COUNT; i++) GLOW[i] = restIntensity(i);

// ── Static line buffers + mutable per-link intensity ──
const LINE_POSITIONS = new Float32Array(LINK_COUNT * 6);
const LINE_BASE = new Float32Array(LINK_COUNT * 3); // blended endpoint colour
const LINE_REST = new Float32Array(LINK_COUNT);
const LINE_INT = new Float32Array(LINK_COUNT);
const LINE_COLORS = new Float32Array(LINK_COUNT * 6);
const LINK_A = new Int16Array(LINK_COUNT);
const LINK_B = new Int16Array(LINK_COUNT);
LINKS.forEach((link, l) => {
  const a = NODES[link.a].position;
  const b = NODES[link.b].position;
  LINE_POSITIONS[l * 6] = a[0];
  LINE_POSITIONS[l * 6 + 1] = a[1];
  LINE_POSITIONS[l * 6 + 2] = a[2];
  LINE_POSITIONS[l * 6 + 3] = b[0];
  LINE_POSITIONS[l * 6 + 4] = b[1];
  LINE_POSITIONS[l * 6 + 5] = b[2];
  const ca = NODES[link.a].cluster;
  const cb = NODES[link.b].cluster;
  LINK_A[l] = link.a;
  LINK_B[l] = link.b;
  const colA = CLUSTER_COLORS[ca];
  const colB = CLUSTER_COLORS[cb];
  LINE_BASE[l * 3] = (colA.r + colB.r) * 0.5;
  LINE_BASE[l * 3 + 1] = (colA.g + colB.g) * 0.5;
  LINE_BASE[l * 3 + 2] = (colA.b + colB.b) * 0.5;
  const rest = ca === cb ? 0.32 : 0.2; // inter-domain ring links sit dimmer
  LINE_REST[l] = rest;
  LINE_INT[l] = rest;
  for (let k = 0; k < 2; k++) {
    LINE_COLORS[l * 6 + k * 3] = LINE_BASE[l * 3] * rest;
    LINE_COLORS[l * 6 + k * 3 + 1] = LINE_BASE[l * 3 + 1] * rest;
    LINE_COLORS[l * 6 + k * 3 + 2] = LINE_BASE[l * 3 + 2] * rest;
  }
});

/** Soft ring sprite for the selection halo — canvas-generated, no external asset (CSP-safe). */
function makeRingTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(size / 2, size / 2);
  ctx.strokeStyle = 'rgba(255,255,255,1)';
  ctx.lineWidth = size * 0.05;
  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  ctx.shadowBlur = size * 0.08;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.36, 0, Math.PI * 2);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}
const RING_TEX = makeRingTexture();

const VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aGlow;
  attribute float aPhase;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSizeScale;
  varying vec3 vColor;
  varying float vGlow;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float twinkle = 0.10 * sin(uTime * 1.6 + aPhase);
    float glow = max(aGlow + twinkle, 0.0);
    vGlow = glow;
    vColor = aColor;
    float s = aSize * uSizeScale * (0.65 + 0.85 * glow) * uPixelRatio / -mv.z;
    gl_PointSize = clamp(s, 1.0, 96.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision mediump float;
  varying vec3 vColor;
  varying float vGlow;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    float alpha = pow(core, 1.5);
    vec3 col = vColor * (0.45 + vGlow);
    float hot = clamp(vGlow - 0.7, 0.0, 1.0); // white-hot centre when highlighted
    col += vec3(1.0) * pow(core, 7.0) * hot;
    gl_FragColor = vec4(col, alpha);
  }
`;

const GROUP_SCALE = 0.92;

/*
 * Shared singletons (the scene is a singleton — see the module note above). Kept
 * at module scope so `useFrame`/effects mutate them without tripping the
 * react-hooks immutability rule (which forbids mutating hook-returned values).
 */
const UNIFORMS = {
  uTime: { value: 0 },
  uPixelRatio: { value: 1 },
  uSizeScale: { value: 56 },
};
const PROJ_VEC = new THREE.Vector3(); // reused for the per-frame label projection

/** A hovered/pinned selection: either a single node or a whole domain (from the legend). */
type Sel = { kind: 'node'; i: number } | { kind: 'cluster'; i: number };

interface LabelData {
  text: string;
  color: string;
  isHub: boolean;
  cluster: string;
  count: number;
}

/** Build the floating-label payload for a node (pure — safe to call during events). */
function buildLabel(i: number): LabelData {
  const n = NODES[i];
  return {
    text: n.label,
    color: CLUSTERS[n.cluster].color,
    isHub: n.isHub,
    cluster: CLUSTERS[n.cluster].title,
    count: CLUSTER_COUNTS[n.cluster],
  };
}

interface SceneProps {
  focusCluster: number | null;
  activeNode: number | null;
  pinnedNode: number | null;
  labelRef: React.RefObject<HTMLDivElement | null>;
  onHoverNode: (i: number | null) => void;
  onClickNode: (i: number) => void;
}

function Scene({ focusCluster, activeNode, pinnedNode, labelRef, onHoverNode, onClickNode }: SceneProps) {
  const { camera, gl, size } = useThree();
  const parallax = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const points = useRef<THREE.Points>(null);
  const glowAttr = useRef<THREE.BufferAttribute>(null);
  const lineColorAttr = useRef<THREE.BufferAttribute>(null);
  const ring = useRef<THREE.Sprite>(null);
  const ringMat = useRef<THREE.SpriteMaterial>(null);
  const lastHover = useRef<number>(-1);

  useEffect(() => {
    UNIFORMS.uPixelRatio.value = gl.getPixelRatio();
  }, [gl]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05); // clamp to avoid jumps after a pause
    UNIFORMS.uTime.value += dt;

    // Gentle autonomous drift + pointer parallax keep the field alive at rest.
    if (spin.current) spin.current.rotation.y += dt * 0.03;
    if (parallax.current) {
      const tx = -state.pointer.y * 0.18;
      const ty = state.pointer.x * 0.22;
      parallax.current.rotation.x += (tx - parallax.current.rotation.x) * 0.04;
      parallax.current.rotation.y += (ty - parallax.current.rotation.y) * 0.04;
    }

    // Per-node glow → active node white-hot, focused cluster lit, the rest dimmed.
    const fNode = 1 - Math.exp(-dt * 9);
    for (let i = 0; i < NODE_COUNT; i++) {
      let target: number;
      if (activeNode === i) target = 1.6;
      else if (focusCluster === null) target = restIntensity(i);
      else if (CLUSTER_OF[i] === focusCluster) target = IS_HUB[i] ? 1.05 : 0.8;
      else target = 0.1;
      GLOW[i] += (target - GLOW[i]) * fNode;
    }
    if (glowAttr.current) glowAttr.current.needsUpdate = true;

    // Per-link intensity mirrors the focus state (cheap: a handful of links).
    const fLine = 1 - Math.exp(-dt * 8);
    for (let l = 0; l < LINK_COUNT; l++) {
      const a = LINK_A[l];
      const b = LINK_B[l];
      const ca = CLUSTER_OF[a];
      const cb = CLUSTER_OF[b];
      let t: number;
      if (activeNode !== null && (a === activeNode || b === activeNode)) t = 1.1;
      else if (focusCluster === null) t = LINE_REST[l];
      else if (ca === focusCluster || cb === focusCluster) t = 0.8;
      else t = 0.05;
      LINE_INT[l] += (t - LINE_INT[l]) * fLine;
      const v = LINE_INT[l];
      const o = l * 6;
      const c = l * 3;
      const r = LINE_BASE[c] * v;
      const g = LINE_BASE[c + 1] * v;
      const bch = LINE_BASE[c + 2] * v;
      LINE_COLORS[o] = r;
      LINE_COLORS[o + 1] = g;
      LINE_COLORS[o + 2] = bch;
      LINE_COLORS[o + 3] = r;
      LINE_COLORS[o + 4] = g;
      LINE_COLORS[o + 5] = bch;
    }
    if (lineColorAttr.current) lineColorAttr.current.needsUpdate = true;

    // Selection halo follows the active node; a pinned node breathes.
    if (ring.current && ringMat.current) {
      if (activeNode !== null) {
        const i = activeNode;
        ring.current.position.set(
          NODE_POSITIONS[i * 3],
          NODE_POSITIONS[i * 3 + 1],
          NODE_POSITIONS[i * 3 + 2],
        );
        const pinned = pinnedNode === activeNode;
        const pulse = pinned ? 1 + 0.12 * Math.sin(state.clock.elapsedTime * 4) : 1;
        const s = (IS_HUB[i] ? 1.55 : 1.05) * pulse;
        ring.current.scale.set(s, s, s);
        ringMat.current.color.copy(CLUSTER_COLORS[CLUSTER_OF[i]]);
        const targetOpacity = pinned ? 0.95 : 0.55;
        ringMat.current.opacity += (targetOpacity - ringMat.current.opacity) * fNode;
        ring.current.visible = true;
      } else {
        ringMat.current.opacity += (0 - ringMat.current.opacity) * fNode;
        if (ringMat.current.opacity < 0.02) ring.current.visible = false;
      }
    }

    // Project the active node to screen space and park the HTML label above it.
    const label = labelRef.current;
    if (label) {
      if (activeNode !== null && points.current) {
        const i = activeNode;
        PROJ_VEC.set(NODE_POSITIONS[i * 3], NODE_POSITIONS[i * 3 + 1], NODE_POSITIONS[i * 3 + 2]);
        points.current.updateWorldMatrix(true, false);
        points.current.localToWorld(PROJ_VEC);
        PROJ_VEC.project(camera);
        const sx = (PROJ_VEC.x * 0.5 + 0.5) * size.width;
        const sy = (-PROJ_VEC.y * 0.5 + 0.5) * size.height;
        label.style.transform = `translate(-50%, -150%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
        label.style.opacity = PROJ_VEC.z < 1 ? '1' : '0';
      } else {
        label.style.opacity = '0';
      }
    }
  });

  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.index != null && e.index !== lastHover.current) {
      lastHover.current = e.index;
      onHoverNode(e.index);
    }
  };
  const handleOut = () => {
    lastHover.current = -1;
    onHoverNode(null);
  };
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.index != null) onClickNode(e.index);
  };

  return (
    <group ref={parallax}>
      <group ref={spin} scale={GROUP_SCALE}>
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[LINE_POSITIONS, 3]} />
            <bufferAttribute ref={lineColorAttr} attach="attributes-color" args={[LINE_COLORS, 3]} />
          </bufferGeometry>
          <lineBasicMaterial
            vertexColors
            transparent
            depthWrite={false}
            depthTest={false}
            blending={THREE.AdditiveBlending}
          />
        </lineSegments>

        <points ref={points} onPointerMove={handleMove} onPointerOut={handleOut} onClick={handleClick}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[NODE_POSITIONS, 3]} />
            <bufferAttribute attach="attributes-aColor" args={[A_COLOR, 3]} />
            <bufferAttribute attach="attributes-aSize" args={[A_SIZE, 1]} />
            <bufferAttribute ref={glowAttr} attach="attributes-aGlow" args={[GLOW, 1]} />
            <bufferAttribute attach="attributes-aPhase" args={[A_PHASE, 1]} />
          </bufferGeometry>
          <shaderMaterial
            uniforms={UNIFORMS}
            vertexShader={VERTEX_SHADER}
            fragmentShader={FRAGMENT_SHADER}
            transparent
            depthWrite={false}
            depthTest={false}
            blending={THREE.AdditiveBlending}
          />
        </points>

        <sprite ref={ring} visible={false}>
          <spriteMaterial
            ref={ringMat}
            map={RING_TEX}
            transparent
            opacity={0}
            depthWrite={false}
            depthTest={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      </group>
    </group>
  );
}

interface SkillsConstellationProps {
  /** When false the render loop hard-stops (frameloop="never") so the GPU idles offscreen. */
  active: boolean;
  /** Reports the focused domain + skill upward so the grid below can mirror the selection. */
  onFocusChange?: (cluster: number | null, skill: string | null) => void;
}

export default function SkillsConstellation({ active, onFocusChange }: SkillsConstellationProps) {
  const [hover, setHover] = useState<Sel | null>(null);
  const [pin, setPin] = useState<Sel | null>(null);

  // Hover previews; a pin holds until cleared. Hover wins for what's shown.
  const sel = hover ?? pin;
  const focusCluster = sel ? (sel.kind === 'cluster' ? sel.i : CLUSTER_OF[sel.i]) : null;
  const activeNode = sel && sel.kind === 'node' ? sel.i : null;
  const pinnedNode = pin && pin.kind === 'node' ? pin.i : null;

  const labelRef = useRef<HTMLDivElement>(null);
  // Holds the most recently inspected node's chip data. Updated in the pointer
  // handlers (never cleared on blur) so the chip keeps its text while it fades
  // out — visibility itself is driven by <Scene> via the label's opacity.
  const [labelData, setLabelData] = useState<LabelData | null>(null);

  // Surface the selection to the parent (grid linkage). Only leaf nodes are skills,
  // so a hub (or legend) focus reports the domain with skill=null — the grid then
  // lights the whole card and the readout says "Focused domain" rather than "skill".
  const activeSkill = activeNode !== null && !NODES[activeNode].isHub ? NODES[activeNode].label : null;
  useEffect(() => {
    onFocusChange?.(focusCluster, activeSkill);
  }, [focusCluster, activeSkill, onFocusChange]);

  // Esc clears any pin/hover — a standard escape route for the pinned state.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPin(null);
        setHover(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onHoverNode = useCallback((i: number | null) => {
    setHover(i == null ? null : { kind: 'node', i });
    if (i != null) setLabelData(buildLabel(i));
  }, []);
  const onClickNode = useCallback((i: number) => {
    setPin((p) => (p && p.kind === 'node' && p.i === i ? null : { kind: 'node', i }));
    setLabelData(buildLabel(i));
  }, []);
  const onLegendEnter = useCallback((i: number) => setHover({ kind: 'cluster', i }), []);
  const onLegendLeave = useCallback(() => setHover(null), []);
  const onLegendClick = useCallback(
    (i: number) =>
      setPin((p) => (p && p.kind === 'cluster' && p.i === i ? null : { kind: 'cluster', i })),
    [],
  );

  return (
    <div className="relative w-full h-full">
      <div
        role="img"
        aria-label="3D constellation of skills grouped by domain"
        className={`absolute inset-0 ${hover?.kind === 'node' ? 'cursor-pointer' : ''}`}
      >
        <Canvas
          frameloop={active ? 'always' : 'never'}
          dpr={[1, 1.5]}
          camera={{ position: [0, 0, 12], fov: 50 }}
          gl={{
            antialias: false,
            alpha: true,
            depth: false,
            stencil: false,
            powerPreference: 'high-performance',
          }}
          onCreated={({ gl, raycaster }) => {
            gl.toneMapping = THREE.NoToneMapping;
            raycaster.params.Points.threshold = 0.5;
          }}
          onPointerMissed={() => setPin(null)}
          style={{ width: '100%', height: '100%' }}
        >
          <Scene
            focusCluster={focusCluster}
            activeNode={activeNode}
            pinnedNode={pinnedNode}
            labelRef={labelRef}
            onHoverNode={onHoverNode}
            onClickNode={onClickNode}
          />
        </Canvas>
      </div>

      {/* Floating skill label — projected onto the active node each frame by <Scene>. */}
      <div
        ref={labelRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 z-10 will-change-transform"
        style={{ opacity: 0, transition: 'opacity 160ms ease' }}
      >
        {labelData && (
          <div
            className="inline-flex items-center gap-2 rounded-md border bg-cyber-darker/90 px-2.5 py-1.5 font-mono text-xs sm:text-sm text-white shadow-glow"
            style={{ borderColor: labelData.color }}
          >
            <span
              className="h-2 w-2 flex-shrink-0 rounded-full"
              style={{ background: labelData.color, boxShadow: `0 0 8px ${labelData.color}` }}
            />
            <span className="whitespace-nowrap font-medium">{labelData.text}</span>
            {labelData.isHub && (
              <span className="ml-0.5 rounded-sm bg-white/10 px-1.5 py-0.5 text-[10px] text-cyber-accent">
                {labelData.count} skills
              </span>
            )}
          </div>
        )}
      </div>

      {/* Accessible domain legend — real buttons that drive the same focus state. */}
      <div className="absolute inset-x-0 bottom-1.5 sm:bottom-2.5 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 px-3">
        {CLUSTERS.map((c, i) => {
          const isActive = focusCluster === i;
          const isPinned = pin?.kind === 'cluster' && pin.i === i;
          return (
            <button
              key={c.index}
              type="button"
              onMouseEnter={() => onLegendEnter(i)}
              onMouseLeave={onLegendLeave}
              onFocus={() => onLegendEnter(i)}
              onBlur={onLegendLeave}
              onClick={() => onLegendClick(i)}
              aria-pressed={isPinned}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-3 py-2 font-mono text-[11px] sm:text-xs transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-brand focus-visible:ring-offset-2 focus-visible:ring-offset-cyber-darker ${
                isActive
                  ? 'border-cyber-brand bg-cyber-brand/10 text-white'
                  : 'border-cyber-primary/15 bg-cyber-darker/60 text-cyber-accent hover:border-cyber-primary/40 hover:text-cyber-primary'
              }`}
            >
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full transition-[box-shadow] duration-200"
                style={{ background: c.color, boxShadow: isActive ? `0 0 10px ${c.color}` : 'none' }}
              />
              <span className="whitespace-nowrap">{c.title}</span>
              <span
                className={`rounded-sm px-1.5 py-0.5 text-[10px] tabular-nums ${
                  isActive ? 'bg-cyber-brand/20 text-cyber-brand' : 'bg-white/5 text-cyber-accent/70'
                }`}
              >
                {CLUSTER_COUNTS[i]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
