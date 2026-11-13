import * as THREE from 'three';
import { FOG_GLSL, LAYER_MATERIAL, SHARED } from './sceneShared';

/*
 * Star layer — a seeded, three-depth starfield in ONE draw call, plus a second
 * small draw of "dust": motes that live inside the system and turn with it.
 *
 * Stars are authored directly in clip space (x,y in -1..1, any aspect ratio),
 * so the field always fills the stage. Depth is faked in the vertex shader:
 * each layer slides by a different amount as the graph turns, tilts, or the
 * camera dollies/trucks, and wraps around the edges — near stars drift faster
 * than far ones, which is what makes the constellation read as sitting in space.
 */

const FAR_COUNT = 190;
const MID_COUNT = 140;
const NEAR_COUNT = 90;
export const STAR_COUNT = FAR_COUNT + MID_COUNT + NEAR_COUNT;
/** Stars drawn when the far layer is switched off (it is stored last). */
export const STAR_COUNT_LEAN = MID_COUNT + NEAR_COUNT;
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
/** size (px at DPR 1), twinkle phase, warmth (0 mint → 1 white) */
const STARS = new Float32Array(STAR_COUNT * 3);
{
  const rand = mulberry32(0x5eed1e);
  for (let i = 0; i < STAR_COUNT; i++) {
    const layer = i < NEAR_COUNT ? 2 : i < NEAR_COUNT + MID_COUNT ? 1 : 0;
    POSITIONS[i * 3] = (rand() * 2 - 1) * WRAP;
    POSITIONS[i * 3 + 1] = (rand() * 2 - 1) * WRAP;
    POSITIONS[i * 3 + 2] = layer;
    // Mostly small; a few larger ones per layer (rand^3 skews towards 0).
    STARS[i * 3] = 1.1 + layer * 0.45 + rand() ** 3 * 1.6;
    STARS[i * 3 + 1] = rand() * 6.2831853;
    STARS[i * 3 + 2] = rand();
  }
}

const GEOMETRY = new THREE.BufferGeometry();
GEOMETRY.setAttribute('position', new THREE.BufferAttribute(POSITIONS, 3));
GEOMETRY.setAttribute('aStar', new THREE.BufferAttribute(STARS, 3));

const VERTEX = /* glsl */ `
  attribute vec3 aStar;
  uniform float uTime;
  uniform float uDpr;
  uniform vec2 uResolution;
  uniform vec3 uDrift; // x/y: slide (yaw, tilt, camera truck) in clip units; z: dolly
  varying vec4 vStar; // rgb + alpha

  void main() {
    float layer = position.z;
    float depth = 0.3 + 0.35 * layer; // parallax factor: 0.3 far → 1.0 near
    vec2 p = position.xy - uDrift.xy * depth;
    p = mod(p + ${WRAP.toFixed(2)}, ${(WRAP * 2).toFixed(2)}) - ${WRAP.toFixed(2)};
    p *= 1.0 + uDrift.z * depth;
    gl_Position = vec4(p, 0.0, 1.0);
    // Size follows the stage height so the field has the same texture on any canvas.
    gl_PointSize = aStar.x * uDpr * clamp(uResolution.y / 720.0, 0.7, 1.3);
    float twinkle = 0.72 + 0.28 * sin(uTime * (0.45 + 0.35 * aStar.z) + aStar.y);
    vec3 tint = mix(vec3(0.42, 0.9, 0.72), vec3(0.86, 0.95, 1.0), aStar.z);
    vStar = vec4(tint, (0.2 + 0.2 * layer) * twinkle);
  }
`;

const FRAGMENT = /* glsl */ `
  varying vec4 vStar;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = 1.0 - smoothstep(0.12, 0.5, d);
    gl_FragColor = vec4(vStar.rgb * a * vStar.a, 0.0);
  }
`;

/** x/y: parallax slide in clip units; z: dolly amount (scales the field about its centre). */
export const STAR_DRIFT = new THREE.Vector3();

