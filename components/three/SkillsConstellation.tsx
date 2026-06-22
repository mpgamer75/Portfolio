'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { GRAPH } from './skillsGraph';
import { getSkillMeta } from './skillsMeta';
import { projects } from '@/components/sections/projectsData';
import { useProjectModal } from '@/components/ui/ProjectModalProvider';
import SkillDetailCard, { type SkillCardData } from '@/components/ui/SkillDetailCard';

/*
 * Client-only (the gate imports it with `ssr:false`), so module-scope `document`
 * access, `Math.random` and the shared scene buffers/objects below are safe — the
 * constellation is a singleton. Render only reads these; `useFrame` mutates them,
 * which keeps render pure and avoids tripping react-hooks/immutability (the rule
 * forbids mutating hook-returned values, not module scope).
 */

const NODES = GRAPH.nodes;
const NODE_COUNT = NODES.length;
const CLUSTERS = GRAPH.clusters;
const LINKS = GRAPH.links;
const LINK_COUNT = LINKS.length;
const CLUSTER_COLORS = CLUSTERS.map((c) => new THREE.Color(c.color));
const CLUSTER_COUNTS = CLUSTERS.map(
  (_, ci) => NODES.filter((n) => n.cluster === ci && !n.isHub).length,
);
/** Hub node index per cluster + the leaf skill labels per cluster (for the domain card). */
const CLUSTER_HUB: number[] = [];
const CLUSTER_SKILLS: string[][] = CLUSTERS.map(() => []);

// ── Static per-node attribute buffers ──
const NODE_POSITIONS = new Float32Array(NODE_COUNT * 3);
const CLUSTER_OF = new Int16Array(NODE_COUNT);
const IS_HUB = new Uint8Array(NODE_COUNT);
const A_COLOR = new Float32Array(NODE_COUNT * 3);
const A_SIZE = new Float32Array(NODE_COUNT);
const A_PHASE = new Float32Array(NODE_COUNT);
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
  A_SIZE[i] = node.isHub ? 3.0 : 1.6;
  A_PHASE[i] = i * 2.39996;
  if (node.isHub) CLUSTER_HUB[node.cluster] = i;
  else CLUSTER_SKILLS[node.cluster].push(node.label);
});

const restIntensity = (i: number) => (IS_HUB[i] ? 0.95 : 0.55);
const GLOW = new Float32Array(NODE_COUNT);
for (let i = 0; i < NODE_COUNT; i++) GLOW[i] = restIntensity(i);

// ── Link buffers (positions + per-link animated intensity) ──
const LINE_POSITIONS = new Float32Array(LINK_COUNT * 6);
const LINE_BASE = new Float32Array(LINK_COUNT * 3);
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
  const rest = ca === cb ? 0.42 : 0.26;
  LINE_REST[l] = rest;
  LINE_INT[l] = rest;
  for (let k = 0; k < 2; k++) {
    LINE_COLORS[l * 6 + k * 3] = LINE_BASE[l * 3] * rest;
    LINE_COLORS[l * 6 + k * 3 + 1] = LINE_BASE[l * 3 + 1] * rest;
    LINE_COLORS[l * 6 + k * 3 + 2] = LINE_BASE[l * 3 + 2] * rest;
  }
});

