import * as THREE from 'three';
import { SHARED } from './sceneShared';

/*
 * Bloom — the light the scene spills. The graph is drawn a second time into a
 * half-resolution target (cheap: it is five small draw calls), blurred down and
 * back up a short mip chain (dual-filter / Kawase, a few tiny fullscreen
 * passes), and the result is added over the canvas.
 *
 * Nothing here reads the main framebuffer, so the canvas keeps its transparent
 * background and its sharp, anti-aliased first pass. Only the top quality tier
 * runs it.
 */

/** Target scale per level, relative to the drawing buffer: 1/2 → 1/16. */
const LEVELS = 4;
const targets: THREE.WebGLRenderTarget[] = [];
let targetW = 0;
let targetH = 0;

const FS_SCENE = new THREE.Scene();
const FS_CAMERA = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const FS_GEOMETRY = new THREE.BufferGeometry();
// One triangle that covers the viewport.
FS_GEOMETRY.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));

const FS_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const DOWN_UNIFORMS = {
  tMap: { value: null as THREE.Texture | null },
  /** Half a texel of the source, in uv. */
  uHalf: { value: new THREE.Vector2() },
  /** 1 on the first pass: keep the highlights, let the faint haze go. */
  uKnee: { value: 0 },
};
const DOWN = new THREE.ShaderMaterial({
  uniforms: DOWN_UNIFORMS,
  vertexShader: FS_VERTEX,
  fragmentShader: /* glsl */ `
    uniform sampler2D tMap;
    uniform vec2 uHalf;
    uniform float uKnee;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tMap, vUv).rgb * 4.0;
      c += texture2D(tMap, vUv - uHalf).rgb;
      c += texture2D(tMap, vUv + uHalf).rgb;
      c += texture2D(tMap, vUv + vec2(uHalf.x, -uHalf.y)).rgb;
      c += texture2D(tMap, vUv - vec2(uHalf.x, -uHalf.y)).rgb;
      c *= 0.125;
      // First pass only: cap what stacked additive layers pushed past white (a
      // float target does not clamp), and let the faint haze go.
      float peak = max(c.r, max(c.g, c.b));
      float keep = min(1.0, 1.0 / max(peak, 1e-4)) * (0.12 + 0.88 * smoothstep(0.06, 0.6, peak));
      c *= mix(1.0, keep, uKnee);
      gl_FragColor = vec4(c, 1.0);
    }
  `,
  depthTest: false,
  depthWrite: false,
  blending: THREE.NoBlending,
  toneMapped: false,
});

const UP_FRAGMENT = /* glsl */ `
  uniform sampler2D tMap;
  uniform vec2 uHalf;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tMap, vUv + vec2(-uHalf.x * 2.0, 0.0)).rgb;
    c += texture2D(tMap, vUv + vec2(-uHalf.x, uHalf.y)).rgb * 2.0;
    c += texture2D(tMap, vUv + vec2(0.0, uHalf.y * 2.0)).rgb;
    c += texture2D(tMap, vUv + vec2(uHalf.x, uHalf.y)).rgb * 2.0;
    c += texture2D(tMap, vUv + vec2(uHalf.x * 2.0, 0.0)).rgb;
    c += texture2D(tMap, vUv + vec2(uHalf.x, -uHalf.y)).rgb * 2.0;
    c += texture2D(tMap, vUv + vec2(0.0, -uHalf.y * 2.0)).rgb;
    c += texture2D(tMap, vUv + vec2(-uHalf.x, -uHalf.y)).rgb * 2.0;
    gl_FragColor = vec4(c / 12.0, 0.0);
  }
`;
const UP_UNIFORMS = {
  tMap: { value: null as THREE.Texture | null },
  uHalf: { value: new THREE.Vector2() },
};

/**
 * The only full-resolution pass, so it is kept to a single (bilinear) tap: the
 * quarter-resolution result is already smooth. Additive, alpha 0.
 */
const COMPOSITE_UNIFORMS = {
  tMap: { value: null as THREE.Texture | null },
  uHalf: { value: new THREE.Vector2() }, // unused; set by pass()
  uGain: { value: 1 },
};
const COMPOSITE = new THREE.ShaderMaterial({
  uniforms: COMPOSITE_UNIFORMS,
  vertexShader: FS_VERTEX,
  fragmentShader: /* glsl */ `
    uniform sampler2D tMap;
    uniform float uGain;
    varying vec2 vUv;
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }
    void main() {
      vec3 c = texture2D(tMap, vUv).rgb * uGain;
      // A wide, faint glow over a dark page bands at 8 bits: break it up.
      c += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
      gl_FragColor = vec4(max(c, 0.0), 0.0);
    }
  `,
  depthTest: false,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.OneFactor,
  blendDstAlpha: THREE.OneFactor,
  toneMapped: false,
});
/** Additive (alpha 0): adds a blurred level onto the next-sharper one. */
const UP = new THREE.ShaderMaterial({
  uniforms: UP_UNIFORMS,
  vertexShader: FS_VERTEX,
  fragmentShader: UP_FRAGMENT,
  depthTest: false,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.OneFactor,
  blendDstAlpha: THREE.OneFactor,
  toneMapped: false,
});

