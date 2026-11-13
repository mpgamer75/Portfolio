'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import {
  CLUSTERS,
  CLUSTER_COUNT,
  CLUSTER_COUNTS,
  CLUSTER_HUB,
  CLUSTER_OF,
  CLUSTER_SKILLS,
  IS_HUB,
  LINK_A,
  LINK_B,
  LINK_COUNT,
  LINK_REST,
  NODES,
  NODE_COUNT,
  NODE_POSITIONS,
  NODE_RADIUS,
} from './constellationData';
import { FOCAL_F, FOG_FAR, FOG_FLOOR, FOG_NEAR, FOV, HOME_Z, SHARED, depthFade } from './sceneShared';
import { NODE_MESH, NODE_UNIFORMS, flushNodeState, setAtmosState, setNodeState } from './nodeLayer';
import { LINK_MESH, LINK_UNIFORMS, flushLinkState, setLinkIntensity, setLinkSkirt } from './linkLayer';
import { STAR_DRIFT, STAR_POINTS, setFarStars } from './starLayer';
import { getSkillMeta } from './skillsMeta';
import ClusterGlyph from './ClusterGlyph';
import { projects } from '@/components/sections/projectsData';
import { useProjectModal } from '@/components/ui/ProjectModalProvider';
import SkillDetailCard, { type SkillCardData } from '@/components/ui/SkillDetailCard';

/*
 * Client-only (the gate imports it with `ssr:false`), so module-scope `document`
 * access and the shared scene buffers/objects are safe — the constellation is a
 * singleton. Render only reads these; `useFrame` and the pointer handlers mutate
 * them, which keeps render pure and avoids tripping react-hooks/immutability
 * (the rule forbids mutating hook-returned values or props, not module scope).
 *
 * The scene is three draw calls, all hand-written shaders, no textures:
 *   starLayer  — seeded parallax starfield
 *   linkLayer  — instanced ribbons (glow, energy flow, entrance draw)
 *   nodeLayer  — instanced billboards (leaves, hub emblems, reticle, domain glows)
 */

const restIntensity = (i: number) => (IS_HUB[i] ? 0.95 : 0.55);
/** Eased per-node glow and selection (0 none · 0.6 hovered · 1 pinned), fed to the node layer. */
const GLOW = new Float32Array(NODE_COUNT);
const SELECT = new Float32Array(NODE_COUNT);
for (let i = 0; i < NODE_COUNT; i++) GLOW[i] = restIntensity(i);
/** Eased per-link brightness, fed to the link layer. */
const LINE_INT = new Float32Array(LINK_COUNT);
LINE_INT.set(LINK_REST);
/** Eased glow strength per domain (+ the backdrop in the last slot). */
const ATMOS = new Float32Array(CLUSTER_COUNT + 1);

/**
 * Screen-space projection of every node, refreshed each frame by the scene:
 * [x px, y px, in-front-of-camera 0|1]. Read by the pointer picker and the label
 * layer — both live in CSS pixels, so hit-testing here is exact regardless of
 * DPR, zoom or the orbit/parallax transforms.
 */
const SCREEN = new Float32Array(NODE_COUNT * 3);
/** View-space depth of every node (distance in front of the camera, scene units). */
const NODE_DEPTH = new Float32Array(NODE_COUNT);
/** On-screen radius of every node in CSS px (hub plate / leaf core). */
const NODE_RPX = new Float32Array(NODE_COUNT);
/** Minimum pick radius in CSS px — hubs get a bigger, higher-priority target. */
const PICK_RADIUS_HUB = 26;
const PICK_RADIUS_LEAF = 15;

/** Label DOM nodes, one per skill node; filled by ref callbacks, positioned by useFrame. */
const LABEL_ELS: (HTMLElement | null)[] = new Array(NODE_COUNT).fill(null);
/**
 * Last values written to each label's style, so a frame in which nothing moved
 * writes nothing: opacity in 1/100 steps, pointer-events flag, anchor mode and
 * position. -1 = unknown (forces the next write).
 */
const LBL_Q = new Int16Array(NODE_COUNT).fill(-1);
const LBL_PE = new Int8Array(NODE_COUNT).fill(-1);
const LBL_MODE = new Int8Array(NODE_COUNT).fill(-1);
const LBL_X = new Float32Array(NODE_COUNT);
const LBL_Y = new Float32Array(NODE_COUNT);
/** Label widths in CSS px (measured on mount and again once the web font is in). */
const LBL_W = new Float32Array(NODE_COUNT);
const HUB_LABEL_H = 29;
const LEAF_LABEL_H = 22;
/** Stable ref callbacks (one per label) — they also reset that label's write cache. */
const LABEL_REFS = NODES.map((_, i) => (el: HTMLElement | null) => {
  LABEL_ELS[i] = el;
  LBL_Q[i] = -1;
  LBL_PE[i] = -1;
  LBL_MODE[i] = -1;
  if (el) LBL_W[i] = el.offsetWidth;
});
function measureLabels() {
  for (let i = 0; i < NODE_COUNT; i++) {
    const el = LABEL_ELS[i];
    if (el) LBL_W[i] = el.offsetWidth;
  }
}
/** Anchor modes: how a label hangs off its node. */
const ANCHOR_ABOVE = 0;
const ANCHOR_RIGHT = 1;
const ANCHOR_LEFT = 2;
const ANCHOR_BELOW = 3;
const ANCHORS = [
  'translate(-50%, -100%)',
  'translate(0, -50%)',
  'translate(-100%, -50%)',
  'translate(-50%, 0)',
];

