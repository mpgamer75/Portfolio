'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

interface AnimatedTextProps {
  phrases: string[];
  className?: string;
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDuration?: number;
}

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeReduced(callback: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}
const getReduced = () => window.matchMedia(REDUCED_QUERY).matches;
// The server cannot know the preference; hydrate as "motion allowed" and let
// React correct it right after, so the markup never mismatches.
const getReducedServer = () => false;

/**
 * Typewriter that cycles through `phrases`. Cursor blink is CSS-driven
 * (`.animate-blink` in globals.css) so there is no per-second JS interval.
 *
 * - The first phrase is rendered in full from the server HTML, then the cycle
 *   starts by deleting it — no empty row before hydration.
 * - Under prefers-reduced-motion the first phrase stays static, with no cursor
 *   and no timers (MotionConfig cannot stop JS timers, so this is explicit).
 * - Timers stop while the element is offscreen or the tab is hidden.
 * - Assistive tech gets the full phrase list once, statically; the animated
 *   span is hidden from it.
 */
export default function AnimatedText({
  phrases,
  className = '',
  typingSpeed = 80,
  deletingSpeed = 50,
  pauseDuration = 2000,
}: AnimatedTextProps) {
  const reduced = useSyncExternalStore(subscribeReduced, getReduced, getReducedServer);
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [currentText, setCurrentText] = useState(phrases[0] ?? '');
  const [isDeleting, setIsDeleting] = useState(false);
  const [active, setActive] = useState(true);
  const rootRef = useRef<HTMLSpanElement>(null);

  // Run only while the row is on screen and the tab is visible.
  useEffect(() => {
    const node = rootRef.current;
    if (!node || reduced) return;

    let inView = true;
    const update = () => setActive(inView && document.visibilityState === 'visible');

    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) inView = entry.isIntersecting;
      update();
    });
    io.observe(node);
    document.addEventListener('visibilitychange', update);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, [reduced]);

  useEffect(() => {
    if (reduced || !active || phrases.length === 0) return;
    const currentPhrase = phrases[currentPhraseIndex] ?? '';
    let timeout: ReturnType<typeof setTimeout>;

    if (!isDeleting) {
      if (currentText.length < currentPhrase.length) {
        timeout = setTimeout(() => {
          setCurrentText(currentPhrase.slice(0, currentText.length + 1));
        }, typingSpeed);
      } else {
        timeout = setTimeout(() => setIsDeleting(true), pauseDuration);
      }
    } else if (currentText.length > 0) {
      timeout = setTimeout(() => {
        setCurrentText(currentText.slice(0, -1));
      }, deletingSpeed);
    } else {
      // Phrase fully deleted — move to the next one on the next tick.
      timeout = setTimeout(() => {
        setIsDeleting(false);
        setCurrentPhraseIndex((prev) => (prev + 1) % phrases.length);
      }, 80);
    }

    return () => clearTimeout(timeout);
  }, [
    reduced,
    active,
    currentText,
    isDeleting,
    currentPhraseIndex,
    phrases,
    typingSpeed,
    deletingSpeed,
    pauseDuration,
  ]);

  return (
    <span ref={rootRef} className={`inline-flex items-center ${className}`}>
      <span className="sr-only">{phrases.join(' · ')}</span>
      <span aria-hidden="true" className="inline-flex items-center">
        <span className="font-mono">{reduced ? (phrases[0] ?? '') : currentText}</span>
        {!reduced && (
          <span className="ml-0.5 font-mono text-cyber-primary animate-blink">|</span>
        )}
      </span>
    </span>
  );
}
