'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useIsMobile } from '@/hooks/useIsMobile';

// Client-only, code-split: three.js is fetched only when this mounts (desktop, in view).
const SkillsConstellation = dynamic(() => import('./SkillsConstellation'), {
  ssr: false,
  loading: () => null,
});

/**
 * Gates the WebGL constellation: desktop + motion-OK only, and only render-loops
 * while the Skills section is in view. The Skills grid below is the accessible,
 * always-present source of truth — this layer is purely visual.
 */
export default function SkillsConstellationGate() {
  const isMobile = useIsMobile();
  const reduced = useReducedMotion();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [inView, setInView] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);

  // `mounted` gate ensures we never load three.js on the first (default-desktop) render
  // before useIsMobile resolves — so phones download zero bytes of three.
  const enable3D = mounted && !isMobile && !reduced;

  useEffect(() => {
    if (!enable3D) return;
    const el = hostRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enable3D]);

  if (!enable3D) return null;

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label="Animated 3D constellation of skills grouped by domain"
      className="relative w-full h-[360px] sm:h-[440px] md:h-[520px]"
    >
      <SkillsConstellation active={inView} />
    </div>
  );
}
