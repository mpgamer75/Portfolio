import * as THREE from 'three';
import { LAYER_MATERIAL, SHARED } from './sceneShared';

/*
 * Star layer — a seeded, three-depth starfield in ONE draw call.
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
