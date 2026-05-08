'use client';

import { useState, useEffect, useRef } from 'react';
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
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Cursor blink effect
    useEffect(() => {
        const cursorInterval = setInterval(() => {
            setShowCursor(prev => !prev);
        }, 530);
        return () => clearInterval(cursorInterval);
    }, []);

    // Typing effect
    useEffect(() => {
        const currentPhrase = phrases[currentPhraseIndex];

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        if (!isDeleting) {
            // Typing
            if (currentText.length < currentPhrase.length) {
                timeoutRef.current = setTimeout(() => {
                    setCurrentText(currentPhrase.slice(0, currentText.length + 1));
                }, typingSpeed);
            } else {
                // Pause before deleting
                timeoutRef.current = setTimeout(() => {
                    setIsDeleting(true);
                }, pauseDuration);
            }
        } else {
            // Deleting
            if (currentText.length > 0) {
                timeoutRef.current = setTimeout(() => {
                    setCurrentText(currentText.slice(0, -1));
                }, deletingSpeed);
            } else {
                // Phrase fully deleted — schedule the next-phrase transition
                // on the next tick so we don't violate
                // react-hooks/set-state-in-effect.
                timeoutRef.current = setTimeout(() => {
                    setIsDeleting(false);
                    setCurrentPhraseIndex((prev) => (prev + 1) % phrases.length);
                }, 80);
            }
        }

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [currentText, isDeleting, currentPhraseIndex, phrases, typingSpeed, deletingSpeed, pauseDuration]);

    return (
        <span className={`inline-flex items-center ${className}`}>
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
            >
                |
            </motion.span>
        </span>
    );
}
