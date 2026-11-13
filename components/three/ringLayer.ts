import * as THREE from 'three';
import { CLUSTERS, CLUSTER_RGB, CORE_RADIUS_W, CORE_RGB, ORBIT_RADIUS } from './constellationData';
import { CLUSTER_U, CLUSTER_V } from './orbitSim';
import { FOG_GLSL, LAYER_MATERIAL, PING_GLSL, SHARED } from './sceneShared';

/*
 * Ring layer — everything that is "a figure drawn on a plane in space", in ONE
 * instanced draw call of quads that really lie in 3D (so perspective, tilt and
 * rotation are exact, and the depth cue is free):
 *
 *   disc  — the orbital plane: a polar grid with the hubs' shared orbit, tick
 *           marks, a slow radar sweep and pulse rings radiating from the core
 *   gyro  — three broken rings tumbling around the core
 *   track — the ring(s) each domain's skills ride around their hub
 *
 * All lines are anti-aliased in screen space (constant pixel width however the
 * plane is foreshortened) and purely additive.
 */

const KIND_TRACK = 0;
const KIND_DISC = 2;
const KIND_GYRO = 3;

/** World radius of the grid disc. */
const DISC_RADIUS = 9.6;
const GYRO_RADII = [1.42, 1.72, 2.06].map((k) => k * CORE_RADIUS_W);
/** Tumble of each gyro ring: resting lean, lean speed, turn speed (rad, rad/s). */
const GYRO_MOTION = [
  [1.15, 0.21, 0.33],
  [0.5, -0.16, -0.27],
  [1.9, 0.12, 0.19],
];

const TRACKS: { cluster: number; radius: number }[] = [];
CLUSTERS.forEach((c, ci) => c.rings.forEach((radius) => TRACKS.push({ cluster: ci, radius })));

const GYRO_AT = 1;
const TRACK_AT = GYRO_AT + GYRO_RADII.length;
const INSTANCES = TRACK_AT + TRACKS.length;

const I_CENTER = new Float32Array(INSTANCES * 3);
const I_U = new Float32Array(INSTANCES * 3);
const I_V = new Float32Array(INSTANCES * 3);
const I_COLOR = new Float32Array(INSTANCES * 3);
/** radius (world), kind, phase, entrance delay */
const I_PARAMS = new Float32Array(INSTANCES * 4);
/** Dynamic brightness per instance. */
const I_INT = new Float32Array(INSTANCES);

// Disc: the orbital (XZ) plane.
I_U.set([1, 0, 0], 0);
I_V.set([0, 0, 1], 0);
I_COLOR.set([0.204, 0.827, 0.6], 0);
I_PARAMS.set([DISC_RADIUS, KIND_DISC, 0, 0], 0);
I_INT[0] = 1;
GYRO_RADII.forEach((radius, k) => {
  const s = GYRO_AT + k;
  I_COLOR.set(CORE_RGB, s * 3);
  I_PARAMS.set([radius, KIND_GYRO, k * 0.37, 0.04 + 0.05 * k], s * 4);
  I_INT[s] = 1;
});
TRACKS.forEach((t, k) => {
  const s = TRACK_AT + k;
  I_CENTER.set(CLUSTERS[t.cluster].center, s * 3);
  I_COLOR.set(CLUSTER_RGB.subarray(t.cluster * 3, t.cluster * 3 + 3), s * 3);
  I_PARAMS.set([t.radius, KIND_TRACK, k * 0.21, 0.42 + 0.04 * t.cluster], s * 4);
  I_INT[s] = 0.2;
});

const GEOMETRY = new THREE.InstancedBufferGeometry();
GEOMETRY.setAttribute(
  'position',
  new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]), 3),
);
GEOMETRY.setIndex([0, 1, 2, 2, 1, 3]);
const dynamicAttr = (array: Float32Array, size: number) => {
  const attr = new THREE.InstancedBufferAttribute(array, size);
  attr.setUsage(THREE.DynamicDrawUsage);
  return attr;
};
const U_ATTR = dynamicAttr(I_U, 3);
const V_ATTR = dynamicAttr(I_V, 3);
const INT_ATTR = dynamicAttr(I_INT, 1);
GEOMETRY.setAttribute('iCenter', new THREE.InstancedBufferAttribute(I_CENTER, 3));
GEOMETRY.setAttribute('iU', U_ATTR);
GEOMETRY.setAttribute('iV', V_ATTR);
GEOMETRY.setAttribute('iColor', new THREE.InstancedBufferAttribute(I_COLOR, 3));
GEOMETRY.setAttribute('iParams', new THREE.InstancedBufferAttribute(I_PARAMS, 4));
GEOMETRY.setAttribute('iInt', INT_ATTR);
GEOMETRY.instanceCount = INSTANCES;

/** Quad half-extent in ring radii for tracks / gyros (the ring sits at radius 1). */
const RING_EXT = 1.06;

