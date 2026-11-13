import * as THREE from 'three';
import {
  CLUSTER_OF,
  IS_HUB,
  LINK_A,
  LINK_B,
  LINK_COUNT,
  LINK_CROSS,
  LINK_ENTER,
  LINK_KIND,
  LINK_REST,
  LINK_TRUNK,
  NODE_POSITIONS,
  NODE_RADIUS,
  nodeRgb,
} from './constellationData';
import { CLUSTER_N } from './orbitSim';
import { FOG_GLSL, LAYER_MATERIAL, PING_GLSL, POINTER_GLSL, SHARED } from './sceneShared';

/*
 * Link layer — every link as a screen-space ribbon in ONE instanced draw call.
 * Each instance is a quadratic Bezier extruded to a constant pixel width in the
 * vertex shader. Three kinds share the draw:
 *   trunk — core → hub, swept along the orbit like a spiral arm; heavier, two comets
 *   spoke — hub → skill, a slight pinwheel arc in the skill-ring plane
 *   cross — skill ↔ skill across domains, a thin dashed arc over the system
 * The fragment shader gives each a crisp core plus a soft glow skirt, draws it
 * in during the entrance, and runs "energy" comets along it.
 *
 * Skills move (see orbitSim), so the curve endpoints are re-derived on the CPU
 * each frame — a few dozen links, a handful of floats each.
 *
 * Links are trimmed per instance so they stop at the node surface instead of
 * running through the hub emblems and leaf beads.
 */

const SEGMENTS = 16;
/** Ribbon half-width in CSS px (core + glow skirt), and the core's half-width. */
const HALF_WIDTH = 5.5;
const CORE_HALF_WIDTH = 0.85;
/** Without the skirt (lowest quality tier) the ribbon shrinks to just its core. */
const HALF_WIDTH_LEAN = 2.4;

const I_A = new Float32Array(LINK_COUNT * 3);
const I_B = new Float32Array(LINK_COUNT * 3);
const I_CTRL = new Float32Array(LINK_COUNT * 3);
const I_COLOR = new Float32Array(LINK_COUNT * 3);
/** entrance delay, flow phase seed, flow speed (link lengths per second), kind */
const I_META = new Float32Array(LINK_COUNT * 4);
/** Bezier parameter range actually drawn (trimmed at both node surfaces). */
const I_TRIM = new Float32Array(LINK_COUNT * 2);
/** Dynamic: brightness per link (rest / focused / dimmed). */
const I_INT = new Float32Array(LINK_COUNT);

const RGB_A = new Float32Array(3);
const RGB_B = new Float32Array(3);
for (let l = 0; l < LINK_COUNT; l++) {
  nodeRgb(LINK_A[l], RGB_A, 0);
  nodeRgb(LINK_B[l], RGB_B, 0);
  // Trunks take the hub's tint (they belong to the domain they feed).
  const wa = LINK_KIND[l] === LINK_TRUNK ? 0.25 : 0.5;
  I_COLOR.set(
    [
      RGB_A[0] * wa + RGB_B[0] * (1 - wa),
      RGB_A[1] * wa + RGB_B[1] * (1 - wa),
      RGB_A[2] * wa + RGB_B[2] * (1 - wa),
    ],
    l * 3,
  );
  const speed = LINK_KIND[l] === LINK_TRUNK ? 0.2 : LINK_KIND[l] === LINK_CROSS ? 0.16 : 0.24 + (l % 5) * 0.04;
  I_META.set([LINK_ENTER[l], (l * 0.137) % 1, speed, LINK_KIND[l]], l * 4);
  I_INT[l] = LINK_REST[l];
}

/**
 * Re-derives every curve (ends, control point, trim) from the current node
 * positions and ring planes. Call once per frame, after orbitSim has stepped.
 */
