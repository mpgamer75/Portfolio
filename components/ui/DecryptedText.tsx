'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/hooks/useIsMobile';

interface DecryptedTextProps {
  text: string;
  speed?: number;
  maxIterations?: number;
  characters?: string;
  className?: string;
  encryptedClassName?: string;
  parentClassName?: string;
  animateOn?: 'view' | 'mount' | 'hover';
  revealDirection?: 'start' | 'end' | 'center';
  sequential?: boolean;
}

const DEFAULT_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?/\\01ABCDEF';

export default function DecryptedText({
  text,
  speed = 60,
  maxIterations = 12,
  characters = DEFAULT_CHARS,
  className = '',
  encryptedClassName = '',
  parentClassName = '',
  animateOn = 'view',
  revealDirection = 'start',
  sequential = true,
}: DecryptedTextProps) {
  const reduced = useReducedMotion();
  const [displayText, setDisplayText] = useState(text);
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(
    new Set(),
  );
  const [hasAnimated, setHasAnimated] = useState(false);
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const isInteracting = useRef(false);
  const timeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    if (reduced || hasAnimated) return;
    if (animateOn === 'mount') {
      runAnimation();
    }
  }, [reduced]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [animateOn, hasAnimated, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((id) => window.clearTimeout(id));
      timeoutsRef.current = [];
    };
  }, []);

  function nextIndex(revealed: Set<number>): number {
    const total = text.length;
    if (revealDirection === 'end') {
      for (let i = total - 1; i >= 0; i--) {
        if (!revealed.has(i)) return i;
      }
    } else if (revealDirection === 'center') {
      const mid = Math.floor(total / 2);
      for (let offset = 0; offset <= mid; offset++) {
        const left = mid - offset;
        const right = mid + offset;
        if (left >= 0 && !revealed.has(left)) return left;
        if (right < total && !revealed.has(right)) return right;
      }
    } else {
      for (let i = 0; i < total; i++) {
        if (!revealed.has(i)) return i;
      }
    }
    return -1;
  }

  function shuffle(input: string, revealed: Set<number>): string {
    return input
      .split('')
      .map((char, idx) => {
        if (char === ' ' || char === '\n') return char;
        if (revealed.has(idx)) return text[idx];
        return characters[Math.floor(Math.random() * characters.length)];
      })
      .join('');
  }

  function runAnimation() {
    if (hasAnimated) return;
    setHasAnimated(true);
    let iter = 0;
    const revealed = new Set<number>();

    const tick = () => {
      iter += 1;
      if (sequential) {
        if (iter % Math.max(1, Math.floor(maxIterations / 4)) === 0) {
          const idx = nextIndex(revealed);
          if (idx !== -1) revealed.add(idx);
        }
      } else if (iter >= maxIterations) {
        for (let i = 0; i < text.length; i++) revealed.add(i);
      }

      setRevealedIndices(new Set(revealed));
      setDisplayText(shuffle(text, revealed));

      if (revealed.size < text.length) {
        timeoutsRef.current.push(window.setTimeout(tick, speed));
      } else {
        setDisplayText(text);
      }
    };

    timeoutsRef.current.push(window.setTimeout(tick, speed));
  }

  function handleHoverStart() {
    if (animateOn !== 'hover' || reduced || isInteracting.current) return;
    isInteracting.current = true;
    setHasAnimated(false);
    setRevealedIndices(new Set());
    requestAnimationFrame(() => runAnimation());
    setTimeout(() => {
      isInteracting.current = false;
    }, speed * maxIterations + 200);
  }

  if (reduced) {
    return (
      <span className={parentClassName} aria-label={text}>
        {text.split('').map((char, idx) =>
          char === '\n' ? <br key={idx} aria-hidden="true" /> : (
            <span key={idx} className={className} aria-hidden="true">
              {char}
            </span>
          ),
        )}
      </span>
    );
  }

  return (
    <span
      ref={containerRef}
      className={parentClassName}
      onMouseEnter={animateOn === 'hover' ? handleHoverStart : undefined}
      aria-label={text}
    >
      {displayText.split('').map((char, idx) => {
        const revealed = revealedIndices.has(idx) || char === ' ' || char === '\n';
        if (char === '\n') return <br key={idx} aria-hidden="true" />;
        return (
          <span
            key={idx}
            aria-hidden="true"
            className={revealed ? className : `${className} ${encryptedClassName}`.trim()}
          >
            {char}
          </span>
        );
      })}
    </span>
  );
}
