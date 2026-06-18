'use client';

import { useEffect, useState } from 'react';
import { motion, useScroll } from 'framer-motion';

export default function ScrollProgress() {
    const [isVisible, setIsVisible] = useState(false);
    const { scrollYProgress } = useScroll();

    useEffect(() => {
        const handleScroll = () => {
            setIsVisible(window.scrollY > window.innerHeight * 0.5);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isVisible ? 1 : 0 }}
            transition={{ duration: 0.3 }}
            className="fixed top-0 left-0 right-0 z-[60] h-1"
        >
            <div className="absolute inset-0 bg-cyber-darker/50 backdrop-blur-sm" />

            <motion.div
                style={{ scaleX: scrollYProgress, transformOrigin: '0%' }}
                className="absolute inset-0 bg-cyber-brand"
            />

            <motion.div
                style={{ scaleX: scrollYProgress, transformOrigin: '0%' }}
                className="absolute inset-0 bg-cyber-brand blur-sm opacity-60"
            />
        </motion.div>
    );
}
