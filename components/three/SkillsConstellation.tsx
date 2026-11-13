'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import {
  CLUSTERS,
  CLUSTER_AZIMUTH,
  CLUSTER_COUNT,
  CLUSTER_COUNTS,
  CLUSTER_HUB,
  CLUSTER_OF,
  CLUSTER_REACH,
  CLUSTER_SKILLS,
  CORE,
  CORE_COLOR,
  HUB_RADIUS_W,
  IS_HUB,
  LINK_A,
  LINK_B,
  LINK_COUNT,
  LINK_CROSS,
  LINK_KIND,
  LINK_REST,
  NODES,
  NODE_COUNT,
  NODE_POSITIONS,
  NODE_RADIUS,
  RELATED,
  SKILL_COUNT,
} from './constellationData';
import {
  BASE_TILT,
  FOCAL_F,
  FOG_FAR,
  FOG_FLOOR,
  FOG_NEAR,
  FOV,
  HOME_Z,
  SHARED,
  SYSTEM_LIFT,
  depthFade,
} from './sceneShared';
import { NODE_MESH, NODE_UNIFORMS, setAtmosState, setNodeState, syncNodes } from './nodeLayer';
import {
  LINK_MESH,
  LINK_UNIFORMS,
  flushLinkState,
  setLinkIntensity,
  setLinkSkirt,
  syncLinkGeometry,
} from './linkLayer';
import { RING_MESH, setSystemRingIntensity, setTrackIntensity, syncRings } from './ringLayer';
import { DUST_POINTS, STAR_DRIFT, STAR_POINTS, setDust, setFarStars } from './starLayer';
import { resetOrbits, stepOrbits } from './orbitSim';
import { compileBloom, disposeBloom, renderBloom } from './bloom';
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
 * The graph is an orrery: a core, the four domain hubs on a shared orbit around
 * it, and each domain's skills riding rings around their hub. The whole system
 * is tipped towards the camera and turns slowly; a focused domain swings its
 * ring plane round to face the viewer, and a pinned one is carried to the front.
 *
 * Five draw calls, all hand-written shaders, no textures:
 *   starLayer  — seeded parallax starfield + dust motes inside the system
 *   ringLayer  — planes in space: polar grid + radar sweep, gyro rings, skill rings
 *   linkLayer  — instanced ribbons (glow, energy flow, entrance draw)
 *   nodeLayer  — instanced billboards (core globe, hub orbs, skill beads, reticle, glows)
 * plus, on the top quality tier, a small bloom chain (bloom.ts).
 */

const restIntensity = (i: number) => (i === CORE ? 1.05 : IS_HUB[i] ? 0.95 : 0.55);
/** Eased per-node glow and selection (0 none · 0.6 hovered · 1 pinned), fed to the node layer. */
const GLOW = new Float32Array(NODE_COUNT);
const SELECT = new Float32Array(NODE_COUNT);
for (let i = 0; i < NODE_COUNT; i++) GLOW[i] = restIntensity(i);
/** Eased per-link brightness, fed to the link layer. */
const LINE_INT = new Float32Array(LINK_COUNT);
LINE_INT.set(LINK_REST);
/** Eased glow strength per domain (+ the backdrop in the last slot). */
const ATMOS = new Float32Array(CLUSTER_COUNT + 1);
/** Eased brightness of each domain's skill rings, and of the grid disc + gyro rings. */
const TRACK_INT = new Float32Array(CLUSTER_COUNT).fill(0.2);
const SYSTEM_INT = { v: 1 };
/** Eased bloom strength (0 while the top quality tier is not active). */
const BLOOM = { v: 0 };
const BLOOM_STRENGTH = 0.38;

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
const PICK_RADIUS_HUB = 24;
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

/**
 * Scratch for the anchor labels (four hubs + the core). As the system turns,
 * a near hub's label can slide over a far one's: the far one steps aside.
 */
const ANCHOR_MAX = 8;
const AN_I = new Int16Array(ANCHOR_MAX);
const AN_MODE = new Int8Array(ANCHOR_MAX);
const AN_X = new Float32Array(ANCHOR_MAX);
const AN_Y = new Float32Array(ANCHOR_MAX);
const AN_OP = new Float32Array(ANCHOR_MAX);

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
 * Narrow stages: the system turns, so its widest moments are a hub passing the
 * side (about 8 units from the axis with its skills, level with the core) and a
 * hub on the near diagonal (6.5 units out, 3.6 nearer the camera). Below a ~1.4:1 aspect the
 * home camera backs off just enough to keep both in frame.
 */
const SIDE_SPAN_X = 8;
const DIAG_SPAN_X = 6.5;
const DIAG_Z = 3.6;
/** View depth at which the fog ramp is "clear" from the home camera. */
const CLEAR_DEPTH = FOG_NEAR;

/** Stage C4 switch: domain glows + backdrop (extra instances of the node draw). */
const ATMOS_ENABLED = true;

