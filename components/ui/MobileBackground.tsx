'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  velocity: number;
  twinkleSpeed: number;
  twinklePhase: number;
}

interface Connection {
  from: Star;
  to: Star;
  distance: number;
}

interface MobileBackgroundProps {
  /** Run the animation loop. When false the loop stops and the last frame
   *  stays painted as a static backdrop (the page passes `!pastHero`, the
   *  phone equivalent of the desktop prism freezing off the hero). */
  active?: boolean;
}

const MAX_STARS = 60;
const MAX_DPR = 2;
const MAX_CONNECTION_DISTANCE = 120;
// Extra canvas height beyond the viewport, so a collapsing mobile URL bar
// (a height-only resize) reveals more starfield instead of forcing a resize.
const HEIGHT_SLACK = 120;

export default function MobileBackground({ active = true }: MobileBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const activeRef = useRef(active);
  const controlsRef = useRef<{ start: () => void; stop: () => void } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Logical (CSS pixel) size; the backing store is this times the DPR.
    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    let connections: Connection[] = [];
    let frameCount = 0;
    let raf = 0;
    let last = 0;

    const setCanvasSize = () => {
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight) + HEIGHT_SLACK;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      // Draw in CSS pixels; the transform maps them onto the denser store.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const initStars = () => {
      const numStars = Math.min(MAX_STARS, Math.floor((width * height) / 8000));
      stars = [];
      for (let i = 0; i < numStars; i++) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() * 2 + 0.5,
          opacity: Math.random() * 0.5 + 0.3,
          velocity: Math.random() * 0.15 + 0.05,
          twinkleSpeed: Math.random() * 0.02 + 0.01,
          twinklePhase: Math.random() * Math.PI * 2,
        });
      }
    };

    const computeConnections = () => {
      const next: Connection[] = [];
      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const dx = stars[i].x - stars[j].x;
          const dy = stars[i].y - stars[j].y;
          const distance = Math.hypot(dx, dy);
          if (distance < MAX_CONNECTION_DISTANCE) {
            next.push({ from: stars[i], to: stars[j], distance });
          }
        }
      }
      connections = next;
    };

    /** Paint one frame. `step` is elapsed time in 60fps frames (0 = static). */
    const draw = (step: number) => {
      ctx.clearRect(0, 0, width, height);

      for (const star of stars) {
        if (step > 0) {
          star.y -= star.velocity * step;
          if (star.y < -10) {
            star.y = height + 10;
            star.x = Math.random() * width;
          }
          star.twinklePhase += star.twinkleSpeed * step;
        }

        const twinkle = Math.sin(star.twinklePhase) * 0.3 + 0.7;
        const currentOpacity = star.opacity * twinkle;

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${currentOpacity})`;
        ctx.fill();

        if (star.size > 1.5) {
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size * 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${currentOpacity * 0.2})`;
          ctx.fill();
        }
      }

      ctx.lineWidth = 0.5;
      for (const { from, to, distance } of connections) {
        const opacity = (1 - distance / MAX_CONNECTION_DISTANCE) * 0.18;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        // Brand emerald (--accent) rather than white for the links.
        ctx.strokeStyle = `rgba(52, 211, 153, ${opacity})`;
        ctx.stroke();
      }
    };

    const drawStatic = () => {
      computeConnections();
      draw(0);
    };

    const animate = (now: number) => {
      // Time-based motion so 90/120Hz phones do not run the field faster;
      // the clamp keeps a long pause from teleporting the stars.
      const step = last ? Math.min(50, now - last) / (1000 / 60) : 1;
      last = now;
      frameCount += 1;
      // Recompute connections every other frame — visually identical, and it
      // halves the O(N^2) distance check on mid-tier phones.
      if ((frameCount & 1) === 0) computeConnections();
      draw(step);
      raf = requestAnimationFrame(animate);
    };

    const start = () => {
      if (raf || reduced) return;
      last = 0;
      raf = requestAnimationFrame(animate);
    };

    const stop = () => {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const onResize = () => {
      // Height-only changes (mobile URL bar showing/hiding) are absorbed by
      // HEIGHT_SLACK; only rebuild when the width changes or the viewport
      // outgrows the canvas.
      if (window.innerWidth === width && window.innerHeight <= height) return;
      setCanvasSize();
      initStars();
      // Resizing clears the canvas: repaint now when no loop will do it.
      if (!raf) drawStatic();
    };

    setCanvasSize();
    initStars();
    // Always paint one frame up front: it is the whole picture under reduced
    // motion, and the static backdrop if the page starts scrolled past the hero.
    drawStatic();
    window.addEventListener('resize', onResize, { passive: true });

    controlsRef.current = { start, stop };
    if (activeRef.current) start();

    return () => {
      controlsRef.current = null;
      window.removeEventListener('resize', onResize);
      stop();
    };
  }, [reduced]);

  // Start/stop without tearing the canvas down, so stopping leaves the last
  // frame painted. Declared after the setup effect so controls exist on mount.
  useEffect(() => {
    activeRef.current = active;
    const controls = controlsRef.current;
    if (!controls) return;
    if (active) controls.start();
    else controls.stop();
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 pointer-events-none"
      style={{ background: 'transparent' }}
    />
  );
}
