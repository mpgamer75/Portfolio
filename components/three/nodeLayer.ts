import * as THREE from 'three';
import {
  CLUSTERS,
  CLUSTER_COUNT,
  CLUSTER_OF,
  CLUSTER_RGB,
  HUB_RADIUS_W,
  IS_HUB,
  LEAF_RADIUS_W,
  NODE_COUNT,
  NODE_ENTER,
  NODE_POSITIONS,
} from './constellationData';
import { FOG_GLSL, LAYER_MATERIAL, PING_GLSL, SHARED } from './sceneShared';
import type { ClusterGlyph } from './skillsGraph';

/*
 * Node layer — every skill node, hub emblem, selection reticle and the soft
 * domain glows in ONE instanced draw call of camera-facing quads. No textures:
 * discs, rims, halos and the four hub glyphs are signed-distance shapes,
 * anti-aliased with screen-space derivatives.
 *
 * Quads are sized in world units (so they scale with the canvas and are never
 * culled by their centre the way gl.POINTS are) and drawn in slot order:
 *   [domain glows] → [hubs] → [leaves]
 * Glows are purely additive; hub plates are near-opaque, so they hide the link
 * ends converging on them; leaves always sit on top of plates.
 */

/** Quad half-extent in node radii — room for the halo and the selection reticle. */
const HUB_EXT = 2.0;
const LEAF_EXT = 3.6;

const SHAPE_ID: Record<ClusterGlyph, number> = { circle: 1, diamond: 2, hexagon: 3, triangle: 4 };
const SHAPE_ATMOS = 5;

/** One soft glow per domain plus one wide backdrop behind the whole graph. */
export const ATMOS_COUNT = CLUSTER_COUNT + 1;
const ATMOS_CLUSTER_RADIUS = 3.6;
const ATMOS_BACKDROP_RADIUS = 11.5;
const INSTANCES = ATMOS_COUNT + NODE_COUNT;

/** Node index → instance slot (hubs before leaves, after the glows). */
export const NODE_SLOT = new Int16Array(NODE_COUNT);
{
  let slot = ATMOS_COUNT;
  for (let i = 0; i < NODE_COUNT; i++) if (IS_HUB[i]) NODE_SLOT[i] = slot++;
  for (let i = 0; i < NODE_COUNT; i++) if (!IS_HUB[i]) NODE_SLOT[i] = slot++;
}

const I_POS = new Float32Array(INSTANCES * 3);
const I_COLOR = new Float32Array(INSTANCES * 3);
/** radius (world), shape id, phase, entrance delay */
const I_PARAMS = new Float32Array(INSTANCES * 4);
/** Dynamic. Nodes: [glow, select]. Glows: [intensity, unused]. */
const I_STATE = new Float32Array(INSTANCES * 2);

for (let c = 0; c < ATMOS_COUNT; c++) {
  const backdrop = c === CLUSTER_COUNT;
  const center = backdrop ? [0, 0, 0] : CLUSTERS[c].center;
  I_POS.set(center, c * 3);
  // Backdrop takes the signature emerald; domain glows their own tint.
  I_COLOR.set(backdrop ? [0.204, 0.827, 0.6] : CLUSTER_RGB.subarray(c * 3, c * 3 + 3), c * 3);
  I_PARAMS.set([backdrop ? ATMOS_BACKDROP_RADIUS : ATMOS_CLUSTER_RADIUS, SHAPE_ATMOS, c * 1.7, 0], c * 4);
}
for (let i = 0; i < NODE_COUNT; i++) {
  const s = NODE_SLOT[i];
  const c = CLUSTER_OF[i];
  I_POS.set(NODE_POSITIONS.subarray(i * 3, i * 3 + 3), s * 3);
  I_COLOR.set(CLUSTER_RGB.subarray(c * 3, c * 3 + 3), s * 3);
  I_PARAMS.set(
    [
      IS_HUB[i] ? HUB_RADIUS_W : LEAF_RADIUS_W,
      IS_HUB[i] ? SHAPE_ID[CLUSTERS[c].glyph] : 0,
      i * 2.39996,
      NODE_ENTER[i],
    ],
    s * 4,
  );
}

const GEOMETRY = new THREE.InstancedBufferGeometry();
GEOMETRY.setAttribute(
  'position',
  new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]), 3),
);
GEOMETRY.setIndex([0, 1, 2, 2, 1, 3]);
GEOMETRY.setAttribute('iPos', new THREE.InstancedBufferAttribute(I_POS, 3));
GEOMETRY.setAttribute('iColor', new THREE.InstancedBufferAttribute(I_COLOR, 3));
GEOMETRY.setAttribute('iParams', new THREE.InstancedBufferAttribute(I_PARAMS, 4));
const STATE_ATTR = new THREE.InstancedBufferAttribute(I_STATE, 2);
STATE_ATTR.setUsage(THREE.DynamicDrawUsage);
GEOMETRY.setAttribute('iState', STATE_ATTR);
GEOMETRY.instanceCount = INSTANCES;

