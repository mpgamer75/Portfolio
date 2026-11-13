'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Renderer, Triangle, Program, Mesh } from 'ogl';

// Fragment budget for the 60-step raymarch. The prism is a soft, bloomed shape,
// so it is rendered at no more than this many pixels and upscaled by the
// browser; a 4K window costs the same as a 1536x864 one.
const MAX_PIXELS = 1536 * 864;
// One-way fallback budget when the first second of frames is slow.
const LOW_PIXELS = 1280 * 720;
const GUARD_SKIP_FRAMES = 20; // ignore load/shader-compile jank
const GUARD_SAMPLE_FRAMES = 40;
const GUARD_MAX_DELTA_MS = 100; // tab switches / long tasks are not GPU cost
const GUARD_SLOW_MEDIAN_MS = 20;

interface PrismProps {
  height?: number;
  baseWidth?: number;
  animationType?: 'rotate' | 'hover' | '3drotate';
  glow?: number;
  offset?: { x: number; y: number };
  noise?: number;
  transparent?: boolean;
  scale?: number;
  hueShift?: number;
  colorFrequency?: number;
  hoverStrength?: number;
  inertia?: number;
  bloom?: number;
  suspendWhenOffscreen?: boolean;
  timeScale?: number;
  /** Freeze the shader (stop the RAF) whenever this selector's element is
   *  offscreen. Pointed at the hero, the GPU idles once you scroll into
   *  content. Falls back to the container when omitted. */
  activeSelector?: string;
  /** Pointer parallax for the 'rotate' animation, in radians at the viewport
   *  edge. 0 (default) disables it and adds no listener. */
  parallax?: number;
}

