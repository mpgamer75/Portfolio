'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from '@/hooks/useIsMobile';

interface ScrambledTextProps {
  children: string;
  radius?: number;
  characters?: string;
  className?: string;
  paragraph?: boolean;
}

const DEFAULT_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?/\\01ABCDEF';

export default function ScrambledText({
  children,
  radius = 80,
  characters = DEFAULT_CHARS,
  className = '',
  paragraph = false,
}: ScrambledTextProps) {
  const reduced = useReducedMotion();
  const containerRef = useRef<HTMLSpanElement>(null);
  const charPositions = useMemo(() => children.split(''), [children]);
  // Locale changes remount this component via AnimatePresence in
  // LocaleTransitionWrapper, so a lazy initializer is enough — no
  // need to sync displayChars from a useEffect.
  const [displayChars, setDisplayChars] = useState<string[]>(() => charPositions);
  const restoreTimers = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    if (reduced) return;
    const node = containerRef.current;
    if (!node) return;
    const timers = restoreTimers.current;

    const onPointerMove = (event: PointerEvent) => {
      const spans = node.querySelectorAll<HTMLSpanElement>('[data-scramble-idx]');
      if (spans.length === 0) return;
      const radiusSq = radius * radius;

      spans.forEach((span) => {
        const idx = Number(span.dataset.scrambleIdx);
        if (Number.isNaN(idx)) return;
        const original = charPositions[idx];
        if (!original || /\s/.test(original)) return;

        const rect = span.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = event.clientX - cx;
        const dy = event.clientY - cy;
        const distSq = dx * dx + dy * dy;

        if (distSq < radiusSq) {
          const random = characters[Math.floor(Math.random() * characters.length)];
          setDisplayChars((prev) => {
            if (prev[idx] === random) return prev;
            const next = prev.slice();
            next[idx] = random;
            return next;
          });

          const existing = timers.get(idx);
          if (existing) window.clearTimeout(existing);
          const timer = window.setTimeout(() => {
            setDisplayChars((prev) => {
              if (prev[idx] === original) return prev;
              const next = prev.slice();
              next[idx] = original;
              return next;
            });
            timers.delete(idx);
          }, 300);
          timers.set(idx, timer);
        }
      });
    };

    node.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => {
      node.removeEventListener('pointermove', onPointerMove);
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
    };
  }, [characters, charPositions, radius, reduced]);

  if (reduced) {
    if (paragraph) {
      return <p className={className}>{children}</p>;
    }
    return <span className={className}>{children}</span>;
  }

  const Tag = paragraph ? 'p' : 'span';

  return (
    <Tag className={className} aria-label={children}>
      <span ref={containerRef} aria-hidden="true">
        {displayChars.map((char, idx) => (
          <span
            key={idx}
            data-scramble-idx={idx}
            className="inline-block"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {char === ' ' ? ' ' : char}
          </span>
        ))}
      </span>
    </Tag>
  );
}