const VERTEX = /* glsl */ `
  attribute vec3 iPos;
  attribute vec3 iColor;
  attribute vec4 iParams;
  attribute vec2 iState;
  uniform float uTime;
  uniform float uEnter;
  uniform float uAtmos;
  ${FOG_GLSL}
  ${PING_GLSL}
  varying vec2 vP;
  varying vec3 vColor;
  varying float vShape;
  varying vec2 vState;
  varying float vFade;
  varying float vReveal;

  void main() {
    float radius = iParams.x;
    float shape = iParams.y;
    vShape = shape;
    vColor = iColor;
    vec4 mv = modelViewMatrix * vec4(iPos, 1.0);

    if (shape > 4.5) {
      // Domain glow: a plain soft quad. Collapsed off-screen while switched off,
      // so a disabled atmosphere costs no fill at all.
      vP = position.xy;
      vState = iState;
      vFade = 1.0;
      vReveal = 1.0;
      mv.xy += position.xy * radius;
      gl_Position = uAtmos * iState.x > 0.002 ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }

    float hub = step(0.5, shape);
    float reveal = smoothstep(iParams.w, iParams.w + 0.3, uEnter);
    float ping = pingAt(iPos);
    float glow = max(iState.x + (1.0 - hub) * 0.07 * sin(uTime * 1.6 + iParams.z), 0.0) + ping * 0.9;
    float lift = smoothstep(0.0, 0.6, iState.y);
    // Bloom in: overshoot slightly then settle, so each node "pops" into place.
    float pop = reveal * (1.0 + 0.35 * sin(reveal * 3.14159265));
    float scale = pop * mix(0.9 + 0.12 * min(glow, 1.2), 1.0, hub) * (1.0 + mix(0.2, 0.07, hub) * lift);
    float fade = depthFade(-mv.z);
    float ext = mix(${LEAF_EXT.toFixed(1)}, ${HUB_EXT.toFixed(1)}, hub);
    // World-space billboard; near nodes read a touch larger than perspective alone.
    mv.xy += position.xy * ext * radius * scale * (0.94 + 0.08 * fade) * (1.0 + 0.14 * ping);
    gl_Position = projectionMatrix * mv;
    vP = position.xy * ext;
    vState = vec2(glow, iState.y);
    vFade = fade;
    vReveal = reveal;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uAtmos;
  varying vec2 vP;
  varying vec3 vColor;
  varying float vShape;
  varying vec2 vState;
  varying float vFade;
  varying float vReveal;

  float sdRhombus(vec2 p, float r) {
    return (abs(p.x) + abs(p.y) - r) * 0.70710678;
  }
  float sdHexagon(vec2 p, float r) {
    const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
    p = abs(p);
    p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
    p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
    return length(p) * sign(p.y);
  }
  float sdTriangle(vec2 p, float r) {
    const float k = 1.7320508;
    p.x = abs(p.x) - r;
    p.y = p.y + r / k;
    if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
    p.x -= clamp(p.x, -2.0 * r, 0.0);
    return -length(p) * sign(p.y);
  }
  // Hub emblem, matching the DOM ClusterGlyph shapes (circle / diamond / hexagon / triangle).
  float glyph(vec2 p, float shape) {
    if (shape < 1.5) return length(p) - 0.52;
    if (shape < 2.5) return sdRhombus(p, 0.64);
    if (shape < 3.5) return sdHexagon(p.yx, 0.47);
    return sdTriangle(p + vec2(0.0, 0.07), 0.55);
  }
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }
  // Target-lock reticle: a ring broken into four slowly turning arcs.
  float reticle(vec2 p, float d, float radius, float halfWidth, float aa, float turn) {
    float ring = 1.0 - smoothstep(halfWidth - aa, halfWidth + aa, abs(d - radius));
    float seg = fract(atan(p.y, p.x + 1e-5) / 6.2831853 * 4.0 + turn);
    float arc = smoothstep(0.3, 0.36, seg) * (1.0 - smoothstep(0.92, 0.98, seg));
    return ring * arc;
  }

  void main() {
    float d = length(vP);
    float glow = vState.x;
    float sel = vState.y;

    if (vShape > 4.5) {
      // Analytic radial falloff (zero at the quad edge) + 1/255 dither against banding.
      float g = max(1.0 - d, 0.0);
      g = g * g * (0.55 + 0.45 * g);
      vec3 c = vColor * g * glow * uAtmos + (hash(gl_FragCoord.xy) - 0.5) / 255.0;
      gl_FragColor = vec4(max(c, 0.0), 0.0);
      return;
    }

    float aa = fwidth(d) * 0.75 + 1e-4;
    float n = clamp(glow, 0.0, 1.7);
    // Dimmed (out-of-focus) nodes recede instead of just losing their halo.
    float lum = 0.2 + 0.8 * smoothstep(0.0, 0.6, n);
    float pinned = step(0.8, sel);
    vec3 rgb;
    float a;

    if (vShape > 0.5) {
      // ── Hub: dark plate + rim + emblem + core ──
      float plate = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, d);
      float g = glyph(vP, vShape);
      float ga = fwidth(g) * 0.75 + 1e-4;
      float stroke = 1.0 - smoothstep(0.05 - ga, 0.05 + ga, abs(g));
      float fill = 1.0 - smoothstep(-ga, ga, g);
      vec3 col = vec3(0.012, 0.028, 0.055) + vColor * (0.05 + 0.07 * (1.0 - d)) * lum;
      col += vColor * (fill * 0.1 + exp(-abs(g) * 9.0) * 0.26) * lum;
      vec3 ink = mix(vColor, vec3(1.0), 0.18 + 0.3 * clamp(n - 0.9, 0.0, 0.75));
      col = mix(col, ink * (0.5 + 0.5 * lum), stroke);
      float core = 1.0 - smoothstep(0.12 - aa, 0.12 + aa, d);
      col = mix(col, mix(vColor, vec3(1.0), 0.6) * (0.55 + 0.45 * lum), core);
      float rim = 1.0 - smoothstep(0.035 - aa, 0.035 + aa, abs(d - 0.96));
      col = mix(col, vColor * (0.3 + 0.7 * lum), rim * 0.9);
      a = plate * 0.92;
      rgb = col * plate;
      // Halo skirt outside the plate (additive), fading out before the quad edge.
      float halo = exp(-max(d - 1.0, 0.0) * 3.4) * (1.0 - plate) * 0.34 * n;
      rgb += vColor * halo * (1.0 - smoothstep(1.5, 1.95, d));
      float lock = reticle(vP, d, 1.4 + 0.04 * sin(uTime * 4.0) * pinned, 0.035, aa, uTime * 0.14);
      rgb += mix(vColor, vec3(1.0), 0.35) * lock * sel;
    } else {
      // ── Leaf: solid shaded core + fresnel rim + halo ──
      float core = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, d);
      float sphere = sqrt(max(1.0 - d * d, 0.0));
      vec3 col = vColor * (0.62 + 0.42 * min(n, 1.2)) * (0.55 + 0.45 * sphere);
      col += vColor * pow(1.0 - sphere, 2.0) * 0.5;
      col += vec3(1.0) * pow(sphere, 5.0) * (0.1 + 0.5 * clamp(n - 0.8, 0.0, 0.9));
      a = core * mix(0.5, 0.96, lum);
      rgb = col * lum * core;
      float halo = exp(-max(d - 1.0, 0.0) * 1.9) * 0.3 + exp(-d * d * 0.35) * 0.16;
      rgb += vColor * halo * (1.0 - core) * n * (1.0 - smoothstep(2.6, 3.5, d));
      float lock = reticle(vP, d, 2.3 + 0.1 * sin(uTime * 4.0) * pinned, 0.085, aa, uTime * 0.14);
      rgb += mix(vColor, vec3(1.0), 0.35) * lock * sel;
    }

    gl_FragColor = vec4(rgb * vReveal * vFade, a * vReveal);
  }
`;

