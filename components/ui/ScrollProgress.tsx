'use client';

import { useEffect, useState } from 'react';
import { motion, useScroll } from 'framer-motion';

/**
 * Reading-progress bar along the top edge. Transform-only: the glow is a static
 * box-shadow on the scaling bar. (An earlier version stacked a full-width
 * `backdrop-blur` track plus a second `filter: blur` bar — two per-scroll-frame
 * filter passes over the WebGL background, for a 4px strip.)
 */
export default function ScrollProgress() {
  const [isVisible, setIsVisible] = useState(false);
  const { scrollYProgress } = useScroll();

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > window.innerHeight * 0.5);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.div
      aria-hidden="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: isVisible ? 1 : 0 }}
      transition={{ duration: 0.3 }}
      className="pointer-events-none fixed top-0 left-0 right-0 z-progress h-1 bg-cyber-darker/60"
    >
      <motion.div
        style={{ scaleX: scrollYProgress, transformOrigin: '0%' }}
        className="absolute inset-0 bg-cyber-brand shadow-[0_0_10px_rgba(52,211,153,0.7)]"
      />
    </motion.div>
  );
}