/**
 * Ambient chatter: while nothing is focused, one cross link at a time lights
 * up for a couple of seconds — a packet runs it and its two skills name
 * themselves — so the dashed arcs explain themselves before anyone hovers.
 * The order is a fixed stride through the cross links (no randomness).
 */
const CROSS_LINKS: number[] = [];
for (let l = 0; l < LINK_COUNT; l++) if (LINK_KIND[l] === LINK_CROSS) CROSS_LINKS.push(l);
const CHATTER = { link: -1, age: 0, wait: 2.5, step: 0, env: 0 };
const CHATTER_SECONDS = 2.6;
const CHATTER_STRIDE = 4;

/** Left out of the bloom's glow source: the sky and the dust would only add haze. */
const BLOOM_BACKDROP: THREE.Object3D[] = [STAR_POINTS, DUST_POINTS];

const PROJ_VEC = new THREE.Vector3();
const CAM_TARGET = new THREE.Vector3(0, 0, HOME_Z);
/** Camera spring velocity (critically damped — eases in and out, never snaps). */
const CAM_VEL = new THREE.Vector3();
const CAM_TIME_IN = 0.55; // s, towards a pinned target
const CAM_TIME_OUT = 0.7; // s, back home
const CAM_TIME_ENTER = 1.5; // s, the entrance push-in
/** The camera starts this far back and pushes in while the constellation assembles. */
const ENTER_DOLLY = 5.5;
/** …and the system starts turned and tipped this much further, settling as it assembles. */
const ENTER_SPIN = -1.25; // rad
const ENTER_TILT = 0.34; // rad
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
 * is properly on screen. The core ignites and the orbital plane radiates out
 * from it, the trunks shoot to the hubs, the hubs pop, their skill rings sweep
 * round, then the spokes draw and the skills bloom along them — all in the
 * shaders, keyed off the shared `uEnter` uniform.
 */
const ENTER = { t: 0, done: false };
const ENTER_SECONDS = 2.6;
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
 *   tier 0 — DPR ≤ 1.5, everything on (bloom included)
 *   tier 1 — DPR ≤ 1.25, bloom and domain glows off
 *   tier 2 — DPR ≤ 1.0, far star layer, dust and link glow skirt off as well
 *
 * NEXT_PUBLIC_CONSTELLATION_TIER (0-2) pins the tier — for checking a tier's
 * look on a machine the governor would otherwise move off it.
 */
const TIER_LOCK = /^[012]$/.test(process.env.NEXT_PUBLIC_CONSTELLATION_TIER ?? '')
  ? Number(process.env.NEXT_PUBLIC_CONSTELLATION_TIER)
  : -1;
const TIER_DPR = [1.5, 1.25, 1.0];
const MAX_TIER = TIER_DPR.length - 1;
const GOV_WINDOW = 45;
const GOV_SKIP = 30; // frames ignored after (re)activation
const GOV_SLOW = 0.02; // s — median frame time that triggers a step down
const GOV_GAP = 0.1; // s — a delta this long is a one-off hitch, not a slow frame: ignored
const GOV_PAUSE = 0.5; // s — a delta this long means the loop was paused: restart the window
const GOV_COOLDOWN = 2; // s between steps
/**
 * …unless they keep coming: this many over-long frames in a row is not a hitch
 * or a pause but a GPU far out of its depth (under ~10 fps the window above
 * would never fill), so step down straight away.
 */
const GOV_CRAWL_FRAMES = 5;
/** Above this many device pixels the canvas starts one DPR step lower. */
const GOV_MAX_PIXELS = 3.2e6;
const GOV = {
  tier: Math.max(0, TIER_LOCK),
  n: 0,
  skip: GOV_SKIP,
  sinceStep: GOV_COOLDOWN,
  /** Consecutive frames longer than GOV_GAP. */
  crawl: 0,
  /** Fastest frame seen (s) — approximates the display refresh interval. */
  fast: Infinity,
  buf: new Float32Array(GOV_WINDOW),
  sorted: new Float32Array(GOV_WINDOW),
};

/** Orbit state — pointer drag with inertia; the idle turn resumes after a pause. */
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
 * Idle motion: the system turns slowly about its axis, like the orrery it is.
 * `k` is the eased blend of that turn — it winds down while anything is hovered,
 * pinned or dragged (so a target never drifts out from under the cursor) and
 * winds back up afterwards.
 */
const AUTO = { k: 0 };
const AUTO_RATE = 0.055; // rad/s
/**
 * Pin → the system turns to carry the pinned domain to the front, a little left
 * of centre (the detail card docks on the right). A critically damped spring on
 * the yaw; any drag takes over from it.
 */
const YAW_TO = { on: false, target: 0, vel: 0 };
const YAW_TO_TIME = 0.75; // s
const PIN_BEARING = -0.3; // rad off dead-ahead (negative = left)
/** The user's pitch is added to BASE_TILT: up to almost top-down, down to almost edge-on. */
const PITCH_MAX = 0.62; // rad
const PITCH_MIN = -0.3;
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
  AUTO.k = 0;
  YAW_TO.on = false;
  YAW_TO.vel = 0;
  POINTER_IN.v = false;
  SHARED.uPointer.value.z = 0;
  BLOOM.v = 0;
  resetOrbits();
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
  GOV.crawl = 0;
}

