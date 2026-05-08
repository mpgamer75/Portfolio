'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useIsMobile } from '@/hooks/useIsMobile';

type NavKey = 'home' | 'about' | 'experience' | 'projects' | 'skills' | 'contact';

const SECTIONS: Array<{ id: string; key: NavKey }> = [
  { id: 'home', key: 'home' },
  { id: 'about', key: 'about' },
  { id: 'experience', key: 'experience' },
  { id: 'projects', key: 'projects' },
  { id: 'skills', key: 'skills' },
  { id: 'contact', key: 'contact' },
];

export default function SectionRail() {
  const t = useTranslations('nav');
  const isMobile = useIsMobile();
  const [activeId, setActiveId] = useState<string>('home');

  useEffect(() => {
    if (isMobile) return;

    const elements = SECTIONS
      .map(({ id }) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const top = visible.reduce((a, b) =>
          a.boundingClientRect.top < b.boundingClientRect.top ? a : b,
        );
        if (top.target instanceof HTMLElement) {
          setActiveId(top.target.id);
        }
      },
      { threshold: 0.45, rootMargin: '-15% 0px -45% 0px' },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [isMobile]);

  if (isMobile) return null;

  return (
    <motion.nav
      aria-label="Section navigation"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.6, duration: 0.4 }}
      className="hidden lg:flex fixed right-6 top-1/2 -translate-y-1/2 z-40 flex-col items-end gap-3"
    >
      {SECTIONS.map(({ id, key }) => {
        const isActive = activeId === id;
        return (
          <a
            key={id}
            href={`#${id}`}
            aria-label={t(key)}
            aria-current={isActive ? 'true' : undefined}
            className="group flex items-center gap-3 cursor-pointer"
          >
            <span
              className={`font-mono text-[10px] uppercase tracking-widest text-cyber-accent transition-all duration-300 ${
                isActive
                  ? 'opacity-100 translate-x-0 text-cyber-primary'
                  : 'opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'
              }`}
            >
              {t(key)}
            </span>
            <span
              className={`relative block transition-all duration-300 ${
                isActive
                  ? 'h-6 w-[2px] bg-cyber-primary shadow-[0_0_8px_rgba(255,255,255,0.7)]'
                  : 'h-2 w-2 rounded-full bg-cyber-accent/40 group-hover:bg-cyber-primary group-hover:scale-125'
              }`}
            />
          </a>
        );
      })}
    </motion.nav>
  );
}
