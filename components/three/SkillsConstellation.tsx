'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AnimatePresence } from 'framer-motion';
import { Minus, Plus, Rocket } from 'lucide-react';
import * as THREE from 'three';
import {
  CLUSTERS,
  CLUSTER_COUNT,
  CLUSTER_COUNTS,
  CLUSTER_HUB,
  CLUSTER_OF,
  CLUSTER_SKILLS,
  CURVE_STRIDE,
  IS_HUB,
  LANE_COUNT,
  NODES,
  NODE_COUNT,
  NODE_POSITIONS,
  NODE_RADIUS,
  SATELLITES,
  SAT_COUNT,
  SHIPS,
  SHIP_COUNT,
  SHIP_CURVES,
} from './constellationData';
import { FOCAL_F, FOG_FAR, FOG_FLOOR, FOG_NEAR, FOV, HOME_Z, SHARED, depthFade } from './sceneShared';
import {
  BIG_COUNT,
  BIG_DEPTH,
  BODY_MESHES,
  GLOW_UNIFORMS,
  MOON_SLOT,
  NEAR_FADE_BIG,
  NEAR_FADE_SMALL,
  PLANET_COVER,
  SAT_BASE,
  SHIP_BASE,
  SHIP_MIN_PX,
  SMALL_BEHIND,
  SMALL_DEPTH,
  SUN_RADIUS,
  bodyTexturesSettled,
  disposeBodyTextures,
  loadBodyTextures,
  requestPlanetDetail,
  setBigState,
  setGlow,
  setPlanetSpin,
  setSmallHeading,
  setSmallPosition,
  setSmallState,
  updateBodyTextures,
  uploadBodies,
} from './bodyLayer';
import {
  LANE_BASE,
  LINE_COUNT,
  LINE_MESH,
  ORBIT_BASE,
  TRAIL_OF_NODE,
  WAKE_BASE,
  flushLines,
  setLineIntensity,
  setLineRange,
  setLineSkirt,
} from './lineLayer';
import {
  NEBULA_MESH,
  STAR_DRIFT,
  STAR_POINTS,
  disposeNebulaTexture,
  loadNebula,
  setFarStars,
  updateNebula,
} from './starLayer';
import { getSkillMeta } from './skillsMeta';
import ClusterGlyph from './ClusterGlyph';
import { projects } from '@/components/sections/projectsData';
import { useProjectModal } from '@/components/ui/ProjectModalProvider';
import SkillDetailCard, { type SkillCardData } from '@/components/ui/SkillDetailCard';

/*
 * Client-only (the gate imports it with `ssr:false`), so module-scope `document`
 * access and the shared scene buffers/objects are safe — the star system is a
 * singleton. Render only reads these; `useFrame` and the pointer handlers mutate
 * them, which keeps render pure and avoids tripping react-hooks/immutability
 * (the rule forbids mutating hook-returned values or props, not module scope).
 *
 * The scene is thirteen draw calls, all hand-written shaders:
 *   starLayer  — nebula plate + seeded parallax starfield (2 draws)
 *   lineLayer  — instanced ribbons: orbits, lanes, moon trails, ship wakes (1 draw)
 *   bodyLayer  — domain glows (1), the star and the four planets (5, back to
 *                front), and the moons and the craft behind / in front of them (4)
 *
 * The skill domains are planets around a star; each skill is a moon on one of
 * its planet's two orbits; every highlighted project is a ship flying a lane
 * between the two domains it draws on.
 */

/**
 * Pickable things: every node (planet or moon) followed by every ship. A "pick
 * index" below NODE_COUNT is a node; NODE_COUNT + s is ship s.
 */
const PICK_COUNT = NODE_COUNT + SHIP_COUNT;

const restIntensity = (i: number) => (IS_HUB[i] ? 0.95 : 0.6);
/** Eased per-node glow and selection (0 none · 0.6 hovered · 1 pinned), fed to the body layer. */
const GLOW = new Float32Array(NODE_COUNT);
const SELECT = new Float32Array(NODE_COUNT);
for (let i = 0; i < NODE_COUNT; i++) GLOW[i] = restIntensity(i);
/** Eased per-line brightness, fed to the line layer. */
const LINE_INT = new Float32Array(LINE_COUNT);
/** Eased glow strength per domain (+ the backdrop in the last slot). */
const ATMOS = new Float32Array(CLUSTER_COUNT + 1);
/** Eased brightness of the star, the ships and the ships' selection. */
const SUN = { glow: 1 };
const SHIP_GLOW = new Float32Array(SHIP_COUNT).fill(1);
const SHIP_SELECT = new Float32Array(SHIP_COUNT);

/**
 * Orbital clocks. Each domain has its own, so a system can slow to a stop while
 * it is in focus (labels and hit targets hold still) without the others pausing.
 * Ships likewise ease off the throttle while hovered, so they can be caught.
 */
const CLUSTER_TIME = new Float64Array(CLUSTER_COUNT);
const CLUSTER_RATE = new Float32Array(CLUSTER_COUNT).fill(1);
const SHIP_TIME = new Float64Array(SHIP_COUNT);
const SHIP_RATE = new Float32Array(SHIP_COUNT).fill(1);
/** Live ship positions (system-local), for the chase camera. */
const SHIP_POS = new Float32Array(SHIP_COUNT * 3);
/**
 * The visitor's own turn of each planet's globe (radians) and its inertia.
 * `AXIS_UP` is +1 when a planet's north pole points up on screen, so a drag to
 * the right always carries the surface to the right.
 */
const SPIN = new Float32Array(CLUSTER_COUNT);
const SPIN_VEL = new Float32Array(CLUSTER_COUNT);
const AXIS_UP = new Float32Array(CLUSTER_COUNT).fill(1);
const SPIN_RATE = 0.0075; // rad per px
/** Length of a moon's trail in turns, and of a ship's wake as a share of its route. */
const MOON_TRAIL = 0.075;
const WAKE_LENGTH = 0.2;
const TAU = Math.PI * 2;

/**
 * Screen-space projection of every pickable, refreshed each frame by the scene:
 * [x px, y px, pickable 0|1]. Read by the pointer picker and the label layer —
 * both live in CSS pixels, so hit-testing here is exact regardless of DPR, zoom
 * or the orbit/parallax transforms.
 */
const SCREEN = new Float32Array(PICK_COUNT * 3);
/** View-space depth of every pickable (distance in front of the camera, scene units). */
const PICK_DEPTH = new Float32Array(PICK_COUNT);
/** On-screen radius of every pickable in CSS px. */
const PICK_RPX = new Float32Array(PICK_COUNT);
/** Minimum pick radius in CSS px — planets get a bigger, higher-priority target. */
const PICK_RADIUS_HUB = 26;
const PICK_RADIUS_LEAF = 15;
const PICK_RADIUS_SHIP = 20;

/** Label DOM nodes, one per pickable; filled by ref callbacks, positioned by useFrame. */
const LABEL_ELS: (HTMLElement | null)[] = new Array(PICK_COUNT).fill(null);
/**
 * Last values written to each label's style, so a frame in which nothing moved
 * writes nothing: opacity in 1/100 steps, pointer-events flag, anchor mode and
 * position. -1 = unknown (forces the next write).
 */
const LBL_Q = new Int16Array(PICK_COUNT).fill(-1);
const LBL_PE = new Int8Array(PICK_COUNT).fill(-1);
const LBL_MODE = new Int8Array(PICK_COUNT).fill(-1);
const LBL_X = new Float32Array(PICK_COUNT);
const LBL_Y = new Float32Array(PICK_COUNT);
/** Label widths in CSS px (measured on mount and again once the web font is in). */
const LBL_W = new Float32Array(PICK_COUNT);
/** A planet's label sits this many planet radii above its centre (the reticle is at 1.32). */
const HUB_LABEL_CLEAR = 1.42;
const HUB_LABEL_H = 29;
const LEAF_LABEL_H = 22;
/** Stable ref callbacks (one per label) — they also reset that label's write cache. */
const LABEL_REFS = Array.from({ length: PICK_COUNT }, (_, i) => (el: HTMLElement | null) => {
  LABEL_ELS[i] = el;
  LBL_Q[i] = -1;
  LBL_PE[i] = -1;
  LBL_MODE[i] = -1;
  if (el) LBL_W[i] = el.offsetWidth;
});
function measureLabels() {
  for (let i = 0; i < PICK_COUNT; i++) {
    const el = LABEL_ELS[i];
    if (el) LBL_W[i] = el.offsetWidth;
  }
}
/** Anchor modes: how a label hangs off its body. */
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
 * Scratch for the moon-label collision pass: the focused system's visible moon
 * labels (at most 9), nudged apart vertically so they never sit on each other.
 */
const SWEEP_MAX = 12;
const SW_I = new Int16Array(SWEEP_MAX);
const SW_MODE = new Int8Array(SWEEP_MAX);
const SW_X = new Float32Array(SWEEP_MAX);
const SW_TOP = new Float32Array(SWEEP_MAX);
const SW_OP = new Float32Array(SWEEP_MAX);
const SW_ORDER = new Int8Array(SWEEP_MAX);
/** 1 = the label sits above its planet (pushed up), 0 = below (pushed down). */
const SW_UP = new Int8Array(SWEEP_MAX);
/** Planet labels of the systems out of focus, held back until the moon-label pass has run. */
const HUB_WAIT_I = new Int16Array(CLUSTER_COUNT);
const HUB_WAIT_OP = new Float32Array(CLUSTER_COUNT);
const HUB_WAIT_X = new Float32Array(CLUSTER_COUNT);
const HUB_WAIT_Y = new Float32Array(CLUSTER_COUNT);
const LABEL_GAP = 3;
/** Labels keep this far (CSS px) from the left and right edges of the stage. */
const STAGE_PAD = 6;
/** Height (CSS px) of the strip at the bottom of the stage that the legend occupies. */
const LEGEND_BAND = 58;
/** Height (CSS px) of the strip at the top of the stage where the scene fades into the page. */
const TOP_BAND = 34;

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
 * Narrow stages: the near (left/right) systems sit at z = +2.2 and reach about
 * 6 units from the axis, so below a ~2:1 aspect the home camera backs off just
 * enough to keep them in frame.
 */
