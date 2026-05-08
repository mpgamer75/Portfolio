'use client';

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface SpotlightCardProps {
    children: React.ReactNode;
    className?: string;
    spotlightColor?: string;
}

export default function SpotlightCard({
    children,
    className = '',
    spotlightColor = 'rgba(255, 255, 255, 0.1)',
}: SpotlightCardProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [spotlightPosition, setSpotlightPosition] = useState({ x: 0, y: 0 });
    const [isHovered, setIsHovered] = useState(false);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current) return;

        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        setSpotlightPosition({ x, y });
    };

    const handleMouseEnter = () => setIsHovered(true);
    const handleMouseLeave = () => setIsHovered(false);

    return (
        <motion.div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            whileHover={{ y: -5, scale: 1.01 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className={`relative overflow-hidden ${className}`}
            style={{ transformStyle: 'preserve-3d' }}
        >
            {/* Spotlight gradient */}
            <motion.div
                className="pointer-events-none absolute -inset-px rounded-lg opacity-0 transition-opacity duration-300"
                style={{
                    background: `radial-gradient(600px circle at ${spotlightPosition.x}px ${spotlightPosition.y}px, ${spotlightColor}, transparent 40%)`,
                    opacity: isHovered ? 1 : 0,
                }}
            />

            {/* Border gradient that follows mouse */}
            <motion.div
                className="pointer-events-none absolute -inset-px rounded-lg opacity-0 transition-opacity duration-300"
                style={{
                    background: `radial-gradient(300px circle at ${spotlightPosition.x}px ${spotlightPosition.y}px, rgba(255, 255, 255, 0.15), transparent 40%)`,
                    opacity: isHovered ? 1 : 0,
                }}
            />

            {/* Card content with cyber styling */}
            <div className="relative cyber-card rounded-lg h-full">
                {children}
            </div>
        </motion.div>
    );
}