const MATERIAL = new THREE.ShaderMaterial({
  uniforms: {
    uTime: SHARED.uTime,
    uDpr: SHARED.uDpr,
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

/*
 * Dust — motes scattered through the system's own volume (graph-local, so they
 * orbit and tilt with it). They are what makes a drag read as a turn in depth:
 * near motes sweep past large and soft, far ones barely move.
 */
const DUST_COUNT = 150;
const DUST_POS = new Float32Array(DUST_COUNT * 3);
/** world size, twinkle phase, drift phase */
const DUST_META = new Float32Array(DUST_COUNT * 3);
{
  const rand = mulberry32(0xd057);
  for (let i = 0; i < DUST_COUNT; i++) {
    // A thick disc around the orbital plane, denser towards the middle.
    const r = 2.2 + Math.sqrt(rand()) * 9.2;
    const a = rand() * 6.2831853;
    DUST_POS[i * 3] = Math.cos(a) * r;
    DUST_POS[i * 3 + 1] = (rand() * 2 - 1) * (1.1 + 0.28 * r);
    DUST_POS[i * 3 + 2] = Math.sin(a) * r;
    DUST_META[i * 3] = 0.035 + rand() ** 2 * 0.085;
    DUST_META[i * 3 + 1] = rand() * 6.2831853;
    DUST_META[i * 3 + 2] = rand() * 6.2831853;
  }
}

const DUST_GEOMETRY = new THREE.BufferGeometry();
DUST_GEOMETRY.setAttribute('position', new THREE.BufferAttribute(DUST_POS, 3));
DUST_GEOMETRY.setAttribute('aDust', new THREE.BufferAttribute(DUST_META, 3));

const DUST_VERTEX = /* glsl */ `
  attribute vec3 aDust;
  uniform float uTime;
  uniform float uEnter;
  uniform float uDpr;
  uniform vec2 uResolution;
  ${FOG_GLSL}
  varying vec4 vDust; // rgb + alpha

  void main() {
    vec3 p = position;
    // A slow wander, so the field is never frozen even when the system is held.
    p += 0.35 * vec3(
      sin(uTime * 0.11 + aDust.z),
      sin(uTime * 0.09 + aDust.z * 1.7),
      cos(uTime * 0.1 + aDust.z * 0.6)
    );
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float depth = max(-mv.z, 0.5);
    float px = aDust.x * projectionMatrix[1][1] * uResolution.y / depth;
    gl_PointSize = clamp(px, 1.0, 26.0) * uDpr;
    float twinkle = 0.65 + 0.35 * sin(uTime * 0.6 + aDust.y);
    // Bokeh: a mote close to the lens is large, so it spreads its light thin.
    float thin = 1.0 / (1.0 + px * px * 0.02);
    float alpha = 0.5 * twinkle * thin * depthFade(depth) * smoothstep(1.2, 3.5, depth);
    vDust = vec4(mix(vec3(0.35, 0.92, 0.72), vec3(0.8, 1.0, 0.95), fract(aDust.y)), alpha * smoothstep(0.35, 0.9, uEnter));
  }
`;

const DUST_FRAGMENT = /* glsl */ `
  varying vec4 vDust;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = 1.0 - smoothstep(0.08, 0.5, d);
    gl_FragColor = vec4(vDust.rgb * a * a * vDust.a, 0.0);
  }
`;

const DUST_MATERIAL = new THREE.ShaderMaterial({
  uniforms: {
    uTime: SHARED.uTime,
    uEnter: SHARED.uEnter,
    uDpr: SHARED.uDpr,
    uResolution: SHARED.uResolution,
    uFogNear: SHARED.uFogNear,
    uFogFar: SHARED.uFogFar,
  },
  vertexShader: DUST_VERTEX,
  fragmentShader: DUST_FRAGMENT,
  ...LAYER_MATERIAL,
});

export const DUST_POINTS = new THREE.Points(DUST_GEOMETRY, DUST_MATERIAL);
DUST_POINTS.frustumCulled = false; // the wander happens in the shader
DUST_POINTS.renderOrder = 3;

/** Lowest quality tier: no dust. */
export function setDust(on: boolean): void {
  DUST_POINTS.visible = on;
}
