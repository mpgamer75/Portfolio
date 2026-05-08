'use client';

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface MagneticButtonProps {
    children: React.ReactNode;
    href?: string;
    onClick?: () => void;
    className?: string;
    magnetStrength?: number;
    ariaLabel?: string;
}

export default function MagneticButton({
    children,
    href,
    onClick,
    className = '',
    magnetStrength = 0.3,
    ariaLabel,
}: MagneticButtonProps) {
    const buttonRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isHovered, setIsHovered] = useState(false);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!buttonRef.current) return;

        const rect = buttonRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const distanceX = (e.clientX - centerX) * magnetStrength;
        const distanceY = (e.clientY - centerY) * magnetStrength;

        setPosition({ x: distanceX, y: distanceY });
    };

    const handleMouseLeave = () => {
        setPosition({ x: 0, y: 0 });
        setIsHovered(false);
    };

    const handleMouseEnter = () => {
        setIsHovered(true);
    };

    const buttonContent = (
        <motion.div
            ref={buttonRef}
            animate={{ x: position.x, y: position.y }}
            transition={{ type: 'spring', stiffness: 150, damping: 15, mass: 0.1 }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onMouseEnter={handleMouseEnter}
            className={`relative group ${className}`}
        >
            {/* Glow effect */}
            <motion.div
                className="absolute -inset-1 bg-gradient-to-r from-cyber-primary/40 via-cyber-secondary/40 to-cyber-primary/40 rounded-lg blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                animate={{ scale: isHovered ? 1.1 : 1 }}
            />

            {/* Button background */}
            <div className="relative cyber-button rounded-lg overflow-hidden">
                {/* Ripple effect layer */}
                <motion.div
                    className="absolute inset-0 bg-cyber-primary/10"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={isHovered ? { scale: 2, opacity: 0.3 } : { scale: 0, opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    style={{ borderRadius: '50%', transformOrigin: 'center' }}
                />

                {/* Content */}
                <motion.span
                    className="relative z-10 block"
                    animate={{ x: position.x * 0.3, y: position.y * 0.3 }}
                    transition={{ type: 'spring', stiffness: 150, damping: 15 }}
                >
                    {children}
                </motion.span>
            </div>
        </motion.div>
    );

    if (href) {
        return (
            <a href={href} aria-label={ariaLabel} className="inline-block">
                {buttonContent}
            </a>
        );
    }

    return (
        <button onClick={onClick} aria-label={ariaLabel} className="inline-block">
            {buttonContent}
        </button>
    );
}
