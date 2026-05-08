'use client';

import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

type SplitMode = 'chars' | 'words';

interface SplitTextProps {
  children: string;
  className?: string;
  mode?: SplitMode;
  delay?: number;
  stagger?: number;
  duration?: number;
  yOffset?: number;
  rotateX?: number;
  once?: boolean;
}

export default function SplitText({
  children,
  className = '',
  mode = 'chars',
  delay = 0,
  stagger = 0.025,
  duration = 0.55,
  yOffset = 24,
  rotateX = -45,
  once = true,
}: SplitTextProps) {
  const reduced = useReducedMotion();

  const tokens = useMemo(() => {
    if (mode === 'words') return children.split(/(\s+)/);
    return children.split('');
  }, [children, mode]);

  if (reduced) {
    return <span className={className}>{children}</span>;
  }

  const container = {
    hidden: {},
    visible: {
      transition: {
        delayChildren: delay,
        staggerChildren: stagger,
      },
    },
  };

  const child = {
    hidden: { y: yOffset, opacity: 0, rotateX },
    visible: {
      y: 0,
      opacity: 1,
      rotateX: 0,
      transition: {
        duration,
        ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
      },
    },
  };

  return (
    <motion.span
      className={`inline-block [perspective:600px] ${className}`}
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: '-10% 0px' }}
      aria-label={children}
    >
      {tokens.map((token, idx) => {
        if (/^\s+$/.test(token)) return <span key={idx}>{token}</span>;
        return (
          <motion.span
            key={idx}
            variants={child}
            aria-hidden="true"
            className="inline-block"
            style={{ transformOrigin: '50% 100%' }}
          >
            {token}
          </motion.span>
        );
      })}
    </motion.span>
  );
}
