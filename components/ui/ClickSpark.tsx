'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

interface ClickSparkProps {
  sparkColor?: string;
  sparkSize?: number;
  sparkRadius?: number;
  sparkCount?: number;
  duration?: number;
}

interface Spark {
  x: number;
  y: number;
  angle: number;
  startTime: number;
}

const MAX_DPR = 1.5;

/**
 * Lightweight global click effect: a fullscreen pointer-events:none canvas
 * that listens only for `pointerdown` events. Each mouse/pen click spawns N
 * short radial spark lines that fade in ~400 ms. The rAF loop is only active
 * while at least one spark is alive; between clicks the canvas is
 * `display: none`, so no fullscreen layer sits on top of the page.
 *
 * Honors prefers-reduced-motion (renders nothing).
 */
export default function ClickSpark({
  sparkColor = '#FFFFFF',
  sparkSize = 9,
  sparkRadius = 18,
  sparkCount = 8,
  duration = 420,
}: ClickSparkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparks = useRef<Spark[]>([]);
  const rafRef = useRef<number | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // The backing store is only (re)allocated when a spark is about to be
    // drawn; a resize while idle just marks it stale.
    let sized = false;
    const applySize = () => {
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      const { innerWidth, innerHeight } = window;
      canvas.width = Math.round(innerWidth * dpr);
      canvas.height = Math.round(innerHeight * dpr);
      canvas.style.width = `${innerWidth}px`;
      canvas.style.height = `${innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sized = true;
    };
    const onResize = () => {
      if (rafRef.current !== null) applySize();
      else sized = false;
    };
    window.addEventListener('resize', onResize, { passive: true });

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const draw = (now: number) => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      sparks.current = sparks.current.filter((spark) => {
        const elapsed = now - spark.startTime;
        const progress = elapsed / duration;
        if (progress >= 1) return false;

        // rAF timestamps can precede the pointerdown's performance.now().
        const eased = easeOutCubic(Math.max(0, progress));
        const distance = eased * sparkRadius;
        const lineLen = sparkSize * (1 - eased);

        const x1 = spark.x + distance * Math.cos(spark.angle);
        const y1 = spark.y + distance * Math.sin(spark.angle);
        const x2 = spark.x + (distance + lineLen) * Math.cos(spark.angle);
        const y2 = spark.y + (distance + lineLen) * Math.sin(spark.angle);

        ctx.strokeStyle = sparkColor;
        ctx.globalAlpha = 1 - eased;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        return true;
      });
      ctx.globalAlpha = 1;

      if (sparks.current.length > 0) {
        rafRef.current = requestAnimationFrame(draw);
      } else {
        rafRef.current = null;
        canvas.style.display = 'none';
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      // Primary button only, and no sparks under a finger: on touch the tap
      // target is hidden by the finger and the effect only costs frames.
      if (event.button !== 0 || event.pointerType === 'touch') return;
      // Buttons get their own dedicated click FX (ButtonFX); skip the ambient
      // cursor spark there so the two effects don't compete.
      const el = event.target as HTMLElement | null;
      if (el?.closest?.('.cyber-button')) return;
      const now = performance.now();
      for (let i = 0; i < sparkCount; i++) {
        sparks.current.push({
          x: event.clientX,
          y: event.clientY,
          angle: (i / sparkCount) * Math.PI * 2,
          startTime: now,
        });
      }
      if (rafRef.current === null) {
        if (!sized) applySize();
        canvas.style.display = 'block';
        rafRef.current = requestAnimationFrame(draw);
      }
    };

    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointerdown', onPointerDown);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      sparks.current = [];
      canvas.style.display = 'none';
    };
  }, [duration, reduced, sparkColor, sparkCount, sparkRadius, sparkSize]);

  // Always render the (inert) canvas: the server can't know the user's motion
  // preference, so returning null here under reduced motion produced a
  // hydration mismatch. The effect above simply never shows it in that case.
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-spark"
      style={{ display: 'none' }}
    />
  );
}