/** Layer-local uniforms. `uAtmos` is the master strength of the domain glows (0 = off). */
export const NODE_UNIFORMS = {
  uAtmos: { value: 0 },
};

const MATERIAL = new THREE.ShaderMaterial({
  uniforms: {
    uTime: SHARED.uTime,
    uEnter: SHARED.uEnter,
    uFogNear: SHARED.uFogNear,
    uFogFar: SHARED.uFogFar,
    uPing: SHARED.uPing,
    uAtmos: NODE_UNIFORMS.uAtmos,
  },
  vertexShader: VERTEX,
  fragmentShader: FRAGMENT,
  ...LAYER_MATERIAL,
});

export const NODE_MESH = new THREE.Mesh(GEOMETRY, MATERIAL);
NODE_MESH.frustumCulled = false; // instances live in the shader; the base quad's bounds mean nothing
NODE_MESH.renderOrder = 3;

let dirty = true;
const EPS = 0.0015;

/** Sets a node's glow (0..1.65) and selection (0 none, ~0.6 hover, 1 pinned). */
export function setNodeState(node: number, glow: number, select: number): void {
  const o = NODE_SLOT[node] * 2;
  if (Math.abs(I_STATE[o] - glow) > EPS || Math.abs(I_STATE[o + 1] - select) > EPS) {
    I_STATE[o] = glow;
    I_STATE[o + 1] = select;
    dirty = true;
  }
}

/** Sets a glow's intensity. `index` is a cluster index, or CLUSTER_COUNT for the backdrop. */
export function setAtmosState(index: number, intensity: number): void {
  const o = index * 2;
  if (Math.abs(I_STATE[o] - intensity) > EPS) {
    I_STATE[o] = intensity;
    dirty = true;
  }
}

/** Uploads the state buffer — only on frames where something actually changed. */
export function flushNodeState(): void {
  if (!dirty) return;
  STATE_ATTR.needsUpdate = true;
  dirty = false;
}
