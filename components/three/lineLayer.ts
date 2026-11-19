import * as THREE from 'three';
import {
  CLUSTERS,
  CLUSTER_COUNT,
  CLUSTER_OF,
  CLUSTER_RGB,
  IS_HUB,
  NODES,
  NODE_COUNT,
  NODE_ENTER,
  SHIP_COUNT,
} from './constellationData';
import { PLANET_PHYSICS, helioState } from './orbitalMechanics';
import { FOG_GLSL, LAYER_MATERIAL, PING_GLSL, SHARED } from './sceneShared';

/*
 * Line layer — every orbit, route and trail as a screen-space ribbon in ONE
 * instanced draw call. An instance is either an ellipse (orbits, trails) or a
 * cubic Bezier (a ship's route and its wake), extruded to a constant pixel
 * width in the vertex shader:
 *
 *   planet orbit   the ellipse a planet rides round the star
 *   moon orbit     the ellipse a domain's moons ride round their planet; it
 *                  travels with the planet
 *   trail          a short arc behind a planet or a moon, bright at the head
 *   route          the dashed flight plan of a ship in transit: what is left
 *                  of it, from the ship to where the planet will be
 *   wake           the stretch a ship has just flown
 *
 * Each instance draws the parameter range [t0, t1] of its curve. For an
 * ellipse the parameter is the eccentric anomaly in turns — what the scene
 * steps the bodies by — so a trail is just a range that follows its body.
 */

const SEGMENTS = 64;
/** Ribbon half-width in CSS px (core + glow skirt). */
const HALF_WIDTH = 5;
/** Without the skirt (lowest quality tier) the ribbon shrinks to just its core. */
const HALF_WIDTH_LEAN = 2;

const KIND_ROUTE = 0;
const KIND_ORBIT = 1;
const KIND_TRAIL = 2;
const KIND_WAKE = 3;

const LEAF_COUNT = NODE_COUNT - CLUSTER_COUNT;
/** One orbit and one trail per planet, round the star. */
export const PLANET_ORBIT_BASE = 0;
export const PLANET_TRAIL_BASE = PLANET_ORBIT_BASE + CLUSTER_COUNT;
/** Two moon orbits per planet, then one trail per moon. */
export const ORBIT_BASE = PLANET_TRAIL_BASE + CLUSTER_COUNT;
const MOON_TRAIL_BASE = ORBIT_BASE + CLUSTER_COUNT * 2;
/** One route and one wake per ship. */
export const ROUTE_BASE = MOON_TRAIL_BASE + LEAF_COUNT;
export const WAKE_BASE = ROUTE_BASE + SHIP_COUNT;
export const LINE_COUNT = WAKE_BASE + SHIP_COUNT;

/** Node index → its trail's line index (-1 for planets). */
export const TRAIL_OF_NODE = new Int16Array(NODE_COUNT).fill(-1);

/** Ellipse: centre, semi-major axis vector, semi-minor axis vector. Bezier: P0, P3, P1 (and P2 in I_D). */
const I_A = new Float32Array(LINE_COUNT * 3);
const I_B = new Float32Array(LINE_COUNT * 3);
const I_C = new Float32Array(LINE_COUNT * 3);
const I_D = new Float32Array(LINE_COUNT * 3);
const I_COLOR = new Float32Array(LINE_COUNT * 3);
/** entrance delay, kind, core half-width (CSS px), unused */
const I_META = new Float32Array(LINE_COUNT * 4);
/** Dynamic: brightness, t0, t1. */
const I_DYN = new Float32Array(LINE_COUNT * 3);
/** For an orbit that travels with a planet: its centre's offset from the planet (the planet is at a focus). */
const FOCUS_OFFSET = new Float32Array(LINE_COUNT * 3);

