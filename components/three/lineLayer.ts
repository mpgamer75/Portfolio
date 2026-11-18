import * as THREE from 'three';
import {
  CLUSTERS,
  CLUSTER_COUNT,
  CLUSTER_OF,
  CLUSTER_RGB,
  CURVE_STRIDE,
  IS_HUB,
  LANES,
  LANE_COUNT,
  LANE_CURVES,
  NODES,
  NODE_COUNT,
  NODE_ENTER,
  SHIP_COUNT,
  SHIP_CURVES,
} from './constellationData';
import { FOG_GLSL, LAYER_MATERIAL, PING_GLSL, SHARED } from './sceneShared';

/*
 * Line layer — every orbit, lane and trail as a screen-space ribbon in ONE
 * instanced draw call. An instance is either an ellipse (orbits, moon trails)
 * or a quadratic Bezier (lanes, ship wakes), extruded to a constant pixel width
 * in the vertex shader:
 *
 *   orbit   the full ellipse a domain's moons ride, drawn in during the entrance
 *   lane    a dashed route between neighbouring planets, dashes drifting along it
 *   trail   a short arc behind a moon / a wake behind a ship, bright at the head
 *
 * Each instance draws the parameter range [t0, t1] of its curve, which is the
 * only thing (besides brightness) that changes per frame — so a trail is just a
 * range that follows its body.
 */

const SEGMENTS = 64;
/** Ribbon half-width in CSS px (core + glow skirt). */
const HALF_WIDTH = 5;
/** Without the skirt (lowest quality tier) the ribbon shrinks to just its core. */
const HALF_WIDTH_LEAN = 2;

const KIND_LANE = 0;
const KIND_ORBIT = 1;
const KIND_MOON_TRAIL = 2;
const KIND_WAKE = 3;

const LEAF_COUNT = NODE_COUNT - CLUSTER_COUNT;
export const ORBIT_BASE = 0;
const MOON_TRAIL_BASE = ORBIT_BASE + CLUSTER_COUNT * 2;
export const LANE_BASE = MOON_TRAIL_BASE + LEAF_COUNT;
export const WAKE_BASE = LANE_BASE + LANE_COUNT;
export const LINE_COUNT = WAKE_BASE + SHIP_COUNT;

/** Node index → its trail's line index (-1 for planets). */
export const TRAIL_OF_NODE = new Int16Array(NODE_COUNT).fill(-1);

const I_A = new Float32Array(LINE_COUNT * 3);
const I_B = new Float32Array(LINE_COUNT * 3);
const I_C = new Float32Array(LINE_COUNT * 3);
const I_COLOR = new Float32Array(LINE_COUNT * 3);
/** entrance delay, kind, core half-width (CSS px), unused */
const I_META = new Float32Array(LINE_COUNT * 4);
/** Dynamic: brightness, t0, t1. */
const I_DYN = new Float32Array(LINE_COUNT * 3);

/**
 * A Kepler orbit as the "circle" kind: an ellipse centred half-way between its
 * foci, with the planet at one of them. Its parameter is the eccentric anomaly
 * (in turns), which is what the scene steps the moons by.
 */
function setOrbit(line: number, cluster: number, ring: number) {
  const c = CLUSTERS[cluster];
  const a = c.orbits[ring];
  const e = c.ecc[ring];
  const b = a * Math.sqrt(1 - e * e);
  const p = c.periapsis[ring];
  const q = c.quarter[ring];
  I_A.set([c.center[0] - a * e * p[0], c.center[1] - a * e * p[1], c.center[2] - a * e * p[2]], line * 3);
  I_B.set([p[0] * a, p[1] * a, p[2] * a], line * 3);
  I_C.set([q[0] * b, q[1] * b, q[2] * b], line * 3);
  I_COLOR.set(CLUSTER_RGB.subarray(cluster * 3, cluster * 3 + 3), line * 3);
}

