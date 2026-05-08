'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AnimatedTextProps {
  phrases: string[];
  className?: string;
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDuration?: number;
}

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
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    const interval = window.setInterval(
      () => setShowCursor((prev) => !prev),
      530,
    );
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const currentPhrase = phrases[currentPhraseIndex] ?? '';
    let timeout: number;

    if (!isDeleting) {
      if (currentText.length < currentPhrase.length) {
        timeout = window.setTimeout(() => {
          setCurrentText(currentPhrase.slice(0, currentText.length + 1));
        }, typingSpeed);
      } else {
        timeout = window.setTimeout(() => setIsDeleting(true), pauseDuration);
      }
    } else if (currentText.length > 0) {
      timeout = window.setTimeout(() => {
        setCurrentText(currentText.slice(0, -1));
      }, deletingSpeed);
    } else {
      // Phrase fully deleted → advance to the next phrase on the next tick.
      timeout = window.setTimeout(() => {
        setIsDeleting(false);
        setCurrentPhraseIndex((prev) => (prev + 1) % phrases.length);
      }, 80);
    }

    return () => window.clearTimeout(timeout);
  }, [
    currentText,
    isDeleting,
    currentPhraseIndex,
    phrases,
    typingSpeed,
    deletingSpeed,
    pauseDuration,
  ]);

  return (
    <span className={`inline-flex items-center ${className}`} aria-live="polite">
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
      <motion.span
        className="ml-0.5 font-mono text-cyber-primary"
        animate={{ opacity: showCursor ? 1 : 0 }}
        transition={{ duration: 0.1 }}
        aria-hidden="true"
      >
        |
      </motion.span>
    </span>
  );
}
