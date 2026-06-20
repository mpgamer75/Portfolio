'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowUp } from 'lucide-react';

/** Floating "scroll to top" control — appears past half a viewport of scroll. */
export default function BackToTop() {
  const [visible, setVisible] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.5);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toTop = () =>
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={toTop}
          initial={{ opacity: 0, y: 16, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.92 }}
          className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 p-3 rounded-full bg-cyber-darker/90 border border-cyber-brand/50 text-cyber-brand hover:bg-cyber-brand hover:text-cyber-darker shadow-[0_0_16px_rgba(52,211,153,0.35)] transition-colors"
          aria-label="Back to top"
        >
          <ArrowUp size={20} aria-hidden="true" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
