'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { GRAPH, type ClusterGlyph as GlyphShape } from './skillsGraph';
import { getSkillMeta } from './skillsMeta';
import ClusterGlyph from './ClusterGlyph';
import { projects } from '@/components/sections/projectsData';
import { useProjectModal } from '@/components/ui/ProjectModalProvider';
import SkillDetailCard, { type SkillCardData } from '@/components/ui/SkillDetailCard';

/*
 * Client-only (the gate imports it with `ssr:false`), so module-scope `document`
 * access, `Math.random` and the shared scene buffers/objects below are safe — the
 * constellation is a singleton. Render only reads these; `useFrame` and the
 * pointer handlers mutate them, which keeps render pure and avoids tripping
 * react-hooks/immutability (the rule forbids mutating hook-returned values or
 * props, not module scope).
 */

const NODES = GRAPH.nodes;
const NODE_COUNT = NODES.length;
const CLUSTERS = GRAPH.clusters;
const CLUSTER_COUNT = CLUSTERS.length;
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
/** Entrance delay (0..1 of the reveal) — hubs first, then each cluster's leaves fan in. */
const A_ENTER = new Float32Array(NODE_COUNT);
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
  if (node.isHub) {
    CLUSTER_HUB[node.cluster] = i;
    A_ENTER[i] = 0.02 * node.cluster;
  } else {
    const li = CLUSTER_SKILLS[node.cluster].length;
    CLUSTER_SKILLS[node.cluster].push(node.label);
    A_ENTER[i] = 0.3 + 0.035 * li + 0.02 * node.cluster;
  }
});

const restIntensity = (i: number) => (IS_HUB[i] ? 0.95 : 0.55);
const GLOW = new Float32Array(NODE_COUNT);
for (let i = 0; i < NODE_COUNT; i++) GLOW[i] = restIntensity(i);

/**
 * Screen-space projection of every node, refreshed each frame by the scene:
 * [x px, y px, in-front-of-camera 0|1]. Read by the pointer picker and the label
 * layer — both live in CSS pixels, so hit-testing here is exact regardless of
 * DPR, zoom or the orbit/parallax transforms.
 */
const SCREEN = new Float32Array(NODE_COUNT * 3);
/** Pick radius in CSS px — hubs get a bigger, higher-priority target. */
const PICK_RADIUS_HUB = 26;
const PICK_RADIUS_LEAF = 15;
/** Label DOM nodes, one per skill node; filled by ref callbacks, positioned by useFrame. */
const LABEL_ELS: (HTMLElement | null)[] = new Array(NODE_COUNT).fill(null);

// ── Link buffers (positions + per-link animated intensity) ──
const LINE_POSITIONS = new Float32Array(LINK_COUNT * 6);
const LINE_BASE = new Float32Array(LINK_COUNT * 3);
const LINE_REST = new Float32Array(LINK_COUNT);
const LINE_INT = new Float32Array(LINK_COUNT);
const LINE_COLORS = new Float32Array(LINK_COUNT * 6);
const LINK_A = new Int16Array(LINK_COUNT);
const LINK_B = new Int16Array(LINK_COUNT);
/** Entrance timing per link (0..1): hub ring first, then leaves fan out. */
const LINK_ENTER = new Float32Array(LINK_COUNT);
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
  const isRing = NODES[link.a].isHub && NODES[link.b].isHub;
  LINK_ENTER[l] = isRing ? 0.05 + 0.04 * (l - (LINK_COUNT - CLUSTER_COUNT)) : A_ENTER[link.b];
});

// Fat, thick glowing links (WebGL line width is capped at 1px — these aren't).
const LINE_GEO = new LineSegmentsGeometry();
// setPositions adopts a Float32Array as-is, so hand it a copy: the entrance
// "draw" rewrites the geometry's ends and must not corrupt LINE_POSITIONS,
// which the pulses and the draw itself read as the ground truth.
LINE_GEO.setPositions(LINE_POSITIONS.slice());
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
/** Interleaved [start xyz, end xyz] per link — written during the entrance "draw". */
const LINE_POS_BUFFER = (LINE_GEO.getAttribute('instanceStart') as THREE.InterleavedBufferAttribute).data;
const LINE_POS_ARR = LINE_POS_BUFFER.array as Float32Array;

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

