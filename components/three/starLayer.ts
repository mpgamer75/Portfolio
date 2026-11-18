import * as THREE from 'three';
import { LAYER_MATERIAL, SHARED } from './sceneShared';

/*
 * Deep-sky layer — two draw calls behind everything else:
 *
 *   NEBULA_MESH  one full-stage quad sampling a pre-rendered nebula plate
 *                (public/images/space/nebula.webp, same-origin, so the CSP's
 *                img-src 'self' covers it). A texture lookup costs a fraction
 *                of what a procedural nebula would at 2x pixel density.
 *   STAR_POINTS  a seeded, three-depth starfield with a handful of bright
 *                stars that carry diffraction spikes.
 *
 * Both are authored directly in clip space (x,y in -1..1, any aspect ratio), so
 * the sky always fills the stage. Depth is faked in the vertex shader: each
 * layer slides by a different amount as the system turns, tilts, or the camera
 * dollies/trucks, and wraps around the edges — near stars drift faster than far
 * ones, and the nebula barely moves at all.
 */

const FAR_COUNT = 760;
const MID_COUNT = 430;
const NEAR_COUNT = 190;
/** Bright stars with diffraction spikes (stored first, always drawn). */
const FEATURE_COUNT = 14;
export const STAR_COUNT = FEATURE_COUNT + NEAR_COUNT + MID_COUNT + FAR_COUNT;
/** Stars drawn when the far layer is switched off (it is stored last). */
export const STAR_COUNT_LEAN = FEATURE_COUNT + NEAR_COUNT + MID_COUNT;
/** Clip-space wrap range — a margin beyond the edge so wrapping happens off-screen. */
const WRAP = 1.12;

/** Deterministic PRNG (mulberry32): the sky is identical on every load. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** x, y in clip space; z = layer (2 near, 1 mid, 0 far). */
const POSITIONS = new Float32Array(STAR_COUNT * 3);
/** size (px at DPR 1), twinkle phase, tint seed, spike flag */
const STARS = new Float32Array(STAR_COUNT * 4);
{
  const rand = mulberry32(0x5eed1e);
  for (let i = 0; i < STAR_COUNT; i++) {
    const feature = i < FEATURE_COUNT;
    const j = i - FEATURE_COUNT;
    const layer = feature ? 1 : j < NEAR_COUNT ? 2 : j < NEAR_COUNT + MID_COUNT ? 1 : 0;
    POSITIONS[i * 3] = (rand() * 2 - 1) * WRAP;
    POSITIONS[i * 3 + 1] = (rand() * 2 - 1) * WRAP;
    POSITIONS[i * 3 + 2] = layer;
    // Mostly tiny; a long tail of larger ones per layer (rand^4 skews towards 0).
    STARS[i * 4] = feature ? 15 + rand() * 11 : 0.9 + layer * 0.4 + rand() ** 4 * 2.2;
    STARS[i * 4 + 1] = rand() * 6.2831853;
    STARS[i * 4 + 2] = rand();
    STARS[i * 4 + 3] = feature ? 1 : 0;
  }
}

const GEOMETRY = new THREE.BufferGeometry();
GEOMETRY.setAttribute('position', new THREE.BufferAttribute(POSITIONS, 3));
GEOMETRY.setAttribute('aStar', new THREE.BufferAttribute(STARS, 4));

const VERTEX = /* glsl */ `
  attribute vec4 aStar;
  uniform float uTime;
  uniform float uDpr;
  uniform float uEnter;
  uniform vec2 uResolution;
  uniform vec3 uDrift; // x/y: slide (yaw, tilt, camera truck) in clip units; z: dolly
  varying vec4 vStar; // rgb + alpha
  varying float vSpike;

  void main() {
    float layer = position.z;
    float depth = 0.3 + 0.35 * layer; // parallax factor: 0.3 far → 1.0 near
    vec2 p = position.xy - uDrift.xy * depth;
    p = mod(p + ${WRAP.toFixed(2)}, ${(WRAP * 2).toFixed(2)}) - ${WRAP.toFixed(2)};
    p *= 1.0 + uDrift.z * depth;
    gl_Position = vec4(p, 0.0, 1.0);
    // Size follows the stage height so the field has the same texture on any canvas.
    gl_PointSize = aStar.x * uDpr * clamp(uResolution.y / 720.0, 0.7, 1.3);
    float twinkle = 0.7 + 0.3 * sin(uTime * (0.5 + 0.9 * aStar.z) + aStar.y);
    // Mostly cool white and mint; one star in seven runs warm.
    vec3 tint = mix(vec3(0.5, 0.93, 0.76), vec3(0.84, 0.93, 1.0), smoothstep(0.15, 0.75, aStar.z));
    tint = mix(tint, vec3(1.0, 0.87, 0.72), step(0.86, aStar.z));
    float base = mix(0.22 + 0.2 * layer, 0.85, aStar.w);
    vStar = vec4(tint, base * twinkle * smoothstep(0.0, 0.35, uEnter + 0.25));
    vSpike = aStar.w;
  }
`;

const FRAGMENT = /* glsl */ `
  varying vec4 vStar;
  varying float vSpike;
  void main() {
    vec2 q = gl_PointCoord - 0.5;
    float d = length(q);
    float a;
    if (vSpike > 0.5) {
      // Tight core, soft bloom, and a four-point diffraction cross.
      float core = exp(-d * d * 520.0);
      float bloom = exp(-d * 13.0) * 0.22;
      vec2 s = abs(q);
      float cross = exp(-s.y * 90.0) * exp(-s.x * 9.0) + exp(-s.x * 90.0) * exp(-s.y * 9.0);
      a = (core + bloom + cross * 0.42) * (1.0 - smoothstep(0.36, 0.5, d));
    } else {
      a = 1.0 - smoothstep(0.1, 0.5, d);
      a *= a;
    }
    gl_FragColor = vec4(vStar.rgb * a * vStar.a, 0.0);
  }
`;