/* Planet orbits and trails: static ellipses round the star. */
{
  const at = [0, 0, 0];
  const ahead = [0, 0, 0];
  for (let c = 0; c < CLUSTER_COUNT; c++) {
    const p = PLANET_PHYSICS[CLUSTERS[c].planet];
    // Recover the ellipse's own axes from two points of it, so the line is
    // exactly the path helioState() walks: perihelion (E = 0, when M = 0) and
    // a quarter of the way round (E = 90°, when M = pi/2 - e).
    helioState(p, -p.anomaly0 / p.helioMotion, at);
    const peri = [at[0], at[1], at[2]];
    helioState(p, (Math.PI / 2 - p.ecc - p.anomaly0) / p.helioMotion, ahead);
    const a = p.orbitScene;
    const b = a * Math.sqrt(1 - p.ecc * p.ecc);
    // perihelion = centre + a*(1 - e)*P  and  point(90°) = centre - a*e*P + b*Q
    const P = [peri[0] / (a * (1 - p.ecc)), peri[1] / (a * (1 - p.ecc)), peri[2] / (a * (1 - p.ecc))];
    const centre = [-a * p.ecc * P[0], -a * p.ecc * P[1], -a * p.ecc * P[2]];
    const Q = [(ahead[0] - centre[0]) / b, (ahead[1] - centre[1]) / b, (ahead[2] - centre[2]) / b];
    for (const line of [PLANET_ORBIT_BASE + c, PLANET_TRAIL_BASE + c]) {
      I_A.set(centre, line * 3);
      I_B.set([P[0] * a, P[1] * a, P[2] * a], line * 3);
      I_C.set([Q[0] * b, Q[1] * b, Q[2] * b], line * 3);
      I_COLOR.set(CLUSTER_RGB.subarray(c * 3, c * 3 + 3), line * 3);
    }
    I_META.set([0.04 + 0.05 * c, KIND_ORBIT, 0.5, 0], (PLANET_ORBIT_BASE + c) * 4);
    I_DYN.set([0, 0, 1], (PLANET_ORBIT_BASE + c) * 3);
    I_META.set([0.3 + 0.03 * c, KIND_TRAIL, 1.1, 0], (PLANET_TRAIL_BASE + c) * 4);
  }
}

/**
 * A moon orbit: an ellipse centred half-way between its foci, the planet at
 * one of them. Its axes are fixed; its centre is rewritten as the planet moves.
 */
function setMoonOrbit(line: number, cluster: number, ring: number) {
  const c = CLUSTERS[cluster];
  const a = c.orbits[ring];
  const e = c.ecc[ring];
  const b = a * Math.sqrt(1 - e * e);
  const p = c.periapsis[ring];
  const q = c.quarter[ring];
  FOCUS_OFFSET.set([-a * e * p[0], -a * e * p[1], -a * e * p[2]], line * 3);
  I_B.set([p[0] * a, p[1] * a, p[2] * a], line * 3);
  I_C.set([q[0] * b, q[1] * b, q[2] * b], line * 3);
  I_COLOR.set(CLUSTER_RGB.subarray(cluster * 3, cluster * 3 + 3), line * 3);
}

/** Lines that travel with each planet (its two orbits, then its moons' trails). */
const LINES_OF_CLUSTER: number[][] = CLUSTERS.map(() => []);
for (let c = 0; c < CLUSTER_COUNT; c++) {
  for (let o = 0; o < 2; o++) {
    const line = ORBIT_BASE + c * 2 + o;
    setMoonOrbit(line, c, o);
    LINES_OF_CLUSTER[c].push(line);
    I_META.set([0.28 + 0.03 * c + 0.1 * o, KIND_ORBIT, 0.6, 0], line * 4);
    I_DYN.set([0, 0, 1], line * 3);
  }
}
{
  let leaf = 0;
  for (let i = 0; i < NODE_COUNT; i++) {
    if (IS_HUB[i]) continue;
    const line = MOON_TRAIL_BASE + leaf++;
    TRAIL_OF_NODE[i] = line;
    setMoonOrbit(line, CLUSTER_OF[i], NODES[i].orbit);
    LINES_OF_CLUSTER[CLUSTER_OF[i]].push(line);
    I_META.set([Math.min(NODE_ENTER[i] + 0.1, 0.7), KIND_TRAIL, 1.0, 0], line * 4);
  }
}
for (let s = 0; s < SHIP_COUNT; s++) {
  I_COLOR.set([0.3, 0.74, 0.6], (ROUTE_BASE + s) * 3);
  I_META.set([0, KIND_ROUTE, 0.55, 0], (ROUTE_BASE + s) * 4);
  I_COLOR.set([0.42, 0.9, 0.7], (WAKE_BASE + s) * 3);
  I_META.set([0, KIND_WAKE, 1.1, 0], (WAKE_BASE + s) * 4);
}

const GEOMETRY = new THREE.InstancedBufferGeometry();
{
  // Strip of SEGMENTS quads: position = (u along the drawn range 0..1, side -1|+1, 0).
  const verts = new Float32Array((SEGMENTS + 1) * 2 * 3);
  const index: number[] = [];
  for (let s = 0; s <= SEGMENTS; s++) {
    const u = s / SEGMENTS;
    verts.set([u, -1, 0, u, 1, 0], s * 6);
    if (s < SEGMENTS) {
      const v = s * 2;
      index.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
    }
  }
  GEOMETRY.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  GEOMETRY.setIndex(index);
}
const dynamicAttr = (array: Float32Array, size: number) => {
  const attr = new THREE.InstancedBufferAttribute(array, size);
  attr.setUsage(THREE.DynamicDrawUsage);
  return attr;
};
const A_ATTR = dynamicAttr(I_A, 3);
const B_ATTR = dynamicAttr(I_B, 3);
const C_ATTR = dynamicAttr(I_C, 3);
const D_ATTR = dynamicAttr(I_D, 3);
const DYN_ATTR = dynamicAttr(I_DYN, 3);
GEOMETRY.setAttribute('iA', A_ATTR);
GEOMETRY.setAttribute('iB', B_ATTR);
GEOMETRY.setAttribute('iC', C_ATTR);
GEOMETRY.setAttribute('iD', D_ATTR);
GEOMETRY.setAttribute('iColor', new THREE.InstancedBufferAttribute(I_COLOR, 3));
GEOMETRY.setAttribute('iMeta', new THREE.InstancedBufferAttribute(I_META, 4));
GEOMETRY.setAttribute('iDyn', DYN_ATTR);
GEOMETRY.instanceCount = LINE_COUNT;

