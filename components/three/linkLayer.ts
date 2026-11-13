import * as THREE from 'three';
import {
  CLUSTER_OF,
  CLUSTER_RGB,
  IS_HUB,
  LINK_A,
  LINK_B,
  LINK_COUNT,
  LINK_ENTER,
  LINK_IS_RING,
  LINK_REST,
  NODE_POSITIONS,
  NODE_RADIUS,
} from './constellationData';
import { FOG_GLSL, LAYER_MATERIAL, PING_GLSL, SHARED } from './sceneShared';

/*
 * Link layer — every link as a screen-space ribbon in ONE instanced draw call.
 * Each instance is a quadratic Bezier (hub spokes arc slightly, the hub ring
 * bows outward) extruded to a constant pixel width in the vertex shader. The
 * fragment shader gives it a crisp core plus a soft glow skirt, draws it in
 * during the entrance, and runs an "energy" comet along it — all from uniforms,
 * so nothing but one small intensity buffer is ever re-uploaded.
 *
 * Links are trimmed per instance so they stop at the node surface instead of
 * running through the hub emblems and leaf cores.
 */

const SEGMENTS = 12;
/** Ribbon half-width in CSS px (core + glow skirt), and the core's half-width. */
const HALF_WIDTH = 5;
const CORE_HALF_WIDTH = 0.85;
/** Without the skirt (lowest quality tier) the ribbon shrinks to just its core. */
const HALF_WIDTH_LEAN = 2;

const I_A = new Float32Array(LINK_COUNT * 3);
const I_B = new Float32Array(LINK_COUNT * 3);
const I_CTRL = new Float32Array(LINK_COUNT * 3);
const I_COLOR = new Float32Array(LINK_COUNT * 3);
/** entrance delay, flow phase seed, flow speed (link lengths per second), unused */
const I_META = new Float32Array(LINK_COUNT * 4);
/** Bezier parameter range actually drawn (trimmed at both node surfaces). */
const I_TRIM = new Float32Array(LINK_COUNT * 2);
/** Dynamic: brightness per link (rest / focused / dimmed). */
const I_INT = new Float32Array(LINK_COUNT);

for (let l = 0; l < LINK_COUNT; l++) {
  const a = LINK_A[l];
  const b = LINK_B[l];
  const ax = NODE_POSITIONS[a * 3];
  const ay = NODE_POSITIONS[a * 3 + 1];
  const az = NODE_POSITIONS[a * 3 + 2];
  const bx = NODE_POSITIONS[b * 3];
  const by = NODE_POSITIONS[b * 3 + 1];
  const bz = NODE_POSITIONS[b * 3 + 2];
  I_A.set([ax, ay, az], l * 3);
  I_B.set([bx, by, bz], l * 3);
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const len = Math.hypot(dx, dy, dz) || 1;
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const mz = (az + bz) / 2;

  // Control point. Ring: bow away from the graph centre. Spoke: a slight
  // sideways arc (perpendicular to the spoke and to the hub's outward axis),
  // the same handedness everywhere, so each cluster reads as a gentle pinwheel.
  let cx: number;
  let cy: number;
  let cz: number;
  if (LINK_IS_RING[l]) {
    const m = Math.hypot(mx, my, mz) || 1;
    cx = mx + (mx / m) * 0.7;
    cy = my + (my / m) * 0.7;
    cz = mz + (mz / m) * 0.7;
  } else {
    const h = Math.hypot(ax, ay, az) || 1;
    const ox = ax / h;
    const oy = ay / h;
    const oz = az / h;
    let px = dy * oz - dz * oy;
    let py = dz * ox - dx * oz;
    let pz = dx * oy - dy * ox;
    let pl = Math.hypot(px, py, pz);
    if (pl < 1e-3) {
      // Spoke parallel to the outward axis: fall back to the view axis.
      px = dy;
      py = -dx;
      pz = 0;
      pl = Math.hypot(px, py) || 1;
    }
    const k = (0.11 * len) / pl;
    cx = mx + px * k;
    cy = my + py * k;
    cz = mz + pz * k;
  }
  I_CTRL.set([cx, cy, cz], l * 3);

  const ca = CLUSTER_OF[a] * 3;
  const cb = CLUSTER_OF[b] * 3;
  I_COLOR.set(
    [
      (CLUSTER_RGB[ca] + CLUSTER_RGB[cb]) / 2,
      (CLUSTER_RGB[ca + 1] + CLUSTER_RGB[cb + 1]) / 2,
      (CLUSTER_RGB[ca + 2] + CLUSTER_RGB[cb + 2]) / 2,
    ],
    l * 3,
  );
  I_META.set([LINK_ENTER[l], (l * 0.137) % 1, 0.24 + (l % 5) * 0.04, 0], l * 4);
  // Stop just inside a hub plate (it is drawn on top) and just short of a leaf core.
  const trimA = NODE_RADIUS[a] * (IS_HUB[a] ? 0.92 : 1.7);
  const trimB = NODE_RADIUS[b] * (IS_HUB[b] ? 0.92 : 1.7);
  I_TRIM.set([trimA / len, 1 - trimB / len], l * 2);
  I_INT[l] = LINK_REST[l];
}

