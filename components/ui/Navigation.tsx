'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { navItems } from '@/lib/links';

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeHref, setActiveHref] = useState('#home');
  const [indicatorStyle, setIndicatorStyle] = useState({
    left: 0,
    width: 0,
    opacity: 0,
  });
  const navRef = useRef<HTMLDivElement>(null);
  const navRectRef = useRef<DOMRect | null>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const hoveringRef = useRef(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Cache the nav container rect — recalc only on resize, never on hover.
  useEffect(() => {
    const node = navRef.current;
    if (!node) return;
    const refresh = () => {
      navRectRef.current = node.getBoundingClientRect();
    };
    refresh();
    const ro = new ResizeObserver(refresh);
    ro.observe(node);
    window.addEventListener('resize', refresh, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', refresh);
    };
  }, []);

  const moveIndicatorTo = useCallback((el: HTMLAnchorElement | null) => {
    const navRect = navRectRef.current;
    if (!navRect || !el) return;
    const targetRect = el.getBoundingClientRect();
    setIndicatorStyle({
      left: targetRect.left - navRect.left,
      width: targetRect.width,
      opacity: 1,
    });
  }, []);

  // Scroll-spy: track the active section and park the indicator under it
  // (the IntersectionObserver callback is the external-subscription seam).
  useEffect(() => {
    const sections = navItems
      .map((item) => document.getElementById(item.href.slice(1)))
      .filter((el): el is HTMLElement => el != null);
    if (!sections.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (!visible[0]) return;
        const href = `#${visible[0].target.id}`;
        setActiveHref(href);
        if (!hoveringRef.current) moveIndicatorTo(linkRefs.current[href]);
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.25, 0.5, 1] },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [moveIndicatorTo]);

  // Close the mobile menu on Escape while it is open.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Mobile menu is a modal dialog: move focus to its first link on open, keep Tab
  // cycling inside it, and restore focus to the toggle when it closes
  // (skip the initial mount so we don't steal focus on first paint).
  const wasOpenRef = useRef(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen && wasOpenRef.current) menuButtonRef.current?.focus();
    wasOpenRef.current = isOpen;
    if (!isOpen) return;

    const raf = requestAnimationFrame(() => {
      mobileMenuRef.current?.querySelector<HTMLElement>('a[href]')?.focus();
    });
    const trapTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const menu = mobileMenuRef.current;
      const toggle = menuButtonRef.current;
      if (!menu || !toggle) return;
      const links = Array.from(menu.querySelectorAll<HTMLElement>('a[href]'));
      // Tab order inside the dialog: toggle button → links → back to the toggle.
      const cycle = [toggle, ...links];
      const idx = cycle.indexOf(document.activeElement as HTMLElement);
      if (idx === -1) return;
      const next = event.shiftKey
        ? cycle[(idx - 1 + cycle.length) % cycle.length]
        : cycle[(idx + 1) % cycle.length];
      event.preventDefault();
      next.focus();
    };
    document.addEventListener('keydown', trapTab);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', trapTab);
    };
  }, [isOpen]);

  // Seed the indicator under the active link on mount so it doesn't pop in.
  useEffect(() => {
    moveIndicatorTo(linkRefs.current[activeHref]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveIndicatorTo]);

  const handleFocus = (event: React.FocusEvent<HTMLAnchorElement>) => {
    hoveringRef.current = true;
    moveIndicatorTo(event.currentTarget);
  };

  const handleBlur = () => {
    hoveringRef.current = false;
    moveIndicatorTo(linkRefs.current[activeHref]);
  };

  const handleMouseEnter = (event: React.MouseEvent<HTMLAnchorElement>) => {
    hoveringRef.current = true;
    moveIndicatorTo(event.currentTarget);
  };

  const handleMouseLeave = () => {
    hoveringRef.current = false;
    moveIndicatorTo(linkRefs.current[activeHref]);
  };

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-cyber-darker/95 border-b border-cyber-primary/10 shadow-lg'
          : 'bg-transparent'
      }`}
      aria-label="Primary"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <motion.a
            href="#home"
            className="text-2xl font-bold text-cyber-primary"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Home"
          >
            {'<CL />'}
          </motion.a>

          <div
            ref={navRef}
            className="hidden md:flex items-center space-x-1 relative"
            onMouseLeave={handleMouseLeave}
          >
            <motion.div
              className="absolute h-full rounded-lg bg-cyber-brand/15 border border-cyber-brand/40 pointer-events-none"
              initial={false}
              animate={indicatorStyle}
              transition={{ type: 'spring', stiffness: 350, damping: 35, mass: 0.8 }}
            />

            {navItems.map((item) => {
              const isActive = activeHref === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  ref={(el) => {
                    linkRefs.current[item.href] = el;
                  }}
                  onMouseEnter={handleMouseEnter}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  aria-current={isActive ? 'true' : undefined}
                  className={`relative px-4 py-2 rounded-lg transition-colors duration-200 z-10 ${
                    isActive
                      ? 'text-cyber-primary'
                      : 'text-cyber-secondary hover:text-cyber-primary'
                  }`}
                >
                  <span className="relative z-10">{item.label}</span>
                </a>
              );
            })}
          </div>

          <div className="md:hidden">
            <button
              ref={menuButtonRef}
              onClick={() => setIsOpen(!isOpen)}
              className="text-cyber-primary hover:text-cyber-secondary smooth-transition-fast p-2 -m-2 rounded-lg scale-on-hover"
              aria-label={isOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isOpen}
            >
              {isOpen ? <X size={28} aria-hidden="true" /> : <Menu size={28} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu: fade + slide only. Animating `height: auto` made framer-motion
          measure the element with a scrollTo(0,0) round-trip, which cancelled the
          in-flight smooth scroll of the anchor link that closed the menu. */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={mobileMenuRef}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            className="md:hidden glass-effect border-t border-cyber-primary/30"
          >
            <nav className="px-4 py-4 space-y-1" aria-label="Mobile">
              {navItems.map((item, index) => {
                const isActive = activeHref === item.href;
                return (
                  <motion.a
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    aria-current={isActive ? 'true' : undefined}
                    className={`flex min-h-[48px] items-center smooth-transition-fast py-2 px-3 rounded-lg hover:bg-cyber-brand/10 ${
                      isActive
                        ? 'text-cyber-primary bg-cyber-brand/10'
                        : 'text-cyber-secondary hover:text-cyber-primary'
                    }`}
                  >
                    {item.label}
                  </motion.a>
                );
              })}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
