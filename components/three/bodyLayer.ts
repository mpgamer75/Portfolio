import * as THREE from 'three';
import {
  CLUSTERS,
  CLUSTER_COUNT,
  CLUSTER_OF,
  CLUSTER_RGB,
  IS_HUB,
  LEAF_RADIUS_W,
  NODE_COUNT,
  NODE_ENTER,
  SATELLITES,
  SAT_COUNT,
  SHIPS,
  SHIP_COUNT,
} from './constellationData';
import { FOG_GLSL, LAYER_MATERIAL, PING_GLSL, SHARED } from './sceneShared';
import type { PlanetKind } from './skillsGraph';

/*
 * Body layer — everything solid in the system, as camera-facing quads (no
 * meshes, no depth buffer):
 *
 *   GLOW_MESH      one instanced draw: a soft glow per domain + a wide backdrop
 *   BIG_MESHES     the star (granulated disc, limb darkening, breathing corona)
 *                  and one quad per domain, each planet with its OWN specialised
 *                  program: a sphere impostor wrapped in an equirectangular
 *                  surface map and lit from the star, with relief from the
 *                  map's own slope, a terminator and an atmosphere. The ocean
 *                  world adds a drifting cloud deck (with its shadow) and city
 *                  lights after dark, the ice world glowing fractures, the gas
 *                  giant flowing bands and rings, the forge world molten rock
 *   MOON_MESHES    two instanced draws of the moons (one per skill): the same
 *                  kind of impostor, all sharing one cratered map, each
 *                  showing a different face of it and tinted by its domain
 *   CRAFT_MESHES   two instanced draws of sprites from one atlas: the ships,
 *                  the satellites and the station, lit from the star, the ships
 *                  with engine plumes that follow the throttle
 *
 * Why separate programs: a single shader that branches between surface models
 * gets flattened by Direct3D compilers (every pixel then pays for every model,
 * which is what an integrated GPU cannot afford). One small program per kind
 * of body has no such branch at all. For the same reason every screen-space
 * derivative is taken once, at the top of main, and the maps are sampled with
 * explicit gradients (textureGrad) inside the branches.
 *
 * Draw order: the five large bodies are drawn back to front (their render order
 * is re-ranked each frame); every small body goes either before them all or
 * after them all, depending on whether one of them covers it — so a moon
 * behind its planet is hidden, and one in front covers it, with correct soft
 * edges and glows.
 *
 * The maps are optional: until one has decoded (or if it never does) its body
 * is drawn in its domain colour, so the scene never depends on them.
 */

const PLANET_DEFINE: Record<PlanetKind, number> = { terran: 1, ice: 2, gas: 3, forge: 4 };

const ATMOS_CLUSTER_RADIUS = 3.9;
const ATMOS_BACKDROP_RADIUS = 11.5;
export const SUN_RADIUS = 0.5;
const SATELLITE_HALF = 0.085;
const STATION_HALF = 0.2;
/** Radius, in planet radii, out to which a planet can cover what is behind it (rings included). */
export const PLANET_COVER: Record<PlanetKind, number> = { terran: 1, ice: 1, gas: 1.95, forge: 1 };
/**
 * A body this close to the camera fades out rather than filling the frame
 * (the close-up views put the camera inside a system): [gone, fully there],
 * in scene units of view depth. Mirrored on the CPU by the scene for labels
 * and picking.
 */
/** A ship is never drawn with a half-length below this many CSS px. */
export const SHIP_MIN_PX = 20;
export const NEAR_FADE_BIG: [number, number] = [0.55, 1.0];
export const NEAR_FADE_SMALL: [number, number] = [0.4, 0.75];

const EMERALD = [0.204, 0.827, 0.6];
/** Engine and presence tint shared by the ships (the signature emerald, lifted towards white). */
const HULL = [0.42, 0.9, 0.7];

const QUAD_POSITIONS = new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]);
const QUAD_INDEX = [0, 1, 2, 2, 1, 3];

/* ── Shared GLSL ──────────────────────────────────────────────────────────── */

const NOISE_GLSL = /* glsl */ `
  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  float vnoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash31(i), hash31(i + vec3(1.0, 0.0, 0.0)), f.x),
          mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), f.x),
          mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float a = 0.5;
    float s = 0.0;
    for (int i = 0; i < 5; i++) {
      s += a * vnoise(p);
      p = p * 2.03 + vec3(17.1, 3.7, 9.2);
      a *= 0.5;
    }
    return s;
  }
`;

/** Target-lock reticle: a ring broken into four slowly turning arcs. */
const RETICLE_GLSL = /* glsl */ `
  float reticle(vec2 p, float d, float radius, float halfWidth, float aa, float spin) {
    float ring = 1.0 - smoothstep(halfWidth - aa, halfWidth + aa, abs(d - radius));
    float seg = fract(atan(p.y, p.x + 1e-5) / 6.2831853 * 4.0 + spin);
    float arc = smoothstep(0.3, 0.36, seg) * (1.0 - smoothstep(0.92, 0.98, seg));
    return ring * arc;
  }
`;

/**
 * Sphere impostor helpers.
 *
 * `reliefTerm` is derivative-map bump lighting: the height's slope along the
 * two screen axes tilts the sphere's normal, and the function returns how much
 * more (or less) star light the tilted surface catches than the smooth one.
 * `dPx` / `dPy` are the screen derivatives of the disc coordinate.
 */
const SPHERE_GLSL = /* glsl */ `
  float luma(vec3 c) {
    return dot(c, vec3(0.3, 0.59, 0.11));
  }
  float reliefTerm(vec3 nv, vec2 dPx, vec2 dPy, vec3 L, float dhx, float dhy) {
    float zc = max(nv.z, 0.08);
    vec3 px = vec3(dPx, -dot(nv.xy, dPx) / zc);
    vec3 py = vec3(dPy, -dot(nv.xy, dPy) / zc);
    vec3 r1 = cross(py, nv);
    vec3 r2 = cross(nv, px);
    float det = dot(px, r1);
    vec3 nb = normalize(abs(det) * nv - sign(det) * (dhx * r1 + dhy * r2));
    // Relief flattens out towards the limb, where a pixel covers a lot of ground.
    return (dot(nb, L) - dot(nv, L)) * smoothstep(0.1, 0.45, nv.z);
  }
`;

/* ── Textures ─────────────────────────────────────────────────────────────── */

const TEXTURE_DIR = '/images/space/';

/**
 * Decoding off the main thread (createImageBitmap) keeps a 4K map from
 * hitching the frame it arrives on. Browsers whose createImageBitmap ignores
 * the flip / premultiply options get the plain image path instead (the same
 * split three's own GLTFLoader makes).
 */
function canUseBitmaps(): boolean {
  if (typeof createImageBitmap === 'undefined') return false;
  const ua = navigator.userAgent;
  const safari = /^((?!chrome|android).)*safari/i.test(ua);
  const safariVersion = safari ? Number(ua.match(/Version\/(\d+)/)?.[1] ?? 0) : 99;
  const firefoxVersion = Number(ua.match(/Firefox\/(\d+)/)?.[1] ?? 99);
  return safariVersion >= 17 && firefoxVersion >= 98;
}

let maxAnisotropy = 1;

