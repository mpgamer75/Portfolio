'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AnimatedTextProps {
  phrases: string[];
  className?: string;
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDuration?: number;
}

/**
 * Typewriter that cycles through `phrases`. Cursor blink is CSS-driven
 * (`.animate-blink` in globals.css) so there is no per-second JS interval.
 * The phrase-advance setState is wrapped in setTimeout so it doesn't trip
 * react-hooks/set-state-in-effect.
 *
 * Assistive tech gets the full phrase list once, statically; the animated
 * span is hidden from it. (It used to be `aria-live`, which read every
 * keystroke of every phrase aloud, forever.)
 */
export default function AnimatedText({
  phrases,
  className = '',
  typingSpeed = 80,
  deletingSpeed = 50,
  pauseDuration = 2000,
}: AnimatedTextProps) {
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [currentText, setCurrentText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const currentPhrase = phrases[currentPhraseIndex] ?? '';

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!isDeleting) {
      if (currentText.length < currentPhrase.length) {
        timeoutRef.current = setTimeout(() => {
          setCurrentText(currentPhrase.slice(0, currentText.length + 1));
        }, typingSpeed);
      } else {
        timeoutRef.current = setTimeout(() => setIsDeleting(true), pauseDuration);
      }
    } else if (currentText.length > 0) {
      timeoutRef.current = setTimeout(() => {
        setCurrentText(currentText.slice(0, -1));
      }, deletingSpeed);
    } else {
      // Phrase fully deleted — schedule the next-phrase transition on the
      // next tick so we don't violate react-hooks/set-state-in-effect.
      timeoutRef.current = setTimeout(() => {
        setIsDeleting(false);
        setCurrentPhraseIndex((prev) => (prev + 1) % phrases.length);
      }, 80);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [currentText, isDeleting, currentPhraseIndex, phrases, typingSpeed, deletingSpeed, pauseDuration]);

  return (
    <span className={`inline-flex items-center ${className}`}>
      <span className="sr-only">{phrases.join(' · ')}</span>
      <span aria-hidden="true" className="inline-flex items-center">
        <AnimatePresence mode="wait">
          <motion.span
            key={currentPhraseIndex}
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 1 }}
            className="font-mono"
          >
            {currentText}
          </motion.span>
        </AnimatePresence>
        <span className="ml-0.5 font-mono text-cyber-primary animate-blink">|</span>
      </span>
    </span>
  );
}