const FS_MESH = new THREE.Mesh(FS_GEOMETRY, DOWN);
FS_MESH.frustumCulled = false;
FS_SCENE.add(FS_MESH);

const SIZE = new THREE.Vector2();

function ensureTargets(gl: THREE.WebGLRenderer): void {
  gl.getDrawingBufferSize(SIZE);
  if (targets.length === LEVELS && SIZE.x === targetW && SIZE.y === targetH) return;
  targetW = SIZE.x;
  targetH = SIZE.y;
  // Half-float keeps the faint end of the blur smooth where the GPU can render to it.
  const float =
    gl.extensions.has('EXT_color_buffer_float') || gl.extensions.has('EXT_color_buffer_half_float');
  for (let i = 0; i < LEVELS; i++) {
    const w = Math.max(2, Math.ceil(targetW / (2 << i)));
    const h = Math.max(2, Math.ceil(targetH / (2 << i)));
    if (targets[i]) {
      targets[i].setSize(w, h);
    } else {
      targets[i] = new THREE.WebGLRenderTarget(w, h, {
        depthBuffer: false,
        stencilBuffer: false,
        type: float ? THREE.HalfFloatType : THREE.UnsignedByteType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        generateMipmaps: false,
      });
    }
  }
}

function pass(
  gl: THREE.WebGLRenderer,
  material: THREE.ShaderMaterial,
  source: THREE.WebGLRenderTarget,
  dest: THREE.WebGLRenderTarget | null,
): void {
  material.uniforms.tMap.value = source.texture;
  material.uniforms.uHalf.value.set(0.5 / source.width, 0.5 / source.height);
  FS_MESH.material = material;
  gl.setRenderTarget(dest);
  gl.render(FS_SCENE, FS_CAMERA);
}

/** Programs to warm up alongside the scene's own (see the scene's compileAsync). */
export function compileBloom(gl: THREE.WebGLRenderer): void {
  FS_MESH.material = DOWN;
  gl.compile(FS_SCENE, FS_CAMERA);
  FS_MESH.material = UP;
  gl.compile(FS_SCENE, FS_CAMERA);
  FS_MESH.material = COMPOSITE;
  gl.compile(FS_SCENE, FS_CAMERA);
}

/**
 * Adds the bloom over whatever is on the canvas. Call right after the main
 * render. `backdrop` objects (stars, …) are left out of the glow source.
 */
export function renderBloom(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  strength: number,
  backdrop: THREE.Object3D[],
): void {
  if (strength <= 0.001) return;
  ensureTargets(gl);
  const autoClear = gl.autoClear;
  const visible = backdrop.map((o) => o.visible);

  // Glow source: the graph again, at half resolution (point sprites sized to match).
  for (const o of backdrop) o.visible = false;
  const dpr = SHARED.uDpr.value;
  SHARED.uDpr.value = dpr * 0.5;
  gl.autoClear = true;
  gl.setRenderTarget(targets[0]);
  gl.render(scene, camera);
  SHARED.uDpr.value = dpr;
  backdrop.forEach((o, i) => (o.visible = visible[i]));

  // Down the chain…
  for (let i = 1; i < LEVELS; i++) {
    DOWN_UNIFORMS.uKnee.value = i === 1 ? 1 : 0;
    pass(gl, DOWN, targets[i - 1], targets[i]);
  }
  // …and back up, each level added onto the next-sharper one.
  gl.autoClear = false;
  for (let i = LEVELS - 1; i > 1; i--) pass(gl, UP, targets[i], targets[i - 1]);
  // Composite the quarter-resolution result over the canvas.
  COMPOSITE_UNIFORMS.uGain.value = strength;
  pass(gl, COMPOSITE, targets[1], null);
  gl.autoClear = autoClear;
}

/** Frees the render targets (they are rebuilt on demand). */
export function disposeBloom(): void {
  for (const t of targets) t.dispose();
  targets.length = 0;
  targetW = 0;
  targetH = 0;
  DOWN.dispose();
  UP.dispose();
  COMPOSITE.dispose();
}
