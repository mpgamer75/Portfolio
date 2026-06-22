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

interface SkillsConstellationGateProps {
  /** Forwarded from the scene so the Skills grid below can mirror the focused domain/skill. */
  onFocusChange?: (cluster: number | null, skill: string | null) => void;
}

/**
 * Gates the WebGL constellation: desktop + motion-OK only, and only render-loops
 * while the Skills section is in view. The Skills grid below is the accessible,
 * always-present source of truth — this layer is purely visual.
 */
export default function SkillsConstellationGate({ onFocusChange }: SkillsConstellationGateProps) {
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
    <div ref={hostRef} className="relative w-full h-[440px] sm:h-[560px] md:h-[640px]">
      <SkillsConstellation active={inView} onFocusChange={onFocusChange} />
    </div>
  );
}