export function syncLinkGeometry(): void {
  for (let l = 0; l < LINK_COUNT; l++) {
    const a = LINK_A[l];
    const b = LINK_B[l];
    const ax = NODE_POSITIONS[a * 3];
    const ay = NODE_POSITIONS[a * 3 + 1];
    const az = NODE_POSITIONS[a * 3 + 2];
    const bx = NODE_POSITIONS[b * 3];
    const by = NODE_POSITIONS[b * 3 + 1];
    const bz = NODE_POSITIONS[b * 3 + 2];
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const len = Math.hypot(dx, dy, dz) || 1;
    let cx = (ax + bx) / 2;
    let cy = (ay + by) / 2;
    let cz = (az + bz) / 2;
    const kind = LINK_KIND[l];
    if (kind === LINK_TRUNK) {
      // Swept along the orbit (tangent = Y × radial) and lifted a little: the
      // four trunks read as the arms of a slow spiral.
      const rl = Math.hypot(bx, bz) || 1;
      cx += (-bz / rl) * 0.2 * len;
      cz += (bx / rl) * 0.2 * len;
      cy += 0.07 * len;
    } else if (kind === LINK_CROSS) {
      // Arc over the system: lifted with the span, so a link between opposite
      // domains clears the core.
      cy += 0.2 * len;
      cx *= 0.9;
      cz *= 0.9;
    } else {
      // Sideways arc in the ring plane (n × spoke), the same handedness
      // everywhere, so each cluster reads as a gentle pinwheel.
      const o = CLUSTER_OF[b] * 3;
      const nx = CLUSTER_N[o];
      const ny = CLUSTER_N[o + 1];
      const nz = CLUSTER_N[o + 2];
      cx += (ny * dz - nz * dy) * 0.12;
      cy += (nz * dx - nx * dz) * 0.12;
      cz += (nx * dy - ny * dx) * 0.12;
    }
    const o3 = l * 3;
    I_A[o3] = ax;
    I_A[o3 + 1] = ay;
    I_A[o3 + 2] = az;
    I_B[o3] = bx;
    I_B[o3 + 1] = by;
    I_B[o3 + 2] = bz;
    I_CTRL[o3] = cx;
    I_CTRL[o3 + 1] = cy;
    I_CTRL[o3 + 2] = cz;
    // Stop just inside a hub orb (it is drawn on top) and just short of a leaf bead.
    const trimA = NODE_RADIUS[a] * (IS_HUB[a] ? 0.92 : 1.7);
    const trimB = NODE_RADIUS[b] * (IS_HUB[b] ? 0.92 : 1.7);
    I_TRIM[l * 2] = trimA / len;
    I_TRIM[l * 2 + 1] = 1 - trimB / len;
  }
  A_ATTR.needsUpdate = true;
  B_ATTR.needsUpdate = true;
  CTRL_ATTR.needsUpdate = true;
  TRIM_ATTR.needsUpdate = true;
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
const dynamicAttr = (array: Float32Array, size: number) => {
  const attr = new THREE.InstancedBufferAttribute(array, size);
  attr.setUsage(THREE.DynamicDrawUsage);
  return attr;
};
const A_ATTR = dynamicAttr(I_A, 3);
const B_ATTR = dynamicAttr(I_B, 3);
const CTRL_ATTR = dynamicAttr(I_CTRL, 3);
const TRIM_ATTR = dynamicAttr(I_TRIM, 2);
const INT_ATTR = dynamicAttr(I_INT, 1);
GEOMETRY.setAttribute('iA', A_ATTR);
GEOMETRY.setAttribute('iB', B_ATTR);
GEOMETRY.setAttribute('iCtrl', CTRL_ATTR);
GEOMETRY.setAttribute('iColor', new THREE.InstancedBufferAttribute(I_COLOR, 3));
GEOMETRY.setAttribute('iMeta', new THREE.InstancedBufferAttribute(I_META, 4));
GEOMETRY.setAttribute('iTrim', TRIM_ATTR);
GEOMETRY.setAttribute('iInt', INT_ATTR);
GEOMETRY.instanceCount = LINK_COUNT;
syncLinkGeometry();

const VERTEX = /* glsl */ `
  attribute vec3 iA;
  attribute vec3 iB;
  attribute vec3 iCtrl;
  attribute vec3 iColor;
  attribute vec4 iMeta;
  attribute vec2 iTrim;
  attribute float iInt;
  uniform float uEnter;
  uniform float uHalfWidth;
  ${FOG_GLSL}
  ${PING_GLSL}
  ${POINTER_GLSL}
  varying vec4 vLine; // bezier t, side -1..1, u along the drawn strip, entrance progress
  varying vec4 vTint; // rgb + brightness (intensity x depth fade)
  varying vec4 vFlow; // phase seed, speed, kind, raw intensity

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
    float halfWidth = uHalfWidth * (0.8 + 0.34 * fade); // nearer links read slightly fatter
    float near = pointerAt(clip);
    clip.xy += vec2(-dir.y, dir.x) * position.y * halfWidth * 2.0 / uResolution * clip.w;
    gl_Position = clip;
    vLine = vec4(t, position.y, u, (uEnter - iMeta.x) / 0.26);
    // The pointer light lifts faint links more than bright ones.
    float lit = iInt + pingAt(p) * 0.8 + near * (0.3 + 0.25 * step(1.5, iMeta.w));
    vTint = vec4(iColor, lit * fade);
    vFlow = vec4(iMeta.yzw, iInt);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uFlow;
  uniform float uSkirt;
  uniform float uCore;
  varying vec4 vLine;
  varying vec4 vTint;
  varying vec4 vFlow;

  void main() {
    float kind = vFlow.z;
    float trunk = 1.0 - step(0.5, kind);
    float arc = step(1.5, kind);
    float x = abs(vLine.y);
    float aa = fwidth(vLine.y) + 1e-4;
    // Core width by kind: trunks heavier, cross links hair-thin.
    float half_ = uCore * (1.0 + 0.7 * trunk - 0.35 * arc);
    float core = 1.0 - smoothstep(half_ - aa, half_ + aa, x);
    float skirt = exp(-x * x * 7.0) * (0.36 + 0.2 * trunk) * uSkirt * (1.0 - smoothstep(0.8, 1.0, x));
    skirt *= 1.0 - 0.6 * arc;

    // Cross links are dashed, the dashes marching from one skill to the other.
    float dash = fract(vLine.z * 22.0 - uTime * 0.35);
    float dashes = smoothstep(0.0, 0.08, dash) * (1.0 - smoothstep(0.55, 0.63, dash));
    // …and close up into a solid line once the link is lit.
    float gaps = mix(1.0, mix(dashes, 1.0, smoothstep(0.5, 1.0, vFlow.w)), arc);

    // Entrance: the link draws out from its source with a bright head.
    float draw = clamp(vLine.w, 0.0, 1.0);
    float drawn = 1.0 - pow(1.0 - draw, 3.0);
    float mask = (1.0 - smoothstep(drawn, drawn + 0.02, vLine.z)) * step(0.0005, draw);
    float head = exp(-max(drawn - vLine.z, 0.0) * 26.0) * (1.0 - smoothstep(0.8, 1.0, draw));

    // Energy flow: comets (sharp head, exponential tail) running source → target,
    // faded at both ends so they never pop. Trunks carry two; cross links only
    // carry one while lit.
    float count = 1.0 + trunk;
    float ph = fract(uTime * vFlow.y + vFlow.x - vLine.x * count);
    float comet = smoothstep(0.0, 0.035, ph) * exp(-ph * (10.0 - 3.0 * trunk)) * sin(3.14159265 * vLine.z);
    comet *= mix(1.0, smoothstep(0.4, 0.9, vFlow.w), arc) * (1.0 + 0.5 * trunk);

    vec3 col = vTint.rgb * (core * 0.9 + skirt) * gaps;
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
    uPointer: SHARED.uPointer,
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
LINK_MESH.renderOrder = 4;

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
