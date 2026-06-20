'use client';

import { useRef } from 'react';
import { motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

interface MagneticButtonProps {
  children: ReactNode;
  className?: string;
  /** Max pull distance in px. */
  strength?: number;
}

/**
 * Wraps an interactive element so it leans toward the cursor (mouse only, desktop).
 * Transform-only, springy, and fully disabled under reduced motion / touch.
 */
export default function MagneticButton({ children, className, strength = 8 }: MagneticButtonProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 250, damping: 18 });
  const sy = useSpring(y, { stiffness: 250, damping: 18 });

  const onMove = (e: React.PointerEvent) => {
    if (reduced || e.pointerType !== 'mouse') return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const clamp = (v: number) => Math.max(-strength, Math.min(strength, v));
    x.set(clamp(dx * 0.3));
    y.set(clamp(dy * 0.3));
  };

  const reset = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.span
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      style={{ x: sx, y: sy }}
      className={className}
    >
      {children}
    </motion.span>
  );
}
