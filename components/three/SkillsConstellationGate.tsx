'use client';

import dynamic from 'next/dynamic';
import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
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
  /**
   * @deprecated Ignored — the constellation announces its own selection through
   * an internal live region. Kept optional so existing callers still compile.
   */
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
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    webglSupport = !!gl;
    // Release the probe immediately so it never coexists with the hero Prism's
    // or the constellation's context (browsers cap live contexts per page).
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

/** Stage visibility at which the one-shot entrance is allowed to start. */
const ENTER_RATIO = 0.45;

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
 *
 * Three failure paths all end in "cards": a React error (boundary), a WebGL
 * context that is lost and not restored, and a shader that fails to link (three
 * logs and draws nothing rather than throwing, so the scene reports it itself).
 */
export default function SkillsConstellationGate({ onModeChange }: SkillsConstellationGateProps) {
  const isMobile = useIsMobile();
  const reduced = useReducedMotion();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [inView, setInView] = useState(false);
  // One-shot: the stage has been properly on screen (not just peeking over the
  // fold), so the entrance may play where the visitor can actually see it.
  const [entered, setEntered] = useState(false);
  // Flips once, when Skills is within ~a viewport of the fold. The three.js
  // chunk (≈235 KB gzipped) is only fetched then, instead of on first paint
  // while the hero is still loading.
  const [near, setNear] = useState(false);
  const [failed, setFailed] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const handleFail = useCallback(() => setFailed(true), []);

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
      ([entry]) => {
        setInView(entry.isIntersecting);
        // Small tolerance: the ratio reported at a threshold crossing can land a
        // hair under the threshold itself.
        if (entry.isIntersecting && entry.intersectionRatio >= ENTER_RATIO - 0.01) setEntered(true);
      },
      { threshold: [0.15, ENTER_RATIO, 0.6], rootMargin: '0px 0px -10% 0px' },
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
        <ConstellationBoundary onError={handleFail}>
          <SkillsConstellation active={inView} entered={entered} onFail={handleFail} />
        </ConstellationBoundary>
      )}
    </div>
  );
}