const VERTEX = /* glsl */ `
  attribute vec3 iCenter;
  attribute vec3 iU;
  attribute vec3 iV;
  attribute vec3 iColor;
  attribute vec4 iParams;
  attribute float iInt;
  uniform float uEnter;
  ${FOG_GLSL}
  ${PING_GLSL}
  varying vec2 vP;
  varying vec4 vTint; // rgb + brightness
  varying vec4 vMeta; // kind, phase, entrance progress, ping
  varying float vFade;

  void main() {
    float disc = step(1.5, iParams.y) * (1.0 - step(2.5, iParams.y));
    float ext = mix(${RING_EXT.toFixed(2)}, 1.0, disc);
    vP = position.xy * ext;
    vec3 p = iCenter + (iU * vP.x + iV * vP.y) * iParams.x;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    // The disc spans the whole depth range, so it fades per fragment instead.
    float fade = depthFade(-(modelViewMatrix * vec4(iCenter, 1.0)).z);
    vFade = -mv.z;
    vTint = vec4(iColor, iInt * mix(fade, 1.0, disc));
    vMeta = vec4(iParams.y, iParams.z, (uEnter - iParams.w) / 0.3, pingAt(iCenter) * (1.0 - disc));
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uEnter;
  uniform float uGrid;
  ${FOG_GLSL}
  ${PING_GLSL}
  varying vec2 vP;
  varying vec4 vTint;
  varying vec4 vMeta;
  varying float vFade;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }
  // Anti-aliased line at every integer of x. The two fract() phases never break
  // at the same place, so the smaller derivative is the true one (also across
  // the atan seam). Fades out where the lines get denser than the pixels.
  float gridLine(float x, float halfPx) {
    float fw = min(fwidth(fract(x)), fwidth(fract(x + 0.5))) + 1e-5;
    float dist = abs(fract(x + 0.5) - 0.5) / fw;
    return (1.0 - smoothstep(halfPx, halfPx + 1.0, dist)) * (1.0 - smoothstep(0.16, 0.42, fw));
  }

  void main() {
    float kind = vMeta.x;
    float ang = atan(vP.y, vP.x) / 6.2831853; // -0.5 .. 0.5
    vec3 col;

    if (kind > 1.5 && kind < 2.5) {
      // ── Orbital plane: polar grid, orbit, radar sweep, pulse rings ──
      float r = length(vP) * ${DISC_RADIUS.toFixed(1)};
      float orbitR = ${ORBIT_RADIUS.toFixed(2)};
      float fr = fwidth(r) + 1e-5;
      float rings = gridLine((r - orbitR) / 1.5, 0.25);
      float spokes = gridLine(ang * 24.0, 0.25) * smoothstep(1.7, 2.9, r);
      float ticks = gridLine(ang * 96.0, 0.3) * (1.0 - smoothstep(0.09, 0.09 + fr, abs(r - orbitR)));
      float orbit = 1.0 - smoothstep(0.7, 1.7, abs(r - orbitR) / fr);

      // Radar sweep: a bright edge turning round the plane with a long trail.
      float sw = fract(uTime * 0.045 - ang);
      float sweep = pow(1.0 - sw, 7.0) + exp(-sw * 260.0) * 0.6;
      // Pulse rings radiating from the core.
      float pr = fract(uTime * 0.085) * ${(DISC_RADIUS * 1.02).toFixed(2)};
      float pulse = exp(-(r - pr) * (r - pr) * 2.6) * (1.0 - pr / ${(DISC_RADIUS * 1.02).toFixed(2)});
      // Two markers running the orbit.
      float run = fract(ang * 2.0 - uTime * 0.03);
      float runner = smoothstep(0.0, 0.01, run) * exp(-run * 16.0);

      float grid = max(max(rings * 0.5, spokes * 0.3), ticks * 0.75) * uGrid;
      float lum = grid * (0.3 + sweep * 1.25 + pulse * 1.1);
      lum += orbit * (0.42 + sweep * 0.7 + runner * 1.3 + pulse * 0.6);
      lum += (sweep * 0.03 + pulse * 0.022) * uGrid;

      // Entrance: the plane radiates out from the core behind a bright front.
      float edge = (uEnter / 0.5) * ${(DISC_RADIUS * 1.1).toFixed(2)};
      float wipe = 1.0 - smoothstep(edge - 0.7, edge, r);
      float front = exp(-(r - edge) * (r - edge) * 3.0) * (1.0 - smoothstep(0.36, 0.5, uEnter));
      lum = lum * wipe + (grid + orbit + 0.04) * front * 1.4;

      // Soft outer falloff, and a clear hole under the core and its gyro rings.
      float fall = smoothstep(${DISC_RADIUS.toFixed(1)}, ${(DISC_RADIUS * 0.42).toFixed(2)}, r);
      lum *= fall * fall * smoothstep(1.3, 2.4, r);
      // The shockwave of a pin crosses the plane as well.
      vec3 p = vec3(vP.x, 0.0, vP.y) * ${DISC_RADIUS.toFixed(1)};
      lum *= 1.0 + pingAt(p) * 2.2;
      col = vTint.rgb * lum * depthFade(vFade);
      col += (hash(gl_FragCoord.xy) - 0.5) / 255.0 * step(0.004, lum);
    } else {
      float r = length(vP);
      float px = abs(r - 1.0) / (fwidth(r) + 1e-5);
      float draw = clamp(vMeta.z, 0.0, 1.0);
      if (kind < 0.5) {
        // ── Skill ring: a hairline that sweeps in around its hub ──
        float line = 1.0 - smoothstep(0.35, 1.35, px);
        float swept = 1.0 - smoothstep(draw - 0.03, draw, ang + 0.5) * step(draw, 0.999);
        // A soft highlight travels the ring.
        float hi = fract(ang - uTime * 0.02 + vMeta.y);
        col = vTint.rgb * line * swept * (0.75 + 0.9 * exp(-hi * 9.0));
      } else {
        // ── Gyro ring: broken arcs with a bright leading end ──
        float line = 1.0 - smoothstep(0.75, 1.75, px);
        float seg = fract(ang * 3.0 + vMeta.y);
        float arc = smoothstep(0.0, 0.03, seg) * (1.0 - smoothstep(0.6, 0.66, seg));
        float lead = exp(-seg * 22.0);
        col = vTint.rgb * line * arc * (0.36 + 0.8 * lead) * draw;
      }
      col *= 1.0 + vMeta.w * 1.4;
    }

    gl_FragColor = vec4(max(col * vTint.a, 0.0), 0.0);
  }
`;