function configure(texture: THREE.Texture, wrapsAround: boolean): THREE.Texture {
  // Sampled and output as authored sRGB values, like every colour in the scene.
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = wrapsAround ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

/** Loads one file of the scene's texture set. `premultiplied` is for the cut-out atlas. */
function loadTexture(
  file: string,
  wrapsAround: boolean,
  premultiplied: boolean,
  onLoad: (texture: THREE.Texture) => void,
  onError: () => void,
): void {
  const url = TEXTURE_DIR + file;
  if (canUseBitmaps()) {
    const loader = new THREE.ImageBitmapLoader();
    loader.setOptions({ imageOrientation: 'flipY', premultiplyAlpha: premultiplied ? 'premultiply' : 'none' });
    loader.load(
      url,
      (bitmap) => {
        const texture = new THREE.Texture(bitmap);
        // The bitmap is already flipped and (if asked) premultiplied.
        texture.flipY = false;
        texture.premultiplyAlpha = false;
        onLoad(configure(texture, wrapsAround));
      },
      undefined,
      onError,
    );
    return;
  }
  new THREE.TextureLoader().load(
    url,
    (texture) => {
      texture.premultiplyAlpha = premultiplied;
      onLoad(configure(texture, wrapsAround));
    },
    undefined,
    onError,
  );
}

/** A sampler uniform plus how far its map has faded in (0 = flat colour, 1 = the map). */
interface MapSlot {
  map: { value: THREE.Texture | null };
  mix: { value: number };
  loaded: boolean;
  settled: boolean;
}
const makeSlot = (): MapSlot => ({ map: { value: null }, mix: { value: 0 }, loaded: false, settled: false });

const PLANET_SLOTS = CLUSTERS.map(makeSlot);
const CLOUD_SLOT = makeSlot();
const MOON_SLOT_MAP = makeSlot();
const CRAFT_SLOT = makeSlot();
const ALL_SLOTS = [...PLANET_SLOTS, CLOUD_SLOT, MOON_SLOT_MAP, CRAFT_SLOT];

/** Base maps kept for the whole session, and the one 4K map that may replace a planet's. */
const BASE_MAPS: (THREE.Texture | null)[] = CLUSTERS.map(() => null);
const DETAIL = { cluster: -1, wanted: -1, texture: null as THREE.Texture | null };

let texturesRequested = false;

function loadSlot(slot: MapSlot, file: string, wrapsAround: boolean, premultiplied: boolean, keep?: (t: THREE.Texture) => void) {
  loadTexture(
    file,
    wrapsAround,
    premultiplied,
    (texture) => {
      slot.map.value = texture;
      slot.loaded = true;
      slot.settled = true;
      keep?.(texture);
    },
    () => {
      slot.settled = true;
    },
  );
}

/** Starts loading the base texture set (once). A failed file just leaves its body flat-shaded. */
export function loadBodyTextures(anisotropy: number): void {
  if (texturesRequested) return;
  texturesRequested = true;
  maxAnisotropy = Math.max(1, Math.min(8, anisotropy));
  CLUSTERS.forEach((c, i) => {
    loadSlot(PLANET_SLOTS[i], `${c.planet}.webp`, true, false, (texture) => {
      BASE_MAPS[i] = texture;
      // A 4K map that arrived first keeps its place.
      if (DETAIL.cluster === i && DETAIL.texture) PLANET_SLOTS[i].map.value = DETAIL.texture;
    });
  });
  loadSlot(CLOUD_SLOT, 'clouds.webp', true, false);
  loadSlot(MOON_SLOT_MAP, 'moon.webp', true, false);
  loadSlot(CRAFT_SLOT, 'craft.webp', false, true);
}

/** True once every base map has either decoded or failed (the entrance waits for this). */
export function bodyTexturesSettled(): boolean {
  for (const slot of ALL_SLOTS) if (!slot.settled) return false;
  return true;
}

/**
 * Asks for the 4K map of one planet (the one the visitor has opened), or for
 * none. Only one is ever held: the previous planet goes back to its base map
 * and its 4K copy is released.
 */
export function requestPlanetDetail(cluster: number | null): void {
  const wanted = cluster ?? -1;
  if (wanted === DETAIL.wanted) return;
  DETAIL.wanted = wanted;
  if (wanted < 0 || wanted === DETAIL.cluster) return;
  loadTexture(
    `${CLUSTERS[wanted].planet}-4k.webp`,
    true,
    false,
    (texture) => {
      // Superseded while it was loading: drop it.
      if (DETAIL.wanted !== wanted) {
        texture.dispose();
        return;
      }
      if (DETAIL.cluster >= 0) {
        PLANET_SLOTS[DETAIL.cluster].map.value = BASE_MAPS[DETAIL.cluster];
        DETAIL.texture?.dispose();
      }
      DETAIL.cluster = wanted;
      DETAIL.texture = texture;
      PLANET_SLOTS[wanted].map.value = texture;
      PLANET_SLOTS[wanted].loaded = true;
    },
    () => {
      if (DETAIL.wanted === wanted) DETAIL.wanted = DETAIL.cluster;
    },
  );
}

/** Per-frame: fades each map in once it has decoded. */
export function updateBodyTextures(dt: number): void {
  const k = 1 - Math.exp(-dt * 2.2);
  for (const slot of ALL_SLOTS) {
    if (slot.loaded && slot.mix.value < 1) {
      slot.mix.value += (1 - slot.mix.value) * k;
      if (slot.mix.value > 0.995) slot.mix.value = 1;
    }
  }
}

/** Releases the GPU copies (they re-upload on next use). */
export function disposeBodyTextures(): void {
  for (const slot of ALL_SLOTS) slot.map.value?.dispose();
  for (const map of BASE_MAPS) map?.dispose();
}

/* ── Domain glows ─────────────────────────────────────────────────────────── */

/** One soft glow per domain plus one wide backdrop behind the whole system. */
export const GLOW_COUNT = CLUSTER_COUNT + 1;
const GLOW_POS = new Float32Array(GLOW_COUNT * 4); // xyz + radius
const GLOW_COLOR = new Float32Array(GLOW_COUNT * 3);
const GLOW_INT = new Float32Array(GLOW_COUNT);
for (let c = 0; c < GLOW_COUNT; c++) {
  const backdrop = c === CLUSTER_COUNT;
  if (!backdrop) GLOW_POS.set(CLUSTERS[c].center, c * 4);
  GLOW_POS[c * 4 + 3] = backdrop ? ATMOS_BACKDROP_RADIUS : ATMOS_CLUSTER_RADIUS;
  GLOW_COLOR.set(backdrop ? EMERALD : CLUSTER_RGB.subarray(c * 3, c * 3 + 3), c * 3);
}

const GLOW_GEOMETRY = new THREE.InstancedBufferGeometry();
GLOW_GEOMETRY.setAttribute('position', new THREE.BufferAttribute(QUAD_POSITIONS, 3));
GLOW_GEOMETRY.setIndex(QUAD_INDEX);
GLOW_GEOMETRY.setAttribute('iPosR', new THREE.InstancedBufferAttribute(GLOW_POS, 4));
GLOW_GEOMETRY.setAttribute('iColor', new THREE.InstancedBufferAttribute(GLOW_COLOR, 3));
const GLOW_INT_ATTR = new THREE.InstancedBufferAttribute(GLOW_INT, 1);
GLOW_INT_ATTR.setUsage(THREE.DynamicDrawUsage);
GLOW_GEOMETRY.setAttribute('iInt', GLOW_INT_ATTR);
GLOW_GEOMETRY.instanceCount = GLOW_COUNT;

/** Layer-local uniform: master strength of the domain glows (0 = off). */
export const GLOW_UNIFORMS = { uAtmos: { value: 0 } };

export const GLOW_MESH = new THREE.Mesh(
  GLOW_GEOMETRY,
  new THREE.ShaderMaterial({
    uniforms: GLOW_UNIFORMS,
    vertexShader: /* glsl */ `
      attribute vec4 iPosR;
      attribute vec3 iColor;
      attribute float iInt;
      uniform float uAtmos;
      varying vec2 vP;
      varying vec3 vColor;
      void main() {
        vP = position.xy;
        vColor = iColor * iInt * uAtmos;
        vec4 mv = modelViewMatrix * vec4(iPosR.xyz, 1.0);
        mv.xy += position.xy * iPosR.w;
        // Collapsed off-screen while switched off, so a disabled glow costs no fill.
        gl_Position = uAtmos * iInt > 0.002 ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vP;
      varying vec3 vColor;
      float hash21(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }
      void main() {
        // Analytic radial falloff (zero at the quad edge) + 1/255 dither against banding.
        float g = max(1.0 - length(vP), 0.0);
        g = g * g * (0.55 + 0.45 * g);
        vec3 c = vColor * g + (hash21(gl_FragCoord.xy) - 0.5) / 255.0;
        gl_FragColor = vec4(max(c, 0.0), 0.0);
      }
    `,
    ...LAYER_MATERIAL,
  }),
);
GLOW_MESH.frustumCulled = false;
GLOW_MESH.renderOrder = 2.5;

let glowDirty = true;
/** Sets a glow's intensity. `index` is a cluster index, or CLUSTER_COUNT for the backdrop. */
export function setGlow(index: number, intensity: number): void {
  if (Math.abs(GLOW_INT[index] - intensity) > 0.0015) {
    GLOW_INT[index] = intensity;
    glowDirty = true;
  }
}

/* ── Large bodies: the star and the planets ───────────────────────────────── */

/**
 * Billboard vertex stage shared by the star and the planets. The mesh sits at
 * the body's centre (inside the turning system group), so the model-view
 * matrix already carries its position and the system's rotation.
 */
const BIG_VERTEX = /* glsl */ `
  uniform float uRadius;
  uniform float uExt;
  uniform vec3 uCenter;
  uniform vec3 uAxis;
  uniform vec3 uState; // glow, select, entrance delay
  uniform vec3 uSunView;
  uniform float uEnter;
  ${FOG_GLSL}
  ${PING_GLSL}
  varying vec2 vP;        // quad coords in body radii
  varying vec3 vBody;     // glow, select, reveal
  varying float vFade;
  varying vec3 vLight;    // view space, towards the star
  varying vec3 vAxisV;    // spin axis in view space
  varying mat3 vToLocal;  // view space → system space (surfaces stay fixed to the world)

  void main() {
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float reveal = smoothstep(uState.z, uState.z + 0.3, uEnter);
    // A body the camera is about to fly through fades out instead.
    float nearK = smoothstep(${NEAR_FADE_BIG[0].toFixed(2)}, ${NEAR_FADE_BIG[1].toFixed(2)}, -mv.z);
    float ping = pingAt(uCenter);
    float lift = smoothstep(0.0, 0.6, uState.y);
    // Bloom in: overshoot slightly then settle, so the body "pops" into place.
    float pop = reveal * (1.0 + 0.3 * sin(reveal * 3.14159265));
    float scale = pop * (1.0 + 0.05 * lift) * (1.0 + 0.1 * ping);
    vLight = normalize(uSunView - mv.xyz + vec3(0.0, 0.0, 1e-4));
    mat3 rot = mat3(modelViewMatrix);
    vAxisV = rot * uAxis;
    vToLocal = transpose(rot);
    vFade = depthFade(-mv.z);
    vBody = vec3(uState.x + ping * 0.9, uState.y, reveal * nearK);
    vP = position.xy * uExt;
    mv.xy += position.xy * uExt * uRadius * scale;
    gl_Position = nearK > 0.001 ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0);
  }
`;

const SUN_FRAGMENT = /* glsl */ `
  uniform float uTime;
  varying vec2 vP;
  varying vec3 vBody;
  ${NOISE_GLSL}
  void main() {
    float d = length(vP);
    float aa = fwidth(d) * 1.5 + 1e-4;
    float core = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, d);
    float n = clamp(vBody.x, 0.0, 1.5);
    vec3 rgb = vec3(0.0);
    if (d < 1.03) {
      // Photosphere: slow granulation, darker and greener towards the limb.
      float limb = sqrt(max(1.0 - d * d, 0.0));
      float gran = fbm(vec3(vP * 3.2, uTime * 0.08));
      vec3 col = mix(vec3(0.3, 0.95, 0.66), vec3(1.0, 1.0, 0.96), 0.2 + 0.8 * pow(limb, 0.6));
      rgb = col * (0.78 + 0.42 * gran) * core;
    }
    // Corona: a tight bright skirt, slow uneven rays, and a wide faint bloom.
    float o = max(d - 1.0, 0.0);
    float ang = atan(vP.y, vP.x);
    float rays = 0.55 + 0.45 * vnoise(vec3(cos(ang) * 2.4, sin(ang) * 2.4, uTime * 0.1));
    float corona = exp(-o * 6.0) * 0.9 + exp(-o * 1.7) * 0.34 * rays + exp(-o * 0.6) * 0.085;
    corona *= (1.0 - core) * (1.0 - smoothstep(4.2, 6.0, d));
    rgb += mix(vec3(0.16, 0.84, 0.58), vec3(0.88, 1.0, 0.94), exp(-o * 4.5)) * corona * (0.3 + 0.7 * n);
    gl_FragColor = vec4(rgb * vBody.z, core * vBody.z);
  }
`;

const PLANET_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform vec3 uAxis;
  uniform vec3 uE1;       // with uE2 and uAxis: the globe's own frame (longitude 0 along uE1)
  uniform vec3 uE2;
  uniform float uSeed;
  uniform float uSpin;    // the visitor's own turn of the globe, in radians
  uniform sampler2D uMap;
  uniform float uMapMix;
  #if PLANET_KIND == 1
    uniform sampler2D uClouds;
    uniform float uCloudMix;
  #endif
  varying vec2 vP;
  varying vec3 vBody;
  varying float vFade;
  varying vec3 vLight;
  varying vec3 vAxisV;
  varying mat3 vToLocal;
  ${NOISE_GLSL}
  ${RETICLE_GLSL}
  ${SPHERE_GLSL}

  #if PLANET_KIND == 1
    // Land is green, grey rock or ice; ocean runs from navy to turquoise.
    float landOf(vec3 c) {
      return clamp(max((c.g - c.b - 0.016) / 0.1, (c.r - 0.46) / 0.16), 0.0, 1.0);
    }
    float heightOf(vec3 c) {
      return landOf(c) * (0.3 + luma(c));
    }
  #elif PLANET_KIND == 4
    // Molten rock is a saturated green, well above the red and blue of the crust.
    float lavaOf(vec3 c) {
      return clamp((c.g - 1.3 * max(c.r, c.b) - 0.094) / 0.353, 0.0, 1.0);
    }
  #endif

  void main() {
    // Every screen-space derivative is taken here, outside the branches.
    vec2 P = vP;
    float d = length(P);
    float fw = fwidth(d);
    float aa = fw * 0.75 + 1e-4;
    vec2 dPx = dFdx(P);
    vec2 dPy = dFdy(P);
    float n = clamp(vBody.x, 0.0, 1.7);
    // A dimmed (out-of-focus) planet recedes instead of just losing its halo.
    float lum = 0.2 + 0.8 * smoothstep(0.0, 0.6, n);
    float sel = vBody.y;
    float pinned = step(0.8, sel);
    vec3 L = normalize(vLight);
    float disc = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, d);
    float z = sqrt(max(1.0 - d * d, 0.0));
    vec3 nv = vec3(P, z);

    // Where this pixel is on the globe: latitude and longitude in the globe's
    // own frame (system space, so the surface stays put while the camera moves).
    vec3 sl = vToLocal * nv;
    float sinLat = clamp(dot(sl, uAxis), -1.0, 1.0);
    float lonA = atan(dot(sl, uE2), dot(sl, uE1)) / 6.2831853;
    float lonB = fract(lonA + 0.5);
    float lat = asin(sinLat) / 3.14159265 + 0.5;
    // The longitude jumps by a whole turn on one meridian; of its two forms,
    // the one that is continuous here gives the true gradient.
    float ax = dFdx(lonA);
    float bx = dFdx(lonB);
    float ay = dFdy(lonA);
    float by = dFdy(lonB);
    vec2 gx = vec2(abs(ax) < abs(bx) ? ax : bx, dFdx(lat));
    vec2 gy = vec2(abs(ay) < abs(by) ? ay : by, dFdy(lat));
    vec2 uv = vec2(lonA - (uTime * 0.045 + uSpin) / 6.2831853 - uSeed, lat);
    // 0 from afar, 1 when the globe fills the stage: how much fine detail to add.
    float detail = smoothstep(110.0, 520.0, 1.0 / (fw + 1e-5));

    vec3 rgb = vec3(0.0);
    float a = disc;

    if (d < 1.0 + aa) {
      float ndl = dot(nv, L);
      float day = smoothstep(-0.22, 0.5, ndl);
      float fres = pow(1.0 - z, 3.0);
      float specB = max(dot(nv, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0);
      vec3 flat0 = uColor * 0.42;
      vec3 surf;
      vec3 emit = vec3(0.0);
      float spec;
      float relief = 0.0;
      float limb = 1.0;

      #if PLANET_KIND == 1
        // Ocean world: continents and seas from the map, a drifting cloud deck
        // that shades the ground beneath it, sun glint on open water and
        // settlements lighting up after dark.
        vec3 c0 = mix(flat0, textureGrad(uMap, uv, gx, gy).rgb, uMapMix);
        vec3 cx = mix(flat0, textureGrad(uMap, uv + gx, gx, gy).rgb, uMapMix);
        vec3 cy = mix(flat0, textureGrad(uMap, uv + gy, gx, gy).rgb, uMapMix);
        float land = landOf(c0) * uMapMix;
        float h0 = heightOf(c0);
        relief = reliefTerm(nv, dPx, dPy, L, (heightOf(cx) - h0) * 0.03, (heightOf(cy) - h0) * 0.03);
        vec2 cuv = uv + vec2(uTime * 0.0011, 0.0);
        float clouds = smoothstep(0.1, 0.8, textureGrad(uClouds, cuv, gx, gy).r) * uCloudMix;
        // The deck sampled a little towards the star = the shadow it casts here.
        vec2 toSun = (gx * L.x + gy * L.y) * (0.014 / (fw + 1e-5));
        float shadow = smoothstep(0.1, 0.8, textureGrad(uClouds, cuv + toSun, gx, gy).r) * uCloudMix;
        float grain = vnoise(sl * 150.0) * 0.6 + vnoise(sl * 430.0) * 0.4 - 0.5;
        surf = c0 * (1.0 + grain * 0.3 * detail * land);
        surf *= 1.0 - 0.45 * shadow * (1.0 - clouds);
        surf = mix(surf, vec3(0.9, 0.98, 0.96), clouds * 0.92);
        relief *= 1.0 - clouds;
        spec = (pow(specB, 120.0) * 0.8 + pow(specB, 14.0) * 0.05) * (1.0 - land) * (1.0 - clouds);
        float night = 1.0 - smoothstep(-0.15, 0.2, ndl);
        // Settlements: fine points of light, gathered into a few regions, that
        // resolve into streets in a close-up.
        float region = smoothstep(0.5, 0.68, vnoise(sl * 6.0 + 2.0));
        float town = smoothstep(0.66, 0.8, vnoise(sl * 58.0)) * (0.35 + 0.65 * smoothstep(0.5, 0.75, vnoise(sl * 21.0)));
        town *= mix(1.0, 0.3 + 1.4 * smoothstep(0.5, 0.85, vnoise(sl * 210.0)), detail);
        emit += mix(uColor, vec3(0.85, 1.0, 0.9), 0.35) * town * region * land * night * (1.0 - clouds * 0.75) * 1.5;
      #elif PLANET_KIND == 2
        // Ice world: bright frost plains split by dark fracture lines that glow
        // faintly on the night side.
        vec3 c0 = mix(flat0 * 1.6, textureGrad(uMap, uv, gx, gy).rgb, uMapMix);
        vec3 cx = mix(flat0 * 1.6, textureGrad(uMap, uv + gx, gx, gy).rgb, uMapMix);
        vec3 cy = mix(flat0 * 1.6, textureGrad(uMap, uv + gy, gx, gy).rgb, uMapMix);
        // A fracture is darker than the ice around it (a much blurrier tap).
        float around = luma(textureGrad(uMap, uv, gx * 12.0, gy * 12.0).rgb);
        float l0 = luma(c0);
        float crack = clamp((around - l0 - 0.04) / 0.18, 0.0, 1.0) * uMapMix;
        relief = reliefTerm(nv, dPx, dPy, L, (luma(cx) - l0) * 0.012, (luma(cy) - l0) * 0.012);
        float grain = vnoise(sl * 150.0) * 0.6 + vnoise(sl * 430.0) * 0.4 - 0.5;
        surf = c0 * (1.0 + grain * 0.16 * detail);
        spec = (pow(specB, 90.0) * 0.5 + pow(specB, 8.0) * 0.05) * (1.0 - crack);
        emit += uColor * crack * 0.25 * (1.0 - day);
      #elif PLANET_KIND == 3
        // Gas giant: the band map, kept flowing. Each latitude is carried along
        // by its own wind; two copies half a cycle apart are cross-faded, so
        // the motion never ends and the storms are never sheared apart.
        float wind = sin(sinLat * 9.0 + 1.3) * 0.6 + sin(sinLat * 23.0 + 0.4) * 0.4;
        float t = uTime * 0.016;
        float p1 = fract(t);
        float p2 = fract(t + 0.5);
        vec3 ca = textureGrad(uMap, uv + vec2(wind * (p1 - 0.5) * 0.03, 0.0), gx, gy).rgb;
        vec3 cb = textureGrad(uMap, uv + vec2(wind * (p2 - 0.5) * 0.03, 0.0), gx, gy).rgb;
        vec3 c0 = mix(flat0, mix(cb, ca, 1.0 - abs(1.0 - 2.0 * p1)), uMapMix);
        surf = c0 * (1.0 + (vnoise(sl * 170.0) - 0.5) * 0.14 * detail);
        spec = pow(specB, 12.0) * 0.06;
        // A deep atmosphere darkens steeply towards the limb.
        limb = mix(0.5, 1.0, sqrt(z));
      #else
        // Forge world: a cracked basalt crust over molten rock that pulses and
        // lights the ground around it.
        vec3 c0 = mix(flat0 * 0.3, textureGrad(uMap, uv, gx, gy).rgb, uMapMix);
        vec3 cx = mix(flat0 * 0.3, textureGrad(uMap, uv + gx, gx, gy).rgb, uMapMix);
        vec3 cy = mix(flat0 * 0.3, textureGrad(uMap, uv + gy, gx, gy).rgb, uMapMix);
        vec3 cw = textureGrad(uMap, uv, gx * 10.0, gy * 10.0).rgb;
        float lava = lavaOf(c0);
        float l0 = luma(c0) * (1.0 - lava);
        relief = reliefTerm(
          nv, dPx, dPy, L,
          (luma(cx) * (1.0 - lavaOf(cx)) - l0) * 0.04,
          (luma(cy) * (1.0 - lavaOf(cy)) - l0) * 0.04);
        float grain = vnoise(sl * 150.0) * 0.6 + vnoise(sl * 430.0) * 0.4 - 0.5;
        surf = c0 * (1.0 - lava) * (1.0 + grain * 0.3 * detail);
        float pulse = 0.78 + 0.22 * sin(uTime * 1.1 + luma(cw) * 22.0 + sl.y * 7.0);
        emit += (mix(c0, uColor * 1.4, 0.2) * lava * 1.35 + uColor * lavaOf(cw) * 0.35) * pulse * uMapMix;
        spec = pow(specB, 20.0) * 0.08 * (1.0 - lava);
      #endif

      // Star light shaped by the relief, plus a faint fill from the viewer so
      // the near planets (which show us more of their night side) stay readable.
      float lit = day * clamp(1.0 + relief * 2.4, 0.25, 1.9) * limb;
      vec3 col = surf * (0.05 + lit + 0.24 * z * z * limb) + vec3(spec * day) + emit;
      col += uColor * fres * (0.22 + 0.55 * day);
      rgb = col * lum * disc;
    }

    // Atmosphere: a thin skirt outside the limb, brighter on the lit side.
    vec2 outward = P / max(d, 1e-4);
    float sunSide = 0.3 + 0.7 * smoothstep(-0.6, 0.7, dot(outward, L.xy));
    float halo = exp(-max(d - 1.0, 0.0) * 7.0) * (1.0 - disc) * 0.55 * sunSide * n;
    rgb += uColor * halo * (1.0 - smoothstep(1.5, 1.95, d));

    #if PLANET_KIND == 3
      // Rings: intersect the view ray with the equatorial plane, then decide
      // per pixel whether the ring is in front of or behind the globe.
      vec3 av = normalize(vAxisV);
      float az = abs(av.z) < 0.06 ? (av.z < 0.0 ? -0.06 : 0.06) : av.z;
      float hz = -(av.x * P.x + av.y * P.y) / az;
      vec3 hit = vec3(P, hz);
      float rr = length(hit);
      float inRing = smoothstep(1.28, 1.33, rr) * (1.0 - smoothstep(1.88, 1.95, rr));
      float bands = 0.55 + 0.45 * sin(rr * 42.0 + sin(rr * 11.0) * 2.0);
      // A close-up resolves the bands into fine ringlets.
      bands *= mix(1.0, 0.55 + 0.9 * vnoise(vec3(rr * 240.0, 3.7, 1.1)), detail);
      float gap = smoothstep(0.0, 0.025, abs(rr - 1.62) - 0.022);
      float ringA = inRing * gap * (0.3 + 0.5 * bands) * smoothstep(0.03, 0.2, abs(av.z));
      // The globe's shadow falls across the far side of the rings.
      float along = dot(hit, L);
      float lateral = length(hit - along * L);
      float shade = mix(1.0, smoothstep(0.92, 1.08, lateral), step(along, 0.0));
      vec3 ringC = mix(uColor * 0.7, vec3(0.82, 1.0, 0.95), bands * 0.55) * (0.1 + 0.9 * shade) * lum;
      ringA = clamp(ringA, 0.0, 1.0) * max(step(z, hz), step(1.0, d));
      rgb = rgb * (1.0 - ringA) + ringC * ringA;
      a = a * (1.0 - ringA) + ringA;
    #endif

    // Selection reticle, hugging the atmosphere (the label sits just outside it).
    // Its stroke is sized in pixels, so it stays a hairline in a close-up.
    float lock = reticle(P, d, 1.32 + 0.02 * sin(uTime * 4.0) * pinned, clamp(aa * 1.6, 0.005, 0.02), aa, uTime * 0.14);
    rgb += mix(uColor, vec3(1.0), 0.3) * lock * sel * 0.85;
    gl_FragColor = vec4(rgb * vBody.z * vFade, a * vBody.z);
  }
`;

const BIG_GEOMETRY = new THREE.BufferGeometry();
BIG_GEOMETRY.setAttribute('position', new THREE.BufferAttribute(QUAD_POSITIONS, 3));
BIG_GEOMETRY.setIndex(QUAD_INDEX);

interface BigBody {
  mesh: THREE.Mesh;
  /** glow, select, entrance delay */
  state: THREE.Vector3;
  spin: { value: number };
}

function makeBig(
  fragmentShader: string,
  center: ArrayLike<number>,
  radius: number,
  ext: number,
  color: ArrayLike<number>,
  seed: number,
  enter: number,
  cluster = -1,
): BigBody {
  const state = new THREE.Vector3(1, 0, enter);
  const spin = { value: 0 };
  const c = cluster >= 0 ? CLUSTERS[cluster] : null;
  const axis = c ? c.axis : [0, 1, 0];
  const uniforms: Record<string, THREE.IUniform> = {
    uTime: SHARED.uTime,
    uEnter: SHARED.uEnter,
    uFogNear: SHARED.uFogNear,
    uFogFar: SHARED.uFogFar,
    uPing: SHARED.uPing,
    uSunView: SHARED.uSunView,
    uRadius: { value: radius },
    uExt: { value: ext },
    uCenter: { value: new THREE.Vector3(center[0], center[1], center[2]) },
    uAxis: { value: new THREE.Vector3(axis[0], axis[1], axis[2]) },
    uColor: { value: new THREE.Vector3(color[0], color[1], color[2]) },
    uSeed: { value: seed },
    uState: { value: state },
  };
  if (c) {
    uniforms.uE1 = { value: new THREE.Vector3(c.u[0], c.u[1], c.u[2]) };
    uniforms.uE2 = { value: new THREE.Vector3(c.v[0], c.v[1], c.v[2]) };
    uniforms.uSpin = spin;
    uniforms.uMap = PLANET_SLOTS[cluster].map;
    uniforms.uMapMix = PLANET_SLOTS[cluster].mix;
    if (c.planet === 'terran') {
      uniforms.uClouds = CLOUD_SLOT.map;
      uniforms.uCloudMix = CLOUD_SLOT.mix;
    }
  }
  const material = new THREE.ShaderMaterial({
    uniforms,
    defines: c ? { PLANET_KIND: PLANET_DEFINE[c.planet] } : {},
    vertexShader: BIG_VERTEX,
    fragmentShader,
    ...LAYER_MATERIAL,
  });
  const mesh = new THREE.Mesh(BIG_GEOMETRY, material);
  mesh.position.set(center[0], center[1], center[2]);
  mesh.frustumCulled = false; // the quad is expanded in the shader
  return { mesh, state, spin };
}

/** Index 0 is the star; 1 + c is the planet of cluster c. */
export const BIG_COUNT = CLUSTER_COUNT + 1;
const BIG: BigBody[] = [
  // Quad half-extents in body radii: room for the corona / atmosphere, rings and reticle.
  makeBig(SUN_FRAGMENT, [0, 0, 0], SUN_RADIUS, 6.0, EMERALD, 0, 0),
  ...CLUSTERS.map((c, i) =>
    makeBig(
      PLANET_FRAGMENT,
      c.center,
      c.radius,
      c.planet === 'gas' ? 2.7 : 2.0,
      CLUSTER_RGB.subarray(i * 3, i * 3 + 3),
      (i * 0.37 + 0.11) % 1,
      0.1 + 0.03 * i,
      i,
    ),
  ),
];
export const BIG_MESHES = BIG.map((b) => b.mesh);

/** Glow (0..1.65) and selection (0 none, ~0.6 hover, 1 pinned) of a large body. */
export function setBigState(index: number, glow: number, select: number): void {
  BIG[index].state.x = glow;
  BIG[index].state.y = select;
}

/** The visitor's own turn of a planet's globe (radians), on top of its slow rotation. */
export function setPlanetSpin(cluster: number, angle: number): void {
  BIG[1 + cluster].spin.value = angle;
}

/** View depth of each large body (written by the scene) and the scratch used to rank them. */
export const BIG_DEPTH = new Float32Array(BIG_COUNT);
const BIG_ORDER = new Int8Array(BIG_COUNT);
for (let i = 0; i < BIG_COUNT; i++) BIG_ORDER[i] = i;

/* ── Small bodies: moons, and the craft (ships, satellites, the station) ──── */

const LEAF_COUNT = NODE_COUNT - CLUSTER_COUNT;
/** Record slots: moons first (in node order), then satellites, then ships. */
export const MOON_SLOT = new Int16Array(NODE_COUNT).fill(-1);
export const SAT_BASE = LEAF_COUNT;
export const SHIP_BASE = SAT_BASE + SAT_COUNT;
export const SMALL_COUNT = SHIP_BASE + SHIP_COUNT;

/** A record's `kind`: a moon, or a cell of the craft atlas. */
const KIND_MOON = -1;
const SPRITE_STATION = 3;
const SPRITE_SATELLITE = 4;

/**
 * 16 floats per record:
 *   0-2 position (system-local) · 3 radius (a craft's half-length)
 *   4-6 colour · 7 kind (KIND_MOON, or the craft's atlas cell)
 *   8-10 heading (craft) · 11 seed
 *   12 glow · 13 select · 14 entrance delay · 15 extra (ship thrust)
 */
const STRIDE = 16;
const SOURCE = new Float32Array(SMALL_COUNT * STRIDE);
/** View depth per record, and whether a large body covers it (both written by the scene). */
export const SMALL_DEPTH = new Float32Array(SMALL_COUNT);
export const SMALL_BEHIND = new Uint8Array(SMALL_COUNT);
const SMALL_ORDER = new Int16Array(SMALL_COUNT);
for (let i = 0; i < SMALL_COUNT; i++) SMALL_ORDER[i] = i;

function initSmall(index: number, kind: number, radius: number, color: ArrayLike<number>, seed: number, enter: number) {
  const o = index * STRIDE;
  SOURCE[o + 3] = radius;
  SOURCE[o + 4] = color[0];
  SOURCE[o + 5] = color[1];
  SOURCE[o + 6] = color[2];
  SOURCE[o + 7] = kind;
  SOURCE[o + 11] = seed;
  SOURCE[o + 14] = enter;
}
{
  let slot = 0;
  for (let i = 0; i < NODE_COUNT; i++) {
    if (IS_HUB[i]) continue;
    const c = CLUSTER_OF[i];
    MOON_SLOT[i] = slot;
    initSmall(slot++, KIND_MOON, LEAF_RADIUS_W, CLUSTER_RGB.subarray(c * 3, c * 3 + 3), (i * 0.61803) % 1, NODE_ENTER[i]);
  }
}
SATELLITES.forEach((s, i) => {
  initSmall(
    SAT_BASE + i,
    s.station ? SPRITE_STATION : SPRITE_SATELLITE,
    s.station ? STATION_HALF : SATELLITE_HALF,
    CLUSTER_RGB.subarray(s.cluster * 3, s.cluster * 3 + 3),
    (i * 0.377) % 1,
    0.6 + i * 0.015,
  );
});
SHIPS.forEach((ship, i) => {
  initSmall(SHIP_BASE + i, ship.craft, ship.size, HULL, (i * 0.283) % 1, 0.62 + i * 0.012);
});

export function setSmallPosition(index: number, x: number, y: number, z: number): void {
  const o = index * STRIDE;
  SOURCE[o] = x;
  SOURCE[o + 1] = y;
  SOURCE[o + 2] = z;
}
export function setSmallHeading(index: number, x: number, y: number, z: number): void {
  const o = index * STRIDE;
  SOURCE[o + 8] = x;
  SOURCE[o + 9] = y;
  SOURCE[o + 10] = z;
}
/** Glow (0..1.65), selection (0 none, ~0.6 hover, 1 pinned), extra (ship thrust). */
export function setSmallState(index: number, glow: number, select: number, extra = 0): void {
  const o = index * STRIDE;
  SOURCE[o + 12] = glow;
  SOURCE[o + 13] = select;
  SOURCE[o + 15] = extra;
}

const NEAR_SMALL = `smoothstep(${NEAR_FADE_SMALL[0].toFixed(2)}, ${NEAR_FADE_SMALL[1].toFixed(2)}, -mv.z)`;

/* Moons */

const MOON_VERTEX = /* glsl */ `
  attribute vec4 iPosR;
  attribute vec4 iColK;
  attribute vec4 iAuxS;
  attribute vec4 iState;
  uniform float uTime;
  uniform float uEnter;
  uniform vec3 uSunView;
  ${FOG_GLSL}
  ${PING_GLSL}
  varying vec2 vP;       // quad coords in body radii
  varying vec3 vColor;
  varying vec2 vMisc;    // depth fade, seed
  varying vec3 vState;   // glow, select, reveal
  varying vec3 vLight;   // view space, towards the star
  varying mat3 vToLocal;
  varying vec3 vPole;    // this moon's own pole and prime meridian: which face
  varying vec3 vPrime;   // of the shared map it shows

  void main() {
    vec3 pos = iPosR.xyz;
    float seed = iAuxS.w;
    vColor = iColK.rgb;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    float reveal = smoothstep(iState.z, iState.z + 0.3, uEnter);
    float nearK = ${NEAR_SMALL};
    float ping = pingAt(pos);
    float glow = max(iState.x + 0.07 * sin(uTime * 1.6 + seed * 40.0), 0.0) + ping * 0.9;
    float lift = smoothstep(0.0, 0.6, iState.y);
    float pop = reveal * (1.0 + 0.35 * sin(reveal * 3.14159265));
    float scale = pop * (1.0 + 0.2 * lift) * (1.0 + 0.12 * ping) * (0.9 + 0.12 * min(glow, 1.2));

    vLight = normalize(uSunView - mv.xyz + vec3(0.0, 0.0, 1e-4));
    vToLocal = transpose(mat3(modelViewMatrix));
    vPole = normalize(vec3(sin(seed * 91.0), 0.9, cos(seed * 57.0)));
    vPrime = normalize(cross(vPole, vec3(0.31, 0.2, 0.93)));

    // Quad half-extent in body radii: room for the halo and the reticle.
    const float ext = 3.6;
    mv.xy += position.xy * ext * iPosR.w * scale;
    gl_Position = nearK > 0.001 ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0);
    vP = position.xy * ext;
    vMisc = vec2(depthFade(-mv.z), seed);
    vState = vec3(glow, iState.y, reveal * nearK);
  }