const NEAR_PLANE_Z = 2.2;
const HALF_SPAN_X = 6.0;
/** View depth of the near systems from the home camera — where the fog ramp is "clear". */
const CLEAR_DEPTH = HOME_Z - NEAR_PLANE_Z;

/** Stage C4 switch: domain glows + backdrop (extra instances of the body draw). */
const ATMOS_ENABLED = true;

const PROJ_VEC = new THREE.Vector3();
const CAM_TARGET = new THREE.Vector3(0, 0, HOME_Z);
/** Camera spring velocity (critically damped — eases in and out, never snaps). */
const CAM_VEL = new THREE.Vector3();
const CAM_TIME_IN = 0.6; // s, towards a pinned target
const CAM_TIME_OUT = 0.7; // s, back home
const CAM_TIME_ENTER = 1.2; // s, the entrance push-in
const CAM_TIME_ZOOM = 0.26; // s, while the visitor is zooming
/** The camera starts this far back and pushes in while the system assembles. */
const ENTER_DOLLY = 4.2;
/** Camera distance from the framed point: a whole system, a single moon, a ship. */
const ZOOM_DIST_SYSTEM = 5.6;
const ZOOM_DIST_MOON = 4.0;
const ZOOM_DIST_SHIP = 3.0;
/**
 * How close the visitor's zoom can bring the camera to what is pinned: a planet
 * (in planet radii, so every globe ends up the same size on screen), a moon
 * and a ship (scene units).
 */
const CLOSE_PLANET = 2.3;
const CLOSE_MOON = 0.9;
const CLOSE_SHIP = 1.15;
/** Click shockwave progress (0 = idle) and the last pinned target, to detect a new pin. */
const PING = { t: 0, last: -1 };
const PING_SECONDS = 0.8;

/**
 * Visitor zoom: a multiplier on how close the camera sits (buttons, +/- keys,
 * Ctrl/⌘ + wheel, trackpad pinch). `nx`/`ny` remember where the pointer was, so
 * the overview zooms towards it; `kick` shortens the camera spring while the
 * visitor is actively zooming so it tracks the gesture.
 */
const ZOOM = { target: 1, max: 2.2, nx: 0, ny: 0, kick: 0 };
const ZOOM_MIN = 1;
/** Zoom limit of the overview; a pin has its own (see zoomMaxFor). */
const ZOOM_MAX_FREE = 2.2;
const ZOOM_STEP = 1.3;
/** 0 at a pin's normal framing, 1 at its closest: how far into a close-up the camera is. */
const CLOSE = { k: 0 };
/** The planet the pointer has grabbed (a drag then turns its globe), or -1. */
const GRAB = { cluster: -1 };

/**
 * Screen-space footprint of the five large bodies (the star, then each planet):
 * centre and the radius out to which it covers what is behind it. A small body
 * inside that footprint and farther away is drawn before the large bodies.
 */
const BIG_X = new Float32Array(BIG_COUNT);
const BIG_Y = new Float32Array(BIG_COUNT);
const BIG_R = new Float32Array(BIG_COUNT);
function coveredByBig(sx: number, sy: number, depth: number, rPx: number): number {
  for (let b = 0; b < BIG_COUNT; b++) {
    if (depth > BIG_DEPTH[b] && Math.hypot(sx - BIG_X[b], sy - BIG_Y[b]) < BIG_R[b] + rPx * 1.2) return 1;
  }
  return 0;
}

/** Model-view matrix of the system group, and the scratch a projection writes to. */
const MODEL_VIEW = new THREE.Matrix4();
const PROJ = { x: 0, y: 0, depth: 0, front: 0 };
const VIEW = { w: 1, h: 1, p0: 1, p5: 1, p8: 0, p9: 0 };
/** Projects a system-local point to stage px + view depth (allocation-free). */
function project(x: number, y: number, z: number) {
  const e = MODEL_VIEW.elements;
  const vx = e[0] * x + e[4] * y + e[8] * z + e[12];
  const vy = e[1] * x + e[5] * y + e[9] * z + e[13];
  const vz = e[2] * x + e[6] * y + e[10] * z + e[14];
  const depth = -vz;
  PROJ.depth = depth;
  if (depth <= 0.2) {
    PROJ.front = 0;
    return;
  }
  PROJ.front = 1;
  PROJ.x = (((VIEW.p0 * vx + VIEW.p8 * vz) / depth) * 0.5 + 0.5) * VIEW.w;
  PROJ.y = ((-(VIEW.p5 * vy + VIEW.p9 * vz) / depth) * 0.5 + 0.5) * VIEW.h;
}

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
 * is properly on screen. The star ignites, the planets pop, their orbits draw,
 * the moons bloom along them, then the lanes and the craft arrive (all in the
 * shaders, keyed off the shared `uEnter` uniform).
 */
const ENTER = { t: 0, done: false };
const ENTER_SECONDS = 2.0;
/**
 * Shader warm-up. Programs are compiled off-screen on mount (the frameloop is
 * 'never' until the stage is in view), and the entrance waits for them so the
 * compile hitch never lands on the reveal. `wait` is a safety net: if the
 * compile promise never settles, the entrance starts anyway.
 */
const WARM = { ready: false, compiled: false, wait: 0 };
const WARM_MAX_WAIT = 2.4; // s

/**
 * Frame-time governor. One-way quality tiers kept in module scope so a remount
 * starts at the last known-good tier: a 45-frame window of raw frame deltas,
 * and when its median says "under 50 fps" the tier steps down (never back up —
 * resizing the drawing buffer back and forth would itself cause hitches).
 *
 *   tier 0 — DPR ≤ 2.0, everything on
 *   tier 1 — DPR ≤ 1.5
 *   tier 2 — DPR ≤ 1.25, domain glows off
 *   tier 3 — DPR ≤ 1.0, far star layer and line glow skirt off as well
 */
const TIER_DPR = [2, 1.5, 1.25, 1.0];
const MAX_TIER = TIER_DPR.length - 1;
const GOV_WINDOW = 45;
const GOV_SKIP = 30; // frames ignored after (re)activation
const GOV_SLOW = 0.02; // s — median frame time that triggers a step down
const GOV_GAP = 0.1; // s — a delta this long is a one-off hitch, not a slow frame: ignored
const GOV_PAUSE = 0.5; // s — a delta this long means the loop was paused: restart the window
const GOV_COOLDOWN = 2; // s between steps
/**
 * This many frames in a row between GOV_GAP and GOV_PAUSE long (2 to 10 fps)
 * are not hitches: the GPU is overloaded. Step down at once — such frames are
 * never sampled, so the window below would never fill. (Frames longer than
 * GOV_PAUSE do not count: a covered or background window is throttled to
 * about 1 fps, which says nothing about the GPU.)
 */
const GOV_CRAWL_FRAMES = 5;
/** Above this many device pixels the canvas starts one DPR step lower. */
const GOV_MAX_PIXELS = 4.6e6;
const GOV = {
  tier: 0,
  n: 0,
  skip: GOV_SKIP,
  sinceStep: GOV_COOLDOWN,
  /** Consecutive frames between GOV_GAP and GOV_PAUSE long. */
  crawl: 0,
  /** Fastest frame seen (s) — approximates the display refresh interval. */
  fast: Infinity,
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
 * Idle motion is a bounded sway, not a free spin: the system rocks +/-SWAY_AMP
 * about its home view and never turns edge-on. `t` only advances while the sway
 * is blended in, so it freezes (rather than jumps) on a drag or a pin.
 */
const SWAY = { t: 0, v: 0 };
const SWAY_AMP = 0.3; // rad
const SWAY_RATE = 0.1; // rad/s (phase)
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
  WARM.compiled = false;
  WARM.wait = 0;
  GOV.n = 0;
  GOV.skip = GOV_SKIP;
  GOV.crawl = 0;
  ZOOM.target = 1;
  ZOOM.max = ZOOM_MAX_FREE;
  ZOOM.nx = 0;
  ZOOM.ny = 0;
  ZOOM.kick = 0;
  CLOSE.k = 0;
  GRAB.cluster = -1;
  SPIN_VEL.fill(0);
}

type Sel =
  | { kind: 'node'; i: number }
  | { kind: 'cluster'; i: number }
  | { kind: 'ship'; i: number }
  | { kind: 'fleet' };
/** What can be pinned open: a planet, a moon, a domain from the legend, or a ship. */
type Pin = Extract<Sel, { kind: 'node' | 'cluster' | 'ship' }>;

/** How far the visitor can zoom with this pinned (1 = no closer than its normal framing). */
function zoomMaxFor(pin: Pin | null): number {
  if (!pin) return ZOOM_MAX_FREE;
  if (pin.kind === 'ship') return ZOOM_DIST_SHIP / CLOSE_SHIP;
  if (pin.kind === 'node' && !IS_HUB[pin.i]) return ZOOM_DIST_MOON / CLOSE_MOON;
  const c = pin.kind === 'cluster' ? pin.i : CLUSTER_OF[pin.i];
  return ZOOM_DIST_SYSTEM / (CLUSTERS[c].radius * CLOSE_PLANET);
}

function buildDomainCard(c: number): SkillCardData {
  return {
    kind: 'domain',
    title: CLUSTERS[c].title,
    domainLabel: CLUSTERS[c].title,
    color: CLUSTERS[c].color,
    glyph: CLUSTERS[c].glyph,
    blurb: `${CLUSTER_COUNTS[c]} skills I work with across this domain, one moon each. Hover any of them to inspect it.`,
    domainSkills: CLUSTER_SKILLS[c],
  };
}

