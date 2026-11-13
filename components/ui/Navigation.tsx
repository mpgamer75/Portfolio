'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { navItems } from '@/lib/links';
import { useIsMobile } from '@/hooks/useIsMobile';

const MOBILE_MENU_ID = 'site-mobile-menu';
const LAST_HREF = navItems[navItems.length - 1]?.href ?? '#contact';
// Critically damped (damping = 2 * sqrt(stiffness * mass)): no overshoot.
const INDICATOR_SPRING = { type: 'spring', stiffness: 400, damping: 40, mass: 1 } as const;

export default function Navigation() {
  const isMobile = useIsMobile();
  const [menuRequested, setMenuRequested] = useState(false);
  // The panel only exists below md; resizing to desktop closes it implicitly.
  const isOpen = menuRequested && isMobile;
  const [scrolled, setScrolled] = useState(false);
  const [activeHref, setActiveHref] = useState('#home');
  const [indicator, setIndicator] = useState({ x: 0, width: 0, opacity: 0 });

  const rootRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const hoveringRef = useRef(false);
  // Scroll-spy inputs, kept in refs so observers/listeners never go stale.
  const activeHrefRef = useRef('#home');
  const spyHrefRef = useRef('#home');
  const atBottomRef = useRef(false);

  // Links are direct children of the `relative` row, so offsetLeft/offsetWidth
  // are already in the indicator's coordinate space — no rect cache needed.
  const moveIndicatorTo = useCallback((el: HTMLAnchorElement | null) => {
    if (!el || el.offsetWidth === 0) return;
    const x = el.offsetLeft;
    const width = el.offsetWidth;
    setIndicator((prev) =>
      prev.x === x && prev.width === width && prev.opacity === 1
        ? prev
        : { x, width, opacity: 1 },
    );
  }, []);

  const parkIndicator = useCallback(() => {
    if (!hoveringRef.current) moveIndicatorTo(linkRefs.current[activeHrefRef.current]);
  }, [moveIndicatorTo]);

  // Active item = the last nav item when the page is scrolled to the very
  // bottom (a short Contact section never reaches the spy band), otherwise
  // whatever the IntersectionObserver last reported.
  const syncActive = useCallback(() => {
    const href = atBottomRef.current ? LAST_HREF : spyHrefRef.current;
    if (href === activeHrefRef.current) return;
    activeHrefRef.current = href;
    setActiveHref(href);
    parkIndicator();
  }, [parkIndicator]);

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 50);
      const atBottom =
        y > 0 && window.innerHeight + y >= document.documentElement.scrollHeight - 2;
      if (atBottom !== atBottomRef.current) {
        atBottomRef.current = atBottom;
        syncActive();
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [syncActive]);

  // Scroll-spy (the IntersectionObserver callback is the external-subscription seam).
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
        spyHrefRef.current = `#${visible[0].target.id}`;
        syncActive();
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.25, 0.5, 1] },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [syncActive]);

  // Park the indicator under the active link: on mount (the observer fires once
  // when it starts observing), whenever the row resizes, and once the swap fonts
  // have loaded — the mono labels change width at that point.
  useEffect(() => {
    const node = navRef.current;
    if (!node) return;
    let cancelled = false;
    const ro = new ResizeObserver(() => parkIndicator());
    ro.observe(node);
    document.fonts?.ready
      .then(() => {
        if (!cancelled) parkIndicator();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [parkIndicator]);

  // Mobile menu is a disclosure, not a dialog: no focus trap. It closes on
  // Escape (focus returns to the toggle), on a press outside the nav, and when
  // keyboard focus moves to something outside the nav.
  useEffect(() => {
    if (!isOpen) return;
    const isOutside = (target: EventTarget | null) =>
      target instanceof Node && !rootRef.current?.contains(target);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuRequested(false);
      menuButtonRef.current?.focus();
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (isOutside(event.target)) setMenuRequested(false);
    };
    const handleFocusIn = (event: FocusEvent) => {
      if (isOutside(event.target)) setMenuRequested(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('focusin', handleFocusIn);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, [isOpen]);

  const handleLinkEnter = (
    event: React.MouseEvent<HTMLAnchorElement> | React.FocusEvent<HTMLAnchorElement>,
  ) => {
    hoveringRef.current = true;
    moveIndicatorTo(event.currentTarget);
  };

  const handleLinkLeave = () => {
    hoveringRef.current = false;
    parkIndicator();
  };

  const solid = scrolled || isOpen;

  return (
    <nav
      ref={rootRef}
      className={`fixed top-0 left-0 right-0 z-nav border-b transition-[background-color,border-color,box-shadow] duration-300 ${
        solid
          ? 'bg-cyber-darker border-cyber-primary/10 shadow-lg'
          : 'bg-transparent border-transparent'
      }`}
      aria-label="Primary"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <a
            href="#home"
            className="text-2xl font-bold text-cyber-primary font-mono hover:text-cyber-brand transition-colors"
            aria-label="Home"
          >
            {'<CL />'}
          </a>

          <div
            ref={navRef}
            className="hidden md:flex items-center space-x-1 relative"
            onMouseLeave={handleLinkLeave}
          >
            <motion.div
              aria-hidden="true"
              className="absolute left-0 top-0 h-full rounded-lg bg-cyber-brand/15 border border-cyber-brand/40 pointer-events-none"
              initial={false}
              animate={indicator}
              transition={INDICATOR_SPRING}
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
                  onMouseEnter={handleLinkEnter}
                  onFocus={handleLinkEnter}
                  onBlur={handleLinkLeave}
                  aria-current={isActive ? 'location' : undefined}
                  className={`relative z-10 px-4 py-2 rounded-lg font-mono text-[13px] transition-colors duration-200 ${
                    isActive
                      ? 'text-cyber-brand'
                      : 'text-cyber-secondary hover:text-cyber-primary'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </div>

          <div className="md:hidden">
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMenuRequested((open) => !open)}
              className="text-cyber-primary hover:text-cyber-secondary transition-colors p-2 -m-2 rounded-lg"
              aria-label={isOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isOpen}
              aria-controls={MOBILE_MENU_ID}
            >
              {isOpen ? <X size={28} aria-hidden="true" /> : <Menu size={28} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu: fade + slide only. Animating `height: auto` made framer-motion
          measure the element with a scrollTo(0,0) round-trip, which cancelled the
          in-flight smooth scroll of the anchor link that closed the menu.
          Fully opaque: a translucent panel let the hero text show through. */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id={MOBILE_MENU_ID}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="md:hidden bg-cyber-darker border-t border-cyber-primary/20 max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain"
          >
            <ul className="px-4 py-4 space-y-1">
              {navItems.map((item) => {
                const isActive = activeHref === item.href;
                return (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      onClick={() => setMenuRequested(false)}
                      aria-current={isActive ? 'location' : undefined}
                      className={`flex min-h-[48px] items-center py-2 px-3 rounded-lg font-mono text-sm transition-colors hover:bg-cyber-brand/10 ${
                        isActive
                          ? 'text-cyber-brand bg-cyber-brand/10'
                          : 'text-cyber-secondary hover:text-cyber-primary'
                      }`}
                    >
                      {item.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
