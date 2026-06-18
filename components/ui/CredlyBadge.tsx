'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface CredlyBadgeProps {
    badgeId: string;
    width?: number;
    height?: number;
}

export default function CredlyBadge({ badgeId, width = 150, height = 270 }: CredlyBadgeProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const scriptLoaded = useRef(false);

    useEffect(() => {
        // Load Credly script only once
        if (!scriptLoaded.current) {
            const existingScript = document.querySelector('script[src*="credly.com/assets/utilities/embed.js"]');

            if (!existingScript) {
                const script = document.createElement('script');
                script.src = '//cdn.credly.com/assets/utilities/embed.js';
                script.async = true;
                document.body.appendChild(script);
            }

            scriptLoaded.current = true;
        }

        // Re-trigger Credly embed detection
        const timer = setTimeout(() => {
            if (window.hasOwnProperty('__credly_init')) {
                (window as unknown as { __credly_init: () => void }).__credly_init();
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [badgeId]);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            whileHover={{ scale: 1.05, y: -5 }}
            className="relative group cursor-pointer"
        >
            {/* Glow effect on hover */}
            <div className="absolute -inset-2 bg-gradient-to-r from-cyber-brand/20 via-cyber-brand2/20 to-cyber-brand/20 rounded-xl opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500" />

            {/* Badge container */}
            <div
                ref={containerRef}
                className="relative bg-cyber-darker/50 backdrop-blur-sm rounded-xl p-4 border border-cyber-primary/30 group-hover:border-cyber-primary/60 transition-all duration-300"
            >
                <div
                    data-iframe-width={width}
                    data-iframe-height={height}
                    data-share-badge-id={badgeId}
                    data-share-badge-host="https://www.credly.com"
                />
            </div>
        </motion.div>
    );
}