/** Left edge / top edge of a label's box for an anchor mode and anchor point. */
const labelLeft = (mode: number, x: number, w: number) =>
  mode === ANCHOR_RIGHT ? x : mode === ANCHOR_LEFT ? x - w : x - w / 2;
const labelTop = (mode: number, y: number, h: number) =>
  mode === ANCHOR_BELOW ? y : mode === ANCHOR_ABOVE ? y - h : y - h / 2;
/** Inverse of labelTop: the anchor y that puts the box's top edge at `top`. */
const anchorY = (mode: number, top: number, h: number) =>
  mode === ANCHOR_BELOW ? top : mode === ANCHOR_ABOVE ? top + h : top + h / 2;

/**
 * The pinned detail card's box in stage px (labels underneath it are hidden).
 * Measured from layout on pin, so it costs nothing per frame.
 */
const CARD = { on: false, left: 0, top: 0, right: 0, bottom: 0 };

/**
 * Scratch for the leaf-label collision pass: the focused cluster's visible leaf
 * labels (at most 9), nudged apart vertically so they never sit on each other.
 */
const SWEEP_MAX = 12;
const SW_I = new Int16Array(SWEEP_MAX);
const SW_MODE = new Int8Array(SWEEP_MAX);
const SW_X = new Float32Array(SWEEP_MAX);
const SW_TOP = new Float32Array(SWEEP_MAX);
const SW_OP = new Float32Array(SWEEP_MAX);
const SW_ORDER = new Int8Array(SWEEP_MAX);
/** 1 = the label sits above its hub (pushed up), 0 = below (pushed down). */
const SW_UP = new Int8Array(SWEEP_MAX);
const LABEL_GAP = 3;