`;

const MOON_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform sampler2D uMap;
  uniform float uMapMix;
  varying vec2 vP;
  varying vec3 vColor;
  varying vec2 vMisc;
  varying vec3 vState;
  varying vec3 vLight;
  varying mat3 vToLocal;
  varying vec3 vPole;
  varying vec3 vPrime;
  ${RETICLE_GLSL}
  ${SPHERE_GLSL}

  void main() {
    // Every screen-space derivative is taken here, outside the branch.
    vec2 P = vP;
    float d = length(P);
    float aa = fwidth(d) * 0.75 + 1e-4;
    vec2 dPx = dFdx(P);
    vec2 dPy = dFdy(P);
    float sel = vState.y;
    float n = clamp(vState.x, 0.0, 1.7);
    // Dimmed (out-of-focus) moons recede instead of just losing their halo.
    float lum = 0.2 + 0.8 * smoothstep(0.0, 0.6, n);
    float pinned = step(0.8, sel);
    vec3 L = normalize(vLight);
    float core = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, d);
    float z = sqrt(max(1.0 - d * d, 0.0));
    vec3 nv = vec3(P, z);

    vec3 nl = vToLocal * nv;
    vec3 pole = normalize(vPole);
    vec3 prime = normalize(vPrime);
    float lonA = atan(dot(nl, cross(pole, prime)), dot(nl, prime)) / 6.2831853;
    float lonB = fract(lonA + 0.5);
    float lat = asin(clamp(dot(nl, pole), -1.0, 1.0)) / 3.14159265 + 0.5;
    float ax = dFdx(lonA);
    float bx = dFdx(lonB);
    float ay = dFdy(lonA);
    float by = dFdy(lonB);
    vec2 gx = vec2(abs(ax) < abs(bx) ? ax : bx, dFdx(lat));
    vec2 gy = vec2(abs(ay) < abs(by) ? ay : by, dFdy(lat));
    vec2 uv = vec2(lonA + vMisc.y * 7.0, lat);

    vec3 rgb = vec3(0.0);
    float a = core * mix(0.55, 1.0, lum);

    if (d < 1.0 + aa) {
      // A small cratered world, tinted by its domain.
      float h0 = mix(0.5, luma(textureGrad(uMap, uv, gx, gy).rgb), uMapMix);
      float hx = mix(0.5, luma(textureGrad(uMap, uv + gx, gx, gy).rgb), uMapMix);
      float hy = mix(0.5, luma(textureGrad(uMap, uv + gy, gx, gy).rgb), uMapMix);
      float relief = reliefTerm(nv, dPx, dPy, L, (hx - h0) * 0.05, (hy - h0) * 0.05);
      float day = smoothstep(-0.25, 0.55, dot(nv, L));
      // A skill has to read from the overview, so a moon never goes fully dark:
      // the star only shapes it.
      vec3 base = mix(vColor * 0.5, mix(vColor, vec3(1.0), 0.55), smoothstep(0.22, 0.85, h0));
      vec3 col = base * (0.52 + 0.66 * day * clamp(1.0 + relief * 2.6, 0.3, 1.8));
      col += vColor * pow(1.0 - z, 2.0) * 0.35;
      col += vec3(1.0) * pow(z, 5.0) * 0.5 * clamp(n - 0.8, 0.0, 0.9);
      rgb = col * lum * core;
    }

    float halo = exp(-max(d - 1.0, 0.0) * 1.9) * 0.3 + exp(-d * d * 0.35) * 0.16;
    rgb += vColor * halo * (1.0 - core) * n * (1.0 - smoothstep(2.6, 3.5, d));
    // The stroke is sized in pixels, so it stays a hairline in a close-up.
    float lock = reticle(P, d, 2.3 + 0.1 * sin(uTime * 4.0) * pinned, clamp(aa * 1.8, 0.012, 0.085), aa, uTime * 0.14);
    rgb += mix(vColor, vec3(1.0), 0.35) * lock * sel;
    gl_FragColor = vec4(rgb * vState.z * vMisc.x, a * vState.z);
  }
`;