/** Outline glyph (selection halo + hub emblems). */
function makeGlyphTexture(shape: GlyphShape | 'ring'): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(size / 2, size / 2);
  ctx.strokeStyle = 'rgba(255,255,255,1)';
  ctx.lineWidth = size * (shape === 'ring' ? 0.05 : 0.06);
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  ctx.shadowBlur = size * 0.08;
  const r = size * 0.34;
  ctx.beginPath();
  if (shape === 'ring' || shape === 'circle') {
    ctx.arc(0, 0, shape === 'ring' ? size * 0.36 : r, 0, Math.PI * 2);
  } else {
    const sides = shape === 'diamond' ? 4 : shape === 'hexagon' ? 6 : 3;
    const start = shape === 'triangle' ? -Math.PI / 2 : shape === 'diamond' ? -Math.PI / 2 : 0;
    for (let k = 0; k < sides; k++) {
      const a = start + (k / sides) * Math.PI * 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}
const RING_TEX = makeGlyphTexture('ring');

/** One emblem sprite per hub, tinted with its cluster colour. Opacity is driven per frame. */
const GLYPH_SPRITES: THREE.Sprite[] = CLUSTERS.map((c) => {
  const mat = new THREE.SpriteMaterial({
    map: makeGlyphTexture(c.glyph),
    color: c.color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.position.set(c.center[0], c.center[1], c.center[2]);
  sprite.scale.set(1.15, 1.15, 1);
  return sprite;
});

const VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aGlow;
  attribute float aPhase;
  attribute float aEnter;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSizeScale;
  uniform float uEnter;
  varying vec3 vColor;
  varying float vGlow;
  varying float vReveal;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float twinkle = 0.10 * sin(uTime * 1.6 + aPhase);
    float glow = max(aGlow + twinkle, 0.0);
    float reveal = smoothstep(aEnter, aEnter + 0.3, uEnter);
    vGlow = glow;
    vColor = aColor;
    vReveal = reveal;
    // Bloom in: overshoot slightly then settle, so each node "pops" into place.
    float pop = reveal * (1.0 + 0.35 * sin(reveal * 3.14159));
    float s = aSize * uSizeScale * (0.65 + 0.85 * glow) * pop * uPixelRatio / -mv.z;
    gl_PointSize = clamp(s, 0.0, 120.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision mediump float;
  varying vec3 vColor;
  varying float vGlow;
  varying float vReveal;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5 || vReveal <= 0.0) discard;
    float core = smoothstep(0.5, 0.0, d);
    float alpha = pow(core, 1.5) * vReveal;
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
  uEnter: { value: 0 },
};
const PROJ_VEC = new THREE.Vector3();
const CAM_TARGET = new THREE.Vector3(0, 0, HOME_Z);

/**
 * One-shot entrance: `t` runs 0 → 1 over ENTER_SECONDS the first time the scene
 * renders (the frameloop only runs while the section is in view, so this is
 * "the first time you see it"). Hubs pop first, the hub ring draws, then each
 * cluster's links draw outward and the leaves bloom along them.
 */
const ENTER = { t: 0, done: false };
const ENTER_SECONDS = 1.4;

/** Orbit state — pointer drag with inertia; auto-rotation resumes after idling. */
const ORBIT = {
  yaw: 0,
  pitch: 0,
  vYaw: 0,
  vPitch: 0,
  dragging: false,
  moved: false,
  lastX: 0,
  lastY: 0,
  lastT: 0,
  idle: 10,
};
const AUTO_RATE = 0.03; // rad/s
const PITCH_LIMIT = 0.55; // rad
const DRAG_YAW = 0.0055; // rad per px
const DRAG_PITCH = 0.0038;
const DRAG_THRESHOLD = 4; // px before a press becomes a drag (so clicks still click)

type Sel = { kind: 'node'; i: number } | { kind: 'cluster'; i: number };

function buildDomainCard(c: number): SkillCardData {
  return {
    kind: 'domain',
    title: CLUSTERS[c].title,
    domainLabel: CLUSTERS[c].title,
    color: CLUSTERS[c].color,
    glyph: CLUSTERS[c].glyph,
    blurb: `${CLUSTER_COUNTS[c]} skills I work with across this domain — hover any node to inspect one.`,
    domainSkills: CLUSTER_SKILLS[c],
  };
}

/**
 * Nearest node to a CSS-pixel point inside the stage, using the per-frame
 * screen projections. Distance is normalised by each node's pick radius, so a
 * hub (bigger radius) wins over a leaf that happens to sit on top of it.
 */
function pickNode(px: number, py: number): number {
  let best = -1;
  let bestScore = 1;
  for (let i = 0; i < NODE_COUNT; i++) {
    if (SCREEN[i * 3 + 2] < 0.5) continue;
    const dx = px - SCREEN[i * 3];
    const dy = py - SCREEN[i * 3 + 1];
    const r = IS_HUB[i] ? PICK_RADIUS_HUB : PICK_RADIUS_LEAF;
    const score = Math.sqrt(dx * dx + dy * dy) / r;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (v: number) => 1 - Math.pow(1 - clamp01(v), 3);

interface SceneProps {
  focusCluster: number | null;
  activeNode: number | null;
  zoomTarget: number | null;
  zoomDist: number;
  pinned: boolean;
  pinnedNode: number | null;
}

function Scene({
  focusCluster,
  activeNode,
  zoomTarget,
  zoomDist,
  pinned,
  pinnedNode,
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

  useEffect(() => {
    UNIFORMS.uPixelRatio.value = gl.getPixelRatio();
  }, [gl]);

  useEffect(() => {
    LINE_MAT.resolution.set(size.width, size.height);
  }, [size.width, size.height]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    UNIFORMS.uTime.value += dt;

    // ── Entrance ──
    let linksDirty = false;
    if (!ENTER.done) {
      ENTER.t = Math.min(1, ENTER.t + dt / ENTER_SECONDS);
      UNIFORMS.uEnter.value = ENTER.t;
      for (let l = 0; l < LINK_COUNT; l++) {
        const p = easeOut((ENTER.t - LINK_ENTER[l]) / 0.3);
        const o = l * 6;
        LINE_POS_ARR[o + 3] = LINE_POSITIONS[o] + (LINE_POSITIONS[o + 3] - LINE_POSITIONS[o]) * p;
        LINE_POS_ARR[o + 4] = LINE_POSITIONS[o + 1] + (LINE_POSITIONS[o + 4] - LINE_POSITIONS[o + 1]) * p;
        LINE_POS_ARR[o + 5] = LINE_POSITIONS[o + 2] + (LINE_POSITIONS[o + 5] - LINE_POSITIONS[o + 2]) * p;
      }
      linksDirty = true;
      if (ENTER.t >= 1) ENTER.done = true;
    }
    if (linksDirty) LINE_POS_BUFFER.needsUpdate = true;
    const enterHub = easeOut(ENTER.t / 0.25);
    const enterLeaf = easeOut((ENTER.t - 0.45) / 0.45);

    // ── Orbit: drag inertia, then auto-rotation once the user has been idle ──
    ORBIT.idle += dt;
    if (!ORBIT.dragging) {
      ORBIT.yaw += ORBIT.vYaw * dt;
      ORBIT.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, ORBIT.pitch + ORBIT.vPitch * dt));
      const damp = Math.exp(-dt * 2.4);
      ORBIT.vYaw *= damp;
      ORBIT.vPitch *= damp;
      // Pitch eases back to level while idle so the field never stays tilted.
      if (ORBIT.idle > 2.5) ORBIT.pitch *= Math.exp(-dt * 0.6);
    }
    const autoBlend = pinned ? 0 : clamp01((ORBIT.idle - 1.5) / 1.5);
    ORBIT.yaw += AUTO_RATE * autoBlend * dt;
    if (spin.current) spin.current.rotation.y = ORBIT.yaw;
    if (parallax.current) {
      const tx = (pinned ? 0 : -state.pointer.y * 0.16) + ORBIT.pitch;
      const ty = pinned ? 0 : state.pointer.x * 0.2;
      const k = pinned || ORBIT.dragging ? 0.12 : 0.04;
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

    // Hub emblems follow their hub's glow (and the entrance).
    for (let c = 0; c < CLUSTER_COUNT; c++) {
      const g = GLOW[CLUSTER_HUB[c]];
      const focused = focusCluster === c;
      const target = (focused ? 0.85 : focusCluster === null ? 0.5 : 0.1) * enterHub;
      const mat = GLYPH_SPRITES[c].material;
      mat.opacity += (target - mat.opacity) * fNode;
      const s = 1.15 + 0.25 * clamp01(g - 0.9) + (focused ? 0.1 * Math.sin(state.clock.elapsedTime * 2.2) : 0);
      GLYPH_SPRITES[c].scale.set(s, s, 1);
    }

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
      const tOp = (pinned ? 0.25 : 0.85) * enterLeaf;
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

    // Camera: frame the pinned target in the left-centre third (the detail card
    // docks on the right); otherwise return home.
    const cam = state.camera;
    if (zoomTarget !== null && points.current) {
      const i = zoomTarget;
      // Frame a leaf halfway between it and its hub so the whole cluster stays in
      // shot (a leaf at the cluster's edge would otherwise push the rest off-stage).
      const h = CLUSTER_HUB[CLUSTER_OF[i]];
      const w = IS_HUB[i] ? 1 : 0.5;
      PROJ_VEC.set(
        NODE_POSITIONS[i * 3] * w + NODE_POSITIONS[h * 3] * (1 - w),
        NODE_POSITIONS[i * 3 + 1] * w + NODE_POSITIONS[h * 3 + 1] * (1 - w),
        NODE_POSITIONS[i * 3 + 2] * w + NODE_POSITIONS[h * 3 + 2] * (1 - w),
      );
      points.current.updateWorldMatrix(true, false);
      points.current.localToWorld(PROJ_VEC);
      const aspect = size.width / size.height;
      const nx = -0.28;
      const ny = 0.04;
      CAM_TARGET.set(
        PROJ_VEC.x - (nx * zoomDist * aspect) / FOCAL_F,
        PROJ_VEC.y - (ny * zoomDist) / FOCAL_F,
        PROJ_VEC.z + zoomDist,
      );
    } else {
      CAM_TARGET.set(0, 0, HOME_Z);
    }
    cam.position.lerp(CAM_TARGET, 1 - Math.exp(-dt * 4.5));

    // Project every node to CSS px (feeds the picker + the label layer), then
    // place the labels. Hubs are always on; leaves only while their cluster is
    // focused (or the leaf itself is active), so the field stays legible.
    if (points.current) {
      points.current.updateWorldMatrix(true, false);
      for (let i = 0; i < NODE_COUNT; i++) {
        PROJ_VEC.set(NODE_POSITIONS[i * 3], NODE_POSITIONS[i * 3 + 1], NODE_POSITIONS[i * 3 + 2]);
        points.current.localToWorld(PROJ_VEC);
        PROJ_VEC.project(cam);
        const inFront = PROJ_VEC.z < 1;
        const sx = (PROJ_VEC.x * 0.5 + 0.5) * size.width;
        const sy = (-PROJ_VEC.y * 0.5 + 0.5) * size.height;
        SCREEN[i * 3] = sx;
        SCREEN[i * 3 + 1] = sy;
        SCREEN[i * 3 + 2] = inFront ? 1 : 0;

        const el = LABEL_ELS[i];
        if (!el) continue;
        const isHub = IS_HUB[i] === 1;
        const inFocus = focusCluster === null || CLUSTER_OF[i] === focusCluster;
        let opacity: number;
        if (!inFront || ORBIT.dragging) opacity = isHub && inFront ? 0.5 : 0;
        else if (i === activeNode) opacity = 1;
        else if (isHub) opacity = inFocus ? 0.95 : 0.3;
        else opacity = focusCluster !== null && inFocus ? 0.9 : 0;
        opacity *= isHub ? enterHub : enterLeaf;
        el.style.opacity = opacity.toFixed(2);
        if (opacity === 0) {
          el.style.pointerEvents = 'none';
          continue;
        }
        el.style.pointerEvents = ORBIT.dragging ? 'none' : 'auto';
        if (isHub) {
          // Hubs sit above their node.
          el.style.transform = `translate(-50%, -100%) translate(${sx.toFixed(1)}px, ${(sy - 18).toFixed(1)}px)`;
          continue;
        }
        // Leaves hang on their outward side (away from the hub), so labels fan
        // out around the cluster instead of piling up on top of each other.
        // Hubs precede their leaves in NODES, so the hub's projection is fresh.
        const h = CLUSTER_HUB[CLUSTER_OF[i]] * 3;
        const dx = sx - SCREEN[h];
        const dy = sy - SCREEN[h + 1];
        if (Math.abs(dx) >= Math.abs(dy)) {
          el.style.transform =
            dx >= 0
              ? `translate(0, -50%) translate(${(sx + 11).toFixed(1)}px, ${sy.toFixed(1)}px)`
              : `translate(-100%, -50%) translate(${(sx - 11).toFixed(1)}px, ${sy.toFixed(1)}px)`;
        } else {
          el.style.transform =
            dy >= 0
              ? `translate(-50%, 0) translate(${sx.toFixed(1)}px, ${(sy + 10).toFixed(1)}px)`
              : `translate(-50%, -100%) translate(${sx.toFixed(1)}px, ${(sy - 10).toFixed(1)}px)`;
        }
      }
    }
  });

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
        {/* Shared module-scope objects — dispose={null} so a gate remount can't free them. */}
        <primitive object={FAT_LINES} dispose={null} />
        {GLYPH_SPRITES.map((s, c) => (
          <primitive key={CLUSTERS[c].index} object={s} dispose={null} />
        ))}

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
            opacity={0}
            depthWrite={false}
            depthTest={false}
            blending={THREE.AdditiveBlending}
          />
        </points>

        {/* Skill nodes — picking is done in screen space by the stage (see pickNode),
            not by the R3F raycaster, so overlapping leaves can't steal a hub. */}
        <points ref={points}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[NODE_POSITIONS, 3]} />
            <bufferAttribute attach="attributes-aColor" args={[A_COLOR, 3]} />
            <bufferAttribute attach="attributes-aSize" args={[A_SIZE, 1]} />
            <bufferAttribute ref={glowAttr} attach="attributes-aGlow" args={[GLOW, 1]} />
            <bufferAttribute attach="attributes-aPhase" args={[A_PHASE, 1]} />
            <bufferAttribute attach="attributes-aEnter" args={[A_ENTER, 1]} />
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
  const [dragging, setDragging] = useState(false);
  const { openProject } = useProjectModal();
  const stageRef = useRef<HTMLDivElement>(null);
  const lastHover = useRef<number>(-1);
  const hintId = useId();

  const sel = hover ?? pin;
  const focusCluster = sel ? (sel.kind === 'cluster' ? sel.i : CLUSTER_OF[sel.i]) : null;
  const activeNode = sel && sel.kind === 'node' ? sel.i : null;
  const pinned = pin !== null;
  const pinnedNode = pin?.kind === 'node' ? pin.i : null;

  let zoomTarget: number | null = null;
  let zoomDist = 7;
  if (pin) {
    if (pin.kind === 'node') {
      zoomTarget = pin.i;
      zoomDist = IS_HUB[pin.i] ? 9 : 8.5;
    } else {
      zoomTarget = CLUSTER_HUB[pin.i];
      zoomDist = 9.5;
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
          glyph: CLUSTERS[n.cluster].glyph,
          blurb: m.blurb,
          usedIn: m.usedIn,
        };
      }
    } else {
      cardData = buildDomainCard(pin.i);
    }
  }

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
  }, []);
  const onClickNode = useCallback((i: number) => {
    setPin((p) => (p && p.kind === 'node' && p.i === i ? null : { kind: 'node', i }));
  }, []);
  const onLegendEnter = useCallback((i: number) => setHover({ kind: 'cluster', i }), []);
  const onLegendLeave = useCallback(() => setHover(null), []);
  const onLegendClick = useCallback(
    (i: number) =>
      setPin((p) => (p && p.kind === 'cluster' && p.i === i ? null : { kind: 'cluster', i })),
    [],
  );

  // ── Stage pointer handling: screen-space picking + drag-to-orbit ──
  const pickAt = useCallback((clientX: number, clientY: number) => {
    const el = stageRef.current;
    if (!el) return -1;
    const r = el.getBoundingClientRect();
    return pickNode(clientX - r.left, clientY - r.top);
  }, []);
  const onStageDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    ORBIT.dragging = true;
    ORBIT.moved = false;
    ORBIT.lastX = e.clientX;
    ORBIT.lastY = e.clientY;
    ORBIT.lastT = performance.now();
    ORBIT.vYaw = 0;
    ORBIT.vPitch = 0;
    ORBIT.idle = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);
  const onStageMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (ORBIT.dragging) {
        const dx = e.clientX - ORBIT.lastX;
        const dy = e.clientY - ORBIT.lastY;
        if (!ORBIT.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        if (!ORBIT.moved) {
          ORBIT.moved = true;
          setDragging(true);
          lastHover.current = -1;
          setHover(null);
        }
        const now = performance.now();
        const dtMs = Math.max(8, now - ORBIT.lastT);
        ORBIT.yaw += dx * DRAG_YAW;
        ORBIT.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, ORBIT.pitch + dy * DRAG_PITCH));
        ORBIT.vYaw = (dx * DRAG_YAW * 1000) / dtMs;
        ORBIT.vPitch = (dy * DRAG_PITCH * 1000) / dtMs;
        ORBIT.lastX = e.clientX;
        ORBIT.lastY = e.clientY;
        ORBIT.lastT = now;
        ORBIT.idle = 0;
        return;
      }
      const i = pickAt(e.clientX, e.clientY);
      if (i !== lastHover.current) {
        lastHover.current = i;
        onHoverNode(i === -1 ? null : i);
      }
    },
    [pickAt, onHoverNode],
  );
  const onStageUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!ORBIT.dragging) return;
    ORBIT.dragging = false;
    ORBIT.idle = 0;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (ORBIT.moved) setDragging(false);
  }, []);
  const onStageLeave = useCallback(() => {
    if (ORBIT.dragging) return; // pointer capture keeps the drag alive
    lastHover.current = -1;
    onHoverNode(null);
  }, [onHoverNode]);
  const onStageClick = useCallback(
    (e: React.MouseEvent) => {
      if (ORBIT.moved) {
        // A drag just ended — swallow the synthetic click so it doesn't unpin.
        ORBIT.moved = false;
        return;
      }
      const i = pickAt(e.clientX, e.clientY);
      if (i === -1) setPin(null);
      else onClickNode(i);
    },
    [pickAt, onClickNode],
  );

  // ── Keyboard: arrows step through skills / domains, Enter opens, Escape closes ──
  const onStageKey = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const current = activeNode ?? (pin?.kind === 'cluster' ? CLUSTER_HUB[pin.i] : -1);
      let next: number | null = null;
      switch (e.key) {
        case 'ArrowRight':
          next = current < 0 ? CLUSTER_HUB[0] : (current + 1) % NODE_COUNT;
          break;
        case 'ArrowLeft':
          next = current < 0 ? CLUSTER_HUB[0] : (current - 1 + NODE_COUNT) % NODE_COUNT;
          break;
        case 'ArrowDown':
        case 'ArrowUp': {
          const dir = e.key === 'ArrowDown' ? 1 : -1;
          const c = current < 0 ? 0 : (CLUSTER_OF[current] + dir + CLUSTER_COUNT) % CLUSTER_COUNT;
          next = CLUSTER_HUB[c];
          break;
        }
        case 'Home':
          next = CLUSTER_HUB[0];
          break;
        case 'Enter':
        case ' ':
          if (current >= 0) {
            e.preventDefault();
            onClickNode(current);
          }
          return;
        default:
          return;
      }
      e.preventDefault();
      ORBIT.idle = 0;
      onHoverNode(next);
    },
    [activeNode, pin, onClickNode, onHoverNode],
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

  const cursor = dragging ? 'cursor-grabbing' : hover?.kind === 'node' ? 'cursor-pointer' : 'cursor-grab';

  return (
    <div className="relative w-full h-full">
      <div
        ref={stageRef}
        role="group"
        tabIndex={0}
        aria-label="Interactive 3D map of skills grouped by domain"
        aria-describedby={hintId}
        className={`absolute inset-0 touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyber-brand/70 ${cursor}`}
        onPointerDown={onStageDown}
        onPointerMove={onStageMove}
        onPointerUp={onStageUp}
        onPointerCancel={onStageUp}
        onPointerLeave={onStageLeave}
        onClick={onStageClick}
        onKeyDown={onStageKey}
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
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.NoToneMapping;
          }}
          style={{ width: '100%', height: '100%' }}
        >
          <Scene
            focusCluster={focusCluster}
            activeNode={activeNode}
            zoomTarget={zoomTarget}
            zoomDist={zoomDist}
            pinned={pinned}
            pinnedNode={pinnedNode}
          />
        </Canvas>
      </div>
      <p id={hintId} className="sr-only">
        Drag to rotate. Use the left and right arrow keys to step through skills, up and down
        to jump between domains, Enter to open details and Escape to close them.
      </p>

      {/* Node labels — positioned per frame by the scene (transform + opacity only).
          Hubs are always readable; leaves appear when their domain is in focus.
          Decorative for AT (the section keeps an sr-only list), but clickable. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
        {NODES.map((n, i) => {
          const isHub = n.isHub;
          const isPinned = pinnedNode === i;
          const isActive = activeNode === i;
          const cluster = CLUSTERS[n.cluster];
          return (
            <button
              key={n.id}
              ref={(el) => {
                LABEL_ELS[i] = el;
              }}
              type="button"
              tabIndex={-1}
              onPointerEnter={() => onHoverNode(i)}
              onPointerLeave={() => onHoverNode(null)}
              onClick={(e) => {
                e.stopPropagation();
                onClickNode(i);
              }}
              style={{ opacity: 0, borderColor: isPinned || isActive ? cluster.color : undefined }}
              className={`absolute left-0 top-0 inline-flex select-none items-center gap-1.5 whitespace-nowrap rounded-md border font-mono text-xs leading-none transition-[opacity,background-color,border-color] duration-200 will-change-transform ${
                isHub ? 'px-2.5 py-1.5 font-semibold text-white' : 'px-2 py-1 text-cyber-secondary'
              } ${
                isPinned
                  ? 'bg-cyber-darker/95 text-white shadow-glow'
                  : isActive
                    ? 'bg-cyber-darker/90 text-white'
                    : isHub
                      ? 'border-cyber-primary/15 bg-cyber-darker/70'
                      : 'border-transparent bg-cyber-darker/60'
              }`}
            >
              {isHub && <ClusterGlyph shape={cluster.glyph} color={cluster.color} size={11} />}
              {n.label}
              {isHub && (
                <span className="rounded-sm bg-white/10 px-1 py-0.5 text-[11px] font-normal tabular-nums text-cyber-accent">
                  {CLUSTER_COUNTS[n.cluster]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Detail card (docks on the right when a node/domain is pinned) */}
      <AnimatePresence>
        {cardData && (
          <SkillDetailCard data={cardData} onClose={() => setPin(null)} onOpenProject={handleOpenProject} />
        )}
      </AnimatePresence>

      {/* Domain legend — stays available while pinned, tucked left of the card */}
      <div
        className={`absolute inset-x-0 bottom-1.5 sm:bottom-2.5 z-10 flex flex-wrap items-center gap-1.5 sm:gap-2 px-3 sm:px-4 ${
          pinned ? 'justify-start' : 'justify-center'
        }`}
      >
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
              aria-pressed={pin?.kind === 'cluster' && pin.i === i}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-3 py-2 font-mono text-xs transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-brand focus-visible:ring-offset-2 focus-visible:ring-offset-cyber-darker ${
                isActive
                  ? 'border-cyber-brand bg-cyber-brand/10 text-white'
                  : 'border-cyber-primary/15 bg-cyber-darker/60 text-cyber-accent hover:border-cyber-primary/40 hover:text-cyber-primary'
              }`}
            >
              <ClusterGlyph shape={c.glyph} color={c.color} size={12} filled={isActive} />
              <span className="whitespace-nowrap">{c.title}</span>
              <span
                className={`rounded-sm px-1.5 py-0.5 text-[11px] tabular-nums ${
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