/**
 * Nearest pickable to a CSS-pixel point inside the stage, using the per-frame
 * screen projections. Distance is normalised by each target's pick radius, so a
 * planet (bigger radius) wins over a moon that happens to sit on top of it.
 */
function pickAtPoint(px: number, py: number): number {
  let best = -1;
  let bestScore = 1;
  for (let i = 0; i < PICK_COUNT; i++) {
    if (SCREEN[i * 3 + 2] < 0.5) continue;
    const dx = px - SCREEN[i * 3];
    const dy = py - SCREEN[i * 3 + 1];
    const r =
      i >= NODE_COUNT
        ? Math.max(PICK_RADIUS_SHIP, PICK_RPX[i] + 8)
        : IS_HUB[i]
          ? Math.max(PICK_RADIUS_HUB, PICK_RPX[i] + 2)
          : Math.max(PICK_RADIUS_LEAF, PICK_RPX[i] + 6);
    const score = Math.sqrt(dx * dx + dy * dy) / r;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** smoothstep over a [gone, fully there] pair of view depths (mirrors the shaders' near fade). */
const nearFade = (range: [number, number], depth: number) => {
  const t = clamp01((depth - range[0]) / (range[1] - range[0]));
  return t * t * (3 - 2 * t);
};
const easeOut = (v: number) => 1 - Math.pow(1 - clamp01(v), 3);

interface SceneProps {
  focusCluster: number | null;
  activeNode: number | null;
  /** Hovered / keyboard-focused ship, and whether the whole fleet is highlighted. */
  activeShip: number | null;
  fleet: boolean;
  zoomTarget: number | null;
  zoomDist: number;
  pinned: boolean;
  pinnedNode: number | null;
  /** The ship the camera is flying alongside, if one is pinned. */
  chaseShip: number | null;
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
  activeShip,
  fleet,
  zoomTarget,
  zoomDist,
  pinned,
  pinnedNode,
  chaseShip,
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

  // Warm-up: compile every program now, while the stage is still off-screen, and
  // start decoding the nebula plate and the surface maps. (No invalidate(): it
  // is a no-op while the frameloop is 'never'.)
  useEffect(() => {
    let alive = true;
    const done = () => {
      if (alive) WARM.compiled = true;
    };
    loadNebula();
    loadBodyTextures(gl.capabilities.getMaxAnisotropy());
    gl.compileAsync(scene, camera).then(done, done);
    return () => {
      alive = false;
    };
  }, [gl, scene, camera]);

  // Context loss: give the browser a moment to restore it, otherwise hand over
  // to the cards. Everything here re-uploads by itself, so a restored context just works.
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
      for (const obj of [NEBULA_MESH, STAR_POINTS, LINE_MESH, ...BODY_MESHES]) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
      disposeNebulaTexture();
      disposeBodyTextures();
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

  // The planet that is open (or whose moon is) gets its 4K surface map.
  const detailCluster = pinned && zoomTarget !== null ? CLUSTER_OF[zoomTarget] : null;
  useEffect(() => {
    requestPlanetDetail(detailCluster);
  }, [detailCluster]);

  // Effect tiers: the lowest tier also drops the far star layer and the line glow skirt.
  useEffect(() => {
    setFarStars(tier < MAX_TIER);
    setLineSkirt(tier < MAX_TIER);
  }, [tier]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    SHARED.uTime.value += dt;
    const time = SHARED.uTime.value;

    if (!shown.current) {
      shown.current = true;
      onShown();
      // Entrance dolly: until the entrance has played, the camera waits further back.
      if (ENTER.t === 0) state.camera.position.setZ(HOME_Z + ENTER_DOLLY);
    }

    // ── Quality governor (raw delta: the clamp above would hide slow frames) ──
    GOV.sinceStep += delta;
    GOV.crawl = delta > GOV_GAP && delta <= GOV_PAUSE ? GOV.crawl + 1 : 0;
    if (GOV.crawl >= GOV_CRAWL_FRAMES && GOV.tier < MAX_TIER) {
      // Crawling: drop a tier without waiting for a window.
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
    } else if (GOV.tier < MAX_TIER) {
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
      if ((WARM.compiled && bodyTexturesSettled()) || WARM.wait > WARM_MAX_WAIT) WARM.ready = true;
    }
    updateBodyTextures(dt);
    if (!ENTER.done && entered && WARM.ready) {
      ENTER.t = Math.min(1, ENTER.t + dt / ENTER_SECONDS);
      if (ENTER.t >= 1) ENTER.done = true;
    }
    SHARED.uEnter.value = ENTER.t;
    const enterHub = easeOut((ENTER.t - 0.1) / 0.3);
    const enterLeaf = easeOut((ENTER.t - 0.5) / 0.4);
    const enterCraft = easeOut((ENTER.t - 0.7) / 0.3);

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
      const tx = (pinned ? 0 : -state.pointer.y * 0.14) + ORBIT.pitch;
      const ty = pinned ? 0 : state.pointer.x * 0.18;
      const k = 1 - Math.exp(-dt * (pinned || ORBIT.dragging ? 8 : 2.5));
      parallax.current.rotation.x += (tx - parallax.current.rotation.x) * k;
      parallax.current.rotation.y += (ty - parallax.current.rotation.y) * k;
      tiltX = parallax.current.rotation.x;
      tiltY = parallax.current.rotation.y;
    }

    // ── Orbital motion: each system runs on its own clock and eases to a stop
    // while it is in focus, so its moons (and their labels) hold still ──
    for (let c = 0; c < CLUSTER_COUNT; c++) {
      const rate = focusCluster === c ? 0 : 1;
      CLUSTER_RATE[c] += (rate - CLUSTER_RATE[c]) * (1 - Math.exp(-dt * 3.5));
      CLUSTER_TIME[c] += dt * CLUSTER_RATE[c];
      // A globe the visitor has spun coasts to a stop.
      if (GRAB.cluster !== c) {
        SPIN[c] += SPIN_VEL[c] * dt;
        SPIN_VEL[c] *= Math.exp(-dt * 1.8);
      }
      setPlanetSpin(c, SPIN[c]);
    }
    for (let i = 0; i < NODE_COUNT; i++) {
      if (IS_HUB[i]) continue;
      const node = NODES[i];
      const c = CLUSTERS[node.cluster];
      const ang = node.orbitPhase + node.orbitSpeed * CLUSTER_TIME[node.cluster];
      const cs = Math.cos(ang) * node.orbitRadius;
      const sn = Math.sin(ang) * node.orbitRadius;
      const x = c.center[0] + c.u[0] * cs + c.v[0] * sn;
      const y = c.center[1] + c.u[1] * cs + c.v[1] * sn;
      const z = c.center[2] + c.u[2] * cs + c.v[2] * sn;
      NODE_POSITIONS[i * 3] = x;
      NODE_POSITIONS[i * 3 + 1] = y;
      NODE_POSITIONS[i * 3 + 2] = z;
      setSmallPosition(MOON_SLOT[i], x, y, z);
      // The trail is the arc the moon has just covered; it shrinks to nothing as
      // the system slows to a stop.
      const turn = ang / TAU;
      const trail = MOON_TRAIL * CLUSTER_RATE[node.cluster] * Math.sign(node.orbitSpeed);
      setLineRange(TRAIL_OF_NODE[i], turn - trail, turn);
    }

    // ── Node glow + selection — active node white-hot, focused system lit, the
    // rest dimmed (harder when something is pinned, for a spotlight feel) ──
    const fNode = 1 - Math.exp(-dt * 9);
    const fSelect = 1 - Math.exp(-dt * 12);
    const dimTarget = pinned ? 0.05 : 0.1;
    for (let i = 0; i < NODE_COUNT; i++) {
      let target: number;
      if (activeNode === i) target = 1.65;
      else if (focusCluster === null) target = restIntensity(i);
      else if (CLUSTER_OF[i] === focusCluster) target = IS_HUB[i] ? 1.1 : 0.9;
      else target = dimTarget;
      GLOW[i] += (target - GLOW[i]) * fNode;
      const select = activeNode === i ? (pinnedNode === i ? 1 : 0.6) : 0;
      SELECT[i] += (select - SELECT[i]) * fSelect;
      if (IS_HUB[i]) setBigState(1 + CLUSTER_OF[i], GLOW[i], SELECT[i]);
      else setSmallState(MOON_SLOT[i], GLOW[i], SELECT[i]);
    }

    // ── Satellites and the station ride with their planet's focus state ──
    for (let s = 0; s < SAT_COUNT; s++) {
      const sat = SATELLITES[s];
      const c = CLUSTERS[sat.cluster];
      const ang = sat.phase + sat.speed * time;
      const cs = Math.cos(ang);
      const sn = Math.sin(ang);
      const r = sat.radius;
      const dir = sat.speed < 0 ? -1 : 1;
      setSmallPosition(
        SAT_BASE + s,
        c.center[0] + (sat.u[0] * cs + sat.v[0] * sn) * r,
        c.center[1] + (sat.u[1] * cs + sat.v[1] * sn) * r,
        c.center[2] + (sat.u[2] * cs + sat.v[2] * sn) * r,
      );
      setSmallHeading(
        SAT_BASE + s,
        (sat.v[0] * cs - sat.u[0] * sn) * dir,
        (sat.v[1] * cs - sat.u[1] * sn) * dir,
        (sat.v[2] * cs - sat.u[2] * sn) * dir,
      );
      setSmallState(SAT_BASE + s, Math.min(GLOW[CLUSTER_HUB[sat.cluster]], 1), 0);
    }

    // ── Ships shuttle along their lane: out, dock, back. Throttle follows the
    // speed, the wake trails behind, and a hovered ship eases off so it can be
    // caught ──
    const fShip = 1 - Math.exp(-dt * 6);
    for (let s = 0; s < SHIP_COUNT; s++) {
      const ship = SHIPS[s];
      const chased = chaseShip === s;
      const active = activeShip === s || chased;
      // A hovered ship all but stops; the one the camera follows keeps cruising.
      const rate = chased ? 0.3 : active ? 0.08 : 1;
      SHIP_RATE[s] += (rate - SHIP_RATE[s]) * (1 - Math.exp(-dt * 5));
      SHIP_TIME[s] += dt * SHIP_RATE[s];
      const phase = (SHIP_TIME[s] / ship.period + ship.offset) % 1;
      const along = 0.5 - 0.5 * Math.cos(phase * TAU);
      const speed = Math.sin(phase * TAU);
      const dir = speed < 0 ? -1 : 1;
      const thrust = Math.abs(speed);
      const o = s * CURVE_STRIDE;
      const t0 = SHIP_CURVES[o + 9];
      const t1 = SHIP_CURVES[o + 10];
      const t = t0 + (t1 - t0) * along;
      const k = 1 - t;
      const wa = k * k;
      const wc = 2 * k * t;
      const wb = t * t;
      const sx = wa * SHIP_CURVES[o] + wc * SHIP_CURVES[o + 3] + wb * SHIP_CURVES[o + 6];
      const sy = wa * SHIP_CURVES[o + 1] + wc * SHIP_CURVES[o + 4] + wb * SHIP_CURVES[o + 7];
      const sz = wa * SHIP_CURVES[o + 2] + wc * SHIP_CURVES[o + 5] + wb * SHIP_CURVES[o + 8];
      SHIP_POS[s * 3] = sx;
      SHIP_POS[s * 3 + 1] = sy;
      SHIP_POS[s * 3 + 2] = sz;
      setSmallPosition(SHIP_BASE + s, sx, sy, sz);
      // Heading = the curve's tangent, flipped on the way back.
      const hx = 2 * k * (SHIP_CURVES[o + 3] - SHIP_CURVES[o]) + 2 * t * (SHIP_CURVES[o + 6] - SHIP_CURVES[o + 3]);
      const hy = 2 * k * (SHIP_CURVES[o + 4] - SHIP_CURVES[o + 1]) + 2 * t * (SHIP_CURVES[o + 7] - SHIP_CURVES[o + 4]);
      const hz = 2 * k * (SHIP_CURVES[o + 5] - SHIP_CURVES[o + 2]) + 2 * t * (SHIP_CURVES[o + 8] - SHIP_CURVES[o + 5]);
      const hl = Math.hypot(hx, hy, hz) || 1;
      setSmallHeading(SHIP_BASE + s, (hx / hl) * dir, (hy / hl) * dir, (hz / hl) * dir);

      const glowTarget = active || fleet ? 1.5 : pinned ? 0.3 : focusCluster !== null ? 0.6 : 1;
      SHIP_GLOW[s] += (glowTarget - SHIP_GLOW[s]) * fShip;
      SHIP_SELECT[s] += ((chased ? 1 : active ? 0.7 : 0) - SHIP_SELECT[s]) * fSelect;
      setSmallState(SHIP_BASE + s, SHIP_GLOW[s], SHIP_SELECT[s], thrust);

      const tail = Math.max(t0, Math.min(t1, t - dir * WAKE_LENGTH * (t1 - t0) * thrust));
      setLineRange(WAKE_BASE + s, tail, t);
      setLineIntensity(WAKE_BASE + s, 0.95 * Math.sqrt(thrust) * Math.min(SHIP_GLOW[s], 1.2) * enterCraft);
    }

    // ── The star dims a little while a system is in focus ──
    SUN.glow += ((pinned ? 0.4 : focusCluster !== null ? 0.7 : 1) - SUN.glow) * (1 - Math.exp(-dt * 4));
    setBigState(0, SUN.glow, 0);

    // ── Domain glows follow the focus; switched off from tier 2 down ──
    const atmosOn = ATMOS_ENABLED && GOV.tier < 2 ? 1 : 0;
    GLOW_UNIFORMS.uAtmos.value += (atmosOn - GLOW_UNIFORMS.uAtmos.value) * (1 - Math.exp(-dt * 3));
    for (let c = 0; c <= CLUSTER_COUNT; c++) {
      let target: number;
      if (c === CLUSTER_COUNT) target = focusCluster === null ? 0.16 : 0.1;
      else if (focusCluster === null) target = 0.12;
      else target = focusCluster === c ? 0.26 : 0.03;
      ATMOS[c] += (target - ATMOS[c]) * (1 - Math.exp(-dt * 4));
      setGlow(c, ATMOS[c]);
    }

    // ── Line brightness mirrors the focus state ──
    const fLine = 1 - Math.exp(-dt * 8);
    const lineDim = pinned ? 0.03 : 0.06;
    for (let c = 0; c < CLUSTER_COUNT; c++) {
      for (let o = 0; o < 2; o++) {
        const line = ORBIT_BASE + c * 2 + o;
        let target: number;
        if (activeNode !== null && !IS_HUB[activeNode] && CLUSTER_OF[activeNode] === c && NODES[activeNode].orbit === o)
          target = 0.95;
        else if (focusCluster === null) target = 0.36;
        else target = focusCluster === c ? 0.62 : lineDim;
        LINE_INT[line] += (target - LINE_INT[line]) * fLine;
        setLineIntensity(line, LINE_INT[line]);
      }
    }
    for (let i = 0; i < NODE_COUNT; i++) {
      if (IS_HUB[i]) continue;
      setLineIntensity(TRAIL_OF_NODE[i], 0.7 * Math.min(GLOW[i], 1.2) * CLUSTER_RATE[CLUSTER_OF[i]] * enterLeaf);
    }
    for (let l = 0; l < LANE_COUNT; l++) {
      const line = LANE_BASE + l;
      const target = fleet || activeShip !== null ? 0.6 : focusCluster === null ? 0.3 : lineDim;
      LINE_INT[line] += (target - LINE_INT[line]) * fLine;
      setLineIntensity(line, LINE_INT[line]);
    }

    // ── Camera: frame the pinned target in the left-centre third (the detail
    // card docks on the right); otherwise return home. The visitor's zoom
    // multiplies how close it sits in both cases ──
    const cam = state.camera;
    const aspect = size.width / size.height;
    const zoom = ZOOM.target;
    ZOOM.kick = Math.max(0, ZOOM.kick - dt);
    CLOSE.k = pinned && ZOOM.max > 1.01 ? clamp01((zoom - 1) / (ZOOM.max - 1)) : 0;
    const homeZ = Math.max(HOME_Z, NEAR_PLANE_Z + (HALF_SPAN_X * FOCAL_F) / aspect);
    let fogShift = homeZ / zoom - HOME_Z;
    if ((zoomTarget !== null || chaseShip !== null) && spin.current) {
      if (chaseShip !== null) {
        PROJ_VEC.set(SHIP_POS[chaseShip * 3], SHIP_POS[chaseShip * 3 + 1], SHIP_POS[chaseShip * 3 + 2]);
      } else {
        const i = zoomTarget as number;
        // Frame a moon part-way towards its planet so the system stays in shot
        // (a moon at the edge of its orbit would otherwise push the rest
        // off-stage); a close-up centres on the moon itself.
        const h = CLUSTER_HUB[CLUSTER_OF[i]];
        const w = IS_HUB[i] ? 1 : 0.62 + 0.38 * CLOSE.k;
        PROJ_VEC.set(
          NODE_POSITIONS[i * 3] * w + NODE_POSITIONS[h * 3] * (1 - w),
          NODE_POSITIONS[i * 3 + 1] * w + NODE_POSITIONS[h * 3 + 1] * (1 - w),
          NODE_POSITIONS[i * 3 + 2] * w + NODE_POSITIONS[h * 3 + 2] * (1 - w),
        );
      }
      spin.current.updateWorldMatrix(true, false);
      spin.current.localToWorld(PROJ_VEC);
      const nx = -0.28;
      const ny = 0.04 * (1 - CLOSE.k);
      // Narrow stages keep a little more distance so the system clears the card.
      const dist = (zoomDist * Math.min(1.35, Math.max(1, 1.6 / aspect))) / zoom;
      CAM_TARGET.set(
        PROJ_VEC.x - (nx * dist * aspect) / FOCAL_F,
        PROJ_VEC.y - (ny * dist) / FOCAL_F,
        PROJ_VEC.z + dist,
      );
      fogShift = dist - CLEAR_DEPTH;
    } else {
      // Before the entrance the camera holds further back, then pushes in with it.
      const z = homeZ / zoom + (ENTER.t > 0 ? 0 : ENTER_DOLLY);
      // Zooming keeps the point under the pointer where it was.
      const travel = homeZ - homeZ / zoom;
      CAM_TARGET.set((ZOOM.nx * aspect * travel) / FOCAL_F, (ZOOM.ny * travel) / FOCAL_F, z);
      // Hovering a far system lifts the fog off it (last frame's depth is plenty).
      if (focusCluster !== null) {
        fogShift = Math.max(fogShift, PICK_DEPTH[CLUSTER_HUB[focusCluster]] - CLEAR_DEPTH);
      }
    }
    const camTime =
      ZOOM.kick > 0
        ? CAM_TIME_ZOOM
        : zoomTarget !== null || chaseShip !== null
          ? CAM_TIME_IN
          : ENTER.done
            ? CAM_TIME_OUT
            : CAM_TIME_ENTER;
    springAxis('x', cam.position, CAM_TARGET.x, camTime, dt);
    springAxis('y', cam.position, CAM_TARGET.y, camTime, dt);
    springAxis('z', cam.position, CAM_TARGET.z, camTime, dt);

    // ── Click shockwave: a new pin sends one ripple out through the system ──
    const pinKey = chaseShip !== null ? -1 : (zoomTarget ?? -1);
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
    // the orbit, the tilt and the camera so the planes separate ──
    FOG.shift += (fogShift - FOG.shift) * (1 - Math.exp(-dt * 4));
    SHARED.uFogNear.value = FOG_NEAR + FOG.shift;
    SHARED.uFogFar.value = FOG_FAR + FOG.shift;
    STAR_DRIFT.set(
      yaw * 0.16 + tiltY * 0.3 + cam.position.x * 0.02,
      -tiltX * 0.3 + cam.position.y * 0.02,
      (homeZ - cam.position.z) * 0.012,
    );
    updateNebula(dt, pinned ? 0.6 : 0.95);

    // ── Project everything to CSS px (feeds the picker, the labels and the
    // draw order), then place the labels. Planets are always labelled; moons
    // only while their system is focused (or the moon itself is active), so the
    // field stays legible ──
    if (!spin.current) return;
    spin.current.updateWorldMatrix(true, false);
    MODEL_VIEW.multiplyMatrices(cam.matrixWorldInverse, spin.current.matrixWorld);
    const pe = cam.projectionMatrix.elements;
    VIEW.w = size.width;
    VIEW.h = size.height;
    VIEW.p0 = pe[0];
    VIEW.p5 = pe[5];
    VIEW.p8 = pe[8];
    VIEW.p9 = pe[9];
    const pxPerUnit = FOCAL_F * size.height * 0.5;
    const interactive = !ORBIT.dragging;

    // The star lights everything: hand its view-space position to the shaders.
    const mve = MODEL_VIEW.elements;
    SHARED.uSunView.value.set(mve[12], mve[13], mve[14]);

    // Large bodies first: their footprints decide which small bodies they cover.
    project(0, 0, 0);
    BIG_DEPTH[0] = PROJ.depth;
    BIG_X[0] = PROJ.x;
    BIG_Y[0] = PROJ.y;
    BIG_R[0] = PROJ.front ? (SUN_RADIUS * pxPerUnit) / PROJ.depth : 0;
    for (let c = 0; c < CLUSTER_COUNT; c++) {
      const cluster = CLUSTERS[c];
      project(cluster.center[0], cluster.center[1], cluster.center[2]);
      BIG_DEPTH[1 + c] = PROJ.depth;
      BIG_X[1 + c] = PROJ.x;
      BIG_Y[1 + c] = PROJ.y;
      // A planet the camera is flying through has faded out: it covers nothing.
      BIG_R[1 + c] =
        PROJ.front && PROJ.depth > NEAR_FADE_BIG[0]
          ? (cluster.radius * PLANET_COVER[cluster.planet] * pxPerUnit) / PROJ.depth
          : 0;
      AXIS_UP[c] = mve[1] * cluster.axis[0] + mve[5] * cluster.axis[1] + mve[9] * cluster.axis[2] < 0 ? -1 : 1;
    }

    for (let s = 0; s < SAT_COUNT; s++) {
      const sat = SATELLITES[s];
      const c = CLUSTERS[sat.cluster];
      const ang = sat.phase + sat.speed * time;
      const cs = Math.cos(ang) * sat.radius;
      const sn = Math.sin(ang) * sat.radius;
      project(
        c.center[0] + sat.u[0] * cs + sat.v[0] * sn,
        c.center[1] + sat.u[1] * cs + sat.v[1] * sn,
        c.center[2] + sat.u[2] * cs + sat.v[2] * sn,
      );
      SMALL_DEPTH[SAT_BASE + s] = PROJ.depth;
      SMALL_BEHIND[SAT_BASE + s] = PROJ.front ? coveredByBig(PROJ.x, PROJ.y, PROJ.depth, 2) : 0;
    }

    let sweep = 0;
    let waiting = 0;
    for (let i = 0; i < NODE_COUNT; i++) {
      project(NODE_POSITIONS[i * 3], NODE_POSITIONS[i * 3 + 1], NODE_POSITIONS[i * 3 + 2]);
      const depth = PROJ.depth;
      const inFront = PROJ.front === 1;
      const sx = PROJ.x;
      const sy = PROJ.y;
      const rPx = inFront ? (NODE_RADIUS[i] * pxPerUnit) / depth : 0;
      const isHub = IS_HUB[i] === 1;
      // How much of the body is left this close to the camera (1 = all of it).
      const nearK = inFront ? nearFade(isHub ? NEAR_FADE_BIG : NEAR_FADE_SMALL, depth) : 0;
      // A moon behind its planet's disc cannot be picked (planets precede their
      // moons in NODES, so the planet's projection is already fresh here).
      let pickable = inFront && nearK > 0.5;
      let eclipsed = false;
      if (pickable && !isHub) {
        const h = CLUSTER_HUB[CLUSTER_OF[i]];
        if (depth > PICK_DEPTH[h] && Math.hypot(sx - SCREEN[h * 3], sy - SCREEN[h * 3 + 1]) < PICK_RPX[h]) {
          pickable = false;
          eclipsed = true;
        }
      }
      SCREEN[i * 3] = sx;
      SCREEN[i * 3 + 1] = sy;
      SCREEN[i * 3 + 2] = pickable ? 1 : 0;
      PICK_DEPTH[i] = depth;
      PICK_RPX[i] = rPx;
      if (!isHub) {
        SMALL_DEPTH[MOON_SLOT[i]] = depth;
        SMALL_BEHIND[MOON_SLOT[i]] = inFront ? coveredByBig(sx, sy, depth, rPx) : 0;
      }

      if (!LABEL_ELS[i]) continue;
      const inFocus = focusCluster === null || CLUSTER_OF[i] === focusCluster;
      let opacity: number;
      if (!inFront || ORBIT.dragging) opacity = isHub && inFront ? 0.5 : 0;
      else if (i === activeNode) opacity = 1;
      else if (isHub) opacity = inFocus ? 0.95 : 0.3;
      else opacity = focusCluster !== null && inFocus ? 0.9 : 0;
      opacity *= (isHub ? enterHub : enterLeaf) * nearK;
      // A moon behind its planet takes its name with it (it would float on the globe).
      if (eclipsed && i !== activeNode) opacity = 0;
      // Depth cue: labels on the far side recede with their bodies — but never the
      // active one, nor the focused system's (those must stay fully legible).
      if (i !== activeNode && opacity > 0 && CLUSTER_OF[i] !== focusCluster) {
        const near = (depthFade(depth) - FOG_FLOOR) / (1 - FOG_FLOOR);
        opacity *= (isHub ? 0.62 : 0.55) + (isHub ? 0.38 : 0.45) * near;
      }

      // Anchor: planets carry their label above the globe, hugging it at every
      // zoom. Moons hang theirs on their outward side (away from the planet), so
      // labels fan out around the system instead of piling up. Both always sit
      // clear of the selection reticle, selected or not: a label that stepped
      // aside on hover would slide out from under the pointer.
      let mode = ANCHOR_ABOVE;
      let ax = sx;
      let ay = sy;
      if (isHub) {
        // In a close-up the globe outgrows the stage: its label stays on it.
        ay = Math.max(sy - rPx * HUB_LABEL_CLEAR - 6, HUB_LABEL_H + 14);
      } else {
        const h = CLUSTER_HUB[CLUSTER_OF[i]] * 3;
        const dx = sx - SCREEN[h];
        const dy = sy - SCREEN[h + 1];
        // A selected moon carries a reticle at 2.3 radii.
        const gap = rPx * 2.6 + 6;
        if (Math.abs(dx) >= Math.abs(dy)) {
          mode = dx >= 0 ? ANCHOR_RIGHT : ANCHOR_LEFT;
          ax = dx >= 0 ? sx + gap : sx - gap;
        } else {
          mode = dy >= 0 ? ANCHOR_BELOW : ANCHOR_ABOVE;
          ay = dy >= 0 ? sy + gap : sy - gap;
        }
        // A moon low in a close-up would hang its label in the legend's band,
        // where it has to be hidden: carry it on the moon's side instead, so a
        // focused system never shows an unnamed moon.
        if (mode === ANCHOR_BELOW && ay + LEAF_LABEL_H > size.height - LEGEND_BAND) {
          mode = dx >= 0 ? ANCHOR_RIGHT : ANCHOR_LEFT;
          ax = dx >= 0 ? sx + gap : sx - gap;
          ay = sy;
        }
      }

      const w = LBL_W[i];
      const hgt = isHub ? HUB_LABEL_H : LEAF_LABEL_H;
      // Keep the whole label on the stage (a close-up pushes outer moons to its edge).
      if (opacity > 0) {
        const left = labelLeft(mode, ax, w);
        if (left < STAGE_PAD) ax += STAGE_PAD - left;
        else if (left + w > size.width - STAGE_PAD) ax -= left + w - (size.width - STAGE_PAD);
      }
      // A label that drifts into the legend's band (a close-up can push a
      // neighbouring system down there) would ghost behind the chips: hide it.
      if (i !== activeNode && labelTop(mode, ay, hgt) + hgt > size.height - LEGEND_BAND) opacity = 0;
      // So would one in the strip at the top, where the scene has faded out.
      if (!isHub && i !== activeNode && labelTop(mode, ay, hgt) < TOP_BAND) opacity = 0;
      // Anything that would sit under the pinned detail card is hidden.
      if (opacity > 0 && CARD.on) {
        const left = labelLeft(mode, ax, w);
        const top = labelTop(mode, ay, hgt);
        if (left < CARD.right && left + w > CARD.left && top < CARD.bottom && top + hgt > CARD.top) {
          opacity = 0;
        }
      }
      // The focused system's moon labels go through the collision pass below.
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
      // Another system's planet label is written after that pass: it gives way
      // to the focused moons' labels instead of ghosting underneath them.
      if (isHub && opacity > 0 && focusCluster !== null && CLUSTER_OF[i] !== focusCluster && i !== activeNode) {
        HUB_WAIT_I[waiting] = i;
        HUB_WAIT_OP[waiting] = opacity;
        HUB_WAIT_X[waiting] = ax;
        HUB_WAIT_Y[waiting] = ay;
        waiting++;
        continue;
      }
      writeLabel(i, opacity, interactive, mode, ax, ay);
    }

    // ── Ships: projection, pick target and the label that names the project ──
    for (let s = 0; s < SHIP_COUNT; s++) {
      const ship = SHIPS[s];
      const phase = (SHIP_TIME[s] / ship.period + ship.offset) % 1;
      const o = s * CURVE_STRIDE;
      const t = SHIP_CURVES[o + 9] + (SHIP_CURVES[o + 10] - SHIP_CURVES[o + 9]) * (0.5 - 0.5 * Math.cos(phase * TAU));
      const k = 1 - t;
      project(
        k * k * SHIP_CURVES[o] + 2 * k * t * SHIP_CURVES[o + 3] + t * t * SHIP_CURVES[o + 6],
        k * k * SHIP_CURVES[o + 1] + 2 * k * t * SHIP_CURVES[o + 4] + t * t * SHIP_CURVES[o + 7],
        k * k * SHIP_CURVES[o + 2] + 2 * k * t * SHIP_CURVES[o + 5] + t * t * SHIP_CURVES[o + 8],
      );
      const p = NODE_COUNT + s;
      const inFront = PROJ.front === 1;
      // On-screen half-length of the hull.
      const rPx = inFront ? Math.max(SHIP_MIN_PX, (ship.size * pxPerUnit) / PROJ.depth) : 0;
      const nearK = inFront ? nearFade(NEAR_FADE_SMALL, PROJ.depth) : 0;
      SCREEN[p * 3] = PROJ.x;
      SCREEN[p * 3 + 1] = PROJ.y;
      SCREEN[p * 3 + 2] = inFront && nearK > 0.5 && enterCraft > 0.5 ? 1 : 0;
      PICK_DEPTH[p] = PROJ.depth;
      PICK_RPX[p] = rPx;
      SMALL_DEPTH[SHIP_BASE + s] = PROJ.depth;
      SMALL_BEHIND[SHIP_BASE + s] = inFront ? coveredByBig(PROJ.x, PROJ.y, PROJ.depth, rPx) : 0;

      let opacity = !inFront || ORBIT.dragging ? 0 : activeShip === s || chaseShip === s ? 1 : fleet ? 0.92 : 0;
      opacity *= nearK;
      // Above the hull, clear of its reticle (1.55 half-lengths).
      const ay = PROJ.y - rPx * 1.7 - 6;
      const half = LBL_W[p] / 2;
      const ax = Math.max(STAGE_PAD + half, Math.min(size.width - STAGE_PAD - half, PROJ.x));
      if (opacity > 0 && CARD.on) {
        const left = ax - half;
        const top = ay - LEAF_LABEL_H;
        if (left < CARD.right && left + LBL_W[p] > CARD.left && top < CARD.bottom && ay > CARD.top) opacity = 0;
      }
      writeLabel(p, opacity * enterCraft, interactive, ANCHOR_ABOVE, ax, ay);
    }

    // ── Moon-label collision pass (focused system only, ≤ 9 labels) ──
    // Labels above the planet are pushed further up (the planet's own label is
    // their first obstacle), labels below it further down — always away from it.
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
      // Below the planet: top-to-bottom, each label drops under any earlier one it overlaps.
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
      // Above the planet: bottom-to-top, each label rises over the planet's label
      // and any earlier (lower) one it overlaps.
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
        // A label the pass pushed down into the legend's band is dropped.
        if (SW_I[j] !== activeNode && SW_TOP[j] + LEAF_LABEL_H > size.height - LEGEND_BAND) SW_OP[j] = 0;
        if (SW_I[j] !== activeNode && SW_TOP[j] < TOP_BAND) SW_OP[j] = 0;
        writeLabel(SW_I[j], SW_OP[j], interactive, SW_MODE[j], SW_X[j], anchorY(SW_MODE[j], SW_TOP[j], LEAF_LABEL_H));
      }
    }
    for (let a = 0; a < waiting; a++) {
      const i = HUB_WAIT_I[a];
      const left = HUB_WAIT_X[a] - LBL_W[i] / 2 - LABEL_GAP;
      const right = left + LBL_W[i] + LABEL_GAP * 2;
      const top = HUB_WAIT_Y[a] - HUB_LABEL_H - LABEL_GAP;
      const bottom = HUB_WAIT_Y[a] + LABEL_GAP;
      let opacity = HUB_WAIT_OP[a];
      for (let j = 0; j < sweep && opacity > 0; j++) {
        if (SW_OP[j] <= 0) continue;
        const jLeft = labelLeft(SW_MODE[j], SW_X[j], LBL_W[SW_I[j]]);
        if (jLeft < right && jLeft + LBL_W[SW_I[j]] > left && SW_TOP[j] < bottom && SW_TOP[j] + LEAF_LABEL_H > top) {
          opacity = 0;
        }
      }
      writeLabel(i, opacity, interactive, ANCHOR_ABOVE, HUB_WAIT_X[a], HUB_WAIT_Y[a]);
    }

    // ── Upload: bodies ranked back to front, lines only if something changed ──
    uploadBodies();
    flushLines();
  });

  return (
    <>
      {/* Shared module-scope objects — dispose={null} so a gate remount can't free them. */}
      <primitive object={NEBULA_MESH} dispose={null} />
      <primitive object={STAR_POINTS} dispose={null} />
      <group ref={parallax}>
        <group ref={spin}>
          <primitive object={LINE_MESH} dispose={null} />
          {/* Picking is done in screen space by the stage (see pickAtPoint), not by
              the R3F raycaster, so an overlapping moon can't steal a planet. */}
          {BODY_MESHES.map((mesh) => (
            <primitive key={mesh.uuid} object={mesh} dispose={null} />
          ))}
        </group>
      </group>
    </>
  );
}

