'use client';

import { useEffect, useRef } from 'react';
import { useIsMobile, useReducedMotion } from '@/hooks/useIsMobile';

interface DotGridProps {
  spacing?: number;
  baseRadius?: number;
  hoverRadius?: number;
  influence?: number;
  color?: string;
  hoverColor?: string;
}

export default function DotGrid({
  spacing = 26,
  baseRadius = 1.1,
  hoverRadius = 3.2,
  influence = 130,
  color = 'rgba(255,255,255,0.08)',
  hoverColor = 'rgba(255,255,255,0.85)',
}: DotGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMobile = useIsMobile();
  const reduced = useReducedMotion();

  useEffect(() => {
    if (isMobile) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let width = 0;
    let height = 0;
    const pointer = { x: -9999, y: -9999, inside: false };
    let raf = 0;
    let needsDraw = true;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      needsDraw = true;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      const inflSq = influence * influence;
      for (let y = spacing / 2; y < height; y += spacing) {
        for (let x = spacing / 2; x < width; x += spacing) {
          let r = baseRadius;
          let alpha = 1;
          let fill = color;

          if (pointer.inside) {
            const dx = x - pointer.x;
            const dy = y - pointer.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < inflSq) {
              const t = 1 - distSq / inflSq;
              r = lerp(baseRadius, hoverRadius, t);
              alpha = lerp(0.6, 1, t);
              fill = hoverColor;
            }
          }

          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = fill;
          ctx.globalAlpha = alpha;
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };

    const tick = () => {
      if (needsDraw || pointer.inside) {
        draw();
        needsDraw = false;
      }
      raf = requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      if (reduced) return;
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.inside = true;
    };
    const onLeave = () => {
      pointer.inside = false;
      needsDraw = true;
    };

    const parent = canvas.parentElement;
    parent?.addEventListener('pointermove', onMove, { passive: true });
    parent?.addEventListener('pointerleave', onLeave);

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      parent?.removeEventListener('pointermove', onMove);
      parent?.removeEventListener('pointerleave', onLeave);
    };
  }, [spacing, baseRadius, hoverRadius, influence, color, hoverColor, isMobile, reduced]);

  if (isMobile) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 w-full h-full"
    />
  );
}
