'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { ElementType, HTMLAttributes, PointerEvent, ReactNode } from 'react';

type SpotlightCardProps = {
  /** Element to render (default 'div'), e.g. 'li' or 'article'. */
  as?: ElementType;
  /** Classes for the root. The root is always `relative isolate`. */
  className?: string;
  /** Any CSS colour for the spotlight centre (default the soft emerald token). */
  color?: string;
  children?: ReactNode;
} & Omit<
  HTMLAttributes<HTMLElement>,
  'className' | 'color' | 'children' | 'onPointerEnter' | 'onPointerMove' | 'onPointerLeave'
>;

/**
 * A wrapper that paints a soft emerald spotlight under the mouse pointer.
 *
 * Cost model: nothing runs while idle. Listeners sit on the element only, the
 * rect is measured on pointerenter (and re-measured only if the page scrolled),
 * and pointer moves are folded into one requestAnimationFrame write of two
 * custom properties. No React state, so hovering never re-renders the card.
 * Touch and pen pointers are ignored, so phones only get the plain card.
 *
 * The fill layer sits at z-index -1 inside the root's own stacking context:
 * above the root's background, below its content.
 */
export default function SpotlightCard({
  as,
  className = '',
  color = 'var(--accent-soft)',
  children,
  ...rest
}: SpotlightCardProps) {
  // `ElementType` resolves JSX props to `never` (intersection of every tag's
  // props); the handlers below are plain HTMLElement ones, so 'div' typing fits.
  const Tag = (as ?? 'div') as 'div';

  const layerRef = useRef<HTMLSpanElement | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const frameRef = useRef(0);
  // Cached geometry: element origin in viewport space + the scroll offsets it
  // was measured at, and the latest pointer position.
  const geo = useRef({ left: 0, top: 0, scrollX: 0, scrollY: 0, x: 0, y: 0, valid: false });

  const measure = useCallback((el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const g = geo.current;
    g.left = rect.left;
    g.top = rect.top;
    g.scrollX = window.scrollX;
    g.scrollY = window.scrollY;
    g.valid = true;
  }, []);

  const flush = useCallback(() => {
    frameRef.current = 0;
    const el = targetRef.current;
    if (!el) return;
    const g = geo.current;
    el.style.setProperty('--sx', `${g.x - g.left}px`);
    el.style.setProperty('--sy', `${g.y - g.top}px`);
  }, []);

  const track = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const el = event.currentTarget;
      const g = geo.current;
      // Re-measure only when the cached rect can be stale (page scrolled
      // under a stationary pointer).
      if (!g.valid || g.scrollX !== window.scrollX || g.scrollY !== window.scrollY) {
        measure(el);
      }
      g.x = event.clientX;
      g.y = event.clientY;
      targetRef.current = el;
      if (frameRef.current === 0) {
        frameRef.current = requestAnimationFrame(flush);
      }
    },
    [flush, measure],
  );

  const handleEnter = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType !== 'mouse') return;
      measure(event.currentTarget);
      track(event);
      if (layerRef.current) layerRef.current.style.opacity = '1';
    },
    [measure, track],
  );

  const handleMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType !== 'mouse') return;
      track(event);
    },
    [track],
  );

  const handleLeave = useCallback(() => {
    geo.current.valid = false;
    if (frameRef.current !== 0) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    }
    if (layerRef.current) layerRef.current.style.opacity = '0';
  }, []);

  useEffect(
    () => () => {
      if (frameRef.current !== 0) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  return (
    <Tag
      {...rest}
      className={`relative isolate ${className}`}
      onPointerEnter={handleEnter}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      <span
        ref={layerRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] opacity-0 transition-opacity duration-300"
        style={{
          background: `radial-gradient(420px circle at var(--sx, 50%) var(--sy, 50%), ${color}, transparent 70%)`,
        }}
      />
      {children}
    </Tag>
  );
}