const GEOMETRY = new THREE.InstancedBufferGeometry();
{
  // Strip of SEGMENTS quads: position = (u along the link 0..1, side -1|+1, 0).
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
GEOMETRY.setAttribute('iCtrl', new THREE.InstancedBufferAttribute(I_CTRL, 3));
GEOMETRY.setAttribute('iColor', new THREE.InstancedBufferAttribute(I_COLOR, 3));
GEOMETRY.setAttribute('iMeta', new THREE.InstancedBufferAttribute(I_META, 4));
GEOMETRY.setAttribute('iTrim', new THREE.InstancedBufferAttribute(I_TRIM, 2));
const INT_ATTR = new THREE.InstancedBufferAttribute(I_INT, 1);
INT_ATTR.setUsage(THREE.DynamicDrawUsage);
GEOMETRY.setAttribute('iInt', INT_ATTR);
GEOMETRY.instanceCount = LINK_COUNT;

const VERTEX = /* glsl */ `
  attribute vec3 iA;
  attribute vec3 iB;
  attribute vec3 iCtrl;
  attribute vec3 iColor;
  attribute vec4 iMeta;
  attribute vec2 iTrim;
  attribute float iInt;
  uniform float uEnter;
  uniform vec2 uResolution;
  uniform float uHalfWidth;
  ${FOG_GLSL}
  ${PING_GLSL}
  varying vec4 vLine; // bezier t, side -1..1, u along the drawn strip, entrance progress
  varying vec4 vTint; // rgb + brightness (intensity x depth fade)
  varying vec2 vFlow; // phase seed, speed

  void main() {
    float u = position.x;
    float t = mix(iTrim.x, iTrim.y, u);
    float o = 1.0 - t;
    vec3 p = o * o * iA + 2.0 * o * t * iCtrl + t * t * iB;
    vec3 tangent = normalize(2.0 * o * (iCtrl - iA) + 2.0 * t * (iB - iCtrl));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec4 clip = projectionMatrix * mv;
    vec4 ahead = projectionMatrix * (modelViewMatrix * vec4(p + tangent * 0.05, 1.0));
    // Screen-space direction of the curve → perpendicular offset of constant pixel width.
    vec2 dir = (ahead.xy / ahead.w - clip.xy / clip.w) * uResolution;
    float len = length(dir);
    dir = len > 1e-6 ? dir / len : vec2(1.0, 0.0);
    float fade = depthFade(-mv.z);
    float halfWidth = uHalfWidth * (0.82 + 0.3 * fade); // nearer links read slightly fatter
    clip.xy += vec2(-dir.y, dir.x) * position.y * halfWidth * 2.0 / uResolution * clip.w;
    gl_Position = clip;
    vLine = vec4(t, position.y, u, (uEnter - iMeta.x) / 0.3);
    vTint = vec4(iColor, (iInt + pingAt(p) * 0.8) * fade);
    vFlow = iMeta.yz;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uFlow;
  uniform float uSkirt;
  uniform float uCore;
  varying vec4 vLine;
  varying vec4 vTint;
  varying vec2 vFlow;

  void main() {
    float x = abs(vLine.y);
    float aa = fwidth(vLine.y) + 1e-4;
    float core = 1.0 - smoothstep(uCore - aa, uCore + aa, x);
    float skirt = exp(-x * x * 7.0) * 0.36 * uSkirt * (1.0 - smoothstep(0.8, 1.0, x));

    // Entrance: the link draws out from its hub with a bright head.
    float draw = clamp(vLine.w, 0.0, 1.0);
    float drawn = 1.0 - pow(1.0 - draw, 3.0);
    float mask = (1.0 - smoothstep(drawn, drawn + 0.02, vLine.z)) * step(0.0005, draw);
    float head = exp(-max(drawn - vLine.z, 0.0) * 26.0) * (1.0 - smoothstep(0.8, 1.0, draw));

    // Energy flow: a comet (sharp head, exponential tail) running hub → leaf,
    // faded at both ends so it never pops, and as bright as its link.
    float ph = fract(uTime * vFlow.y + vFlow.x - vLine.x);
    float comet = smoothstep(0.0, 0.035, ph) * exp(-ph * 10.0) * sin(3.14159265 * vLine.z);

    vec3 col = vTint.rgb * (core * 0.9 + skirt);
    col += mix(vTint.rgb, vec3(0.74, 1.0, 0.9), 0.65) * comet * exp(-x * x * 4.0) * uFlow * 1.5;
    col += mix(vTint.rgb, vec3(1.0), 0.4) * head * (core + skirt) * 1.6;
    gl_FragColor = vec4(col * mask * vTint.a, 0.0);
  }
`;

/** Layer-local uniforms: comet strength, glow skirt amount, ribbon/core widths. */
export const LINK_UNIFORMS = {
  uFlow: { value: 0.85 },
  uSkirt: { value: 1 },
  uHalfWidth: { value: HALF_WIDTH },
  uCore: { value: CORE_HALF_WIDTH / HALF_WIDTH },
};

/** Lowest quality tier: drop the glow skirt and narrow the ribbon to its core. */
export function setLinkSkirt(on: boolean): void {
  const half = on ? HALF_WIDTH : HALF_WIDTH_LEAN;
  LINK_UNIFORMS.uSkirt.value = on ? 1 : 0;
  LINK_UNIFORMS.uHalfWidth.value = half;
  LINK_UNIFORMS.uCore.value = CORE_HALF_WIDTH / half;
}

const MATERIAL = new THREE.ShaderMaterial({
  uniforms: {
    uTime: SHARED.uTime,
    uEnter: SHARED.uEnter,
    uFogNear: SHARED.uFogNear,
    uFogFar: SHARED.uFogFar,
    uPing: SHARED.uPing,
    uResolution: SHARED.uResolution,
    ...LINK_UNIFORMS,
  },
  vertexShader: VERTEX,
  fragmentShader: FRAGMENT,
  // The ribbon is extruded in screen space, so its winding is not meaningful.
  side: THREE.DoubleSide,
  ...LAYER_MATERIAL,
});

export const LINK_MESH = new THREE.Mesh(GEOMETRY, MATERIAL);
LINK_MESH.frustumCulled = false; // instances live in the shader
LINK_MESH.renderOrder = 2;

let dirty = true;

/** Marks the intensity buffer for upload if `value` differs from what is stored. */
export function setLinkIntensity(link: number, value: number): void {
  if (Math.abs(I_INT[link] - value) > 0.0015) {
    I_INT[link] = value;
    dirty = true;
  }
}

/** Uploads the intensity buffer — only on frames where something changed. */
export function flushLinkState(): void {
  if (!dirty) return;
  INT_ATTR.needsUpdate = true;
  dirty = false;
}
