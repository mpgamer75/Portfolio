'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface CredlyBadgeProps {
  badgeId: string;
  width?: number;
  height?: number;
}

const CREDLY_SRC = 'https://cdn.credly.com/assets/utilities/embed.js';

/**
 * Loads Credly's embed script once, on demand. The badges sit at the bottom of
 * the Skills section, so the third-party script and its two iframes are fetched
 * only when a badge is about to scroll into view rather than on first paint.
 */
let credlyLoad: Promise<void> | null = null;
function loadCredly(): Promise<void> {
  if (credlyLoad) return credlyLoad;
  credlyLoad = new Promise<void>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CREDLY_SRC}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = CREDLY_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.body.appendChild(script);
  });
  return credlyLoad;
}

export default function CredlyBadge({ badgeId, width = 150, height = 270 }: CredlyBadgeProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        loadCredly().then(() => {
          if (cancelled) return;
          // embed.js scans for data-share-badge-id on load; re-run it for any
          // badge that mounted after the script (e.g. the second badge).
          const init = (window as unknown as { __credly_init?: () => void }).__credly_init;
          init?.();
        });
      },
      { rootMargin: '400px 0px' },
    );
    io.observe(host);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [badgeId]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      whileHover={{ scale: 1.05, y: -5 }}
      className="relative group cursor-pointer max-w-full"
    >
      {/* Glow effect on hover — solid emerald (no gradient) */}
      <div
        aria-hidden="true"
        className="absolute -inset-2 bg-cyber-brand/15 rounded-xl opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500"
      />

      {/* Badge container — reserves the iframe's box so nothing shifts when it lands. */}
      <div
        ref={hostRef}
        className="relative bg-cyber-darker/50 rounded-xl p-4 border border-cyber-primary/30 group-hover:border-cyber-primary/60 transition-all duration-300"
      >
        <div
          style={{ width, minHeight: height }}
          data-iframe-width={width}
          data-iframe-height={height}
          data-share-badge-id={badgeId}
          data-share-badge-host="https://www.credly.com"
        />
      </div>
    </motion.div>
  );
}