/** Writes a label's opacity / hit-testing / transform, skipping anything unchanged. */
function writeLabel(i: number, opacity: number, interactive: boolean, mode: number, x: number, y: number) {
  const el = LABEL_ELS[i];
  if (!el) return;
  const q = Math.round(opacity * 100);
  if (q !== LBL_Q[i]) {
    // Promote to its own layer only while it is actually on screen.
    if ((q === 0) !== (LBL_Q[i] <= 0)) el.style.willChange = q === 0 ? '' : 'transform';
    el.style.opacity = (q / 100).toFixed(2);
    LBL_Q[i] = q;
  }
  const pe = q > 0 && interactive ? 1 : 0;
  if (pe !== LBL_PE[i]) {
    el.style.pointerEvents = pe ? 'auto' : 'none';
    LBL_PE[i] = pe;
  }
  if (q === 0) return;
  if (mode !== LBL_MODE[i] || Math.abs(x - LBL_X[i]) >= 0.25 || Math.abs(y - LBL_Y[i]) >= 0.25) {
    el.style.transform = `${ANCHORS[mode]} translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    LBL_MODE[i] = mode;
    LBL_X[i] = x;
    LBL_Y[i] = y;
  }
}

/**
 * Narrow stages: the near (left/right) clusters sit at z = +2.2 and reach about
 * 5.7 units from the axis, so below a ~2:1 aspect the home camera backs off just
 * enough to keep them in frame.
 */
const NEAR_PLANE_Z = 2.2;
const HALF_SPAN_X = 5.7;
/** View depth of the near clusters from the home camera — where the fog ramp is "clear". */
const CLEAR_DEPTH = HOME_Z - NEAR_PLANE_Z;

/** Stage C4 switch: domain glows + backdrop (extra instances of the node draw). */
const ATMOS_ENABLED = true;

const PROJ_VEC = new THREE.Vector3();
const CAM_TARGET = new THREE.Vector3(0, 0, HOME_Z);
/** Camera spring velocity (critically damped — eases in and out, never snaps). */
const CAM_VEL = new THREE.Vector3();
const CAM_TIME_IN = 0.55; // s, towards a pinned target
const CAM_TIME_OUT = 0.7; // s, back home
const CAM_TIME_ENTER = 1.0; // s, the entrance push-in
/** The camera starts this far back and pushes in while the constellation assembles. */
const ENTER_DOLLY = 3.2;
/** Click shockwave progress (0 = idle) and the last pinned target, to detect a new pin. */
const PING = { t: 0, last: -1 };
const PING_SECONDS = 0.8;

/**
 * Critically damped spring step for one camera axis (Unity-style SmoothDamp):
 * allocation-free, frame-rate independent, interruptible without a jump.
 */
function springAxis(axis: 'x' | 'y' | 'z', pos: THREE.Vector3, target: number, time: number, dt: number) {
  const omega = 2 / time;
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = pos[axis] - target;
  const temp = (CAM_VEL[axis] + omega * change) * dt;
  CAM_VEL[axis] = (CAM_VEL[axis] - omega * temp) * decay;
  pos[axis] = target + (change + temp) * decay;
}
/** Eased offset of the fog ramp, so whatever the camera frames stays clear of the fog. */
const FOG = { shift: 0 };

/**
 * One-shot entrance: `t` runs 0 → 1 over ENTER_SECONDS the first time the stage
 * is properly on screen. Hubs pop first, the hub ring draws, then each cluster's
 * links draw outward and the leaves bloom along them (all in the shaders, keyed
 * off the shared `uEnter` uniform).
 */
const ENTER = { t: 0, done: false };
const ENTER_SECONDS = 1.4;
/**
 * Shader warm-up. Programs are compiled off-screen on mount (the frameloop is
 * 'never' until the stage is in view), and the entrance waits for them so the
 * compile hitch never lands on the reveal. `wait` is a safety net: if the
 * compile promise never settles, the entrance starts anyway.
 */
const WARM = { ready: false, wait: 0 };
const WARM_MAX_WAIT = 1.2; // s

/**
 * Frame-time governor. One-way quality tiers kept in module scope so a remount
 * starts at the last known-good tier: a 45-frame window of raw frame deltas,
 * and when its median says "under 50 fps" the tier steps down (never back up —
 * resizing the drawing buffer back and forth would itself cause hitches).
 *
 *   tier 0 — DPR ≤ 1.5, everything on
 *   tier 1 — DPR ≤ 1.25, domain glows off
 *   tier 2 — DPR ≤ 1.0, far star layer and link glow skirt off as well
 */
const TIER_DPR = [1.5, 1.25, 1.0];
const MAX_TIER = TIER_DPR.length - 1;
const GOV_WINDOW = 45;
const GOV_SKIP = 30; // frames ignored after (re)activation
const GOV_SLOW = 0.02; // s — median frame time that triggers a step down
const GOV_GAP = 0.1; // s — a delta this long is a one-off hitch, not a slow frame: ignored
const GOV_PAUSE = 0.5; // s — a delta this long means the loop was paused: restart the window
const GOV_COOLDOWN = 2; // s between steps
/** Above this many device pixels the canvas starts one DPR step lower. */
const GOV_MAX_PIXELS = 3.2e6;
const GOV = {
  tier: 0,
  n: 0,
  skip: GOV_SKIP,
  sinceStep: GOV_COOLDOWN,
  buf: new Float32Array(GOV_WINDOW),
  sorted: new Float32Array(GOV_WINDOW),
};

/** Orbit state — pointer drag with inertia; the idle sway resumes after a pause. */
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
/**
 * Idle motion is a bounded sway, not a free spin: the graph rocks +/-SWAY_AMP
 * about its home view and never turns edge-on. `t` only advances while the sway
 * is blended in, so it freezes (rather than jumps) on a drag or a pin.
 */
const SWAY = { t: 0, v: 0 };
const SWAY_AMP = 0.38; // rad
const SWAY_RATE = 0.11; // rad/s (phase)
/** Soft limit on the total yaw (user + sway); past it the drag rubber-bands. */
const YAW_LIMIT = 1.1; // rad
const PITCH_LIMIT = 0.55; // rad
const DRAG_YAW = 0.0055; // rad per px
const DRAG_PITCH = 0.0038;
const DRAG_THRESHOLD = 4; // px before a press becomes a drag (so clicks still click)

/** Restores the interactive state a remount should not inherit (the entrance is kept). */
function resetSceneState() {
  ORBIT.yaw = 0;
  ORBIT.pitch = 0;
  ORBIT.vYaw = 0;
  ORBIT.vPitch = 0;
  ORBIT.dragging = false;
  ORBIT.moved = false;
  ORBIT.idle = 10;
  SWAY.t = 0;
  SWAY.v = 0;
  FOG.shift = 0;
  CAM_VEL.set(0, 0, 0);
  PING.t = 0;
  PING.last = -1;
  SHARED.uPing.value.w = 0;
  CARD.on = false;
  WARM.ready = false;
  WARM.wait = 0;
  GOV.n = 0;
  GOV.skip = GOV_SKIP;
}

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
    const r = IS_HUB[i]
      ? Math.max(PICK_RADIUS_HUB, NODE_RPX[i] + 2)
      : Math.max(PICK_RADIUS_LEAF, NODE_RPX[i] + 6);
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
  /** One-shot: the stage has been properly visible, so the entrance may start. */
  entered: boolean;
  /** Current quality tier (React copy of GOV.tier, so the DPR cap can follow it). */
  tier: number;
  /** Governor → parent: step to a lower tier. */
  onTier: (tier: number) => void;
  /** Scene → parent: the DPR cap for this canvas size and tier. */
  onDprCap: (cap: number) => void;
  /** First frame has been drawn — the canvas can fade in. */
  onShown: () => void;
  /** Unrecoverable GPU failure (context lost and not restored) → cards. */
  onFail: () => void;
}

function Scene({
  focusCluster,
  activeNode,
  zoomTarget,
  zoomDist,
  pinned,
  pinnedNode,
  entered,
  tier,
  onTier,
  onDprCap,
  onShown,
  onFail,
}: SceneProps) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const parallax = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const shown = useRef(false);

  // Follows the live DPR and stage size (browser zoom, monitor change, quality governor).
  useEffect(() => {
    SHARED.uDpr.value = dpr;
    SHARED.uResolution.value.set(size.width, size.height);
  }, [dpr, size.width, size.height]);

  // Warm-up: compile every program now, while the stage is still off-screen.
  // (No invalidate(): it is a no-op while the frameloop is 'never'.)
  useEffect(() => {
    let alive = true;
    const done = () => {
      if (alive) WARM.ready = true;
    };
    gl.compileAsync(scene, camera).then(done, done);
    return () => {
      alive = false;
    };
  }, [gl, scene, camera]);

  // Context loss: give the browser a moment to restore it, otherwise hand over
  // to the cards. Everything here is procedural, so a restored context just works.
  useEffect(() => {
    const el = gl.domElement;
    let timer: number | undefined;
    const onLost = (e: Event) => {
      e.preventDefault();
      window.clearTimeout(timer);
      timer = window.setTimeout(onFail, 1500);
    };
    const onRestored = () => {
      window.clearTimeout(timer);
      timer = undefined;
    };
    el.addEventListener('webglcontextlost', onLost);
    el.addEventListener('webglcontextrestored', onRestored);
    return () => {
      el.removeEventListener('webglcontextlost', onLost);
      el.removeEventListener('webglcontextrestored', onRestored);
      window.clearTimeout(timer);
      resetSceneState();
    };
  }, [gl, onFail]);

  // DPR cap for this tier — one step lower again on very large canvases, where
  // the top DPR would mean more pixels than an integrated GPU fills at 60 fps.
  useEffect(() => {
    let cap = TIER_DPR[tier];
    if (tier < MAX_TIER && size.width * size.height * cap * cap > GOV_MAX_PIXELS) cap = TIER_DPR[tier + 1];
    onDprCap(cap);
  }, [tier, size.width, size.height, onDprCap]);

  // Effect tiers: the lowest tier also drops the far star layer and the link glow skirt.
  useEffect(() => {
    setFarStars(tier < MAX_TIER);
    setLinkSkirt(tier < MAX_TIER);
  }, [tier]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    SHARED.uTime.value += dt;

    if (!shown.current) {
      shown.current = true;
      onShown();
      // Entrance dolly: until the entrance has played, the camera waits further back.
      if (ENTER.t === 0) state.camera.position.setZ(HOME_Z + ENTER_DOLLY);
    }

    // ── Quality governor (raw delta: the clamp above would hide slow frames) ──
    GOV.sinceStep += delta;
    if (delta > GOV_PAUSE) {
      // The loop was paused (scrolled away / tab hidden): start a fresh window.
      GOV.n = 0;
      GOV.skip = GOV_SKIP;
    } else if (delta > GOV_GAP) {
      // A one-off hitch (GC, another section mounting) says nothing about fill rate.
    } else if (GOV.skip > 0) {
      GOV.skip--;
    } else if (GOV.tier < MAX_TIER) {
      GOV.buf[GOV.n++] = delta;
      if (GOV.n === GOV_WINDOW) {
        GOV.n = 0;
        GOV.sorted.set(GOV.buf);
        GOV.sorted.sort();
        if (GOV.sorted[GOV_WINDOW >> 1] > GOV_SLOW && GOV.sinceStep >= GOV_COOLDOWN) {
          GOV.tier++;
          GOV.sinceStep = 0;
          GOV.skip = GOV_SKIP;
          onTier(GOV.tier);
        }
      }
    }

    // ── Entrance (waits for the stage to be properly visible and shaders warm) ──
    if (!ENTER.done && entered && !WARM.ready) {
      WARM.wait += dt;
      if (WARM.wait > WARM_MAX_WAIT) WARM.ready = true;
    }
    if (!ENTER.done && entered && WARM.ready) {
      ENTER.t = Math.min(1, ENTER.t + dt / ENTER_SECONDS);
      if (ENTER.t >= 1) ENTER.done = true;
    }
    SHARED.uEnter.value = ENTER.t;
    const enterHub = easeOut(ENTER.t / 0.25);
    const enterLeaf = easeOut((ENTER.t - 0.45) / 0.45);

    // ── Orbit: drag inertia + a bounded idle sway (never a free spin) ──
    ORBIT.idle += dt;
    const autoBlend = pinned ? 0 : clamp01((ORBIT.idle - 1.5) / 1.5);
    SWAY.t += dt * autoBlend;
    SWAY.v = SWAY_AMP * Math.sin(SWAY.t * SWAY_RATE);
    if (!ORBIT.dragging) {
      ORBIT.yaw += ORBIT.vYaw * dt;
      ORBIT.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, ORBIT.pitch + ORBIT.vPitch * dt));
      const damp = Math.exp(-dt * 2.4);
      ORBIT.vYaw *= damp;
      ORBIT.vPitch *= damp;
      // Past the soft limit: kill the inertia and spring back inside it.
      const total = ORBIT.yaw + SWAY.v;
      const over = total > YAW_LIMIT ? total - YAW_LIMIT : total < -YAW_LIMIT ? total + YAW_LIMIT : 0;
      if (over !== 0) {
        ORBIT.vYaw = 0;
        ORBIT.yaw -= over * (1 - Math.exp(-dt * 5));
      }
      // While idle the view eases back home: pitch to level, user yaw to zero
      // (the yaw stays put while something is pinned, so the framing holds).
      if (ORBIT.idle > 2.5) {
        ORBIT.pitch *= Math.exp(-dt * 0.6);
        if (!pinned) ORBIT.yaw *= Math.exp(-dt * 0.25);
      }
    }
    const yaw = ORBIT.yaw + SWAY.v;
    if (spin.current) spin.current.rotation.y = yaw;
    let tiltX = 0;
    let tiltY = 0;
    if (parallax.current) {
      const tx = (pinned ? 0 : -state.pointer.y * 0.16) + ORBIT.pitch;
      const ty = pinned ? 0 : state.pointer.x * 0.2;
      const k = 1 - Math.exp(-dt * (pinned || ORBIT.dragging ? 8 : 2.5));
      parallax.current.rotation.x += (tx - parallax.current.rotation.x) * k;
      parallax.current.rotation.y += (ty - parallax.current.rotation.y) * k;
      tiltX = parallax.current.rotation.x;
      tiltY = parallax.current.rotation.y;
    }

    // ── Node glow + selection — active node white-hot, focused cluster lit, the
    // rest dimmed (harder when something is pinned, for a spotlight feel) ──
    const fNode = 1 - Math.exp(-dt * 9);
    const fSelect = 1 - Math.exp(-dt * 12);
    const dimTarget = pinned ? 0.05 : 0.1;
    for (let i = 0; i < NODE_COUNT; i++) {
      let target: number;
      if (activeNode === i) target = 1.65;
      else if (focusCluster === null) target = restIntensity(i);
      else if (CLUSTER_OF[i] === focusCluster) target = IS_HUB[i] ? 1.1 : 0.85;
      else target = dimTarget;
      GLOW[i] += (target - GLOW[i]) * fNode;
      const select = activeNode === i ? (pinnedNode === i ? 1 : 0.6) : 0;
      SELECT[i] += (select - SELECT[i]) * fSelect;
      setNodeState(i, GLOW[i], SELECT[i]);
    }

    // ── Domain glows follow the focus; switched off from tier 1 down ──
    const atmosOn = ATMOS_ENABLED && GOV.tier < 1 ? 1 : 0;
    NODE_UNIFORMS.uAtmos.value += (atmosOn - NODE_UNIFORMS.uAtmos.value) * (1 - Math.exp(-dt * 3));
    for (let c = 0; c <= CLUSTER_COUNT; c++) {
      let target: number;
      if (c === CLUSTER_COUNT) target = focusCluster === null ? 0.2 : 0.12;
      else if (focusCluster === null) target = 0.14;
      else target = focusCluster === c ? 0.3 : 0.04;
      ATMOS[c] += (target - ATMOS[c]) * (1 - Math.exp(-dt * 4));
      setAtmosState(c, ATMOS[c]);
    }
    flushNodeState();

    // ── Link brightness mirrors the focus state ──
    const fLine = 1 - Math.exp(-dt * 8);
    for (let l = 0; l < LINK_COUNT; l++) {
      const a = LINK_A[l];
      const b = LINK_B[l];
      let target: number;
      if (activeNode !== null && (a === activeNode || b === activeNode)) target = 1.2;
      else if (focusCluster === null) target = LINK_REST[l];
      else if (CLUSTER_OF[a] === focusCluster || CLUSTER_OF[b] === focusCluster) target = 0.95;
      else target = pinned ? 0.03 : 0.06;
      LINE_INT[l] += (target - LINE_INT[l]) * fLine;
      setLinkIntensity(l, LINE_INT[l]);
    }
    flushLinkState();
    // Energy flow calms down while a detail card is open.
    LINK_UNIFORMS.uFlow.value += ((pinned ? 0.3 : 0.85) - LINK_UNIFORMS.uFlow.value) * (1 - Math.exp(-dt * 6));

    // ── Camera: frame the pinned target in the left-centre third (the detail
    // card docks on the right); otherwise return home ──
    const cam = state.camera;
    const aspect = size.width / size.height;
    const homeZ = Math.max(HOME_Z, NEAR_PLANE_Z + (HALF_SPAN_X * FOCAL_F) / aspect);
    let fogShift = homeZ - HOME_Z;
    if (zoomTarget !== null && spin.current) {
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
      spin.current.updateWorldMatrix(true, false);
      spin.current.localToWorld(PROJ_VEC);
      const nx = -0.28;
      const ny = 0.04;
      // Narrow stages keep a little more distance so the cluster clears the card.
      const dist = zoomDist * Math.min(1.35, Math.max(1, 1.6 / aspect));
      CAM_TARGET.set(
        PROJ_VEC.x - (nx * dist * aspect) / FOCAL_F,
        PROJ_VEC.y - (ny * dist) / FOCAL_F,
        PROJ_VEC.z + dist,
      );
      fogShift = dist - CLEAR_DEPTH;
    } else {
      // Before the entrance the camera holds further back, then pushes in with it.
      CAM_TARGET.set(0, 0, homeZ + (ENTER.t > 0 ? 0 : ENTER_DOLLY));
      // Hovering a far cluster lifts the fog off it (last frame's depth is plenty).
      if (focusCluster !== null) {
        fogShift = Math.max(fogShift, NODE_DEPTH[CLUSTER_HUB[focusCluster]] - CLEAR_DEPTH);
      }
    }
    const camTime = zoomTarget !== null ? CAM_TIME_IN : ENTER.done ? CAM_TIME_OUT : CAM_TIME_ENTER;
    springAxis('x', cam.position, CAM_TARGET.x, camTime, dt);
    springAxis('y', cam.position, CAM_TARGET.y, camTime, dt);
    springAxis('z', cam.position, CAM_TARGET.z, camTime, dt);

    // ── Click shockwave: a new pin sends one ripple out through the graph ──
    const pinKey = zoomTarget ?? -1;
    if (pinKey !== PING.last) {
      PING.last = pinKey;
      if (pinKey >= 0) {
        SHARED.uPing.value.set(
          NODE_POSITIONS[pinKey * 3],
          NODE_POSITIONS[pinKey * 3 + 1],
          NODE_POSITIONS[pinKey * 3 + 2],
          0,
        );
        PING.t = 0.001;
      }
    }
    if (PING.t > 0) {
      PING.t += dt / PING_SECONDS;
      if (PING.t >= 1) PING.t = 0;
      SHARED.uPing.value.w = PING.t;
    }
    // Refresh matrixWorld(+Inverse) now: the projection below must use this
    // frame's camera, not the one from the previous render.
    cam.updateMatrixWorld();

    // ── Depth: the fog ramp follows what the camera frames; stars drift with
    // the orbit, the tilt and the camera so the three planes separate ──
    FOG.shift += (fogShift - FOG.shift) * (1 - Math.exp(-dt * 4));
    SHARED.uFogNear.value = FOG_NEAR + FOG.shift;
    SHARED.uFogFar.value = FOG_FAR + FOG.shift;
    STAR_DRIFT.set(
      yaw * 0.16 + tiltY * 0.3 + cam.position.x * 0.02,
      -tiltX * 0.3 + cam.position.y * 0.02,
      (homeZ - cam.position.z) * 0.012,
    );

    // ── Project every node to CSS px (feeds the picker + the label layer), then
    // place the labels. Hubs are always on; leaves only while their cluster is
    // focused (or the leaf itself is active), so the field stays legible ──
    if (!spin.current) return;
    spin.current.updateWorldMatrix(true, false);
    const pxPerUnit = FOCAL_F * size.height * 0.5;
    const interactive = !ORBIT.dragging;
    let sweep = 0;
    for (let i = 0; i < NODE_COUNT; i++) {
      PROJ_VEC.set(NODE_POSITIONS[i * 3], NODE_POSITIONS[i * 3 + 1], NODE_POSITIONS[i * 3 + 2]);
      spin.current.localToWorld(PROJ_VEC);
      PROJ_VEC.applyMatrix4(cam.matrixWorldInverse);
      const depth = -PROJ_VEC.z;
      PROJ_VEC.applyMatrix4(cam.projectionMatrix);
      const inFront = depth > 0.2 && PROJ_VEC.z < 1;
      const sx = (PROJ_VEC.x * 0.5 + 0.5) * size.width;
      const sy = (-PROJ_VEC.y * 0.5 + 0.5) * size.height;
      const rPx = inFront ? (NODE_RADIUS[i] * pxPerUnit) / depth : 0;
      SCREEN[i * 3] = sx;
      SCREEN[i * 3 + 1] = sy;
      SCREEN[i * 3 + 2] = inFront ? 1 : 0;
      NODE_DEPTH[i] = depth;
      NODE_RPX[i] = rPx;

      if (!LABEL_ELS[i]) continue;
      const isHub = IS_HUB[i] === 1;
      const inFocus = focusCluster === null || CLUSTER_OF[i] === focusCluster;
      let opacity: number;
      if (!inFront || ORBIT.dragging) opacity = isHub && inFront ? 0.5 : 0;
      else if (i === activeNode) opacity = 1;
      else if (isHub) opacity = inFocus ? 0.95 : 0.3;
      else opacity = focusCluster !== null && inFocus ? 0.9 : 0;
      opacity *= isHub ? enterHub : enterLeaf;
      // Depth cue: labels on the far side recede with their nodes — but never the
      // active one, nor the focused cluster's (those must stay fully legible).
      if (i !== activeNode && opacity > 0 && CLUSTER_OF[i] !== focusCluster) {
        const near = (depthFade(depth) - FOG_FLOOR) / (1 - FOG_FLOOR);
        opacity *= (isHub ? 0.62 : 0.55) + (isHub ? 0.38 : 0.45) * near;
      }

      // Anchor: hubs sit above their plate, hugging it at every zoom (and clearing
      // the reticle, at 1.4 radii, while the hub itself is selected). Leaves hang
      // on their outward side (away from the hub), so labels fan out around the
      // cluster instead of piling up. Hubs precede their leaves in NODES, so the
      // hub's projection is already fresh here.
      let mode = ANCHOR_ABOVE;
      let ax = sx;
      let ay = sy - (i === activeNode ? rPx * 1.5 : rPx) - 8;
      if (!isHub) {
        const h = CLUSTER_HUB[CLUSTER_OF[i]] * 3;
        const dx = sx - SCREEN[h];
        const dy = sy - SCREEN[h + 1];
        // The active leaf carries a reticle (2.3 radii) — its label clears that too.
        const gap = (i === activeNode ? rPx * 2.6 : rPx) + 7;
        if (Math.abs(dx) >= Math.abs(dy)) {
          mode = dx >= 0 ? ANCHOR_RIGHT : ANCHOR_LEFT;
          ax = dx >= 0 ? sx + gap : sx - gap;
          ay = sy;
        } else {
          mode = dy >= 0 ? ANCHOR_BELOW : ANCHOR_ABOVE;
          ay = dy >= 0 ? sy + gap : sy - gap;
        }
      }

      const w = LBL_W[i];
      const hgt = isHub ? HUB_LABEL_H : LEAF_LABEL_H;
      // Anything that would sit under the pinned detail card is hidden.
      if (opacity > 0 && CARD.on) {
        const left = labelLeft(mode, ax, w);
        const top = labelTop(mode, ay, hgt);
        if (left < CARD.right && left + w > CARD.left && top < CARD.bottom && top + hgt > CARD.top) {
          opacity = 0;
        }
      }
      // The focused cluster's leaf labels go through the collision pass below.
      if (!isHub && opacity > 0 && CLUSTER_OF[i] === focusCluster && sweep < SWEEP_MAX) {
        SW_I[sweep] = i;
        SW_MODE[sweep] = mode;
        SW_X[sweep] = ax;
        SW_TOP[sweep] = labelTop(mode, ay, hgt);
        SW_OP[sweep] = opacity;
        SW_ORDER[sweep] = sweep;
        sweep++;
        continue;
      }
      writeLabel(i, opacity, interactive, mode, ax, ay);
    }

    // ── Leaf-label collision pass (focused cluster only, ≤ 9 labels) ──
    // Labels above the hub are pushed further up (the hub's own label is their
    // first obstacle), labels below it further down — always away from the plate.
    if (sweep > 0 && focusCluster !== null) {
      const step = LEAF_LABEL_H + LABEL_GAP;
      const hub = CLUSTER_HUB[focusCluster];
      const hubY = SCREEN[hub * 3 + 1];
      const hubOn = LBL_Q[hub] > 0;
      const hLeft = labelLeft(LBL_MODE[hub], LBL_X[hub], LBL_W[hub]) - LABEL_GAP;
      const hRight = hLeft + LBL_W[hub] + LABEL_GAP * 2;
      const hTop = labelTop(LBL_MODE[hub], LBL_Y[hub], HUB_LABEL_H);
      // Order top-to-bottom (insertion sort — no allocation, n ≤ 9).
      for (let a = 0; a < sweep; a++) SW_UP[a] = SW_TOP[a] + LEAF_LABEL_H / 2 < hubY ? 1 : 0;
      for (let a = 1; a < sweep; a++) {
        const o = SW_ORDER[a];
        let k = a - 1;
        while (k >= 0 && SW_TOP[SW_ORDER[k]] > SW_TOP[o]) {
          SW_ORDER[k + 1] = SW_ORDER[k];
          k--;
        }
        SW_ORDER[k + 1] = o;
      }
      // Below the hub: top-to-bottom, each label drops under any earlier one it overlaps.
      for (let a = 0; a < sweep; a++) {
        const j = SW_ORDER[a];
        if (SW_UP[j]) continue;
        const wj = LBL_W[SW_I[j]];
        const left = labelLeft(SW_MODE[j], SW_X[j], wj);
        for (let c = 0; c < a; c++) {
          const k = SW_ORDER[c];
          if (SW_UP[k]) continue;
          const kLeft = labelLeft(SW_MODE[k], SW_X[k], LBL_W[SW_I[k]]);
          if (left >= kLeft + LBL_W[SW_I[k]] + LABEL_GAP || left + wj + LABEL_GAP <= kLeft) continue;
          if (SW_TOP[j] < SW_TOP[k] + step) SW_TOP[j] = SW_TOP[k] + step;
        }
      }
      // Above the hub: bottom-to-top, each label rises over the hub label and any
      // earlier (lower) one it overlaps.
      for (let a = sweep - 1; a >= 0; a--) {
        const j = SW_ORDER[a];
        if (!SW_UP[j]) continue;
        const wj = LBL_W[SW_I[j]];
        const left = labelLeft(SW_MODE[j], SW_X[j], wj);
        if (hubOn && left < hRight && left + wj > hLeft && SW_TOP[j] + step > hTop) {
          SW_TOP[j] = hTop - step;
        }
        for (let c = sweep - 1; c > a; c--) {
          const k = SW_ORDER[c];
          if (!SW_UP[k]) continue;
          const kLeft = labelLeft(SW_MODE[k], SW_X[k], LBL_W[SW_I[k]]);
          if (left >= kLeft + LBL_W[SW_I[k]] + LABEL_GAP || left + wj + LABEL_GAP <= kLeft) continue;
          if (SW_TOP[j] + step > SW_TOP[k]) SW_TOP[j] = SW_TOP[k] - step;
        }
      }
      for (let j = 0; j < sweep; j++) {
        writeLabel(SW_I[j], SW_OP[j], interactive, SW_MODE[j], SW_X[j], anchorY(SW_MODE[j], SW_TOP[j], LEAF_LABEL_H));
      }
    }
  });

  return (
    <>
      {/* Shared module-scope objects — dispose={null} so a gate remount can't free them. */}
      <primitive object={STAR_POINTS} dispose={null} />
      <group ref={parallax}>
        <group ref={spin}>
          <primitive object={LINK_MESH} dispose={null} />
          {/* Picking is done in screen space by the stage (see pickNode), not by the
              R3F raycaster, so overlapping leaves can't steal a hub. */}
          <primitive object={NODE_MESH} dispose={null} />
        </group>
      </group>
    </>
  );
}

interface SkillsConstellationProps {
  active: boolean;
  /**
   * @deprecated No longer called — the constellation announces its own selection
   * through an internal live region. Kept optional so existing callers compile.
   */
  onFocusChange?: (cluster: number | null, skill: string | null) => void;
  /** One-shot from the gate: the stage is properly on screen, the entrance may play. */
  entered?: boolean;
  /** Unrecoverable GPU failure (lost context, shader link error) → show the cards. */
  onFail?: () => void;
}

const noop = () => {};

export default function SkillsConstellation({
  active,
  entered = true,
  onFail,
}: SkillsConstellationProps) {
  const [hover, setHover] = useState<Sel | null>(null);
  const [pin, setPin] = useState<Sel | null>(null);
  const [dragging, setDragging] = useState(false);
  const { openProject } = useProjectModal();
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const lastHover = useRef<number>(-1);
  const hintId = useId();
  // Rare, one-shot state: quality tier (governor), DPR cap, first-frame fade-in.
  const [tier, setTier] = useState(() => GOV.tier);
  const [dprCap, setDprCap] = useState(() => TIER_DPR[GOV.tier]);
  const [shown, setShown] = useState(false);
  const handleShown = useCallback(() => setShown(true), []);
  const fail = onFail ?? noop;

  const sel = hover ?? pin;
  const focusCluster = sel ? (sel.kind === 'cluster' ? sel.i : CLUSTER_OF[sel.i]) : null;
  const activeNode = sel && sel.kind === 'node' ? sel.i : null;
  const pinned = pin !== null;
  const pinnedNode = pin?.kind === 'node' ? pin.i : null;

  let zoomTarget: number | null = null;
  // Camera distance from the framed point: a whole cluster (hub or legend pin)
  // sits a little further back than a single skill.
  let zoomDist = 7.6;
  if (pin) {
    if (pin.kind === 'node') {
      zoomTarget = pin.i;
      zoomDist = IS_HUB[pin.i] ? 7.6 : 7.0;
    } else {
      zoomTarget = CLUSTER_HUB[pin.i];
      zoomDist = 7.6;
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

  // Announced by the sr-only live region below (the canvas itself is decorative).
  const activeSkill = activeNode !== null && !NODES[activeNode].isHub ? NODES[activeNode].label : null;
  const announcement = activeSkill
    ? `Selected skill: ${activeSkill}, ${CLUSTERS[focusCluster ?? 0].title}`
    : focusCluster !== null
      ? `Focused domain: ${CLUSTERS[focusCluster].title}, ${CLUSTER_COUNTS[focusCluster]} skills`
      : '';

  // Where the detail card sits (layout box, so its enter animation does not
  // matter) — the scene hides any label that would end up underneath it.
  const cardTitle = cardData?.title ?? null;
  useEffect(() => {
    CARD.on = false;
    if (cardTitle === null) return;
    const cards = rootRef.current?.querySelectorAll<HTMLElement>('[data-skill-card]');
    const el = cards?.[cards.length - 1];
    if (!el) return;
    const pad = 6;
    CARD.left = el.offsetLeft - pad;
    CARD.right = el.offsetLeft + el.offsetWidth + pad;
    // The card is centred with translateY(-50%) on a top: 50% box.
    CARD.top = el.offsetTop - el.offsetHeight / 2 - pad;
    CARD.bottom = el.offsetTop + el.offsetHeight / 2 + pad;
    CARD.on = true;
  }, [cardTitle]);

  // Label widths feed the collision pass; re-measure once the mono font has loaded.
  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => {
      if (alive) measureLabels();
    });
    return () => {
      alive = false;
    };
  }, []);

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
        // Rubber band: dragging further past the yaw limit gets progressively heavier.
        const total = ORBIT.yaw + SWAY.v;
        const over = Math.abs(total) - YAW_LIMIT;
        const outward = dx !== 0 && Math.sign(dx) === Math.sign(total);
        const dYaw = dx * DRAG_YAW * (over > 0 && outward ? 1 / (1 + over * 4) : 1);
        ORBIT.yaw += dYaw;
        ORBIT.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, ORBIT.pitch + dy * DRAG_PITCH));
        ORBIT.vYaw = (dYaw * 1000) / dtMs;
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
  // Keyboard focus leaving the stage must not leave a node "hovered" (dimmed field).
  const onStageBlur = useCallback(() => {
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
    <div ref={rootRef} className="relative w-full h-full">
      {/* touch-pan-y: a vertical swipe still scrolls the page on touch laptops and
          tablets; horizontal drags orbit. */}
      <div
        ref={stageRef}
        role="group"
        tabIndex={0}
        aria-label="Interactive 3D map of skills grouped by domain"
        aria-describedby={hintId}
        className={`peer absolute inset-0 touch-pan-y select-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyber-brand/70 ${cursor}`}
        onPointerDown={onStageDown}
        onPointerMove={onStageMove}
        onPointerUp={onStageUp}
        onPointerCancel={onStageUp}
        onPointerLeave={onStageLeave}
        onClick={onStageClick}
        onKeyDown={onStageKey}
        onBlur={onStageBlur}
      >
        {/* Fades in on the first drawn frame, so the canvas never pops in. */}
        <div
          className={`h-full w-full transition-opacity duration-[400ms] ease-out ${
            shown ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <Canvas
            frameloop={active ? 'always' : 'never'}
            dpr={[1, dprCap]}
            camera={{ position: [0, 0, HOME_Z], fov: FOV }}
            gl={{
              antialias: false,
              alpha: true,
              depth: false,
              stencil: false,
              powerPreference: 'default',
            }}
            onCreated={({ gl }) => {
              gl.toneMapping = THREE.NoToneMapping;
              // three does not throw on a GLSL compile/link failure — it logs and
              // draws nothing — so the error boundary would never see it.
              gl.debug.onShaderError = (ctx, program, vs, fs) => {
                if (process.env.NODE_ENV !== 'production') {
                  console.error(
                    'Skills constellation shader failed — falling back to cards.',
                    ctx.getProgramInfoLog(program),
                    ctx.getShaderInfoLog(vs),
                    ctx.getShaderInfoLog(fs),
                  );
                }
                fail();
              };
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
              entered={entered}
              tier={tier}
              onTier={setTier}
              onDprCap={setDprCap}
              onShown={handleShown}
              onFail={fail}
            />
          </Canvas>
        </div>
      </div>
      <p id={hintId} className="sr-only">
        Drag to rotate. Use the left and right arrow keys to step through skills, up and down
        to jump between domains, Enter to open details and Escape to close them.
      </p>
      {/* Visible keyboard hint — only while the stage itself has keyboard focus. */}
      <p
        aria-hidden="true"
        className="pointer-events-none absolute left-4 top-4 z-10 whitespace-nowrap rounded-md border border-cyber-primary/15 bg-cyber-darker/90 px-3 py-1.5 font-mono text-xs text-cyber-accent opacity-0 transition-opacity duration-200 peer-focus-visible:opacity-100"
      >
        <span className="text-cyber-brand">←→</span> skills · <span className="text-cyber-brand">↑↓</span> domains ·{' '}
        <span className="text-cyber-brand">Enter</span> details · <span className="text-cyber-brand">Esc</span> close
      </p>
      <p className="sr-only" aria-live="polite">
        {announcement}
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
              ref={LABEL_REFS[i]}
              type="button"
              tabIndex={-1}
              onPointerEnter={() => onHoverNode(i)}
              onPointerLeave={() => onHoverNode(null)}
              onClick={(e) => {
                e.stopPropagation();
                onClickNode(i);
              }}
              style={{ opacity: 0, borderColor: isPinned || isActive ? cluster.color : undefined }}
              className={`absolute left-0 top-0 inline-flex select-none items-center gap-1.5 whitespace-nowrap rounded-md border font-mono text-xs leading-none transition-[opacity,background-color,border-color] duration-200 ${
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
          <SkillDetailCard
            key={cardData.title}
            data={cardData}
            onClose={() => setPin(null)}
            onOpenProject={handleOpenProject}
          />
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
