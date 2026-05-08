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

/**
 * Lightweight global click effect: a fullscreen pointer-events:none canvas
 * that listens only for `pointerdown` events. Each click spawns N short
 * radial spark lines that fade in ~400 ms. The rAF loop is only active
 * while at least one spark is alive — between clicks the canvas is idle.
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

    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const resize = () => {
      const { innerWidth, innerHeight } = window;
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      canvas.style.width = `${innerWidth}px`;
      canvas.style.height = `${innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const draw = (now: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      sparks.current = sparks.current.filter((spark) => {
        const elapsed = now - spark.startTime;
        const progress = elapsed / duration;
        if (progress >= 1) return false;

        const eased = easeOutCubic(progress);
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
      }
    };

    const onClick = (event: PointerEvent) => {
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
        rafRef.current = requestAnimationFrame(draw);
      }
    };

    window.addEventListener('pointerdown', onClick);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointerdown', onClick);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      sparks.current = [];
    };
  }, [duration, reduced, sparkColor, sparkCount, sparkRadius, sparkSize]);

  if (reduced) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[200]"
    />
  );
}