const Prism = ({
  height = 3.5,
  baseWidth = 5.5,
  animationType = 'rotate',
  glow = 1,
  offset = { x: 0, y: 0 },
  noise = 0.5,
  transparent = true,
  scale = 3.6,
  hueShift = 0,
  colorFrequency = 1,
  hoverStrength = 2,
  inertia = 0.05,
  bloom = 1,
  suspendWhenOffscreen = false,
  timeScale = 0.5,
  activeSelector,
  parallax = 0,
}: PrismProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  // Bumped after a restored WebGL context: every GL resource is gone at that
  // point, so the effect below is simply re-run to rebuild the renderer.
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    // Honor prefers-reduced-motion: skip the WebGL animation entirely.
    if (!container || reduced) return;

    const H = Math.max(0.001, height);
    const BW = Math.max(0.001, baseWidth);
    const BASE_HALF = BW * 0.5;
    const GLOW = Math.max(0.0, glow);
    const NOISE = Math.max(0.0, noise);
    const offX = offset?.x ?? 0;
    const offY = offset?.y ?? 0;
    const SAT = transparent ? 1.5 : 1;
    const SCALE = Math.max(0.001, scale);
    const HUE = hueShift || 0;
    const CFREQ = Math.max(0.0, colorFrequency || 1);
    const BLOOM = Math.max(0.0, bloom);
    const RSX = 1;
    const RSY = 1;
    const RSZ = 1;
    const TS = Math.max(0, timeScale || 1);
    const HOVSTR = Math.max(0, hoverStrength || 1);
    const INERT = Math.max(0, Math.min(1, inertia || 0.12));
    const PARALLAX = Math.max(0, Math.min(0.5, parallax || 0));

    // Render at 1x at most (never device pixels) and without MSAA: the scene is
    // one fullscreen triangle, so antialiasing buys nothing. resize() lowers the
    // ratio further on large windows to stay inside the pixel budget.
    const renderer = new Renderer({
      dpr: 1,
      alpha: transparent,
      antialias: false,
    });
    const gl = renderer.gl;
    const canvas = gl.canvas;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);

    Object.assign(canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      display: 'block',
    });
    container.appendChild(canvas);

    const vertex = /* glsl */ `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fragment = /* glsl */ `
      precision highp float;

      uniform vec2  iResolution;
      uniform float iTime;

      uniform float uHeight;
      uniform float uBaseHalf;
      uniform mat3  uRot;
      uniform int   uUseBaseWobble;
      uniform float uGlow;
      uniform vec2  uOffsetPx;
      uniform float uNoise;
      uniform float uSaturation;
      uniform float uScale;
      uniform float uHueShift;
      uniform float uColorFreq;
      uniform float uBloom;
      uniform float uCenterShift;
      uniform float uInvBaseHalf;
      uniform float uInvHeight;
      uniform float uMinAxis;
      uniform float uPxScale;
      uniform float uTimeScale;

      vec4 tanh4(vec4 x){
        vec4 e2x = exp(2.0*x);
        return (e2x - 1.0) / (e2x + 1.0);
      }

      float rand(vec2 co){
        return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453123);
      }

      float sdOctaAnisoInv(vec3 p){
        vec3 q = vec3(abs(p.x) * uInvBaseHalf, abs(p.y) * uInvHeight, abs(p.z) * uInvBaseHalf);
        float m = q.x + q.y + q.z - 1.0;
        return m * uMinAxis * 0.5773502691896258;
      }

      float sdPyramidUpInv(vec3 p){
        float oct = sdOctaAnisoInv(p);
        float halfSpace = -p.y;
        return max(oct, halfSpace);
      }

      mat3 hueRotation(float a){
        float c = cos(a), s = sin(a);
        mat3 W = mat3(
          0.299, 0.587, 0.114,
          0.299, 0.587, 0.114,
          0.299, 0.587, 0.114
        );
        mat3 U = mat3(
           0.701, -0.587, -0.114,
          -0.299,  0.413, -0.114,
          -0.300, -0.588,  0.886
        );
        mat3 V = mat3(
           0.168, -0.331,  0.500,
           0.328,  0.035, -0.500,
          -0.497,  0.296,  0.201
        );
        return W + U * c + V * s;
      }

      void main(){
        vec2 f = (gl_FragCoord.xy - 0.5 * iResolution.xy - uOffsetPx) * uPxScale;

        float z = 5.0;
        float d = 0.0;

        vec3 p;
        vec4 o = vec4(0.0);

        float centerShift = uCenterShift;
        float cf = uColorFreq;

        mat2 wob = mat2(1.0);
        if (uUseBaseWobble == 1) {
          float t = iTime * uTimeScale;
          float c0 = cos(t + 0.0);
          float c1 = cos(t + 33.0);
          float c2 = cos(t + 11.0);
          wob = mat2(c0, c1, c2, c0);
        }

        const int STEPS = 60;
        for (int i = 0; i < STEPS; i++) {
          p = vec3(f, z);
          p.xz = p.xz * wob;
          p = uRot * p;
          vec3 q = p;
          q.y += centerShift;
          d = 0.1 + 0.2 * abs(sdPyramidUpInv(q));
          z -= d;
          o += (sin((p.y + z) * cf + vec4(0.0, 1.0, 2.0, 3.0)) + 1.0) / d;
        }

        o = tanh4(o * o * (uGlow * uBloom) / 1e5);

        // Single-hue emerald tint: map the prism's intensity onto the brand
        // green instead of the default rainbow, so the background reads as
        // terminal-emerald rather than blue/cyan.
        float intensity = clamp(dot(o.rgb, vec3(0.3333)), 0.0, 1.0);
        vec3 col = vec3(0.204, 0.827, 0.600) * intensity;
        float n = rand(gl_FragCoord.xy + vec2(iTime));
        col += (n - 0.5) * uNoise;
        col = clamp(col, 0.0, 1.0);

        float L = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = clamp(mix(vec3(L), col, uSaturation), 0.0, 1.0);

        if(abs(uHueShift) > 0.0001){
          col = clamp(hueRotation(uHueShift) * col, 0.0, 1.0);
        }

        gl_FragColor = vec4(col, o.a);
      }
    `;

    const geometry = new Triangle(gl);
    const iResBuf = new Float32Array(2);
    const offsetPxBuf = new Float32Array(2);

    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        iResolution: { value: iResBuf },
        iTime: { value: 0 },
        uHeight: { value: H },
        uBaseHalf: { value: BASE_HALF },
        uUseBaseWobble: { value: 1 },
        uRot: { value: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]) },
        uGlow: { value: GLOW },
        uOffsetPx: { value: offsetPxBuf },
        uNoise: { value: NOISE },
        uSaturation: { value: SAT },
        uScale: { value: SCALE },
        uHueShift: { value: HUE },
        uColorFreq: { value: CFREQ },
        uBloom: { value: BLOOM },
        uCenterShift: { value: H * 0.25 },
        uInvBaseHalf: { value: 1 / BASE_HALF },
        uInvHeight: { value: 1 / H },
        uMinAxis: { value: Math.min(BASE_HALF, H) },
        uPxScale: {
          value: 1 / ((gl.drawingBufferHeight || 1) * 0.1 * SCALE),
        },
        uTimeScale: { value: TS },
      },
    });
    const mesh = new Mesh(gl, { geometry, program });

    let maxPixels = MAX_PIXELS;
    let contextLost = false;
    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      // Cap the backing store: ogl's setSize multiplies by renderer.dpr, so a
      // ratio below 1 renders fewer pixels and CSS stretches the canvas back.
      renderer.dpr = Math.min(1, Math.sqrt(maxPixels / (w * h)));
      renderer.setSize(w, h);
      iResBuf[0] = gl.drawingBufferWidth;
      iResBuf[1] = gl.drawingBufferHeight;
      offsetPxBuf[0] = offX * renderer.dpr;
      offsetPxBuf[1] = offY * renderer.dpr;
      program.uniforms.uPxScale.value =
        1 / ((gl.drawingBufferHeight || 1) * 0.1 * SCALE);
    };
    const ro = new ResizeObserver(() => {
      if (contextLost) return;
      resize();
      // If we're frozen (RAF stopped while scrolled past the hero), repaint a
      // single frame so a resize doesn't leave the canvas stretched/blank.
      if (!raf) renderer.render({ scene: mesh });
    });
    ro.observe(container);
    resize();

    const rotBuf = new Float32Array(9);
    const setMat3FromEuler = (
      yawY: number,
      pitchX: number,
      rollZ: number,
      out: Float32Array
    ) => {
      const cy = Math.cos(yawY),
        sy = Math.sin(yawY);
      const cx = Math.cos(pitchX),
        sx = Math.sin(pitchX);
      const cz = Math.cos(rollZ),
        sz = Math.sin(rollZ);
      const r00 = cy * cz + sy * sx * sz;
      const r01 = -cy * sz + sy * sx * cz;
      const r02 = sy * cx;

      const r10 = cx * sz;
      const r11 = cx * cz;
      const r12 = -sx;

      const r20 = -sy * cz + cy * sx * sz;
      const r21 = sy * sz + cy * sx * cz;
      const r22 = cy * cx;

      out[0] = r00;
      out[1] = r10;
      out[2] = r20;
      out[3] = r01;
      out[4] = r11;
      out[5] = r21;
      out[6] = r02;
      out[7] = r12;
      out[8] = r22;
      return out;
    };

    const NOISE_IS_ZERO = NOISE < 1e-6;
    let raf = 0;
    // Shader time only advances while the loop runs, so freezing off the hero
    // and resuming later continues from the same phase instead of jumping by
    // however long the page sat scrolled away.
    let elapsed = 0;
    let last = 0;
    // Whether the watched element is on screen; nothing may start the loop
    // while it is not.
    let visible = false;
    const startRAF = () => {
      if (raf || contextLost || !visible) return;
      last = 0;
      raf = requestAnimationFrame(render);
    };
    const stopRAF = () => {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const rnd = () => Math.random();
    const wX = (0.3 + rnd() * 0.6) * RSX;
    const wY = (0.2 + rnd() * 0.7) * RSY;
    const wZ = (0.1 + rnd() * 0.5) * RSZ;
    const phX = rnd() * Math.PI * 2;
    const phZ = rnd() * Math.PI * 2;

    let yaw = 0,
      pitch = 0,
      roll = 0;
    let targetYaw = 0,
      targetPitch = 0;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const pointer = { x: 0, y: 0, inside: true };
    const onMove = (e: PointerEvent) => {
      const ww = Math.max(1, window.innerWidth);
      const wh = Math.max(1, window.innerHeight);
      const cx = ww * 0.5;
      const cy = wh * 0.5;
      const nx = (e.clientX - cx) / (ww * 0.5);
      const ny = (e.clientY - cy) / (wh * 0.5);
      pointer.x = Math.max(-1, Math.min(1, nx));
      pointer.y = Math.max(-1, Math.min(1, ny));
      pointer.inside = true;
    };
    const onLeave = () => {
      pointer.inside = false;
    };
    const onBlur = () => {
      pointer.inside = false;
    };

    let onPointerMove: ((e: PointerEvent) => void) | null = null;
    if (animationType === 'hover') {
      onPointerMove = (e) => {
        onMove(e);
        startRAF();
      };
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('mouseleave', onLeave);
      window.addEventListener('blur', onBlur);
      program.uniforms.uUseBaseWobble.value = 0;
    } else if (animationType === '3drotate') {
      program.uniforms.uUseBaseWobble.value = 0;
    } else {
      program.uniforms.uUseBaseWobble.value = 1;
      if (PARALLAX > 0) {
        // Parallax only writes two numbers; it never starts the loop, so a
        // frozen prism stays frozen however much the pointer moves.
        onPointerMove = (e) => {
          if (e.pointerType === 'mouse') onMove(e);
        };
        window.addEventListener('pointermove', onPointerMove, { passive: true });
      }
    }

    // One-shot adaptive guard: median frame time over the first frames.
    let guardSkip = GUARD_SKIP_FRAMES;
    let guardDone = false;
    const guardSamples: number[] = [];

    const render = (t: number) => {
      const deltaMs = last ? t - last : 0;
      last = t;
      const dt = Math.min(0.05, Math.max(0, deltaMs) * 0.001);
      elapsed += dt;
      const time = elapsed;
      program.uniforms.iTime.value = time;

      if (!guardDone && deltaMs > 0 && deltaMs <= GUARD_MAX_DELTA_MS) {
        if (guardSkip > 0) {
          guardSkip -= 1;
        } else {
          guardSamples.push(deltaMs);
          if (guardSamples.length >= GUARD_SAMPLE_FRAMES) {
            guardDone = true;
            guardSamples.sort((a, b) => a - b);
            const mid = guardSamples.length >> 1;
            const median = (guardSamples[mid - 1] + guardSamples[mid]) * 0.5;
            if (median > GUARD_SLOW_MEDIAN_MS && maxPixels > LOW_PIXELS) {
              maxPixels = LOW_PIXELS; // once, never back up
              resize();
            }
          }
        }
      }

      let continueRAF = true;

      if (animationType === 'hover') {
        const maxPitch = 0.6 * HOVSTR;
        const maxYaw = 0.6 * HOVSTR;
        targetYaw = (pointer.inside ? -pointer.x : 0) * maxYaw;
        targetPitch = (pointer.inside ? pointer.y : 0) * maxPitch;
        const prevYaw = yaw;
        const prevPitch = pitch;
        const prevRoll = roll;
        yaw = lerp(prevYaw, targetYaw, INERT);
        pitch = lerp(prevPitch, targetPitch, INERT);
        roll = lerp(prevRoll, 0, 0.1);
        program.uniforms.uRot.value = setMat3FromEuler(yaw, pitch, roll, rotBuf);

        if (NOISE_IS_ZERO) {
          const settled =
            Math.abs(yaw - targetYaw) < 1e-4 &&
            Math.abs(pitch - targetPitch) < 1e-4 &&
            Math.abs(roll) < 1e-4;
          if (settled) continueRAF = false;
        }
      } else if (animationType === '3drotate') {
        const tScaled = time * TS;
        yaw = tScaled * wY;
        pitch = Math.sin(tScaled * wX + phX) * 0.6;
        roll = Math.sin(tScaled * wZ + phZ) * 0.5;
        program.uniforms.uRot.value = setMat3FromEuler(yaw, pitch, roll, rotBuf);
        if (TS < 1e-6) continueRAF = false;
      } else if (PARALLAX > 0) {
        // Ease toward the pointer with a frame-rate independent factor.
        const k = 1 - Math.exp(-dt * 3);
        yaw += (-pointer.x * PARALLAX - yaw) * k;
        pitch += (pointer.y * PARALLAX - pitch) * k;
        program.uniforms.uRot.value = setMat3FromEuler(yaw, pitch, 0, rotBuf);
        if (TS < 1e-6) continueRAF = false;
      } else {
        rotBuf[0] = 1;
        rotBuf[1] = 0;
        rotBuf[2] = 0;
        rotBuf[3] = 0;
        rotBuf[4] = 1;
        rotBuf[5] = 0;
        rotBuf[6] = 0;
        rotBuf[7] = 0;
        rotBuf[8] = 1;
        program.uniforms.uRot.value = rotBuf;
        if (TS < 1e-6) continueRAF = false;
      }

      renderer.render({ scene: mesh });
      if (continueRAF) {
        raf = requestAnimationFrame(render);
      } else {
        raf = 0;
      }
    };

    let intersectionObserver: IntersectionObserver | null = null;
    // Freeze the shader whenever the watched element is offscreen. With
    // activeSelector pointed at the hero, the RAF stops the moment you scroll
    // into the content and the last frame stays painted as a static backdrop —
    // the single biggest site-wide perf win. Falls back to the container.
    const watched =
      (activeSelector && document.querySelector(activeSelector)) || container;
    if (suspendWhenOffscreen || activeSelector) {
      intersectionObserver = new IntersectionObserver((entries) => {
        visible = entries.some((e) => e.isIntersecting);
        if (visible) startRAF();
        else stopRAF();
      });
      intersectionObserver.observe(watched);
    } else {
      visible = true;
      startRAF();
    }

    // A lost context (GPU reset, driver update, too many contexts) must not
    // leave a loop drawing into nothing. preventDefault allows a restore; on
    // restore the whole effect is rebuilt, since every GL object is invalid.
    const onContextLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
      stopRAF();
    };
    const onContextRestored = () => setGeneration((g) => g + 1);
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    return () => {
      stopRAF();
      ro.disconnect();
      if (onPointerMove) {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('mouseleave', onLeave);
        window.removeEventListener('blur', onBlur);
      }
      intersectionObserver?.disconnect();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      if (canvas.parentElement === container) container.removeChild(canvas);
      // Release the GPU context now instead of waiting for garbage collection.
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [
    height,
    baseWidth,
    animationType,
    glow,
    noise,
    offset?.x,
    offset?.y,
    scale,
    transparent,
    hueShift,
    colorFrequency,
    timeScale,
    hoverStrength,
    inertia,
    bloom,
    suspendWhenOffscreen,
    activeSelector,
    parallax,
    reduced,
    generation,
  ]);

  // Static, calm fallback when motion is reduced — a faint accent wash
  // instead of a forced full-screen WebGL animation.
  if (reduced) {
    return (
      <div
        aria-hidden="true"
        className="w-full h-full relative"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 30%, rgba(52,211,153,0.14), rgba(5,8,20,0) 60%)',
        }}
      />
    );
  }

  return <div className="w-full h-full relative" ref={containerRef} />;
};

export default Prism;