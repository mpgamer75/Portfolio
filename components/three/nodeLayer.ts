import * as THREE from 'three';
import {
  CLUSTERS,
  CLUSTER_COUNT,
  CLUSTER_OF,
  CLUSTER_RGB,
  CORE,
  IS_HUB,
  NODE_COUNT,
  NODE_ENTER,
  NODE_POSITIONS,
  NODE_RADIUS,
  nodeRgb,
} from './constellationData';
import { FOG_GLSL, LAYER_MATERIAL, PING_GLSL, POINTER_GLSL, SHARED } from './sceneShared';
import type { ClusterGlyph } from './skillsGraph';

/*
 * Node layer — the core, every hub orb, every skill bead, their selection
 * reticles and the soft domain glows in ONE instanced draw call of
 * camera-facing quads. No textures: spheres, rims, halos, the four hub glyphs
 * and the core's wireframe globe are analytic shapes, anti-aliased with
 * screen-space derivatives.
 *
 * Quads are sized in world units (so they scale with the canvas and are never
 * culled by their centre the way gl.POINTS are) and drawn in slot order:
 *   [domain glows] → [nodes, far to near]
 * Glows are purely additive; orbs and beads are near-opaque, so with the nodes
 * re-sorted by depth each frame a nearer one covers a farther one, and the hubs
 * hide the link ends converging on them.
 */

/** Quad half-extent in node radii — room for the halo and the selection reticle. */
const HUB_EXT = 2.0;
const LEAF_EXT = 3.8;
const CORE_EXT = 2.5;

const SHAPE_ID: Record<ClusterGlyph, number> = { circle: 1, diamond: 2, hexagon: 3, triangle: 4 };
const SHAPE_ATMOS = 5;
const SHAPE_CORE = 6;

/** One soft glow per domain plus one wide backdrop behind the whole graph. */
export const ATMOS_COUNT = CLUSTER_COUNT + 1;
const ATMOS_CLUSTER_RADIUS = 3.4;
/**
 * The backdrop is a wide, flat ellipse (like the tilted disc it sits behind),
 * sized to die out inside the canvas — a glow still lit at the canvas edge
 * would show that edge as a seam against the page.
 */
const ATMOS_BACKDROP_RADIUS = 11;
const ATMOS_BACKDROP_FLATTEN = 0.4;
const INSTANCES = ATMOS_COUNT + NODE_COUNT;

/** Per-node static instance data (tint; radius, shape id, phase, entrance delay). */
const N_COLOR = new Float32Array(NODE_COUNT * 3);
const N_PARAMS = new Float32Array(NODE_COUNT * 4);
/** Per-node dynamic state: glow and selection (see setNodeState). */
const N_GLOW = new Float32Array(NODE_COUNT);
const N_SELECT = new Float32Array(NODE_COUNT);
/**
 * Draw order of the nodes, far → near. There is no depth buffer, so this is
 * what makes a hub cover the skills passing behind it (and the core cover a hub
 * on the far side) while the system turns. Starts as core, hubs, leaves.
 */
const ORDER = new Int16Array(NODE_COUNT);
{
  let k = 0;
  ORDER[k++] = CORE;
  for (let i = 0; i < NODE_COUNT; i++) if (IS_HUB[i] && i !== CORE) ORDER[k++] = i;
  for (let i = 0; i < NODE_COUNT; i++) if (!IS_HUB[i]) ORDER[k++] = i;
}

const I_POS = new Float32Array(INSTANCES * 3);
const I_COLOR = new Float32Array(INSTANCES * 3);
/** radius (world), shape id, phase, entrance delay */
const I_PARAMS = new Float32Array(INSTANCES * 4);
/** Nodes: [glow, select]. Glows: [intensity, unused]. */
const I_STATE = new Float32Array(INSTANCES * 2);

