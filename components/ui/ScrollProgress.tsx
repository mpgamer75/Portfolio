'use client';

import { useEffect, useState } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';

export default function ScrollProgress() {
    const [isVisible, setIsVisible] = useState(false);
    const { scrollYProgress } = useScroll();
    const scaleX = useSpring(scrollYProgress, {
        stiffness: 100,
        damping: 30,
        restDelta: 0.001,
    });

    useEffect(() => {
        const handleScroll = () => {
            // Show after scrolling past the hero section (roughly 100vh)
            setIsVisible(window.scrollY > window.innerHeight * 0.5);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isVisible ? 1 : 0 }}
            transition={{ duration: 0.3 }}
            className="fixed top-0 left-0 right-0 z-[60] h-1"
        >
            {/* Background track */}
            <div className="absolute inset-0 bg-cyber-darker/50 backdrop-blur-sm" />

            {/* Progress bar */}
            <motion.div
                style={{ scaleX, transformOrigin: '0%' }}
                className="absolute inset-0 bg-gradient-to-r from-cyber-primary via-cyber-secondary to-cyber-primary"
            />

            {/* Glow effect */}
            <motion.div
                style={{ scaleX, transformOrigin: '0%' }}
                className="absolute inset-0 bg-gradient-to-r from-cyber-primary via-cyber-secondary to-cyber-primary blur-sm opacity-60"
            />
        </motion.div>
    );
}
