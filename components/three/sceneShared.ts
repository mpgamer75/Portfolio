import * as THREE from 'three';

/*
 * Camera constants, the uniforms every constellation layer shares, and the
 * common material settings. One uniform object per value: three keeps the
 * reference, so a single write per frame updates every material at once.
 */

export const FOV = 40;
export const HOME_Z = 16;
export const FOCAL_F = 1 / Math.tan(((FOV / 2) * Math.PI) / 180);

/** The orbital plane is tipped this far towards the camera (rad), so we look down on it. */
export const BASE_TILT = 0.5;
/** …and the whole system rides this far above the camera axis, which centres the tilted disc. */
export const SYSTEM_LIFT = 1.3;

/** View-space depth range of the fog ramp at the home camera distance. */
export const FOG_NEAR = HOME_Z - 3.5;
export const FOG_FAR = HOME_Z + 6.5;
/** Brightness of something at (or beyond) the far end of the ramp. */
export const FOG_FLOOR = 0.42;

export const SHARED = {
  uTime: { value: 0 },
  /** Entrance progress 0 → 1 (see ENTER in SkillsConstellation). */
  uEnter: { value: 0 },
  /** Fog ramp; shifted with the camera dolly so a pinned cluster is not "fogged in". */
  uFogNear: { value: FOG_NEAR },
  uFogFar: { value: FOG_FAR },
  /** Stage size in CSS px (ribbon widths are authored in CSS px). */
  uResolution: { value: new THREE.Vector2(1, 1) },
  uDpr: { value: 1 },
  /**
   * Click shockwave: xyz = origin (graph-local), w = progress 0 → 1 (0 = idle).
   * A ring of extra brightness expands through the nodes and links from a pin.
   */
  uPing: { value: new THREE.Vector4(0, 0, 0, 0) },
  /**
   * Pointer light: xy = pointer in NDC, z = strength (0 while the pointer is
   * away, dragging, or a detail card is open). Whatever is near the cursor on
   * screen glows a little brighter, so the graph answers before a hover lands.
   */
  uPointer: { value: new THREE.Vector3(0, 0, 0) },
};

/** GLSL: depth fade shared by the node, link and ring shaders (1 near → FOG_FLOOR far). */
export const FOG_GLSL = /* glsl */ `
  uniform float uFogNear;
  uniform float uFogFar;
  float depthFade(float viewDepth) {
    return mix(${FOG_FLOOR.toFixed(2)}, 1.0, smoothstep(uFogFar, uFogNear, viewDepth));
  }
`;

/** GLSL: brightness bump at graph-local point `p` from the click shockwave (0 when idle). */
export const PING_GLSL = /* glsl */ `
  uniform vec4 uPing;
  float pingAt(vec3 p) {
    float r = distance(p, uPing.xyz) - uPing.w * 9.5;
    return exp(-r * r * 1.8) * (1.0 - uPing.w) * step(0.0005, uPing.w);
  }
`;

/** GLSL: pointer-light amount for a clip-space position (declares uResolution too). */
export const POINTER_GLSL = /* glsl */ `
  uniform vec3 uPointer;
  uniform vec2 uResolution;
  float pointerAt(vec4 clip) {
    vec2 d = (clip.xy / clip.w - uPointer.xy) * 0.5 * uResolution;
    return exp(-dot(d, d) / 26000.0) * uPointer.z;
  }
`;

/** Same ramp on the CPU, for the DOM labels. */
export function depthFade(viewDepth: number): number {
  const near = SHARED.uFogNear.value;
  const far = SHARED.uFogFar.value;
  let t = (viewDepth - far) / (near - far);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return FOG_FLOOR + (1 - FOG_FLOOR) * t * t * (3 - 2 * t);
}

/**
 * Blending for every layer: premultiplied "over". A fragment that outputs
 * alpha 0 is purely additive (glows, links, stars); alpha > 0 also occludes what
 * is behind it (hub plates, leaf cores) — both in one draw, no depth buffer.
 */
export const LAYER_MATERIAL = {
  transparent: true,
  depthTest: false,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.OneFactor,
  blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
} as const;