for (let c = 0; c < ATMOS_COUNT; c++) {
  const backdrop = c === CLUSTER_COUNT;
  const center = backdrop ? [0, 0, 0] : CLUSTERS[c].center;
  I_POS.set(center, c * 3);
  // Backdrop takes the signature emerald; domain glows their own tint.
  I_COLOR.set(backdrop ? [0.204, 0.827, 0.6] : CLUSTER_RGB.subarray(c * 3, c * 3 + 3), c * 3);
  I_PARAMS.set(
    [
      backdrop ? ATMOS_BACKDROP_RADIUS : ATMOS_CLUSTER_RADIUS,
      SHAPE_ATMOS,
      c * 1.7,
      backdrop ? ATMOS_BACKDROP_FLATTEN : 1, // glows: vertical squash instead of an entrance delay
    ],
    c * 4,
  );
}
for (let i = 0; i < NODE_COUNT; i++) {
  const c = CLUSTER_OF[i];
  nodeRgb(i, N_COLOR, i * 3);
  const shape = i === CORE ? SHAPE_CORE : IS_HUB[i] ? SHAPE_ID[CLUSTERS[c].glyph] : 0;
  N_PARAMS.set([NODE_RADIUS[i], shape, i * 2.39996, NODE_ENTER[i]], i * 4);
}

