'use client';

import dynamic from 'next/dynamic';
import { Component, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useIsMobile } from '@/hooks/useIsMobile';

// Client-only, code-split: three.js is fetched only when this mounts (desktop, in view).
const SkillsConstellation = dynamic(() => import('./SkillsConstellation'), {
  ssr: false,
  loading: () => null,
});

/** What the Skills section should show: the 3D scene, or the always-accessible cards. */
export type SkillsDisplayMode = '3d' | 'cards';

interface SkillsConstellationGateProps {
  /** Forwarded from the scene so the Skills grid below can mirror the focused domain/skill. */
  onFocusChange?: (cluster: number | null, skill: string | null) => void;
  /** Tells the section whether the scene is actually on screen, so it can fall back to cards. */
  onModeChange?: (mode: SkillsDisplayMode) => void;
}

// Probed once per session: a context that can't be created (blocked GPU, VM,
// exhausted contexts) must never take the page down — it just means "cards".
let webglSupport: boolean | null = null;
function hasWebGL(): boolean {
  if (webglSupport !== null) return webglSupport;
  try {
    const canvas = document.createElement('canvas');
    webglSupport = !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

interface BoundaryProps {
  onError: () => void;
  children: ReactNode;
}

/** Catches a render/context failure inside the R3F tree and reports it upward. */
class ConstellationBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Skills constellation failed to render — falling back to cards.', error);
    }
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Gates the WebGL constellation: desktop + motion-OK + WebGL-capable only, and
 * only render-loops while the Skills section is in view. Whenever the scene is
 * NOT showing, the section renders the skill cards instead — the cards are the
 * accessible, always-correct source of truth; this layer is purely visual.
 */
export default function SkillsConstellationGate({
  onFocusChange,
  onModeChange,
}: SkillsConstellationGateProps) {
  const isMobile = useIsMobile();
  const reduced = useReducedMotion();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [inView, setInView] = useState(false);
  // Flips once, when Skills is within ~a viewport of the fold. The three.js
  // chunk (≈235 KB gzipped) is only fetched then, instead of on first paint
  // while the hero is still loading.
  const [near, setNear] = useState(false);
  const [failed, setFailed] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);

  // `mounted` gate ensures we never load three.js on the first (default-desktop) render
  // before useIsMobile resolves — so phones download zero bytes of three.
  const enable3D = mounted && !isMobile && !reduced && !failed && hasWebGL();

  useEffect(() => {
    onModeChange?.(enable3D ? '3d' : 'cards');
  }, [enable3D, onModeChange]);

  useEffect(() => {
    if (!enable3D) return;
    const el = hostRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
    );
    io.observe(el);
    const approach = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setNear(true);
        approach.disconnect();
      },
      { rootMargin: '900px 0px' },
    );
    approach.observe(el);
    return () => {
      io.disconnect();
      approach.disconnect();
    };
  }, [enable3D]);

  if (!enable3D) return null;

  return (
    <div ref={hostRef} className="relative w-full h-[460px] sm:h-[560px] md:h-[660px] lg:h-[720px]">
      {near && (
        <ConstellationBoundary onError={() => setFailed(true)}>
          <SkillsConstellation active={inView} onFocusChange={onFocusChange} />
        </ConstellationBoundary>
      )}
    </div>
  );
}
