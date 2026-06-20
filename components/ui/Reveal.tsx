'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';
import {
  REVEAL_VIEWPORT,
  fadeIn,
  fadeUp,
  revealContainer,
  revealItem,
} from '@/lib/motion';

interface RevealProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Slide in from a side instead of rising up. */
  x?: 'left' | 'right';
  /** Delay (seconds) before this block animates. Ignored in stagger mode. */
  delay?: number;
  /** Turn this into a container that staggers its `<RevealItem>` children. */
  stagger?: boolean | number;
  id?: string;
}

/**
 * Scroll-reveal wrapper: transform/opacity only, fires once, IntersectionObserver-native
 * (framer `whileInView`). Reduced-motion users get the final state immediately.
 */
export function Reveal({
  children,
  className,
  style,
  x,
  delay = 0,
  stagger,
  id,
}: RevealProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <div id={id} className={className} style={style}>
        {children}
      </div>
    );
  }

  if (stagger) {
    const amount = typeof stagger === 'number' ? stagger : 0.08;
    return (
      <motion.div
        id={id}
        className={className}
        style={style}
        variants={revealContainer(amount, delay)}
        initial="hidden"
        whileInView="visible"
        viewport={REVEAL_VIEWPORT}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      id={id}
      className={className}
      style={style}
      variants={x ? fadeIn(x, delay) : fadeUp(delay)}
      initial="hidden"
      whileInView="visible"
      viewport={REVEAL_VIEWPORT}
    >
      {children}
    </motion.div>
  );
}

interface RevealItemProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  x?: 'left' | 'right';
}

/** A child of `<Reveal stagger>` — animates as its parent scrolls into view. */
export function RevealItem({ children, className, style, x }: RevealItemProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <motion.div className={className} style={style} variants={x ? fadeIn(x) : revealItem}>
      {children}
    </motion.div>
  );
}