/** Layer-local uniforms. `uGrid` scales the disc's grid lines (the orbit itself stays). */
export const RING_UNIFORMS = {
  uGrid: { value: 1 },
};

const MATERIAL = new THREE.ShaderMaterial({
  uniforms: {
    uTime: SHARED.uTime,
    uEnter: SHARED.uEnter,
    uFogNear: SHARED.uFogNear,
    uFogFar: SHARED.uFogFar,
    uPing: SHARED.uPing,
    uGrid: RING_UNIFORMS.uGrid,
  },
  vertexShader: VERTEX,
  fragmentShader: FRAGMENT,
  side: THREE.DoubleSide, // the planes are seen from both faces as the system tips
  ...LAYER_MATERIAL,
});

export const RING_MESH = new THREE.Mesh(GEOMETRY, MATERIAL);
RING_MESH.frustumCulled = false; // instances live in the shader
RING_MESH.renderOrder = 2;

const EPS = 0.0015;
let intDirty = true;

/** Brightness of the grid disc and the core's gyro rings (they dim together). */
export function setSystemRingIntensity(value: number): void {
  if (Math.abs(I_INT[0] - value) < EPS) return;
  for (let s = 0; s < TRACK_AT; s++) I_INT[s] = value;
  intDirty = true;
}

/** Brightness of one domain's skill rings. */
export function setTrackIntensity(cluster: number, value: number): void {
  for (let k = 0; k < TRACKS.length; k++) {
    if (TRACKS[k].cluster !== cluster) continue;
    const s = TRACK_AT + k;
    if (Math.abs(I_INT[s] - value) > EPS) {
      I_INT[s] = value;
      intDirty = true;
    }
  }
}

/**
 * Per frame: tumbles the gyro rings and copies each domain's current ring-plane
 * basis (it swings round when the domain unfolds), then uploads what changed.
 */
export function syncRings(time: number): void {
  for (let k = 0; k < GYRO_MOTION.length; k++) {
    const [lean, leanRate, turnRate] = GYRO_MOTION[k];
    const a = lean + time * leanRate;
    const b = time * turnRate;
    const o = (GYRO_AT + k) * 3;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const cb = Math.cos(b);
    const sb = Math.sin(b);
    // The XZ plane leaned about X by a, then turned about Y by b.
    I_U[o] = cb;
    I_U[o + 1] = 0;
    I_U[o + 2] = -sb;
    I_V[o] = ca * sb;
    I_V[o + 1] = -sa;
    I_V[o + 2] = ca * cb;
  }
  for (let k = 0; k < TRACKS.length; k++) {
    const o = (TRACK_AT + k) * 3;
    const c = TRACKS[k].cluster * 3;
    I_U[o] = CLUSTER_U[c];
    I_U[o + 1] = CLUSTER_U[c + 1];
    I_U[o + 2] = CLUSTER_U[c + 2];
    I_V[o] = CLUSTER_V[c];
    I_V[o + 1] = CLUSTER_V[c + 1];
    I_V[o + 2] = CLUSTER_V[c + 2];
  }
  U_ATTR.needsUpdate = true;
  V_ATTR.needsUpdate = true;
  if (intDirty) {
    INT_ATTR.needsUpdate = true;
    intDirty = false;
  }
}
