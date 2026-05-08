'use client';

import { useEffect, useRef } from 'react';

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

export default function MobileBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const animationFrameRef = useRef<number>(0);
  const isVisibleRef = useRef<boolean>(true);
  const cachedConnectionsRef = useRef<Connection[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const setCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    setCanvasSize();
    window.addEventListener('resize', setCanvasSize, { passive: true });

    const initStars = () => {
      starsRef.current = [];
      const numStars = Math.floor((canvas.width * canvas.height) / 8000);
      for (let i = 0; i < numStars; i++) {
        starsRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 2 + 0.5,
          opacity: Math.random() * 0.5 + 0.3,
          velocity: Math.random() * 0.15 + 0.05,
          twinkleSpeed: Math.random() * 0.02 + 0.01,
          twinklePhase: Math.random() * Math.PI * 2,
        });
      }
    };
    initStars();

    let frameCount = 0;
    const maxConnectionDistance = 120;

    const animate = () => {
      // Skip the entire frame budget when offscreen — pause RAF instead
      // (loop will be restarted by the IntersectionObserver below).
      if (!isVisibleRef.current) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frameCount += 1;

      // Recompute connections every other frame — visually identical at
      // 60 fps, halves the O(N^2) distance check on mid-tier mobile.
      if ((frameCount & 1) === 0) {
        const connections: Connection[] = [];
        const stars = starsRef.current;
        for (let i = 0; i < stars.length; i++) {
          for (let j = i + 1; j < stars.length; j++) {
            const dx = stars[i].x - stars[j].x;
            const dy = stars[i].y - stars[j].y;
            const distance = Math.hypot(dx, dy);
            if (distance < maxConnectionDistance) {
              connections.push({ from: stars[i], to: stars[j], distance });
            }
          }
        }
        cachedConnectionsRef.current = connections;
      }

      starsRef.current.forEach((star) => {
        star.y -= star.velocity;
        if (star.y < -10) {
          star.y = canvas.height + 10;
          star.x = Math.random() * canvas.width;
        }

        star.twinklePhase += star.twinkleSpeed;
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
      });

      cachedConnectionsRef.current.forEach(({ from, to, distance }) => {
        const opacity = (1 - distance / maxConnectionDistance) * 0.15;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    const startLoop = () => {
      if (animationFrameRef.current) return;
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    const stopLoop = () => {
      if (!animationFrameRef.current) return;
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = 0;
    };

    // Pause the loop while the canvas is offscreen.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          isVisibleRef.current = entry.isIntersecting;
          if (entry.isIntersecting) startLoop();
          else stopLoop();
        }
      },
      { threshold: 0 },
    );
    observer.observe(canvas);

    return () => {
      window.removeEventListener('resize', setCanvasSize);
      observer.disconnect();
      stopLoop();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full pointer-events-none"
      style={{ background: 'transparent' }}
    />
  );
}