/* Craft: sprites from one atlas */

const ATLAS_W = 2048;
const ATLAS_H = 1024;
/**
 * Atlas cells in px (x, y, w, h), in sprite order: courier, freighter,
 * explorer, station, satellite. Mirrors CRAFT_CELLS in
 * scripts/build-space-textures.mjs.
 */
const CRAFT_CELLS: [number, number, number, number][] = [
  [0, 0, 1024, 512],
  [1024, 0, 1024, 512],
  [0, 512, 1024, 512],
  [1024, 512, 512, 512],
  [1536, 512, 512, 512],
];
/** As uv: origin at the cell's top-left corner, +y running down the image. */
const CRAFT_RECTS = CRAFT_CELLS.map(
  ([x, y, w, h]) => new THREE.Vector4(x / ATLAS_W, 1 - y / ATLAS_H, w / ATLAS_W, -h / ATLAS_H),
);
/** Width over height of each cell (the sprite's long axis is its heading). */
const CRAFT_ASPECT = CRAFT_CELLS.map(([, , w, h]) => w / h);
/**
 * Engines of the three hulls, in cell coordinates (0..1, y down): where the
 * nozzles end along the hull, each nozzle's centre across it (-1 = none), and
 * a nozzle's half-height.
 */
const CRAFT_JET_Y = [
  new THREE.Vector4(0.387, 0.585, -1, -1),
  new THREE.Vector4(0.304, 0.442, 0.581, 0.72),
  new THREE.Vector4(0.357, 0.501, 0.645, -1),
  new THREE.Vector4(-1, -1, -1, -1),
  new THREE.Vector4(-1, -1, -1, -1),
];
const CRAFT_JET = [
  new THREE.Vector2(0.16, 0.05),
  new THREE.Vector2(0.035, 0.052),
  new THREE.Vector2(0.035, 0.05),
  new THREE.Vector2(0, 1),
  new THREE.Vector2(0, 1),
];

