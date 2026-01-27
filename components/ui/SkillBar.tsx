'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';

interface SkillBarProps {
    skill: string;
    level: number; // 0-100
    color?: string;
    delay?: number;
}

export default function SkillBar({
    skill,
    level,
    color = 'cyber-primary',
    delay = 0,
}: SkillBarProps) {
    const [displayLevel, setDisplayLevel] = useState(0);
    const barRef = useRef<HTMLDivElement>(null);
    const isInView = useInView(barRef, { once: true, margin: '-50px' });

    useEffect(() => {
        if (isInView) {
            // Animate the number
            const duration = 1500;
            const startTime = Date.now();
            const startDelay = delay * 1000;

            const timer = setTimeout(() => {
                const animate = () => {
                    const elapsed = Date.now() - startTime - startDelay;
                    const progress = Math.min(elapsed / duration, 1);

                    // Easing function (easeOutExpo)
                    const eased = 1 - Math.pow(2, -10 * progress);
                    setDisplayLevel(Math.round(eased * level));

                    if (progress < 1) {
                        requestAnimationFrame(animate);
                    }
                };
                animate();
            }, startDelay);

            return () => clearTimeout(timer);
        }
    }, [isInView, level, delay]);

    return (
        <div ref={barRef} className="w-full">
            <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-mono text-white">{skill}</span>
                <motion.span
                    initial={{ opacity: 0 }}
                    animate={isInView ? { opacity: 1 } : {}}
                    transition={{ delay: delay + 0.5 }}
                    className="text-sm font-mono text-cyber-primary"
                >
                    {displayLevel}%
                </motion.span>
            </div>

            <div className="relative h-2 bg-cyber-darker rounded-full overflow-hidden border border-cyber-primary/20">
                {/* Background glow */}
                <motion.div
                    initial={{ width: 0 }}
                    animate={isInView ? { width: `${level}%` } : {}}
                    transition={{ duration: 1.5, delay, ease: [0.16, 1, 0.3, 1] }}
                    className={`absolute inset-y-0 left-0 bg-${color}/20 blur-sm`}
                />

                {/* Main bar */}
                <motion.div
                    initial={{ width: 0 }}
                    animate={isInView ? { width: `${level}%` } : {}}
                    transition={{ duration: 1.5, delay, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyber-primary via-cyber-secondary to-cyber-primary rounded-full"
                />

                {/* Shine effect */}
                <motion.div
                    initial={{ x: '-100%' }}
                    animate={isInView ? { x: '200%' } : {}}
                    transition={{ duration: 1, delay: delay + 0.5 }}
                    className="absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                />
            </div>
        </div>
    );
}