for (let c = 0; c < CLUSTER_COUNT; c++) {
  for (let o = 0; o < 2; o++) {
    const line = ORBIT_BASE + c * 2 + o;
    setOrbit(line, c, o);
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
    setOrbit(line, CLUSTER_OF[i], NODES[i].orbit);
    I_META.set([Math.min(NODE_ENTER[i] + 0.1, 0.7), KIND_MOON_TRAIL, 1.0, 0], line * 4);
  }
}
function setBezier(line: number, curves: Float32Array, index: number) {
  const o = index * CURVE_STRIDE;
  I_A.set(curves.subarray(o, o + 3), line * 3);
  I_C.set(curves.subarray(o + 3, o + 6), line * 3);
  I_B.set(curves.subarray(o + 6, o + 9), line * 3);
  I_DYN.set([0, curves[o + 9], curves[o + 10]], line * 3);
}
for (let l = 0; l < LANE_COUNT; l++) {
  const line = LANE_BASE + l;
  setBezier(line, LANE_CURVES, l);
  const a = LANES[l].a * 3;
  const b = LANES[l].b * 3;
  I_COLOR.set(
    [
      (CLUSTER_RGB[a] + CLUSTER_RGB[b]) / 2,
      (CLUSTER_RGB[a + 1] + CLUSTER_RGB[b + 1]) / 2,
      (CLUSTER_RGB[a + 2] + CLUSTER_RGB[b + 2]) / 2,
    ],
    line * 3,
  );
  I_META.set([0.5 + 0.05 * l, KIND_LANE, 0.6, 0], line * 4);
}
for (let s = 0; s < SHIP_COUNT; s++) {
  const line = WAKE_BASE + s;
  setBezier(line, SHIP_CURVES, s);
  I_COLOR.set([0.42, 0.9, 0.7], line * 3);
  I_META.set([0.7, KIND_WAKE, 1.1, 0], line * 4);
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
GEOMETRY.setAttribute('iA', new THREE.InstancedBufferAttribute(I_A, 3));
GEOMETRY.setAttribute('iB', new THREE.InstancedBufferAttribute(I_B, 3));
GEOMETRY.setAttribute('iC', new THREE.InstancedBufferAttribute(I_C, 3));
GEOMETRY.setAttribute('iColor', new THREE.InstancedBufferAttribute(I_COLOR, 3));
GEOMETRY.setAttribute('iMeta', new THREE.InstancedBufferAttribute(I_META, 4));
const DYN_ATTR = new THREE.InstancedBufferAttribute(I_DYN, 3);
DYN_ATTR.setUsage(THREE.DynamicDrawUsage);
GEOMETRY.setAttribute('iDyn', DYN_ATTR);
GEOMETRY.instanceCount = LINE_COUNT;

const VERTEX = /* glsl */ `
  attribute vec3 iA;
  attribute vec3 iB;
  attribute vec3 iC;
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
  varying float vCore; // core half-width as a fraction of the ribbon

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
      // Quadratic Bezier: iA → iB with control point iC.
      float o = 1.0 - t;
      p = o * o * iA + 2.0 * o * t * iC + t * t * iB;
      tangent = normalize(2.0 * o * (iC - iA) + 2.0 * t * (iB - iC));
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
    vLine = vec4(kind, position.y, u, (uEnter - iMeta.x) / 0.3);
    vTint = vec4(iColor, (iDyn.x + pingAt(p) * 0.8 * step(kind, 1.5)) * fade);
    vCore = iMeta.z / uHalfWidth;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uSkirt;
  varying vec4 vLine;
  varying vec4 vTint;
  varying float vCore;

  void main() {
    float kind = vLine.x;
    float x = abs(vLine.y);
    float u = vLine.z;
    float aa = fwidth(vLine.y) + 1e-4;
    float core = 1.0 - smoothstep(vCore - aa, vCore + aa, x);
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
        // Lane: dashes drifting from planet to planet.
        float dash = smoothstep(0.2, 0.26, abs(fract(u * 22.0 - uTime * 0.16) - 0.5));
        body *= mix(0.16, 1.0, dash);
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

let dirty = true;
const EPS = 0.0015;

/** Sets a line's brightness. */
export function setLineIntensity(line: number, value: number): void {
  const o = line * 3;
  if (Math.abs(I_DYN[o] - value) > EPS) {
    I_DYN[o] = value;
    dirty = true;
  }
}

/** Sets the parameter range a line draws (a trail's tail → head). */
export function setLineRange(line: number, t0: number, t1: number): void {
  const o = line * 3;
  if (Math.abs(I_DYN[o + 1] - t0) > 1e-5 || Math.abs(I_DYN[o + 2] - t1) > 1e-5) {
    I_DYN[o + 1] = t0;
    I_DYN[o + 2] = t1;
    dirty = true;
  }
}

/** Uploads the dynamic buffer — only on frames where something changed. */
export function flushLines(): void {
  if (!dirty) return;
  DYN_ATTR.needsUpdate = true;
  dirty = false;
}