interface SkillsConstellationProps {
  active: boolean;
  /**
   * @deprecated No longer called — the scene announces its own selection through
   * an internal live region. Kept optional so existing callers compile.
   */
  onFocusChange?: (cluster: number | null, skill: string | null) => void;
  /** One-shot from the gate: the stage is properly on screen, the entrance may play. */
  entered?: boolean;
  /** Unrecoverable GPU failure (lost context, shader link error) → show the cards. */
  onFail?: () => void;
}

const noop = () => {};

/**
 * The overlay has no plates or boxes: its text sits straight on the scene, and
 * this dark halo is what keeps it legible over a bright nebula or a lit globe.
 */
const TEXT_HALO =
  '[text-shadow:0_0_3px_#050814,0_0_8px_#050814,0_0_16px_rgba(5,8,20,0.9),0_1px_2px_#050814]';
const LEGEND_ITEM = `inline-flex min-h-[44px] items-center gap-2 rounded-md px-2.5 font-mono text-xs transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-brand ${TEXT_HALO}`;

export default function SkillsConstellation({
  active,
  entered = true,
  onFail,
}: SkillsConstellationProps) {
  const [hover, setHover] = useState<Sel | null>(null);
  const [pin, setPin] = useState<Pin | null>(null);
  const [dragging, setDragging] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [zoomMax, setZoomMax] = useState(ZOOM_MAX_FREE);
  const [wheelHint, setWheelHint] = useState(false);
  const { openProject } = useProjectModal();
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const lastHover = useRef<number>(-1);
  const wheelHinted = useRef(false);
  const hintId = useId();
  // Rare, one-shot state: quality tier (governor), DPR cap, first-frame fade-in.
  const [tier, setTier] = useState(() => GOV.tier);
  const [dprCap, setDprCap] = useState(() => TIER_DPR[GOV.tier]);
  const [shown, setShown] = useState(false);
  const handleShown = useCallback(() => setShown(true), []);
  const fail = onFail ?? noop;

  // A hovered ship (or the fleet chip) never changes which domain is in focus:
  // the pinned system stays lit underneath it.
  const hoverFocus = hover && (hover.kind === 'node' || hover.kind === 'cluster') ? hover : null;
  const pinFocus = pin && pin.kind !== 'ship' ? pin : null;
  const sel = hoverFocus ?? pinFocus;
  const focusCluster = sel ? (sel.kind === 'cluster' ? sel.i : CLUSTER_OF[sel.i]) : null;
  const activeNode = sel && sel.kind === 'node' ? sel.i : null;
  const activeShip = hover?.kind === 'ship' ? hover.i : null;
  const chaseShip = pin?.kind === 'ship' ? pin.i : null;
  const fleet = hover?.kind === 'fleet';
  const pinned = pin !== null;
  const pinnedNode = pin?.kind === 'node' ? pin.i : null;

  let zoomTarget: number | null = null;
  // Camera distance from the framed point: a whole system (planet or legend
  // pin) sits further back than a single moon or a ship.
  let zoomDist = ZOOM_DIST_SYSTEM;
  if (pin) {
    if (pin.kind === 'ship') {
      zoomDist = ZOOM_DIST_SHIP;
    } else if (pin.kind === 'node') {
      zoomTarget = pin.i;
      zoomDist = IS_HUB[pin.i] ? ZOOM_DIST_SYSTEM : ZOOM_DIST_MOON;
    } else {
      zoomTarget = CLUSTER_HUB[pin.i];
    }
  }

  let cardData: SkillCardData | null = null;
  if (pin) {
    if (pin.kind === 'ship') {
      const project = projects[SHIPS[pin.i].project];
      cardData = {
        kind: 'project',
        title: project.title,
        domainLabel: 'Shipped project',
        color: '#34D399',
        glyph: 'circle',
        blurb: project.tagline ?? project.description,
        tech: project.tech,
      };
    } else if (pin.kind === 'node') {
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
  const announcement =
    activeShip !== null
      ? `Project ship: ${SHIPS[activeShip].label}. Press Enter to fly alongside it.`
      : chaseShip !== null
        ? `Flying alongside ${SHIPS[chaseShip].label}. Press Enter to open the project.`
      : fleet
        ? `${SHIP_COUNT} ships, one for each shipped project.`
        : activeSkill
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

  // ── Zoom: one setter for the buttons, the keys and the wheel ──
  const applyZoom = useCallback((next: number, nx?: number, ny?: number) => {
    const z = Math.min(ZOOM.max, Math.max(ZOOM_MIN, next));
    ZOOM.target = z;
    if (nx !== undefined && ny !== undefined) {
      ZOOM.nx = nx;
      ZOOM.ny = ny;
    }
    ZOOM.kick = 0.5;
    ORBIT.idle = 0;
    setZoom(z);
  }, []);
  // A new pin (or closing one) starts from its canonical framing, unless the
  // caller dives straight in. Each kind of pin has its own zoom range.
  const changePin = useCallback((next: Pin | null, dive = false) => {
    ZOOM.max = zoomMaxFor(next);
    ZOOM.target = dive && next ? ZOOM.max : 1;
    ORBIT.idle = 0;
    setZoomMax(ZOOM.max);
    setZoom(ZOOM.target);
    setPin(next);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        changePin(null);
        setHover(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [changePin]);

  // Ctrl/⌘ + wheel (and trackpad pinch, which arrives as a ctrl-wheel) zooms; a
  // plain wheel keeps scrolling the page. Native listener: React's is passive,
  // so it could not stop the browser's own page zoom.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let timer: number | undefined;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        if (!wheelHinted.current) {
          wheelHinted.current = true;
          setWheelHint(true);
          timer = window.setTimeout(() => setWheelHint(false), 2200);
        }
        return;
      }
      e.preventDefault();
      const r = el.getBoundingClientRect();
      applyZoom(
        ZOOM.target * Math.exp(-e.deltaY * 0.0022),
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -(((e.clientY - r.top) / r.height) * 2 - 1),
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      window.clearTimeout(timer);
    };
  }, [applyZoom]);

  /** Hover by pick index: a node, a ship (NODE_COUNT + s), or nothing. */
  const onHoverPick = useCallback((i: number | null) => {
    if (i == null || i < 0) setHover(null);
    else if (i >= NODE_COUNT) setHover({ kind: 'ship', i: i - NODE_COUNT });
    else setHover({ kind: 'node', i });
  }, []);
  const onClickNode = useCallback(
    (i: number) => changePin(pin?.kind === 'node' && pin.i === i ? null : { kind: 'node', i }),
    [pin, changePin],
  );
  const onLegendEnter = useCallback((i: number) => setHover({ kind: 'cluster', i }), []);
  const onLegendLeave = useCallback(() => setHover(null), []);
  const onLegendClick = useCallback(
    (i: number) => changePin(pin?.kind === 'cluster' && pin.i === i ? null : { kind: 'cluster', i }),
    [pin, changePin],
  );

  const handleOpenProject = useCallback(
    (label: string) => {
      const proj = projects.find((p) => p.title === label);
      // The chip that was clicked unmounts with the card, so park focus on the
      // stage first: the modal then returns focus there when it closes.
      if (proj) stageRef.current?.focus({ preventScroll: true });
      if (proj) openProject(proj);
      changePin(null); // hand off: zoom back out as the project modal takes over
      setHover(null);
    },
    [openProject, changePin],
  );
  // Clicking a ship flies alongside it (its panel opens the project).
  const onClickShip = useCallback(
    (s: number) => changePin(pin?.kind === 'ship' && pin.i === s ? null : { kind: 'ship', i: s }),
    [pin, changePin],
  );

  // ── Stage pointer handling: screen-space picking + drag-to-orbit ──
  const pickAt = useCallback((clientX: number, clientY: number) => {
    const el = stageRef.current;
    if (!el) return -1;
    const r = el.getBoundingClientRect();
    return pickAtPoint(clientX - r.left, clientY - r.top);
  }, []);
  const onStageDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // Pressing on the globe of the planet that is open grabs it: the drag then
    // turns the globe instead of the whole system.
    GRAB.cluster = -1;
    if (pin && pin.kind !== 'ship') {
      const c = pin.kind === 'cluster' ? pin.i : CLUSTER_OF[pin.i];
      const hub = CLUSTER_HUB[c];
      const r = e.currentTarget.getBoundingClientRect();
      const dx = e.clientX - r.left - SCREEN[hub * 3];
      const dy = e.clientY - r.top - SCREEN[hub * 3 + 1];
      if (SCREEN[hub * 3 + 2] > 0.5 && Math.hypot(dx, dy) < PICK_RPX[hub]) {
        GRAB.cluster = c;
        SPIN_VEL[c] = 0;
      }
    }
    ORBIT.dragging = true;
    ORBIT.moved = false;
    ORBIT.lastX = e.clientX;
    ORBIT.lastY = e.clientY;
    ORBIT.lastT = performance.now();
    ORBIT.vYaw = 0;
    ORBIT.vPitch = 0;
    ORBIT.idle = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
    },
    [pin],
  );
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
        if (GRAB.cluster >= 0) {
          const c = GRAB.cluster;
          const dSpin = dx * SPIN_RATE * AXIS_UP[c];
          SPIN[c] += dSpin;
          SPIN_VEL[c] = (dSpin * 1000) / dtMs;
          ORBIT.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, ORBIT.pitch + dy * DRAG_PITCH * 0.5));
          ORBIT.lastX = e.clientX;
          ORBIT.lastY = e.clientY;
          ORBIT.lastT = now;
          ORBIT.idle = 0;
          return;
        }
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
        onHoverPick(i);
      }
    },
    [pickAt, onHoverPick],
  );
  const onStageUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!ORBIT.dragging) return;
    ORBIT.dragging = false;
    GRAB.cluster = -1;
    ORBIT.idle = 0;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (ORBIT.moved) setDragging(false);
  }, []);
  const onStageLeave = useCallback(() => {
    if (ORBIT.dragging) return; // pointer capture keeps the drag alive
    lastHover.current = -1;
    onHoverPick(null);
  }, [onHoverPick]);
  // Keyboard focus leaving the stage must not leave a body "hovered" (dimmed field).
  const onStageBlur = useCallback(() => {
    lastHover.current = -1;
    onHoverPick(null);
  }, [onHoverPick]);
  const onStageClick = useCallback(
    (e: React.MouseEvent) => {
      if (ORBIT.moved) {
        // A drag just ended — swallow the synthetic click so it doesn't unpin.
        ORBIT.moved = false;
        return;
      }
      const i = pickAt(e.clientX, e.clientY);
      if (i === -1) changePin(null);
      else if (i >= NODE_COUNT) onClickShip(i - NODE_COUNT);
      else onClickNode(i);
    },
    [pickAt, onClickNode, onClickShip, changePin],
  );

  // Double-click dives straight into a close-up of whatever is under the
  // pointer (the two clicks before it have toggled the pin on and off again).
  const onStageDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const i = pickAt(e.clientX, e.clientY);
      if (i === -1) return;
      changePin(i >= NODE_COUNT ? { kind: 'ship', i: i - NODE_COUNT } : { kind: 'node', i }, true);
    },
    [pickAt, changePin],
  );

  // ── Keyboard: arrows step through bodies / domains, Enter opens, +/- zoom, Escape closes ──
  const onStageKey = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const current =
        activeShip !== null
          ? NODE_COUNT + activeShip
          : (activeNode ??
            (pin?.kind === 'cluster' ? CLUSTER_HUB[pin.i] : pin?.kind === 'ship' ? NODE_COUNT + pin.i : -1));
      let next: number | null = null;
      switch (e.key) {
        case 'ArrowRight':
          next = current < 0 ? CLUSTER_HUB[0] : (current + 1) % PICK_COUNT;
          break;
        case 'ArrowLeft':
          next = current < 0 ? CLUSTER_HUB[0] : (current - 1 + PICK_COUNT) % PICK_COUNT;
          break;
        case 'ArrowDown':
        case 'ArrowUp': {
          const dir = e.key === 'ArrowDown' ? 1 : -1;
          const c =
            current < 0 || current >= NODE_COUNT
              ? 0
              : (CLUSTER_OF[current] + dir + CLUSTER_COUNT) % CLUSTER_COUNT;
          next = CLUSTER_HUB[c];
          break;
        }
        case 'Home':
          next = CLUSTER_HUB[0];
          break;
        case 'Enter':
        case ' ':
          if (chaseShip !== null && (current < 0 || current === NODE_COUNT + chaseShip)) {
            // Already alongside this ship: Enter opens its project.
            e.preventDefault();
            handleOpenProject(SHIPS[chaseShip].label);
          } else if (current >= 0) {
            e.preventDefault();
            if (current >= NODE_COUNT) onClickShip(current - NODE_COUNT);
            else onClickNode(current);
          }
          return;
        case '+':
        case '=':
          e.preventDefault();
          applyZoom(ZOOM.target * ZOOM_STEP);
          return;
        case '-':
        case '_':
          e.preventDefault();
          applyZoom(ZOOM.target / ZOOM_STEP);
          return;
        case '0':
          e.preventDefault();
          applyZoom(1);
          return;
        default:
          return;
      }
      e.preventDefault();
      ORBIT.idle = 0;
      onHoverPick(next);
    },
    [activeNode, activeShip, chaseShip, pin, onClickNode, onClickShip, onHoverPick, applyZoom, handleOpenProject],
  );

  const cursor = dragging
    ? 'cursor-grabbing'
    : hover?.kind === 'node' || hover?.kind === 'ship'
      ? 'cursor-pointer'
      : 'cursor-grab';
  const zoomButton =
    'flex h-11 w-11 items-center justify-center rounded-full text-cyber-secondary transition-colors duration-200 hover:bg-white/10 hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-brand disabled:pointer-events-none disabled:opacity-30';

  return (
    <div ref={rootRef} className="relative w-full h-full">
      {/* touch-pan-y: a vertical swipe still scrolls the page on touch laptops and
          tablets; horizontal drags orbit. */}
      <div
        ref={stageRef}
        role="group"
        tabIndex={0}
        aria-label="Interactive 3D map of skills: each domain is a planet, each skill a moon, each project a ship"
        aria-describedby={hintId}
        className={`peer absolute inset-0 touch-pan-y select-none focus-visible:!outline-none ${cursor}`}
        onPointerDown={onStageDown}
        onPointerMove={onStageMove}
        onPointerUp={onStageUp}
        onPointerCancel={onStageUp}
        onPointerLeave={onStageLeave}
        onClick={onStageClick}
        onDoubleClick={onStageDoubleClick}
        onKeyDown={onStageKey}
        onBlur={onStageBlur}
      >
        {/* Fades in on the first drawn frame, so the canvas never pops in. The
            mask feathers the top and bottom over a long run, so the scene has no
            edge: the sky thins out into the page, and a close-up planet or
            orbit dissolves instead of being cut. */}
        <div
          className={`h-full w-full transition-opacity duration-[400ms] ease-out [mask-image:linear-gradient(to_bottom,transparent,rgba(0,0,0,0.5)_7%,black_17%,black_80%,rgba(0,0,0,0.5)_91%,transparent)] ${
            shown ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <Canvas
            frameloop={active ? 'always' : 'never'}
            dpr={dprCap}
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
              // three does not throw on a GLSL compile/link failure — it logs and
              // draws nothing — so the error boundary would never see it.
              gl.debug.onShaderError = (ctx, program, vs, fs) => {
                if (process.env.NODE_ENV !== 'production') {
                  console.error(
                    'Skills star system shader failed — falling back to cards.',
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
              activeShip={activeShip}
              fleet={fleet}
              zoomTarget={zoomTarget}
              zoomDist={zoomDist}
              pinned={pinned}
              pinnedNode={pinnedNode}
              chaseShip={chaseShip}
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
        Drag to rotate; drag an open planet to turn its globe. Use the left and right arrow
        keys to step through planets, moons and ships, up and down to jump between domains,
        Enter to open details or fly alongside a ship, plus and minus to zoom into a close-up,
        and Escape to close.
      </p>
      {/* Keyboard focus indicator: no ring is drawn round the stage (it would box
          the scene in), so this line — a lit marker and the keys — is what shows
          that the stage has keyboard focus. */}
      <p
        aria-hidden="true"
        className={`pointer-events-none absolute left-4 top-12 z-10 whitespace-nowrap font-mono text-xs text-cyber-accent opacity-0 transition-opacity duration-200 peer-focus-visible:opacity-100 ${TEXT_HALO}`}
      >
        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-cyber-brand align-middle shadow-[0_0_8px_#34D399]" />
        <span className="text-cyber-brand">←→</span> step · <span className="text-cyber-brand">↑↓</span> domains ·{' '}
        <span className="text-cyber-brand">Enter</span> open · <span className="text-cyber-brand">+ −</span> zoom ·{' '}
        <span className="text-cyber-brand">Esc</span> close
      </p>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      {/* Zoom — the same control the +/- keys and Ctrl/⌘ + scroll drive. */}
      <div
        role="group"
        aria-label="Zoom"
        className="absolute right-3 top-10 z-10 flex items-center sm:right-5 sm:top-12"
      >
        <button
          type="button"
          aria-label="Zoom out"
          disabled={zoom <= ZOOM_MIN + 0.001}
          onClick={() => applyZoom(ZOOM.target / ZOOM_STEP)}
          className={zoomButton}
        >
          <Minus size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={`Reset zoom, currently ${zoom.toFixed(1)} times`}
          disabled={zoom <= ZOOM_MIN + 0.001}
          onClick={() => applyZoom(1)}
          className={`h-11 min-w-[3.25rem] rounded-full px-1 text-center font-mono text-xs tabular-nums text-cyber-accent transition-colors duration-200 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-brand disabled:pointer-events-none ${TEXT_HALO}`}
        >
          {zoom.toFixed(1)}×
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          disabled={zoom >= zoomMax - 0.001}
          onClick={() => applyZoom(ZOOM.target * ZOOM_STEP)}
          className={zoomButton}
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
      {/* One-shot: a plain scroll over the stage scrolls the page, so say how to zoom. */}
      <p
        aria-hidden="true"
        className={`pointer-events-none absolute left-1/2 top-14 z-10 -translate-x-1/2 whitespace-nowrap font-mono text-xs text-cyber-accent transition-opacity duration-300 ${TEXT_HALO} ${
          wheelHint ? 'opacity-100' : 'opacity-0'
        }`}
      >
        hold <span className="text-cyber-brand">Ctrl</span> or <span className="text-cyber-brand">⌘</span> and scroll to zoom
      </p>

      {/* Labels — positioned per frame by the scene (transform + opacity only).
          Planets are always readable; moons appear when their domain is in focus;
          a ship names its project while it is hovered. Decorative for AT (the
          section keeps an sr-only list), but clickable. */}
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
              onPointerEnter={() => onHoverPick(i)}
              onPointerLeave={() => onHoverPick(null)}
              onClick={(e) => {
                e.stopPropagation();
                onClickNode(i);
              }}
              style={{ opacity: 0, color: isPinned || isActive ? '#fff' : undefined }}
              className={`absolute left-0 top-0 inline-flex select-none items-center gap-1.5 whitespace-nowrap font-mono text-xs leading-none transition-[opacity,color] duration-200 ${TEXT_HALO} ${
                isHub ? 'px-2.5 py-1.5 font-semibold text-white' : 'px-2 py-1 text-cyber-secondary'
              }`}
            >
              {isHub && <ClusterGlyph shape={cluster.glyph} color={cluster.color} size={11} filled={isPinned || isActive} />}
              <span
                className={isPinned ? 'underline decoration-1 underline-offset-4' : undefined}
                style={isPinned ? { textDecorationColor: cluster.color } : undefined}
              >
                {n.label}
              </span>
              {isHub && (
                <span className="text-[11px] font-normal tabular-nums text-cyber-accent">
                  {CLUSTER_COUNTS[n.cluster]}
                </span>
              )}
            </button>
          );
        })}
        {SHIPS.map((ship, s) => {
          const isChased = chaseShip === s;
          const isActive = activeShip === s || isChased;
          return (
            <button
              key={ship.label}
              ref={LABEL_REFS[NODE_COUNT + s]}
              type="button"
              tabIndex={-1}
              onPointerEnter={() => onHoverPick(NODE_COUNT + s)}
              onPointerLeave={() => onHoverPick(null)}
              onClick={(e) => {
                e.stopPropagation();
                onClickShip(s);
              }}
              style={{ opacity: 0 }}
              className={`absolute left-0 top-0 inline-flex select-none items-center gap-1.5 whitespace-nowrap px-2 py-1 font-mono text-xs leading-none transition-[opacity,color] duration-200 ${TEXT_HALO} ${
                isActive ? 'text-white' : 'text-cyber-secondary'
              }`}
            >
              <Rocket size={11} className="text-cyber-brand" />
              {ship.label}
              {isActive && !isChased && <span className="text-cyber-brand">fly alongside →</span>}
            </button>
          );
        })}
      </div>

      {/* Detail card (docks on the right when a body/domain is pinned) */}
      <AnimatePresence>
        {cardData && (
          <SkillDetailCard
            key={cardData.title}
            data={cardData}
            onClose={() => changePin(null)}
            onOpenProject={handleOpenProject}
          />
        )}
      </AnimatePresence>

      {/* Legend — the four domains, then the fleet. It never moves: shifting it on
          a pin would slide a different domain under the pointer. */}
      <div
        className="absolute inset-x-0 bottom-1.5 z-10 flex flex-wrap items-center justify-center gap-x-1 px-3 sm:bottom-2.5 sm:gap-x-3 sm:px-4"
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
              className={`${LEGEND_ITEM} ${isActive ? 'text-white' : 'text-cyber-accent hover:text-white'}`}
            >
              <ClusterGlyph shape={c.glyph} color={c.color} size={12} filled={isActive} />
              <span
                className={`whitespace-nowrap underline decoration-1 underline-offset-[6px] ${
                  isActive ? 'decoration-cyber-brand' : 'decoration-transparent'
                }`}
              >
                {c.title}
              </span>
              <span className={`text-[11px] tabular-nums ${isActive ? 'text-cyber-brand' : 'text-cyber-accent/70'}`}>
                {CLUSTER_COUNTS[i]}
              </span>
            </button>
          );
        })}
        {/* The fleet: highlights every ship and names it; following it goes to Projects. */}
        <a
          href="#projects"
          onMouseEnter={() => setHover({ kind: 'fleet' })}
          onMouseLeave={onLegendLeave}
          onFocus={() => setHover({ kind: 'fleet' })}
          onBlur={onLegendLeave}
          className={`${LEGEND_ITEM} ${fleet ? 'text-white' : 'text-cyber-accent hover:text-white'}`}
        >
          <Rocket size={12} className="text-cyber-brand" aria-hidden="true" />
          <span
            className={`whitespace-nowrap underline decoration-1 underline-offset-[6px] ${
              fleet ? 'decoration-cyber-brand' : 'decoration-transparent'
            }`}
          >
            Shipped projects
          </span>
          <span className={`text-[11px] tabular-nums ${fleet ? 'text-cyber-brand' : 'text-cyber-accent/70'}`}>
            {SHIP_COUNT}
          </span>
        </a>
      </div>
    </div>
  );
}