/**
 * Telemetry readout in the stage corner: the system's bearing and elevation,
 * written straight to two text nodes (and only when a whole degree changes).
 */
const HUD: { az: HTMLElement | null; el: HTMLElement | null; lastAz: number; lastEl: number } = {
  az: null,
  el: null,
  lastAz: -1,
  lastEl: -1,
};
const setHudAz = (el: HTMLElement | null) => {
  HUD.az = el;
  HUD.lastAz = -1;
};
const setHudEl = (el: HTMLElement | null) => {
  HUD.el = el;
  HUD.lastEl = -1;
};
const RAD_TO_DEG = 180 / Math.PI;

/** Whether the pointer is over the stage (drives the pointer light). */
const POINTER_IN = { v: false };

type Sel = { kind: 'node'; i: number } | { kind: 'cluster'; i: number };

function buildDomainCard(c: number): SkillCardData {
  return {
    kind: 'domain',
    title: CLUSTERS[c].title,
    domainLabel: CLUSTERS[c].title,
    color: CLUSTERS[c].color,
    glyph: CLUSTERS[c].glyph,
    blurb: `${CLUSTER_COUNTS[c]} skills I work with across this domain — pick one to see where I use it.`,
    domainSkills: CLUSTER_SKILLS[c],
  };
}

function buildCoreCard(): SkillCardData {
  return {
    kind: 'core',
    title: 'Skill system',
    domainLabel: 'Core',
    color: CORE_COLOR,
    glyph: 'circle',
    blurb: `${SKILL_COUNT} skills in ${CLUSTER_COUNT} domains. The dashed arcs join skills I use together on the same project or role — pick a domain to bring it to the front.`,
    domains: CLUSTERS.map((c, i) => ({
      title: c.title,
      color: c.color,
      glyph: c.glyph,
      count: CLUSTER_COUNTS[i],
    })),
  };
}

/** How many cross-domain links the graph draws (shown in the telemetry readout). */
const LINK_TOTALS = { cross: 0 };
for (let l = 0; l < LINK_COUNT; l++) if (LINK_KIND[l] === LINK_CROSS) LINK_TOTALS.cross++;

/** Node index by skill / domain label (labels are unique across the graph). */
const NODE_BY_LABEL = new Map(NODES.map((n, i) => [n.label, i]));

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

/**
 * Domain whose skill rings the point falls within (-1 = none) — hovering
 * anywhere inside a domain's little system focuses it, so it can unfold towards
 * the cursor without the hover flickering off as its skills move. `sticky` is
 * the domain already focused this way: it holds on a little further out.
 */