const VERTEX = /* glsl */ `
  attribute vec3 iA;
  attribute vec3 iB;
  attribute vec3 iC;
  attribute vec3 iD;
  attribute vec3 iColor;
  attribute vec4 iMeta;
  attribute vec3 iDyn;
  uniform float uEnter;
  uniform vec2 uResolution;
  uniform float uHalfWidth;
  ${FOG_GLSL}
  ${PING_GLSL}
  varying vec4 vLine; // kind, side -1..1, u along the drawn range, entrance progress
  varying vec4 vTint; // rgb + brightness (intensity x depth fade)
  varying vec2 vCore; // core half-width as a fraction of the ribbon, curve parameter

  void main() {
    float u = position.x;
    float t = mix(iDyn.y, iDyn.z, u);
    float kind = iMeta.y;
    vec3 p;
    vec3 tangent;
    if (kind > 0.5 && kind < 2.5) {
      // Ellipse: centre iA, semi-axes iB / iC (a circle when they are equal).
      float ang = t * 6.2831853;
      float c = cos(ang);
      float s = sin(ang);
      p = iA + iB * c + iC * s;
      tangent = normalize(iC * c - iB * s);
    } else {
      // Cubic Bezier: iA → iB, leaving towards iC and arriving from iD.
      float o = 1.0 - t;
      p = o * o * o * iA + 3.0 * o * o * t * iC + 3.0 * o * t * t * iD + t * t * t * iB;
      tangent = normalize(3.0 * o * o * (iC - iA) + 6.0 * o * t * (iD - iC) + 3.0 * t * t * (iB - iD) + vec3(1e-6));
    }
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec4 clip = projectionMatrix * mv;
    vec4 ahead = projectionMatrix * (modelViewMatrix * vec4(p + tangent * 0.05, 1.0));
    // Screen-space direction of the curve → perpendicular offset of constant pixel width.
    vec2 dir = (ahead.xy / ahead.w - clip.xy / clip.w) * uResolution;
    float len = length(dir);
    dir = len > 1e-6 ? dir / len : vec2(1.0, 0.0);
    // A line the camera is about to fly through fades out (close-up views sit
    // inside a system, where an orbit can cross the lens).
    float fade = depthFade(-mv.z) * smoothstep(0.3, 0.9, -mv.z);
    float halfWidth = uHalfWidth * (0.82 + 0.3 * fade); // nearer lines read slightly fatter
    clip.xy += vec2(-dir.y, dir.x) * position.y * halfWidth * 2.0 / uResolution * clip.w;
    // Nothing to draw: collapse the strip so it costs no fill.
    gl_Position = iDyn.x > 0.002 ? clip : vec4(2.0, 2.0, 2.0, 1.0);
    // A route is planned after the entrance: it has no drawing-in of its own.
    float entrance = kind < 0.5 || kind > 2.5 ? 1.0 : (uEnter - iMeta.x) / 0.3;
    vLine = vec4(kind, position.y, u, entrance);
    vTint = vec4(iColor, (iDyn.x + pingAt(p) * 0.8 * step(kind, 1.5)) * fade);
    vCore = vec2(iMeta.z / uHalfWidth, t);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uSkirt;
  varying vec4 vLine;
  varying vec4 vTint;
  varying vec2 vCore;

  void main() {
    float kind = vLine.x;
    float x = abs(vLine.y);
    float u = vLine.z;
    float aa = fwidth(vLine.y) + 1e-4;
    float core = 1.0 - smoothstep(vCore.x - aa, vCore.x + aa, x);
    float skirt = exp(-x * x * 7.0) * 0.36 * uSkirt * (1.0 - smoothstep(0.8, 1.0, x));
    float draw = clamp(vLine.w, 0.0, 1.0);
    vec3 col;

    if (kind > 1.5) {
      // Trail / wake: nothing at the tail, full at the head.
      float tail = pow(u, 2.4);
      col = vTint.rgb * (core + skirt * 1.5) * tail;
      col += mix(vTint.rgb, vec3(1.0), 0.5) * core * pow(u, 9.0) * 0.6;
      col *= draw;
    } else {
      // Entrance: the line draws out along its length with a bright head.
      float drawn = 1.0 - pow(1.0 - draw, 3.0);
      float mask = (1.0 - smoothstep(drawn, drawn + 0.02, u)) * step(0.0005, draw);
      float head = exp(-max(drawn - u, 0.0) * 26.0) * (1.0 - smoothstep(0.8, 1.0, draw));
      float body = core * 0.9 + skirt;
      if (kind < 0.5) {
        // Route: dashes fixed to the path, drifting towards the destination.
        float dash = smoothstep(0.2, 0.26, abs(fract(vCore.y * 26.0 - uTime * 0.22) - 0.5));
        body *= mix(0.12, 1.0, dash);
      }
      col = vTint.rgb * body + mix(vTint.rgb, vec3(1.0), 0.4) * head * (core + skirt) * 1.6;
      col *= mask;
    }
    gl_FragColor = vec4(col * vTint.a, 0.0);
  }
`;

