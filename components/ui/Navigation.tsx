'use client';

import { useState, useEffect, useRef } from 'react';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';

type NavKey = 'home' | 'about' | 'experience' | 'projects' | 'skills' | 'contact';

const navItems: Array<{ key: NavKey; href: string }> = [
  { key: 'home', href: '#home' },
  { key: 'about', href: '#about' },
  { key: 'experience', href: '#experience' },
  { key: 'projects', href: '#projects' },
  { key: 'skills', href: '#skills' },
  { key: 'contact', href: '#contact' },
];

export default function Navigation() {
  const t = useTranslations('nav');
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [indicatorStyle, setIndicatorStyle] = useState({
    left: 0,
    width: 0,
    opacity: 0,
  });
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleMouseEnter = (
    event: React.MouseEvent<HTMLAnchorElement>,
  ) => {
    const target = event.currentTarget;
    if (!navRef.current) return;
    const navRect = navRef.current.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    setIndicatorStyle({
      left: targetRect.left - navRect.left,
      width: targetRect.width,
      opacity: 1,
    });
  };

  const handleMouseLeave = () => {
    setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }));
  };

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-cyber-darker/95 backdrop-blur-md shadow-lg' : 'bg-transparent'
      }`}
      aria-label="Primary"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <motion.a
            href="#home"
            className="text-2xl font-bold text-cyber-primary font-mono"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label={t('home')}
          >
            {'<CL />'}
          </motion.a>

          <div className="flex items-center gap-3">
            <div
              ref={navRef}
              className="hidden md:flex items-center space-x-1 relative"
              onMouseLeave={handleMouseLeave}
            >
              <motion.div
                className="absolute h-full rounded-lg bg-cyber-primary/10 border border-cyber-primary/30 pointer-events-none"
                initial={false}
                animate={indicatorStyle}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />

              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onMouseEnter={handleMouseEnter}
                  className="relative text-gray-300 hover:text-cyber-primary px-4 py-2 rounded-lg transition-colors duration-200 z-10"
                >
                  <span className="relative z-10">{t(item.key)}</span>
                </a>
              ))}
            </div>

            <LanguageSwitcher />

            <div className="md:hidden">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-cyber-primary hover:text-cyber-secondary smooth-transition-fast p-2 -m-2 rounded-lg scale-on-hover"
                aria-label={isOpen ? t('closeMenu') : t('openMenu')}
                aria-expanded={isOpen}
              >
                {isOpen ? <X size={28} aria-hidden="true" /> : <Menu size={28} aria-hidden="true" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass-effect border-t border-cyber-primary/30"
          >
            <nav className="px-4 py-6 space-y-4" aria-label="Mobile">
              {navItems.map((item, index) => (
                <motion.a
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="block text-gray-300 hover:text-cyber-primary smooth-transition-fast py-2 px-3 -mx-3 rounded-lg hover:bg-cyber-primary/10"
                >
                  {t(item.key)}
                </motion.a>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