function pickCluster(px: number, py: number, sticky: number): number {
  let best = -1;
  let bestScore = 1;
  for (let c = 0; c < CLUSTER_COUNT; c++) {
    const h = CLUSTER_HUB[c];
    if (SCREEN[h * 3 + 2] < 0.5) continue;
    const pxPerUnit = NODE_RPX[h] / HUB_RADIUS_W;
    const r = (CLUSTER_REACH[c] + (c === sticky ? 0.75 : 0.3)) * pxPerUnit;
    const dx = px - SCREEN[h * 3];
    const dy = py - SCREEN[h * 3 + 1];
    const score = Math.sqrt(dx * dx + dy * dy) / r;
    if (score < bestScore) {
      bestScore = score;
      best = c;
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
    compileBloom(gl);
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
    let lost = false;
    // Browsers do not restore a context while the tab is hidden, so the grace
    // period only runs while the page is visible; otherwise a GPU reset in a
    // background tab would strand the section on the cards until reload.
    const arm = () => {
      window.clearTimeout(timer);
      timer = undefined;
      if (lost && !document.hidden) timer = window.setTimeout(onFail, 1500);
    };
    const onLost = (e: Event) => {
      e.preventDefault();
      lost = true;
      arm();
    };
    const onRestored = () => {
      lost = false;
      arm();
    };
    el.addEventListener('webglcontextlost', onLost);
    el.addEventListener('webglcontextrestored', onRestored);
    document.addEventListener('visibilitychange', arm);
    return () => {
      el.removeEventListener('webglcontextlost', onLost);
      el.removeEventListener('webglcontextrestored', onRestored);
      document.removeEventListener('visibilitychange', arm);
      window.clearTimeout(timer);
      // Release this renderer's GPU caches for the shared module-scope objects;
      // they re-upload on next use, so a later remount starts clean.
      for (const obj of [STAR_POINTS, DUST_POINTS, RING_MESH, LINK_MESH, NODE_MESH]) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
      disposeBloom();
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

  // Effect tiers: the lowest tier also drops the far star layer, the dust and
  // the link glow skirt.
  useEffect(() => {
    setFarStars(tier < MAX_TIER);
    setDust(tier < MAX_TIER);
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
    GOV.crawl = delta > GOV_GAP ? GOV.crawl + 1 : 0;
    if (GOV.crawl >= GOV_CRAWL_FRAMES && GOV.tier < MAX_TIER && TIER_LOCK < 0) {
      // Frame after frame over 100 ms: sustained, not a hitch. Drop a tier now.
      GOV.crawl = 0;
      GOV.n = 0;
      GOV.skip = GOV_SKIP;
      GOV.tier++;
      GOV.sinceStep = 0;
      onTier(GOV.tier);
    } else if (delta > GOV_PAUSE) {
      // The loop was paused (scrolled away / tab hidden): start a fresh window.
      GOV.n = 0;
      GOV.skip = GOV_SKIP;
    } else if (delta > GOV_GAP) {
      // A one-off hitch (GC, another section mounting) says nothing about fill rate.
    } else if (GOV.skip > 0) {
      GOV.skip--;
    } else if (GOV.tier < MAX_TIER && TIER_LOCK < 0) {
      GOV.buf[GOV.n++] = delta;
      if (GOV.n === GOV_WINDOW) {
        GOV.n = 0;
        GOV.sorted.set(GOV.buf);
        GOV.sorted.sort();
        // "Slow" is relative to the display: a 30/40/48 Hz panel (or a capped
        // power mode) runs every frame above GOV_SLOW without being overloaded.
        if (GOV.sorted[0] > 0.002) GOV.fast = Math.min(GOV.fast, GOV.sorted[0]);
        const slow = Math.max(GOV_SLOW, GOV.fast * 1.4);
        if (GOV.sorted[GOV_WINDOW >> 1] > slow && GOV.sinceStep >= GOV_COOLDOWN) {
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
    const enterHub = easeOut((ENTER.t - 0.24) / 0.25);
    const enterLeaf = easeOut((ENTER.t - 0.55) / 0.4);
    const enterCore = easeOut(ENTER.t / 0.2);
    // What is left of the entrance's extra turn and tip (1 → 0, eased out).
    const settle = Math.pow(1 - ENTER.t, 3);

    // ── Orbit: a slow idle turn + drag inertia + the turn-to-front of a pin ──
    ORBIT.idle += dt;
    const held = pinned || focusCluster !== null || activeNode !== null || ORBIT.dragging;
    const autoTarget = held ? 0 : clamp01((ORBIT.idle - 0.5) / 1.2);
    AUTO.k += (autoTarget - AUTO.k) * (1 - Math.exp(-dt * 3.2));
    if (!ORBIT.dragging) {
      ORBIT.yaw += (ORBIT.vYaw + AUTO_RATE * AUTO.k) * dt;
      ORBIT.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, ORBIT.pitch + ORBIT.vPitch * dt));
      const damp = Math.exp(-dt * 2.4);
      ORBIT.vYaw *= damp;
      ORBIT.vPitch *= damp;
      if (YAW_TO.on) {
        // Critically damped spring on the yaw (same step as the camera's).
        const omega = 2 / YAW_TO_TIME;
        const x = omega * dt;
        const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
        const change = ORBIT.yaw - YAW_TO.target;
        const temp = (YAW_TO.vel + omega * change) * dt;
        YAW_TO.vel = (YAW_TO.vel - omega * temp) * decay;
        ORBIT.yaw = YAW_TO.target + (change + temp) * decay;
        ORBIT.vYaw = 0;
      }
      // While idle the tip eases back to its resting angle.
      if (ORBIT.idle > 2.5) ORBIT.pitch *= Math.exp(-dt * 0.6);
    }
    const yaw = ORBIT.yaw + ENTER_SPIN * settle;
    if (spin.current) spin.current.rotation.y = yaw;
    let tiltX = 0;
    let tiltY = 0;
    if (parallax.current) {
      const tx = (pinned ? 0 : -state.pointer.y * 0.07) + ORBIT.pitch + BASE_TILT + ENTER_TILT * settle;
      const ty = pinned ? 0 : state.pointer.x * 0.1;
      const k = 1 - Math.exp(-dt * (pinned || ORBIT.dragging || !ENTER.done ? 8 : 2.5));
      parallax.current.rotation.x += (tx - parallax.current.rotation.x) * k;
      parallax.current.rotation.y += (ty - parallax.current.rotation.y) * k;
      tiltX = parallax.current.rotation.x - BASE_TILT;
      tiltY = parallax.current.rotation.y;
    }
    // Telemetry: bearing 0–359°, elevation above the orbital plane.
    const az = ((Math.round((yaw + tiltY) * RAD_TO_DEG) % 360) + 360) % 360;
    const el = Math.round((tiltX + BASE_TILT) * RAD_TO_DEG);
    if (az !== HUD.lastAz && HUD.az) {
      HUD.az.textContent = String(az).padStart(3, '0');
      HUD.lastAz = az;
    }
    if (el !== HUD.lastEl && HUD.el) {
      HUD.el.textContent = String(el).padStart(2, '0');
      HUD.lastEl = el;
    }

    // ── Skill rings: turn, and unfold the focused domain towards the camera.
    // Everything downstream (layers, picker, labels) reads the result ──
    if (spin.current) {
      spin.current.updateWorldMatrix(true, false);
      PROJ_VEC.copy(state.camera.position);
      spin.current.worldToLocal(PROJ_VEC);
      stepOrbits(dt, SHARED.uTime.value, focusCluster, PROJ_VEC.x, PROJ_VEC.y, PROJ_VEC.z);
      syncLinkGeometry();
    }

    // ── Pointer light: follows the cursor, off while dragging or pinned ──
    const lightOn = POINTER_IN.v && !ORBIT.dragging && !pinned && ENTER.done ? 1 : 0;
    SHARED.uPointer.value.x = state.pointer.x;
    SHARED.uPointer.value.y = state.pointer.y;
    SHARED.uPointer.value.z += (lightOn - SHARED.uPointer.value.z) * (1 - Math.exp(-dt * 6));

    // ── Node glow + selection — active node white-hot, focused cluster lit, the
    // rest dimmed (harder when something is pinned, for a spotlight feel) ──
    const fNode = 1 - Math.exp(-dt * 9);
    const fSelect = 1 - Math.exp(-dt * 12);
    // ── Ambient chatter (only at rest; any focus cuts it short) ──
    const atRest = focusCluster === null && activeNode === null && !ORBIT.dragging && ENTER.done;
    if (!atRest || CROSS_LINKS.length === 0) {
      CHATTER.link = -1;
      CHATTER.wait = 1.6;
    } else if (CHATTER.link < 0) {
      CHATTER.wait -= dt;
      if (CHATTER.wait <= 0) {
        CHATTER.step = (CHATTER.step + CHATTER_STRIDE) % CROSS_LINKS.length;
        CHATTER.link = CROSS_LINKS[CHATTER.step];
        CHATTER.age = 0;
      }
    } else {
      CHATTER.age += dt;
      if (CHATTER.age >= CHATTER_SECONDS) {
        CHATTER.link = -1;
        CHATTER.wait = 1.4 + (CHATTER.step % 3) * 0.7;
      }
    }
    CHATTER.env = CHATTER.link < 0 ? 0 : Math.sin((Math.PI * CHATTER.age) / CHATTER_SECONDS);
    const chatA = CHATTER.link < 0 ? -1 : LINK_A[CHATTER.link];
    const chatB = CHATTER.link < 0 ? -1 : LINK_B[CHATTER.link];

    const dimTarget = pinned ? 0.08 : 0.2;
    // Skills used together with the active one (cross links) light up with it.
    const related = activeNode !== null ? RELATED[activeNode] : null;
    for (let i = 0; i < NODE_COUNT; i++) {
      let target: number;
      if (activeNode === i) target = 1.65;
      else if (related !== null && related.includes(i)) target = 1.3;
      else if (i === chatA || i === chatB) target = restIntensity(i) + 0.7 * CHATTER.env;
      else if (focusCluster === null) target = restIntensity(i);
      else if (CLUSTER_OF[i] === focusCluster) target = IS_HUB[i] ? 1.1 : 0.85;
      else target = i === CORE ? dimTarget * 2.2 : dimTarget;
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
    // Draw order follows last frame's depths (one frame of lag is invisible).
    syncNodes(NODE_DEPTH);

    // ── Rings: the focused domain's skill rings brighten; the grid and the gyro
    // rings step back while a domain has the floor ──
    const fRing = 1 - Math.exp(-dt * 6);
    for (let c = 0; c < CLUSTER_COUNT; c++) {
      const target = focusCluster === null ? 0.2 : focusCluster === c ? 0.42 : 0.06;
      TRACK_INT[c] += (target - TRACK_INT[c]) * fRing;
      setTrackIntensity(c, TRACK_INT[c] * enterHub);
    }
    const systemTarget = focusCluster === null ? 1 : pinned ? 0.4 : 0.62;
    SYSTEM_INT.v += (systemTarget - SYSTEM_INT.v) * fRing;
    setSystemRingIntensity(SYSTEM_INT.v);
    syncRings(SHARED.uTime.value);

    // ── Link brightness mirrors the focus state ──
    const fLine = 1 - Math.exp(-dt * 8);
    const dimLink = pinned ? 0.03 : 0.07;
    for (let l = 0; l < LINK_COUNT; l++) {
      const a = LINK_A[l];
      const b = LINK_B[l];
      let target: number;
      if (activeNode !== null && (a === activeNode || b === activeNode)) target = 1.25;
      else if (l === CHATTER.link) target = LINK_REST[l] + 0.95 * CHATTER.env;
      else if (focusCluster === null) target = LINK_REST[l];
      else if (LINK_KIND[l] === LINK_CROSS) {
        // A focused domain shows where its skills reach out to.
        target = CLUSTER_OF[a] === focusCluster || CLUSTER_OF[b] === focusCluster ? 0.34 : dimLink * 0.5;
      } else if (CLUSTER_OF[b] === focusCluster) target = 0.95; // its trunk and its spokes
      else target = dimLink;
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
    const homeZ = Math.max(
      HOME_Z,
      (SIDE_SPAN_X * FOCAL_F) / aspect,
      DIAG_Z + (DIAG_SPAN_X * FOCAL_F) / aspect,
    );
    let fogShift = homeZ - HOME_Z;
    if (zoomTarget !== null && spin.current) {
      const i = zoomTarget;
      // Frame a leaf a third of the way out from its hub, so the whole unfolded
      // dial stays in shot (a leaf at its edge would otherwise push the rest off-stage).
      const h = IS_HUB[i] ? i : CLUSTER_HUB[CLUSTER_OF[i]];
      const w = IS_HUB[i] ? 1 : 0.35;
      PROJ_VEC.set(
        NODE_POSITIONS[i * 3] * w + NODE_POSITIONS[h * 3] * (1 - w),
        NODE_POSITIONS[i * 3 + 1] * w + NODE_POSITIONS[h * 3 + 1] * (1 - w),
        NODE_POSITIONS[i * 3 + 2] * w + NODE_POSITIONS[h * 3 + 2] * (1 - w),
      );
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
      // …and a pinned domain (or skill) is carried round to the front. Of the
      // equivalent yaws, take the one nearest to where the system already is.
      YAW_TO.on = false;
      if (pinKey >= 0 && pinKey !== CORE) {
        let target = CLUSTER_AZIMUTH[CLUSTER_OF[pinKey]] - Math.PI / 2 + PIN_BEARING;
        target += Math.PI * 2 * Math.round((ORBIT.yaw - target) / (Math.PI * 2));
        YAW_TO.on = true;
        YAW_TO.target = target;
        YAW_TO.vel = ORBIT.vYaw;
        ORBIT.vYaw = 0;
      }
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
    BLOOM.v += ((GOV.tier < 1 ? BLOOM_STRENGTH : 0) - BLOOM.v) * (1 - Math.exp(-dt * 3));
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
    let anchors = 0;
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
      else if (related !== null && related.includes(i)) opacity = 0.9;
      else if (i === chatA || i === chatB) {
        // …unless the skill is passing behind the core: a tag over the globe reads as noise.
        const cx = sx - SCREEN[CORE * 3];
        const cy = sy - SCREEN[CORE * 3 + 1];
        const clear = cx * cx + cy * cy > NODE_RPX[CORE] * NODE_RPX[CORE] * 2.6;
        opacity = clear ? Math.min(1, CHATTER.env * 1.6) * 0.85 : 0;
      }
      else opacity = focusCluster !== null && inFocus ? 0.9 : 0;
      opacity *= i === CORE ? enterCore : isHub ? enterHub : enterLeaf;
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
      if (i === CORE) {
        // The core's tag hangs below it: the far hubs' labels pass just above.
        mode = ANCHOR_BELOW;
        ay = sy + rPx * (i === activeNode ? 1.5 : 1.12) + 8;
      } else if (!isHub) {
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
      // Hub and core labels are settled against each other below.
      if (isHub && anchors < ANCHOR_MAX) {
        AN_I[anchors] = i;
        AN_MODE[anchors] = mode;
        AN_X[anchors] = ax;
        AN_Y[anchors] = ay;
        AN_OP[anchors] = opacity;
        anchors++;
        continue;
      }
      writeLabel(i, opacity, interactive, mode, ax, ay);
    }

    // ── Anchor labels: where two overlap, the farther node's label yields
    // (the active node's never does) ──
    for (let a = 0; a < anchors; a++) {
      if (AN_OP[a] <= 0) continue;
      const ia = AN_I[a];
      const la = labelLeft(AN_MODE[a], AN_X[a], LBL_W[ia]) - LABEL_GAP;
      const ta = labelTop(AN_MODE[a], AN_Y[a], HUB_LABEL_H) - LABEL_GAP;
      for (let b = a + 1; b < anchors; b++) {
        if (AN_OP[b] <= 0) continue;
        const ib = AN_I[b];
        const lb = labelLeft(AN_MODE[b], AN_X[b], LBL_W[ib]);
        const tb = labelTop(AN_MODE[b], AN_Y[b], HUB_LABEL_H);
        if (
          lb >= la + LBL_W[ia] + LABEL_GAP * 2 ||
          lb + LBL_W[ib] <= la ||
          tb >= ta + HUB_LABEL_H + LABEL_GAP * 2 ||
          tb + HUB_LABEL_H <= ta
        ) {
          continue;
        }
        const aWins = ia === activeNode || (ib !== activeNode && NODE_DEPTH[ia] <= NODE_DEPTH[ib]);
        if (aWins) AN_OP[b] = 0;
        else {
          AN_OP[a] = 0;
          break;
        }
      }
    }
    for (let a = 0; a < anchors; a++) {
      writeLabel(AN_I[a], AN_OP[a], interactive, AN_MODE[a], AN_X[a], AN_Y[a]);
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

  // Render: a positive priority hands the draw to us (R3F stops auto-rendering),
  // and puts it after the update above. The bloom adds itself over the result.
  useFrame((state) => {
    state.gl.setRenderTarget(null);
    state.gl.render(state.scene, state.camera);
    // The domain glows are already soft light: keep them out of the glow source.
    const atmos = NODE_UNIFORMS.uAtmos.value;
    NODE_UNIFORMS.uAtmos.value = 0;
    renderBloom(state.gl, state.scene, state.camera, BLOOM.v, BLOOM_BACKDROP);
    NODE_UNIFORMS.uAtmos.value = atmos;
  }, 1);

  return (
    <>
      {/* Shared module-scope objects — dispose={null} so a gate remount can't free them. */}
      <primitive object={STAR_POINTS} dispose={null} />
      <group ref={parallax} position={[0, SYSTEM_LIFT, 0]}>
        <group ref={spin}>
          <primitive object={RING_MESH} dispose={null} />
          <primitive object={DUST_POINTS} dispose={null} />
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
  // The core belongs to no domain: selecting it focuses nothing.
  const selCluster = sel ? (sel.kind === 'cluster' ? sel.i : CLUSTER_OF[sel.i]) : -1;
  const focusCluster = selCluster >= 0 ? selCluster : null;
  const activeNode = sel && sel.kind === 'node' ? sel.i : null;
  const pinned = pin !== null;
  const pinnedNode = pin?.kind === 'node' ? pin.i : null;
  // The pointer handlers read this without re-subscribing on every pin change.
  const pinnedRef = useRef(false);
  useEffect(() => {
    pinnedRef.current = pinned;
  }, [pinned]);

  let zoomTarget: number | null = null;
  // Camera distance from the framed point: a whole cluster (hub or legend pin)
  // sits a little further back than a single skill.
  let zoomDist = 10.2;
  if (pin) {
    if (pin.kind === 'node') {
      zoomTarget = pin.i;
      zoomDist = pin.i === CORE ? 12 : IS_HUB[pin.i] ? 10.2 : 9.8;
    } else {
      zoomTarget = CLUSTER_HUB[pin.i];
      zoomDist = 10.2;
    }
  }

  let cardData: SkillCardData | null = null;
  if (pin) {
    if (pin.kind === 'node') {
      const n = NODES[pin.i];
      if (n.kind === 'core') cardData = buildCoreCard();
      else if (n.kind === 'hub') cardData = buildDomainCard(n.cluster);
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
          related: RELATED[pin.i].map((r) => NODES[r].label),
        };
      }
    } else {
      cardData = buildDomainCard(pin.i);
    }
  }

  // Announced by the sr-only live region below (the canvas itself is decorative).
  const activeSkill =
    activeNode !== null && NODES[activeNode].kind === 'leaf' ? NODES[activeNode].label : null;
  const announcement = activeSkill
    ? `Selected skill: ${activeSkill}, ${CLUSTERS[focusCluster ?? 0].title}`
    : focusCluster !== null
      ? `Focused domain: ${CLUSTERS[focusCluster].title}, ${CLUSTER_COUNTS[focusCluster]} skills`
      : activeNode === CORE
        ? `Core: ${SKILL_COUNT} skills in ${CLUSTER_COUNT} domains`
        : '';

  // Where the detail card sits (layout box, so its enter animation does not
  // matter) — the scene hides any label that would end up underneath it.
  const cardTitle = cardData?.title ?? null;
  useEffect(() => {
    CARD.on = false;
    if (cardTitle === null) return;
    const root = rootRef.current;
    const cards = root?.querySelectorAll<HTMLElement>('[data-skill-card]');
    const el = cards?.[cards.length - 1];
    if (!root || !el) return;
    const measure = () => {
      const pad = 6;
      CARD.left = el.offsetLeft - pad;
      CARD.right = el.offsetLeft + el.offsetWidth + pad;
      // The card is centred with translateY(-50%) on a top: 50% box.
      CARD.top = el.offsetTop - el.offsetHeight / 2 - pad;
      CARD.bottom = el.offsetTop + el.offsetHeight / 2 + pad;
      CARD.on = true;
    };
    measure();
    // The card moves with the stage size and breakpoint, so follow resizes.
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    ro.observe(el);
    return () => ro.disconnect();
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
  // Pointer over the stage but not on a node: the domain whose rings it is within
  // (only while nothing is pinned — a pinned view must not refocus under the cursor).
  const hoverAt = useCallback(
    (clientX: number, clientY: number) => {
      const el = stageRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = clientX - r.left;
      const py = clientY - r.top;
      const i = pickNode(px, py);
      // One key for "what is hovered": node index, -2 - cluster, or -1 for nothing.
      let key = i;
      if (i === -1 && !pinnedRef.current) {
        const sticky = lastHover.current <= -2 ? -2 - lastHover.current : -1;
        const c = pickCluster(px, py, sticky);
        if (c >= 0) key = -2 - c;
      }
      if (key === lastHover.current) return;
      lastHover.current = key;
      setHover(key >= 0 ? { kind: 'node', i: key } : key <= -2 ? { kind: 'cluster', i: -2 - key } : null);
    },
    [],
  );
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
          YAW_TO.on = false; // the hand takes over from the turn-to-front
          setDragging(true);
          lastHover.current = -1;
          setHover(null);
        }
        const now = performance.now();
        const dtMs = Math.max(8, now - ORBIT.lastT);
        const dYaw = dx * DRAG_YAW;
        ORBIT.yaw += dYaw;
        ORBIT.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, ORBIT.pitch + dy * DRAG_PITCH));
        ORBIT.vYaw = (dYaw * 1000) / dtMs;
        ORBIT.vPitch = (dy * DRAG_PITCH * 1000) / dtMs;
        ORBIT.lastX = e.clientX;
        ORBIT.lastY = e.clientY;
        ORBIT.lastT = now;
        ORBIT.idle = 0;
        return;
      }
      POINTER_IN.v = true;
      hoverAt(e.clientX, e.clientY);
    },
    [hoverAt],
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
    POINTER_IN.v = false;
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
      if (i !== -1) onClickNode(i);
      // Empty space inside a hovered domain's rings opens that domain; anywhere
      // else (or with something already pinned) a click on empty space closes.
      else if (!pinnedRef.current && lastHover.current <= -2) setPin({ kind: 'cluster', i: -2 - lastHover.current });
      else setPin(null);
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
          // From the core (no domain) or from nothing: enter at the first / last domain.
          const from = current < 0 ? -1 : CLUSTER_OF[current];
          const c = from < 0 ? (dir > 0 ? 0 : CLUSTER_COUNT - 1) : (from + dir + CLUSTER_COUNT) % CLUSTER_COUNT;
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
      // The chip that was clicked unmounts with the card, so park focus on the
      // stage first: the modal then returns focus there when it closes.
      if (proj) stageRef.current?.focus({ preventScroll: true });
      if (proj) openProject(proj);
      setPin(null); // hand off: zoom back out as the project modal takes over
      setHover(null);
    },
    [openProject],
  );

  // Detail-card chips: jump to another skill or domain (the system turns to it).
  const handleSelectLabel = useCallback((label: string) => {
    const i = NODE_BY_LABEL.get(label);
    if (i === undefined) return;
    stageRef.current?.focus({ preventScroll: true });
    lastHover.current = -1;
    setHover(null);
    setPin({ kind: 'node', i });
  }, []);

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
      {/* Telemetry — decorative; follows the drag and the idle turn. */}
      <p
        aria-hidden="true"
        className={`pointer-events-none absolute right-4 top-4 z-10 hidden whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.14em] text-cyber-accent/60 transition-opacity duration-700 lg:block ${
          shown ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <span className="text-cyber-brand/80">sys.orbit</span> · az <span ref={setHudAz} className="tabular-nums text-cyber-secondary/80">000</span>° · el{' '}
        <span ref={setHudEl} className="tabular-nums text-cyber-secondary/80">29</span>° · {SKILL_COUNT} skills · {LINK_TOTALS.cross} links
      </p>

      {/* Node labels — positioned per frame by the scene (transform + opacity only).
          Hubs are always readable; leaves appear when their domain is in focus.
          Decorative for AT (the section keeps an sr-only list), but clickable. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
        {NODES.map((n, i) => {
          const isHub = n.kind !== 'leaf';
          const isCore = n.kind === 'core';
          const isPinned = pinnedNode === i;
          const isActive = activeNode === i;
          const color = isCore ? CORE_COLOR : CLUSTERS[n.cluster].color;
          return (
            <button
              key={n.id}
              ref={LABEL_REFS[i]}
              type="button"
              tabIndex={-1}
              onPointerEnter={() => {
                POINTER_IN.v = true;
                lastHover.current = i;
                onHoverNode(i);
              }}
              onPointerLeave={() => {
                lastHover.current = -1;
                onHoverNode(null);
              }}
              onClick={(e) => {
                e.stopPropagation();
                onClickNode(i);
              }}
              style={{ opacity: 0, borderColor: isPinned || isActive ? color : undefined }}
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
              {isHub && !isCore && (
                <ClusterGlyph shape={CLUSTERS[n.cluster].glyph} color={color} size={11} />
              )}
              {isCore ? <span className="text-cyber-brand">{n.label}</span> : n.label}
              {isHub && (
                <span className="rounded-sm bg-white/10 px-1 py-0.5 text-[11px] font-normal tabular-nums text-cyber-accent">
                  {isCore ? SKILL_COUNT : CLUSTER_COUNTS[n.cluster]}
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
            onSelect={handleSelectLabel}
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