const CRAFT_VERTEX = /* glsl */ `
  attribute vec4 iPosR;
  attribute vec4 iColK;
  attribute vec4 iAuxS;
  attribute vec4 iState;
  uniform float uTime;
  uniform float uEnter;
  uniform vec2 uResolution;
  uniform vec3 uSunView;
  uniform vec4 uRects[5];
  uniform float uAspect[5];
  uniform vec4 uJetY[5];
  uniform vec2 uJet[5];
  ${FOG_GLSL}
  ${PING_GLSL}
  varying vec4 vPD;      // xy: quad coords in half-lengths · zw: screen-space heading
  varying vec3 vColor;
  varying vec4 vMisc;    // sprite, depth fade, seed, foreshortening
  varying vec4 vState;   // glow, select, reveal, thrust
  varying vec3 vLight;   // view space, towards the star
  varying vec4 vRect;    // atlas cell: uv origin + size
  varying vec4 vJetY;
  varying vec3 vJet;     // nozzle exit, nozzle half-height, cell aspect

  void main() {
    vec3 pos = iPosR.xyz;
    float sprite = iColK.w;
    int cell = int(sprite + 0.5);
    float ship = 1.0 - step(2.5, sprite);
    vColor = iColK.rgb;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    float reveal = smoothstep(iState.z, iState.z + 0.3, uEnter);
    float nearK = ${NEAR_SMALL};
    float ping = pingAt(pos);
    float glow = max(iState.x, 0.0) + ping * 0.9;
    float lift = smoothstep(0.0, 0.6, iState.y);
    float pop = reveal * (1.0 + 0.35 * sin(reveal * 3.14159265));
    float scale = pop * (1.0 + 0.06 * lift) * (1.0 + 0.12 * ping);

    vLight = normalize(uSunView - mv.xyz + vec3(0.0, 0.0, 1e-4));

    // Screen-space heading: the sprite turns to face where the craft is going,
    // and shortens as that direction swings towards or away from the camera.
    vec4 c0 = projectionMatrix * mv;
    vec4 c1 = projectionMatrix * (modelViewMatrix * vec4(pos + iAuxS.xyz * 0.25, 1.0));
    vec2 heading = (c1.xy / c1.w - c0.xy / c0.w) * uResolution;
    float hl = length(heading);
    heading = hl > 1e-4 ? heading / hl : vec2(1.0, 0.0);
    vec3 hv = mat3(modelViewMatrix) * iAuxS.xyz;
    float shorten = mix(1.0, clamp(length(hv.xy), 0.55, 1.0), ship);
    // The station just turns slowly on itself.
    if (cell == 3) {
      float t = uTime * 0.12 + iAuxS.w * 6.0;
      heading = vec2(cos(t), sin(t));
    }

    // From the overview a craft would be a few pixels long: it is never drawn
    // smaller than this half-length (CSS px), whatever the distance.
    float pxHalf = iPosR.w * projectionMatrix[1][1] * uResolution.y * 0.5 / max(-mv.z, 0.05);
    float minPx = cell < 3 ? ${SHIP_MIN_PX.toFixed(1)} : (cell == 3 ? 13.0 : 8.0);
    scale *= max(1.0, minPx / pxHalf);

    // Quad half-extent in half-lengths: a ship needs room for its plume and reticle.
    float ext = mix(1.3, 2.7, ship);
    mv.xy += position.xy * ext * iPosR.w * scale;
    gl_Position = nearK > 0.001 ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0);
    vPD = vec4(position.xy * ext, heading);
    vMisc = vec4(sprite, depthFade(-mv.z), iAuxS.w, shorten);
    vState = vec4(glow, iState.y, reveal * nearK, iState.w);
    vRect = uRects[cell];
    vJetY = uJetY[cell];
    vJet = vec3(uJet[cell], uAspect[cell]);
  }
`;

