'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useIsMobile, useReducedMotion } from '@/hooks/useIsMobile';

interface CursorHUDProps {
  status?: string;
}

export default function CursorHUD({ status = 'IDLE' }: CursorHUDProps) {
  const isMobile = useIsMobile();
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const xs = useSpring(x, { stiffness: 280, damping: 30, mass: 0.4 });
  const ys = useSpring(y, { stiffness: 280, damping: 30, mass: 0.4 });

  useEffect(() => {
    if (isMobile || reduced) return;

    const onMove = (event: PointerEvent) => {
      x.set(event.clientX + 18);
      y.set(event.clientY + 18);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setCoords({ x: event.clientX, y: event.clientY });
      });

      const target = event.target as HTMLElement | null;
      if (!target) {
        setHoverLabel(null);
        return;
      }
      const interactive = target.closest('a, button, [role="button"]');
      if (interactive) {
        const label =
          interactive.getAttribute('aria-label') ||
          interactive.textContent?.trim().slice(0, 24) ||
          'INTERACT';
        setHoverLabel(label.toUpperCase());
      } else {
        setHoverLabel(null);
      }
    };
    const onEnter = () => setVisible(true);
    const onLeave = () => setVisible(false);

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerenter', onEnter);
    window.addEventListener('pointerleave', onLeave);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerenter', onEnter);
      window.removeEventListener('pointerleave', onLeave);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isMobile, reduced, x, y]);

  if (isMobile || reduced) return null;

  const displayedStatus = hoverLabel ?? status;

  return (
    <motion.div
      aria-hidden="true"
      style={{ x: xs, y: ys, opacity: visible ? 1 : 0 }}
      transition={{ opacity: { duration: 0.2 } }}
      className="pointer-events-none fixed top-0 left-0 z-[150] font-mono text-[10px] uppercase tracking-widest text-cyber-primary/80 mix-blend-difference select-none"
    >
      <div className="rounded-md border border-cyber-primary/30 bg-cyber-darker/80 backdrop-blur-sm px-2 py-1 leading-tight space-y-0.5 min-w-[120px]">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyber-primary animate-pulse" />
          <span className="text-cyber-primary">{displayedStatus}</span>
        </div>
        <div className="text-cyber-accent/70 tabular-nums">
          [{coords.x.toString().padStart(4, '0')},{coords.y.toString().padStart(4, '0')}]
        </div>
      </div>
    </motion.div>
  );
}