/** Layer-local uniforms: glow skirt amount and ribbon half-width. */
export const LINE_UNIFORMS = {
  uSkirt: { value: 1 },
  uHalfWidth: { value: HALF_WIDTH },
};

/** Lowest quality tier: drop the glow skirt and narrow the ribbon to its core. */
export function setLineSkirt(on: boolean): void {
  LINE_UNIFORMS.uSkirt.value = on ? 1 : 0;
  LINE_UNIFORMS.uHalfWidth.value = on ? HALF_WIDTH : HALF_WIDTH_LEAN;
}

const MATERIAL = new THREE.ShaderMaterial({
  uniforms: {
    uTime: SHARED.uTime,
    uEnter: SHARED.uEnter,
    uFogNear: SHARED.uFogNear,
    uFogFar: SHARED.uFogFar,
    uPing: SHARED.uPing,
    uResolution: SHARED.uResolution,
    ...LINE_UNIFORMS,
  },
  vertexShader: VERTEX,
  fragmentShader: FRAGMENT,
  // The ribbon is extruded in screen space, so its winding is not meaningful.
  side: THREE.DoubleSide,
  ...LAYER_MATERIAL,
});

export const LINE_MESH = new THREE.Mesh(GEOMETRY, MATERIAL);
LINE_MESH.frustumCulled = false; // instances live in the shader
LINE_MESH.renderOrder = 2;

let dynDirty = true;
let shapeDirty = true;
const EPS = 0.0015;

/** Sets a line's brightness. */
export function setLineIntensity(line: number, value: number): void {
  const o = line * 3;
  if (Math.abs(I_DYN[o] - value) > EPS) {
    I_DYN[o] = value;
    dynDirty = true;
  }
}

/** Sets the parameter range a line draws (a trail's tail → head). */
export function setLineRange(line: number, t0: number, t1: number): void {
  const o = line * 3;
  if (Math.abs(I_DYN[o + 1] - t0) > 1e-5 || Math.abs(I_DYN[o + 2] - t1) > 1e-5) {
    I_DYN[o + 1] = t0;
    I_DYN[o + 2] = t1;
    dynDirty = true;
  }
}

/** Moves a planet's moon orbits and moon trails to where the planet now is. */
export function setClusterOrigin(cluster: number, x: number, y: number, z: number): void {
  const lines = LINES_OF_CLUSTER[cluster];
  for (let k = 0; k < lines.length; k++) {
    const o = lines[k] * 3;
    I_A[o] = x + FOCUS_OFFSET[o];
    I_A[o + 1] = y + FOCUS_OFFSET[o + 1];
    I_A[o + 2] = z + FOCUS_OFFSET[o + 2];
  }
  shapeDirty = true;
}

/**
 * Sets the cubic Bezier a ship's route and wake follow: from `p` at offset
 * `o0` to the point at `o3`, leaving towards `o1` and arriving from `o2`.
 */
export function setShipCurve(ship: number, p: Float32Array, o0: number, o1: number, o2: number, o3: number): void {
  for (const line of [ROUTE_BASE + ship, WAKE_BASE + ship]) {
    const o = line * 3;
    for (let k = 0; k < 3; k++) {
      I_A[o + k] = p[o0 + k];
      I_C[o + k] = p[o1 + k];
      I_D[o + k] = p[o2 + k];
      I_B[o + k] = p[o3 + k];
    }
  }
  shapeDirty = true;
}

/** Uploads the dynamic buffers — only those in which something changed. */
export function flushLines(): void {
  if (dynDirty) {
    DYN_ATTR.needsUpdate = true;
    dynDirty = false;
  }
  if (shapeDirty) {
    A_ATTR.needsUpdate = true;
    B_ATTR.needsUpdate = true;
    C_ATTR.needsUpdate = true;
    D_ATTR.needsUpdate = true;
    shapeDirty = false;
  }
}