const CRAFT_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform sampler2D uAtlas;
  uniform float uAtlasMix;
  varying vec4 vPD;
  varying vec3 vColor;
  varying vec4 vMisc;
  varying vec4 vState;
  varying vec3 vLight;
  varying vec4 vRect;
  varying vec4 vJetY;
  varying vec3 vJet;
  ${RETICLE_GLSL}

  void main() {
    vec2 P = vPD.xy;
    float d = length(P);
    float aa = fwidth(d) * 0.75 + 1e-4;
    float ship = 1.0 - step(2.5, vMisc.x);
    float seed = vMisc.z;
    float sel = vState.y;
    float n = clamp(vState.x, 0.0, 1.7);
    // Dimmed (out-of-focus) craft recede instead of just losing their glow.
    float lum = 0.2 + 0.8 * smoothstep(0.0, 0.6, n);
    vec3 L = normalize(vLight);

    // The sprite's own frame: s runs 0..1 from the stern to the bow, and 0..1
    // across the hull (the image's top to its bottom).
    vec2 dir = vPD.zw;
    vec2 side = vec2(-dir.y, dir.x);
    vec2 q = vec2(dot(P, dir) / vMisc.w, dot(P, side));
    vec2 s = vec2(q.x, -q.y * vJet.z) * 0.5 + 0.5;
    vec2 uv = vRect.xy + s * vRect.zw;
    // Gradients for the atlas tap, capped so a distant craft never reads a mip
    // coarse enough to bleed in the neighbouring cell.
    vec2 gx = dFdx(uv);
    vec2 gy = dFdy(uv);
    float span = max(length(gx * vec2(${ATLAS_W}.0, ${ATLAS_H}.0)), length(gy * vec2(${ATLAS_W}.0, ${ATLAS_H}.0)));
    float cap = min(1.0, 12.0 / max(span, 1e-4));
    gx *= cap;
    gy *= cap;
    float inside = step(0.0, s.x) * step(s.x, 1.0) * step(0.0, s.y) * step(s.y, 1.0);

    // Premultiplied colour + coverage.
    vec4 hull = textureGrad(uAtlas, uv, gx, gy) * inside * uAtlasMix;
    // A much blurrier read of the silhouette, one step along and one across:
    // its slope stands in for the hull's roundness, so the side that faces the
    // star catches the light and the other falls into shade.
    float soft = textureLod(uAtlas, uv, 5.0).a;
    float softX = textureLod(uAtlas, uv + vec2(vRect.z * 0.05, 0.0), 5.0).a;
    float softY = textureLod(uAtlas, uv + vec2(0.0, vRect.w * 0.05 * vJet.z), 5.0).a;
    vec2 slope = vec2(soft - softX, soft - softY);
    vec2 sun = vec2(dot(L.xy, dir), -dot(L.xy, side));
    float shade = clamp(0.8 + dot(slope, sun) * 2.6 + 0.12 * L.z, 0.35, 1.5);

    vec3 rgb = hull.rgb * shade * lum;
    float a = hull.a;

    // Engines (ships only): one plume per nozzle, longer with the throttle.
    float thrust = vState.w * ship;
    float back = vJet.x - s.x;
    float reach = 0.07 + 0.3 * thrust;
    float along = max(back, 0.0) / reach;
    float open = smoothstep(-0.03, 0.02, back);
    float plume = 0.0;
    for (int j = 0; j < 4; j++) {
      float off = (s.y - vJetY[j]) / (vJet.y * (1.0 + along * 0.9));
      plume += exp(-off * off * 1.6) * step(0.0, vJetY[j]);
    }
    plume *= exp(-along * 2.4) * open * ship;
    float flicker = 0.88 + 0.12 * sin(uTime * 34.0 + seed * 50.0 + s.x * 40.0);
    vec3 flame = mix(vColor, vec3(0.92, 1.0, 0.96), 0.35 + 0.55 * exp(-along * 5.0));
    rgb += flame * plume * (0.2 + 1.5 * thrust) * flicker * min(n, 1.3) * (1.0 - hull.a * 0.6) * uAtlasMix;

    // Until the atlas has decoded a craft is a small lit dot.
    rgb += vColor * exp(-d * d * 9.0) * 0.8 * n * (1.0 - uAtlasMix);
    // A faint presence glow keeps a craft readable from the overview.
    rgb += vColor * exp(-d * d * 1.3) * 0.14 * n * (1.0 - a);
    // The satellite's beacon.
    float beacon = step(3.5, vMisc.x) * step(0.86, fract(uTime * 0.6 + seed * 7.0));
    rgb += vec3(0.7, 1.0, 0.85) * exp(-d * d * 22.0) * 0.9 * beacon * n;

    float lock = reticle(P, d, 1.55 + 0.05 * sin(uTime * 4.0), clamp(aa * 1.8, 0.01, 0.05), aa, uTime * 0.14);
    rgb += mix(vColor, vec3(1.0), 0.35) * lock * sel * ship;
    gl_FragColor = vec4(rgb * vState.z * vMisc.y, a * lum * vState.z);
  }