// Fat, thick glowing links (WebGL line width is capped at 1px — these aren't).
const LINE_GEO = new LineSegmentsGeometry();
LINE_GEO.setPositions(LINE_POSITIONS);
LINE_GEO.setColors(LINE_COLORS);
const LINE_MAT = new LineMaterial({
  linewidth: 2.6, // CSS px
  vertexColors: true,
  transparent: true,
  depthTest: false,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const FAT_LINES = new LineSegments2(LINE_GEO, LINE_MAT);
FAT_LINES.frustumCulled = false;
const LINE_COLOR_BUFFER = (LINE_GEO.getAttribute('instanceColorStart') as THREE.InterleavedBufferAttribute).data;
const LINE_COLOR_ARR = LINE_COLOR_BUFFER.array as Float32Array;

// ── Energy pulses travelling hub→leaf along each link ──
const PULSE_COUNT = LINK_COUNT;
const PULSE_POSITIONS = new Float32Array(PULSE_COUNT * 3);
const PULSE_PROG = new Float32Array(PULSE_COUNT);
const PULSE_SPEED = new Float32Array(PULSE_COUNT);
for (let l = 0; l < PULSE_COUNT; l++) {
  PULSE_PROG[l] = (l * 0.137) % 1;
  PULSE_SPEED[l] = 0.26 + (l % 5) * 0.045;
  PULSE_POSITIONS[l * 3] = LINE_POSITIONS[l * 6];
  PULSE_POSITIONS[l * 3 + 1] = LINE_POSITIONS[l * 6 + 1];
  PULSE_POSITIONS[l * 3 + 2] = LINE_POSITIONS[l * 6 + 2];
}

// ── Ambient particle dust (deterministic-enough; client-only so random is fine) ──
const DUST_COUNT = 140;
const DUST_POSITIONS = new Float32Array(DUST_COUNT * 3);
for (let i = 0; i < DUST_COUNT; i++) {
  const r = 4 + Math.random() * 7;
  const a = Math.random() * Math.PI * 2;
  DUST_POSITIONS[i * 3] = Math.cos(a) * r;
  DUST_POSITIONS[i * 3 + 1] = (Math.random() - 0.5) * 9;
  DUST_POSITIONS[i * 3 + 2] = (Math.random() - 0.5) * 6 - 1;
}

/** Soft round sprite (pulses + dust). */
function makeDotTexture(): THREE.CanvasTexture {
  const s = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = s;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}
const DOT_TEX = makeDotTexture();

/** Big soft nebula glow behind the graph for depth. */
function makeNebulaTexture(): THREE.CanvasTexture {
  const s = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = s;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(52,211,153,0.5)');
  g.addColorStop(0.4, 'rgba(16,185,129,0.16)');
  g.addColorStop(1, 'rgba(16,185,129,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}
const NEBULA_TEX = makeNebulaTexture();

/** Selection halo. */
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
    gl_PointSize = clamp(s, 1.0, 120.0);
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
    float hot = clamp(vGlow - 0.7, 0.0, 1.0);
    col += vec3(1.0) * pow(core, 7.0) * hot;
    gl_FragColor = vec4(col, alpha);
  }
`;

const GROUP_SCALE = 1.0;
const HOME_Z = 11.5;
const FOV = 50;
const FOCAL_F = 1 / Math.tan(((FOV / 2) * Math.PI) / 180);

/** Shared singletons mutated per-frame (module scope → immutability-lint-safe). */
const UNIFORMS = {
  uTime: { value: 0 },
  uPixelRatio: { value: 1 },
  uSizeScale: { value: 62 },
};
const PROJ_VEC = new THREE.Vector3();
const CAM_TARGET = new THREE.Vector3(0, 0, HOME_Z);

type Sel = { kind: 'node'; i: number } | { kind: 'cluster'; i: number };

interface LabelData {
  text: string;
  color: string;
  isHub: boolean;
  cluster: string;
  count: number;
}

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

function buildDomainCard(c: number): SkillCardData {
  return {
    kind: 'domain',
    title: CLUSTERS[c].title,
    domainLabel: CLUSTERS[c].title,
    color: CLUSTERS[c].color,
    blurb: `${CLUSTER_COUNTS[c]} skills I work with across this domain — hover any node to inspect one.`,
    domainSkills: CLUSTER_SKILLS[c],
  };
}

interface SceneProps {
  focusCluster: number | null;
  activeNode: number | null;
  labelNode: number | null;
  zoomTarget: number | null;
  zoomDist: number;
  pinned: boolean;
  pinnedNode: number | null;
  labelRef: React.RefObject<HTMLDivElement | null>;
  onHoverNode: (i: number | null) => void;
  onClickNode: (i: number) => void;
}

function Scene({
  focusCluster,
  activeNode,
  labelNode,
  zoomTarget,
  zoomDist,
  pinned,
  pinnedNode,
  labelRef,
  onHoverNode,
  onClickNode,
}: SceneProps) {
  const { gl, size } = useThree();
  const parallax = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const dust = useRef<THREE.Points>(null);
  const points = useRef<THREE.Points>(null);
  const glowAttr = useRef<THREE.BufferAttribute>(null);
  const pulseAttr = useRef<THREE.BufferAttribute>(null);
  const pulseMat = useRef<THREE.PointsMaterial>(null);
  const ring = useRef<THREE.Sprite>(null);
  const ringMat = useRef<THREE.SpriteMaterial>(null);
  const lastHover = useRef<number>(-1);

  useEffect(() => {
    UNIFORMS.uPixelRatio.value = gl.getPixelRatio();
  }, [gl]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    UNIFORMS.uTime.value += dt;
    LINE_MAT.resolution.set(size.width, size.height);

    // Settle the field while focused so the zoom target is stable.
    if (spin.current && !pinned) spin.current.rotation.y += dt * 0.03;
    if (parallax.current) {
      const tx = pinned ? 0 : -state.pointer.y * 0.16;
      const ty = pinned ? 0 : state.pointer.x * 0.2;
      const k = pinned ? 0.08 : 0.04;
      parallax.current.rotation.x += (tx - parallax.current.rotation.x) * k;
      parallax.current.rotation.y += (ty - parallax.current.rotation.y) * k;
    }
    if (dust.current) dust.current.rotation.y += dt * 0.012;

    // Node glow — active node white-hot, focused cluster lit, the rest dimmed
    // (harder when something is pinned, for a spotlight feel).
    const fNode = 1 - Math.exp(-dt * 9);
    const dimTarget = pinned ? 0.05 : 0.1;
    for (let i = 0; i < NODE_COUNT; i++) {
      let target: number;
      if (activeNode === i) target = 1.65;
      else if (focusCluster === null) target = restIntensity(i);
      else if (CLUSTER_OF[i] === focusCluster) target = IS_HUB[i] ? 1.1 : 0.85;
      else target = dimTarget;
      GLOW[i] += (target - GLOW[i]) * fNode;
    }
    if (glowAttr.current) glowAttr.current.needsUpdate = true;

    // Link intensity mirrors the focus state.
    const fLine = 1 - Math.exp(-dt * 8);
    for (let l = 0; l < LINK_COUNT; l++) {
      const a = LINK_A[l];
      const b = LINK_B[l];
      const ca = CLUSTER_OF[a];
      const cb = CLUSTER_OF[b];
      let t: number;
      if (activeNode !== null && (a === activeNode || b === activeNode)) t = 1.2;
      else if (focusCluster === null) t = LINE_REST[l];
      else if (ca === focusCluster || cb === focusCluster) t = 0.95;
      else t = pinned ? 0.03 : 0.06;
      LINE_INT[l] += (t - LINE_INT[l]) * fLine;
      const v = LINE_INT[l];
      const o = l * 6;
      const c = l * 3;
      const r = LINE_BASE[c] * v;
      const g = LINE_BASE[c + 1] * v;
      const bch = LINE_BASE[c + 2] * v;
      LINE_COLOR_ARR[o] = r;
      LINE_COLOR_ARR[o + 1] = g;
      LINE_COLOR_ARR[o + 2] = bch;
      LINE_COLOR_ARR[o + 3] = r;
      LINE_COLOR_ARR[o + 4] = g;
      LINE_COLOR_ARR[o + 5] = bch;
    }
    LINE_COLOR_BUFFER.needsUpdate = true;

    // Energy pulses flowing along the links.
    for (let l = 0; l < PULSE_COUNT; l++) {
      let p = PULSE_PROG[l] + PULSE_SPEED[l] * dt;
      if (p > 1) p -= 1;
      PULSE_PROG[l] = p;
      const o = l * 6;
      PULSE_POSITIONS[l * 3] = LINE_POSITIONS[o] + (LINE_POSITIONS[o + 3] - LINE_POSITIONS[o]) * p;
      PULSE_POSITIONS[l * 3 + 1] = LINE_POSITIONS[o + 1] + (LINE_POSITIONS[o + 4] - LINE_POSITIONS[o + 1]) * p;
      PULSE_POSITIONS[l * 3 + 2] = LINE_POSITIONS[o + 2] + (LINE_POSITIONS[o + 5] - LINE_POSITIONS[o + 2]) * p;
    }
    if (pulseAttr.current) pulseAttr.current.needsUpdate = true;
    if (pulseMat.current) {
      const tOp = pinned ? 0.25 : 0.85;
      pulseMat.current.opacity += (tOp - pulseMat.current.opacity) * 0.1;
    }

    // Selection halo on the active node.
    if (ring.current && ringMat.current) {
      if (activeNode !== null) {
        const i = activeNode;
        ring.current.position.set(
          NODE_POSITIONS[i * 3],
          NODE_POSITIONS[i * 3 + 1],
          NODE_POSITIONS[i * 3 + 2],
        );
        const isPinned = pinnedNode === activeNode;
        const pulse = isPinned ? 1 + 0.12 * Math.sin(state.clock.elapsedTime * 4) : 1;
        const s = (IS_HUB[i] ? 1.7 : 1.15) * pulse;
        ring.current.scale.set(s, s, s);
        ringMat.current.color.copy(CLUSTER_COLORS[CLUSTER_OF[i]]);
        const targetOpacity = isPinned ? 0.95 : 0.55;
        ringMat.current.opacity += (targetOpacity - ringMat.current.opacity) * fNode;
        ring.current.visible = true;
      } else {
        ringMat.current.opacity += (0 - ringMat.current.opacity) * fNode;
        if (ringMat.current.opacity < 0.02) ring.current.visible = false;
      }
    }

    // Camera: zoom the pinned target forward + to the left; otherwise return home.
    const cam = state.camera;
    if (zoomTarget !== null && points.current) {
      const i = zoomTarget;
      PROJ_VEC.set(NODE_POSITIONS[i * 3], NODE_POSITIONS[i * 3 + 1], NODE_POSITIONS[i * 3 + 2]);
      points.current.updateWorldMatrix(true, false);
      points.current.localToWorld(PROJ_VEC);
      const aspect = size.width / size.height;
      const nx = -0.42;
      const ny = 0.05;
      CAM_TARGET.set(
        PROJ_VEC.x - (nx * zoomDist * aspect) / FOCAL_F,
        PROJ_VEC.y - (ny * zoomDist) / FOCAL_F,
        PROJ_VEC.z + zoomDist,
      );
    } else {
      CAM_TARGET.set(0, 0, HOME_Z);
    }
    cam.position.lerp(CAM_TARGET, 1 - Math.exp(-dt * 4.5));

    // Floating preview label (hover only — the card replaces it when pinned).
    const label = labelRef.current;
    if (label) {
      if (labelNode !== null && points.current) {
        const i = labelNode;
        PROJ_VEC.set(NODE_POSITIONS[i * 3], NODE_POSITIONS[i * 3 + 1], NODE_POSITIONS[i * 3 + 2]);
        points.current.updateWorldMatrix(true, false);
        points.current.localToWorld(PROJ_VEC);
        PROJ_VEC.project(cam);
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
      {/* Atmosphere */}
      <sprite position={[0, 0, -3]} scale={[22, 22, 1]}>
        <spriteMaterial
          map={NEBULA_TEX}
          transparent
          opacity={0.5}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <points ref={dust}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[DUST_POSITIONS, 3]} />
        </bufferGeometry>
        <pointsMaterial
          map={DOT_TEX}
          color="#34D399"
          size={0.08}
          sizeAttenuation
          transparent
          opacity={0.45}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      <group ref={spin} scale={GROUP_SCALE}>
        {/* Shared module-scope object — dispose={null} so a gate remount can't free it. */}
        <primitive object={FAT_LINES} dispose={null} />

        {/* Energy pulses flowing along the links */}
        <points>
          <bufferGeometry>
            <bufferAttribute ref={pulseAttr} attach="attributes-position" args={[PULSE_POSITIONS, 3]} />
          </bufferGeometry>
          <pointsMaterial
            ref={pulseMat}
            map={DOT_TEX}
            color="#9DF3D2"
            size={0.32}
            sizeAttenuation
            transparent
            opacity={0.85}
            depthWrite={false}
            depthTest={false}
            blending={THREE.AdditiveBlending}
          />
        </points>

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
  active: boolean;
  onFocusChange?: (cluster: number | null, skill: string | null) => void;
}

export default function SkillsConstellation({ active, onFocusChange }: SkillsConstellationProps) {
  const [hover, setHover] = useState<Sel | null>(null);
  const [pin, setPin] = useState<Sel | null>(null);
  const { openProject } = useProjectModal();

  const sel = hover ?? pin;
  const focusCluster = sel ? (sel.kind === 'cluster' ? sel.i : CLUSTER_OF[sel.i]) : null;
  const activeNode = sel && sel.kind === 'node' ? sel.i : null;
  const labelNode = pin === null && hover?.kind === 'node' ? hover.i : null;
  const pinned = pin !== null;
  const pinnedNode = pin?.kind === 'node' ? pin.i : null;

  let zoomTarget: number | null = null;
  let zoomDist = 7;
  if (pin) {
    if (pin.kind === 'node') {
      zoomTarget = pin.i;
      zoomDist = IS_HUB[pin.i] ? 8 : 6.5;
    } else {
      zoomTarget = CLUSTER_HUB[pin.i];
      zoomDist = 8.5;
    }
  }

  let cardData: SkillCardData | null = null;
  if (pin) {
    if (pin.kind === 'node') {
      const n = NODES[pin.i];
      if (n.isHub) cardData = buildDomainCard(n.cluster);
      else {
        const m = getSkillMeta(n.label);
        cardData = {
          kind: 'skill',
          title: n.label,
          domainLabel: CLUSTERS[n.cluster].title,
          color: CLUSTERS[n.cluster].color,
          blurb: m.blurb,
          usedIn: m.usedIn,
        };
      }
    } else {
      cardData = buildDomainCard(pin.i);
    }
  }

  const labelRef = useRef<HTMLDivElement>(null);
  const [labelData, setLabelData] = useState<LabelData | null>(null);

  const activeSkill = activeNode !== null && !NODES[activeNode].isHub ? NODES[activeNode].label : null;
  useEffect(() => {
    onFocusChange?.(focusCluster, activeSkill);
  }, [focusCluster, activeSkill, onFocusChange]);

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

  const handleOpenProject = useCallback(
    (label: string) => {
      const proj = projects.find((p) => p.title === label);
      if (proj) openProject(proj);
      setPin(null); // hand off: zoom back out as the project modal takes over
      setHover(null);
    },
    [openProject],
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
          camera={{ position: [0, 0, HOME_Z], fov: FOV }}
          gl={{
            antialias: false,
            alpha: true,
            depth: false,
            stencil: false,
            powerPreference: 'high-performance',
          }}
          onCreated={({ gl, raycaster }) => {
            gl.toneMapping = THREE.NoToneMapping;
            raycaster.params.Points.threshold = 0.55;
          }}
          onPointerMissed={() => setPin(null)}
          style={{ width: '100%', height: '100%' }}
        >
          <Scene
            focusCluster={focusCluster}
            activeNode={activeNode}
            labelNode={labelNode}
            zoomTarget={zoomTarget}
            zoomDist={zoomDist}
            pinned={pinned}
            pinnedNode={pinnedNode}
            labelRef={labelRef}
            onHoverNode={onHoverNode}
            onClickNode={onClickNode}
          />
        </Canvas>
      </div>

      {/* Floating hover-preview label */}
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

      {/* Detail card (slides in from the right when a node/domain is pinned) */}
      <AnimatePresence>
        {cardData && (
          <SkillDetailCard data={cardData} onClose={() => setPin(null)} onOpenProject={handleOpenProject} />
        )}
      </AnimatePresence>

      {/* Domain legend — hidden while a detail card is open */}
      {pin === null && (
        <div className="absolute inset-x-0 bottom-1.5 sm:bottom-2.5 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 px-3">
          {CLUSTERS.map((c, i) => {
            const isActive = focusCluster === i;
            return (
              <button
                key={c.index}
                type="button"
                onMouseEnter={() => onLegendEnter(i)}
                onMouseLeave={onLegendLeave}
                onFocus={() => onLegendEnter(i)}
                onBlur={onLegendLeave}
                onClick={() => onLegendClick(i)}
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
      )}
    </div>
  );
}
