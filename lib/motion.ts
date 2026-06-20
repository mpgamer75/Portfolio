import type { Variants } from 'framer-motion';

/**
 * Shared scroll-reveal motion vocabulary.
 *
 * Everything here is transform/opacity-only and one-shot (`viewport.once`), so it
 * composites cheaply and never repaints on scroll-back. Reduced-motion is handled
 * by the global MotionConfigProvider plus explicit guards in `Reveal`.
 */

/** Ease-out curve — matches the Folder component's tween feel. */
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Standard one-shot viewport config: fire once, when ~20% of the block is visible. */
export const REVEAL_VIEWPORT = { once: true, amount: 0.2 };

/** Parent container that staggers its `<RevealItem>` children. */
export const revealContainer = (stagger = 0.08, delayChildren = 0): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: stagger, delayChildren } },
});

/** Child item for a staggered container (fade + rise). */
export const revealItem: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

/** Standalone fade + rise with an optional delay. */
export const fadeUp = (delay = 0): Variants => ({
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT, delay } },
});

/** Standalone directional fade — for the alternating timeline and two-column blocks. */
export const fadeIn = (dir: 'left' | 'right', delay = 0): Variants => ({
  hidden: { opacity: 0, x: dir === 'left' ? -40 : 40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: EASE_OUT, delay } },
});