`;

const smallUniforms = () => ({
  uTime: SHARED.uTime,
  uEnter: SHARED.uEnter,
  uFogNear: SHARED.uFogNear,
  uFogFar: SHARED.uFogFar,
  uPing: SHARED.uPing,
  uSunView: SHARED.uSunView,
});

const MOON_MATERIAL = new THREE.ShaderMaterial({
  uniforms: { ...smallUniforms(), uMap: MOON_SLOT_MAP.map, uMapMix: MOON_SLOT_MAP.mix },
  vertexShader: MOON_VERTEX,
  fragmentShader: MOON_FRAGMENT,
  ...LAYER_MATERIAL,
});

const CRAFT_MATERIAL = new THREE.ShaderMaterial({
  uniforms: {
    ...smallUniforms(),
    uResolution: SHARED.uResolution,
    uAtlas: CRAFT_SLOT.map,
    uAtlasMix: CRAFT_SLOT.mix,
    uRects: { value: CRAFT_RECTS },
    uAspect: { value: CRAFT_ASPECT },
    uJetY: { value: CRAFT_JET_Y },
    uJet: { value: CRAFT_JET },
  },
  vertexShader: CRAFT_VERTEX,
  fragmentShader: CRAFT_FRAGMENT,
  ...LAYER_MATERIAL,
});

interface SmallPass {
  mesh: THREE.Mesh;
  geometry: THREE.InstancedBufferGeometry;
  buffer: THREE.InstancedInterleavedBuffer;
  data: Float32Array;
  count: number;
}

function makeSmallPass(material: THREE.ShaderMaterial, capacity: number, renderOrder: number): SmallPass {
  const data = new Float32Array(capacity * STRIDE);
  const buffer = new THREE.InstancedInterleavedBuffer(data, STRIDE, 1);
  buffer.setUsage(THREE.DynamicDrawUsage);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(QUAD_POSITIONS, 3));
  geometry.setIndex(QUAD_INDEX);
  geometry.setAttribute('iPosR', new THREE.InterleavedBufferAttribute(buffer, 4, 0));
  geometry.setAttribute('iColK', new THREE.InterleavedBufferAttribute(buffer, 4, 4));
  geometry.setAttribute('iAuxS', new THREE.InterleavedBufferAttribute(buffer, 4, 8));
  geometry.setAttribute('iState', new THREE.InterleavedBufferAttribute(buffer, 4, 12));
  geometry.instanceCount = 0;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false; // instances live in the shader
  mesh.renderOrder = renderOrder;
  return { mesh, geometry, buffer, data, count: 0 };
}

/**
 * Small bodies covered by a large one are drawn before all of them; the rest
 * after. Within each group the moons go first, then the craft.
 */
const CRAFT_COUNT = SAT_COUNT + SHIP_COUNT;
const MOON_BACK = makeSmallPass(MOON_MATERIAL, LEAF_COUNT, 3.5);
const CRAFT_BACK = makeSmallPass(CRAFT_MATERIAL, CRAFT_COUNT, 3.6);
const MOON_FRONT = makeSmallPass(MOON_MATERIAL, LEAF_COUNT, 5);
const CRAFT_FRONT = makeSmallPass(CRAFT_MATERIAL, CRAFT_COUNT, 5.1);
const SMALL_PASSES = [MOON_BACK, CRAFT_BACK, MOON_FRONT, CRAFT_FRONT];
export const SMALL_MESHES = SMALL_PASSES.map((p) => p.mesh);

/** Every mesh of this layer, for the scene graph and for GPU clean-up. */
export const BODY_MESHES: THREE.Mesh[] = [GLOW_MESH, ...BIG_MESHES, ...SMALL_MESHES];

/**
 * Per-frame upload. Ranks the large bodies back to front, then writes the small
 * ones into their passes, each ordered back to front (insertion sorts: the
 * order barely changes between frames, so they are close to linear).
 */
export function uploadBodies(): void {
  for (let a = 1; a < BIG_COUNT; a++) {
    const o = BIG_ORDER[a];
    let k = a - 1;
    while (k >= 0 && BIG_DEPTH[BIG_ORDER[k]] < BIG_DEPTH[o]) {
      BIG_ORDER[k + 1] = BIG_ORDER[k];
      k--;
    }
    BIG_ORDER[k + 1] = o;
  }
  for (let rank = 0; rank < BIG_COUNT; rank++) BIG[BIG_ORDER[rank]].mesh.renderOrder = 4 + rank * 0.01;

  for (let a = 1; a < SMALL_COUNT; a++) {
    const o = SMALL_ORDER[a];
    const depth = SMALL_DEPTH[o];
    let k = a - 1;
    while (k >= 0 && SMALL_DEPTH[SMALL_ORDER[k]] < depth) {
      SMALL_ORDER[k + 1] = SMALL_ORDER[k];
      k--;
    }
    SMALL_ORDER[k + 1] = o;
  }
  for (const pass of SMALL_PASSES) pass.count = 0;
  for (let i = 0; i < SMALL_COUNT; i++) {
    const index = SMALL_ORDER[i];
    const src = index * STRIDE;
    const moon = SOURCE[src + 7] === KIND_MOON;
    const pass = SMALL_BEHIND[index] === 1 ? (moon ? MOON_BACK : CRAFT_BACK) : moon ? MOON_FRONT : CRAFT_FRONT;
    const dst = pass.count++ * STRIDE;
    // Plain copy loop: no per-record typed-array views, so no garbage per frame.
    for (let k = 0; k < STRIDE; k++) pass.data[dst + k] = SOURCE[src + k];
  }
  for (const pass of SMALL_PASSES) {
    pass.geometry.instanceCount = pass.count;
    pass.buffer.needsUpdate = true;
  }

  if (glowDirty) {
    GLOW_INT_ATTR.needsUpdate = true;
    glowDirty = false;
  }
}