/** x/y: parallax slide in clip units; z: dolly amount (scales the field about its centre). */
export const STAR_DRIFT = new THREE.Vector3();

const MATERIAL = new THREE.ShaderMaterial({
  uniforms: {
    uTime: SHARED.uTime,
    uDpr: SHARED.uDpr,
    uEnter: SHARED.uEnter,
    uResolution: SHARED.uResolution,
    uDrift: { value: STAR_DRIFT },
  },
  vertexShader: VERTEX,
  fragmentShader: FRAGMENT,
  ...LAYER_MATERIAL,
});

export const STAR_POINTS = new THREE.Points(GEOMETRY, MATERIAL);
STAR_POINTS.frustumCulled = false; // positions are clip-space, not world-space
STAR_POINTS.renderOrder = 1;

/** Lowest quality tier: stop drawing the far layer (stored last in the buffer). */
export function setFarStars(on: boolean): void {
  GEOMETRY.setDrawRange(0, on ? STAR_COUNT : STAR_COUNT_LEAN);
}

/* ── Nebula plate ─────────────────────────────────────────────────────────── */

const NEBULA_SRC = '/images/space/nebula.webp';
/** Width / height of the plate. */
const NEBULA_ASPECT = 2048 / 1158;
/** The plate is drawn this much larger than the stage, leaving room to slide. */
const NEBULA_OVERSCAN = 1.16;

/** Master strength: 0 until the plate has decoded, then eased in by the scene. */
export const NEBULA = { loaded: false, strength: 0 };

const NEBULA_UNIFORMS = {
  uMap: { value: null as THREE.Texture | null },
  uStrength: { value: 0 },
};

const NEBULA_VERTEX = /* glsl */ `
  uniform vec2 uResolution;
  uniform vec3 uDrift;
  varying vec2 vUv;
  varying float vEdge;
  void main() {
    vEdge = position.y;
    // "Cover" fit for any stage aspect, then a slow slide (the farthest plane).
    float stage = uResolution.x / max(uResolution.y, 1.0);
    vec2 fit = stage > ${NEBULA_ASPECT.toFixed(4)}
      ? vec2(1.0, ${NEBULA_ASPECT.toFixed(4)} / stage)
      : vec2(stage / ${NEBULA_ASPECT.toFixed(4)}, 1.0);
    vec2 p = position.xy * fit / ${NEBULA_OVERSCAN.toFixed(2)};
    p -= uDrift.xy * 0.085;
    p *= 1.0 - uDrift.z * 0.12;
    vUv = p * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const NEBULA_FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uStrength;
  varying vec2 vUv;
  varying float vEdge;
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }
  void main() {
    vec3 c = texture2D(uMap, clamp(vUv, 0.0, 1.0)).rgb;
    // Lift the black point out (the plate is added over the page, so its floor
    // must be exactly zero), then let the bright filaments bloom a little.
    c = max(c - 0.035, 0.0);
    c *= 1.0 + 0.9 * dot(c, vec3(0.3333));
    // Fade to nothing at the top and bottom so the stage has no visible edge.
    float edge = 1.0 - smoothstep(0.62, 1.0, abs(vEdge));
    c = c * uStrength * edge + (hash(gl_FragCoord.xy) - 0.5) / 255.0;
    gl_FragColor = vec4(max(c, 0.0), 0.0);
  }
`;

const NEBULA_GEOMETRY = new THREE.BufferGeometry();
NEBULA_GEOMETRY.setAttribute(
  'position',
  new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]), 3),
);
NEBULA_GEOMETRY.setIndex([0, 1, 2, 2, 1, 3]);

const NEBULA_MATERIAL = new THREE.ShaderMaterial({
  uniforms: {
    uResolution: SHARED.uResolution,
    uDrift: { value: STAR_DRIFT },
    ...NEBULA_UNIFORMS,
  },
  vertexShader: NEBULA_VERTEX,
  fragmentShader: NEBULA_FRAGMENT,
  ...LAYER_MATERIAL,
});

export const NEBULA_MESH = new THREE.Mesh(NEBULA_GEOMETRY, NEBULA_MATERIAL);
NEBULA_MESH.frustumCulled = false;
NEBULA_MESH.renderOrder = 0;
// Nothing to draw until the plate has decoded (and never, if it fails to load).
NEBULA_MESH.visible = false;

let nebulaRequested = false;

/** Starts loading the plate (once). A failed load just leaves the sky to the stars. */
export function loadNebula(): void {
  if (nebulaRequested) return;
  nebulaRequested = true;
  new THREE.TextureLoader().load(
    NEBULA_SRC,
    (texture) => {
      // Sampled and output as authored sRGB values, like every colour in the scene.
      texture.colorSpace = THREE.NoColorSpace;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      NEBULA_UNIFORMS.uMap.value = texture;
      NEBULA_MESH.visible = true;
      NEBULA.loaded = true;
    },
    undefined,
    () => {
      nebulaRequested = false;
    },
  );
}

/** Per-frame: eases the plate in once loaded; `target` dims it while something is pinned. */
export function updateNebula(dt: number, target: number): void {
  const goal = NEBULA.loaded ? target : 0;
  NEBULA.strength += (goal - NEBULA.strength) * (1 - Math.exp(-dt * 1.6));
  NEBULA_UNIFORMS.uStrength.value = NEBULA.strength;
}

/** Releases the plate's GPU copy (it re-uploads on next use). */
export function disposeNebulaTexture(): void {
  NEBULA_UNIFORMS.uMap.value?.dispose();
}