const GEOMETRY = new THREE.InstancedBufferGeometry();
GEOMETRY.setAttribute(
  'position',
  new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]), 3),
);
GEOMETRY.setIndex([0, 1, 2, 2, 1, 3]);
// Every per-instance buffer is rewritten each frame (the draw order changes as
// the system turns): a few hundred floats.
const dynamicAttr = (array: Float32Array, size: number) => {
  const attr = new THREE.InstancedBufferAttribute(array, size);
  attr.setUsage(THREE.DynamicDrawUsage);
  return attr;
};
const POS_ATTR = dynamicAttr(I_POS, 3);
const COLOR_ATTR = dynamicAttr(I_COLOR, 3);
const PARAMS_ATTR = dynamicAttr(I_PARAMS, 4);
const STATE_ATTR = dynamicAttr(I_STATE, 2);
GEOMETRY.setAttribute('iPos', POS_ATTR);
GEOMETRY.setAttribute('iColor', COLOR_ATTR);
GEOMETRY.setAttribute('iParams', PARAMS_ATTR);
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
  ${POINTER_GLSL}
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

    if (shape > 4.5 && shape < 5.5) {
      // Domain glow: a plain soft quad. Collapsed off-screen while switched off,
      // so a disabled atmosphere costs no fill at all.
      vP = position.xy;
      vState = iState;
      vFade = 1.0;
      vReveal = smoothstep(0.2, 0.8, uEnter);
      mv.xy += position.xy * radius * vec2(1.0, iParams.w);
      gl_Position = uAtmos * iState.x > 0.002 ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }

    float core = step(5.5, shape);
    float hub = step(0.5, shape); // hubs and the core
    float reveal = smoothstep(iParams.w, iParams.w + 0.22, uEnter);
    float ping = pingAt(iPos);
    float near = pointerAt(projectionMatrix * mv);
    float glow = max(iState.x + (1.0 - hub) * 0.07 * sin(uTime * 1.6 + iParams.z), 0.0)
      + ping * 0.9 + near * mix(0.55, 0.22, hub);
    float lift = smoothstep(0.0, 0.6, iState.y);
    // Bloom in: overshoot slightly then settle, so each node "pops" into place.
    float pop = reveal * (1.0 + 0.38 * sin(reveal * 3.14159265));
    float scale = pop * mix(0.9 + 0.12 * min(glow, 1.2), 1.0, hub) * (1.0 + mix(0.22, 0.07, hub) * lift);
    scale *= 1.0 + core * 0.035 * sin(uTime * 1.3);
    float fade = depthFade(-mv.z);
    float ext = mix(mix(${LEAF_EXT.toFixed(1)}, ${HUB_EXT.toFixed(1)}, hub), ${CORE_EXT.toFixed(1)}, core);
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
  // Declared here as well: three uploads it per program, and the core's globe
  // needs the graph's rotation to keep its meridians fixed to the system.
  uniform mat4 modelViewMatrix;
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
    if (shape < 1.5) return length(p) - 0.5;
    if (shape < 2.5) return sdRhombus(p, 0.62);
    if (shape < 3.5) return sdHexagon(p.yx, 0.45);
    return sdTriangle(p + vec2(0.0, 0.07), 0.53);
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
  // Anti-aliased line at every integer of x (x in "cells"). The two fract()
  // phases never break at the same place, so the smaller derivative is always
  // the true one — including across the atan seam.
  float cellLine(float x, float halfPx) {
    float fw = min(fwidth(fract(x)), fwidth(fract(x + 0.5))) + 1e-5;
    float dist = abs(fract(x + 0.5) - 0.5) / fw;
    return 1.0 - smoothstep(halfPx, halfPx + 1.0, dist);
  }
  // Latitude / longitude wireframe on a unit sphere, for a graph-local normal.
  float globe(vec3 n, float spin) {
    float c = cos(spin);
    float s = sin(spin);
    n.xz = mat2(c, -s, s, c) * n.xz;
    float lon = atan(n.z, n.x) / 6.2831853 * 12.0;
    float lat = asin(clamp(n.y, -1.0, 1.0)) / 3.14159265 * 8.0;
    float pole = smoothstep(0.985, 0.9, abs(n.y)); // meridians bunch up at the poles
    return max(cellLine(lon, 0.35) * pole, cellLine(lat, 0.35));
  }

  void main() {
    float d = length(vP);
    float glow = vState.x;
    float sel = vState.y;

    if (vShape > 4.5 && vShape < 5.5) {
      // Analytic radial falloff (zero at the quad edge) + 1/255 dither against banding.
      float g = max(1.0 - d, 0.0);
      g = g * g * (0.55 + 0.45 * g);
      vec3 c = vColor * g * glow * uAtmos * vReveal + (hash(gl_FragCoord.xy) - 0.5) / 255.0;
      gl_FragColor = vec4(max(c, 0.0), 0.0);
      return;
    }

    float aa = fwidth(d) * 0.75 + 1e-4;
    float n = clamp(glow, 0.0, 1.7);
    // Dimmed (out-of-focus) nodes recede instead of just losing their halo.
    float lum = 0.2 + 0.8 * smoothstep(0.0, 0.6, n);
    float pinned = step(0.8, sel);
    float sz = sqrt(max(1.0 - d * d, 0.0));
    vec3 rgb;
    float a;

    if (vShape > 5.5) {
      // ── Core: a see-through holographic globe around a hot centre ──
      float inside = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, d);
      mat3 toLocal = mat3(modelViewMatrix);
      float spin = uTime * 0.22;
      // Front and back hemispheres share the pixel: the back one shows through, dimmer.
      float front = globe(vec3(vP, sz) * toLocal, spin);
      float back = globe(vec3(vP, -sz) * toLocal, spin);
      float limb = smoothstep(0.0, 0.3, sz); // wires thin out where the sphere turns away
      vec3 wire = vColor * (front * 0.85 + back * 0.26) * limb;
      float pulse = 0.5 + 0.5 * sin(uTime * 1.3);
      vec3 col = vec3(0.004, 0.02, 0.03) * 0.6;
      col += wire * (0.55 + 0.45 * lum);
      // Hot centre + soft inner body.
      col += mix(vColor, vec3(1.0), 0.55) * exp(-d * d * 10.0) * (0.62 + 0.22 * pulse) * lum;
      col += vColor * exp(-d * d * 2.2) * 0.2 * lum;
      // Fresnel limb.
      col += vColor * pow(1.0 - sz, 2.2) * 0.75 * lum;
      a = inside * 0.5;
      rgb = col * inside;
      float rim = 1.0 - smoothstep(0.02 - aa, 0.02 + aa, abs(d - 0.985));
      rgb += vColor * rim * 0.55 * lum;
      // Halo outside the sphere, gone before the quad edge.
      // (Capped: the core is already the brightest thing on the stage when selected.)
      float halo = exp(-max(d - 1.0, 0.0) * 2.4) * (1.0 - inside) * (0.3 + 0.1 * pulse) * min(n, 1.2);
      rgb += vColor * halo * (1.0 - smoothstep(1.9, 2.45, d));
      float lock = reticle(vP, d, 1.42 + 0.03 * sin(uTime * 4.0) * pinned, 0.028, aa, uTime * 0.14);
      rgb += mix(vColor, vec3(1.0), 0.35) * lock * sel;
    } else if (vShape > 0.5) {
      // ── Hub: dark glass orb + rim + emblem + HUD ticks ──
      float plate = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, d);
      float g = glyph(vP, vShape);
      float ga = fwidth(g) * 0.75 + 1e-4;
      float stroke = 1.0 - smoothstep(0.05 - ga, 0.05 + ga, abs(g));
      float fill = 1.0 - smoothstep(-ga, ga, g);
      vec3 col = vec3(0.01, 0.026, 0.05) + vColor * (0.035 + 0.09 * sz) * lum;
      col += vColor * (fill * 0.1 + exp(-abs(g) * 9.0) * 0.26) * lum;
      vec3 ink = mix(vColor, vec3(1.0), 0.18 + 0.3 * clamp(n - 0.9, 0.0, 0.75));
      col = mix(col, ink * (0.5 + 0.5 * lum), stroke);
      float core = 1.0 - smoothstep(0.12 - aa, 0.12 + aa, d);
      col = mix(col, mix(vColor, vec3(1.0), 0.6) * (0.55 + 0.45 * lum), core);
      // Glass: fresnel towards the limb and one soft glint, top-left.
      col += vColor * pow(1.0 - sz, 3.0) * 0.5 * lum;
      float spec = pow(max(dot(vec3(vP, sz), vec3(-0.42, 0.56, 0.715)), 0.0), 22.0);
      col += vec3(0.86, 1.0, 0.95) * spec * 0.2 * lum;
      float rim = 1.0 - smoothstep(0.035 - aa, 0.035 + aa, abs(d - 0.96));
      col = mix(col, vColor * (0.3 + 0.7 * lum), rim * 0.9);
      a = plate * 0.93;
      rgb = col * plate;
      // Halo skirt outside the plate (additive), fading out before the quad edge.
      float halo = exp(-max(d - 1.0, 0.0) * 3.2) * (1.0 - plate) * 0.36 * n;
      rgb += vColor * halo * (1.0 - smoothstep(1.5, 1.95, d));
      // HUD: a ring of ticks just off the plate, counter-turning; brighter in focus.
      float ang = atan(vP.y, vP.x + 1e-5) / 6.2831853;
      float ticks = step(0.5, fract(ang * 36.0 - uTime * 0.03));
      float hud = (1.0 - smoothstep(0.03 - aa, 0.03 + aa, abs(d - 1.2))) * ticks;
      rgb += vColor * hud * (0.16 + 0.34 * clamp(n - 0.8, 0.0, 0.8)) * lum;
      float lock = reticle(vP, d, 1.46 + 0.04 * sin(uTime * 4.0) * pinned, 0.035, aa, uTime * 0.14);
      rgb += mix(vColor, vec3(1.0), 0.35) * lock * sel;
    } else {
      // ── Leaf: glass bead + fresnel rim + halo, and a star glint when hot ──
      float core = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, d);
      vec3 col = vColor * (0.6 + 0.42 * min(n, 1.2)) * (0.5 + 0.5 * sz);
      col += vColor * pow(1.0 - sz, 2.0) * 0.5;
      float spec = pow(max(dot(vec3(vP, sz), vec3(-0.42, 0.56, 0.715)), 0.0), 9.0);
      col += vec3(1.0) * spec * (0.16 + 0.5 * clamp(n - 0.8, 0.0, 0.9));
      a = core * mix(0.5, 0.96, lum);
      rgb = col * lum * core;
      float halo = exp(-max(d - 1.0, 0.0) * 1.9) * 0.32 + exp(-d * d * 0.35) * 0.17;
      rgb += vColor * halo * (1.0 - core) * n * (1.0 - smoothstep(2.6, 3.6, d));
      // Four-point glint: only for the hovered / pinned / related skills.
      float hot = clamp(n - 1.0, 0.0, 0.65);
      vec2 q = abs(vP);
      float glint = exp(-q.y * 7.0) * exp(-q.x * 1.15) + exp(-q.x * 7.0) * exp(-q.y * 1.15);
      rgb += mix(vColor, vec3(1.0), 0.6) * glint * hot * 0.85 * (1.0 - smoothstep(2.4, 3.6, d));
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
    uPointer: SHARED.uPointer,
    uResolution: SHARED.uResolution,
    uAtmos: NODE_UNIFORMS.uAtmos,
  },
  vertexShader: VERTEX,
  fragmentShader: FRAGMENT,
  ...LAYER_MATERIAL,
});

