'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

interface DecryptedTextProps {
  text: string;
  speed?: number;
  characters?: string;
  className?: string;
  encryptedClassName?: string;
  parentClassName?: string;
  animateOn?: 'view' | 'mount';
  revealDirection?: 'start' | 'end' | 'center';
}

const DEFAULT_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?/\\01ABCDEF';

/**
 * Reveals `text` one character at a time after picking random glyphs as
 * placeholders. Cheap on render: one setState per tick, ~N ticks total
 * where N is text length. Honors prefers-reduced-motion via framer-motion's
 * useReducedMotion (subscribes to the media query reactively, unlike the
 * previous useState-only hook this component used to import).
 */
export default function DecryptedText({
  text,
  speed = 55,
  characters = DEFAULT_CHARS,
  className = '',
  encryptedClassName = '',
  parentClassName = '',
  animateOn = 'mount',
  revealDirection = 'start',
}: DecryptedTextProps) {
  const reduced = useReducedMotion();
  const [displayText, setDisplayText] = useState(text);
  const [hasAnimated, setHasAnimated] = useState(false);
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const runAnimation = useCallback(() => {
    if (timeoutRef.current !== null) return;
    setHasAnimated(true);
    const revealed = new Set<number>();

    const pickNext = (): number => {
      const total = text.length;
      if (revealDirection === 'end') {
        for (let i = total - 1; i >= 0; i--) if (!revealed.has(i)) return i;
      } else if (revealDirection === 'center') {
        const mid = Math.floor(total / 2);
        for (let offset = 0; offset <= mid; offset++) {
          const left = mid - offset;
          const right = mid + offset;
          if (left >= 0 && !revealed.has(left)) return left;
          if (right < total && !revealed.has(right)) return right;
        }
      } else {
        for (let i = 0; i < total; i++) if (!revealed.has(i)) return i;
      }
      return -1;
    };

    const tick = () => {
      timeoutRef.current = null;
      const idx = pickNext();
      if (idx === -1) {
        setDisplayText(text);
        return;
      }
      revealed.add(idx);

      const next = text
        .split('')
        .map((char, i) => {
          if (revealed.has(i) || char === ' ' || char === '\n') return char;
          return characters[Math.floor(Math.random() * characters.length)];
        })
        .join('');
      setDisplayText(next);

      timeoutRef.current = window.setTimeout(tick, speed);
    };

    timeoutRef.current = window.setTimeout(tick, speed);
  }, [characters, revealDirection, speed, text]);

  useEffect(() => {
    if (reduced) return;
    if (animateOn === 'mount') runAnimation();
  }, [animateOn, reduced, runAnimation]);

  useEffect(() => {
    if (animateOn !== 'view' || hasAnimated || reduced) return;
    const node = containerRef.current;
    if (!node) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            runAnimation();
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.1 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [animateOn, hasAnimated, reduced, runAnimation]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  if (reduced) {
    return (
      <span className={parentClassName} aria-label={text}>
        {text.split('').map((char, idx) =>
          char === '\n' ? (
            <br key={idx} aria-hidden="true" />
          ) : (
            <span key={idx} className={className} aria-hidden="true">
              {char}
            </span>
          ),
        )}
      </span>
    );
  }

  return (
    <span ref={containerRef} className={parentClassName} aria-label={text}>
      {displayText.split('').map((char, idx) => {
        if (char === '\n') return <br key={idx} aria-hidden="true" />;
        const revealed = char === text[idx] || char === ' ';
        return (
          <span
            key={idx}
            aria-hidden="true"
            className={
              revealed ? className : `${className} ${encryptedClassName}`.trim()
            }
          >
            {char}
          </span>
        );
      })}
    </span>
  );
}