export const NODE_MESH = new THREE.Mesh(GEOMETRY, MATERIAL);
NODE_MESH.frustumCulled = false; // instances live in the shader; the base quad's bounds mean nothing
NODE_MESH.renderOrder = 5;

/** Sets a node's glow (0..1.65) and selection (0 none, ~0.6 hover, 1 pinned). */
export function setNodeState(node: number, glow: number, select: number): void {
  N_GLOW[node] = glow;
  N_SELECT[node] = select;
}

/** Sets a glow's intensity. `index` is a cluster index, or CLUSTER_COUNT for the backdrop. */
export function setAtmosState(index: number, intensity: number): void {
  I_STATE[index * 2] = intensity;
}

/**
 * Per frame: re-sorts the nodes far → near by `depth` (view-space depth per
 * node, from the scene's projection pass) and rewrites the instance buffers in
 * that order, with the current (moving) positions and state.
 */
export function syncNodes(depth: Float32Array): void {
  // Insertion sort: the order barely changes between frames, so this is ~linear.
  for (let a = 1; a < NODE_COUNT; a++) {
    const i = ORDER[a];
    const d = depth[i];
    let k = a - 1;
    while (k >= 0 && depth[ORDER[k]] < d) {
      ORDER[k + 1] = ORDER[k];
      k--;
    }
    ORDER[k + 1] = i;
  }
  for (let k = 0; k < NODE_COUNT; k++) {
    const i = ORDER[k];
    const s = ATMOS_COUNT + k;
    I_POS[s * 3] = NODE_POSITIONS[i * 3];
    I_POS[s * 3 + 1] = NODE_POSITIONS[i * 3 + 1];
    I_POS[s * 3 + 2] = NODE_POSITIONS[i * 3 + 2];
    I_COLOR[s * 3] = N_COLOR[i * 3];
    I_COLOR[s * 3 + 1] = N_COLOR[i * 3 + 1];
    I_COLOR[s * 3 + 2] = N_COLOR[i * 3 + 2];
    I_PARAMS[s * 4] = N_PARAMS[i * 4];
    I_PARAMS[s * 4 + 1] = N_PARAMS[i * 4 + 1];
    I_PARAMS[s * 4 + 2] = N_PARAMS[i * 4 + 2];
    I_PARAMS[s * 4 + 3] = N_PARAMS[i * 4 + 3];
    I_STATE[s * 2] = N_GLOW[i];
    I_STATE[s * 2 + 1] = N_SELECT[i];
  }
  POS_ATTR.needsUpdate = true;
  COLOR_ATTR.needsUpdate = true;
  PARAMS_ATTR.needsUpdate = true;
  STATE_ATTR.needsUpdate = true;
}
