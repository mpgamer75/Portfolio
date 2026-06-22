'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useIsMobile } from '@/hooks/useIsMobile';

const darkenColor = (hex: string, percent: number) => {
  const stripped = hex.startsWith('#') ? hex.slice(1) : hex;
  const expanded =
    stripped.length === 3
      ? stripped.split('').map((c) => c + c).join('')
      : stripped;
  // Fall back to the raw value if it isn't a 6-digit hex (e.g. a CSS var),
  // so the folder back tab still gets a valid colour instead of "#NaN".
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return hex;
  const num = parseInt(expanded, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.max(0, Math.min(255, Math.floor(r * (1 - percent))));
  g = Math.max(0, Math.min(255, Math.floor(g * (1 - percent))));
  b = Math.max(0, Math.min(255, Math.floor(b * (1 - percent))));
  return (
    '#' +
    ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()
  );
};

const PAPER_COLORS = ['#E8F4FD', '#F0F9FF', '#FFFFFF', '#F5F5FF', '#FFF8F0'];
const MAX_ITEMS = 5;

const desktopOpenTransform = [
  'translate(-155%, -120%) rotate(-22deg) scale(1.08)',
  'translate(-58%, -140%) rotate(-9deg) scale(1.12)',
  'translate(58%, -140%) rotate(9deg) scale(1.12)',
  'translate(155%, -120%) rotate(22deg) scale(1.08)',
  'translate(0%, -100%) rotate(0deg) scale(1.15)',
];

const mobileOpenTransform = [
  'translate(-115%, -95%) rotate(-16deg) scale(1.05)',
  'translate(-45%, -110%) rotate(-7deg) scale(1.08)',
  'translate(45%, -110%) rotate(7deg) scale(1.08)',
  'translate(115%, -95%) rotate(16deg) scale(1.05)',
  'translate(0%, -85%) rotate(0deg) scale(1.1)',
];

const closedSizes = [
  'w-[70%] h-[80%]',
  'w-[80%] h-[70%]',
  'w-[90%] h-[60%]',
  'w-[80%] h-[50%]',
  'w-[70%] h-[40%]',
];

const openSizes = [
  'w-[70%] h-[80%]',
  'w-[80%] h-[80%]',
  'w-[90%] h-[80%]',
  'w-[80%] h-[80%]',
  'w-[70%] h-[80%]',
];

interface FolderProps {
  color?: string;
  size?: number;
  items?: React.ReactNode[];
  className?: string;
}

export default function Folder({
  color = '#9CA3AF',
  size = 1,
  items = [],
  className = '',
}: FolderProps) {
  const isMobile = useIsMobile();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);

  const papers = useMemo(() => {
    const padded: Array<React.ReactNode | null> = items.slice(0, MAX_ITEMS);
    while (padded.length < MAX_ITEMS) padded.push(null);
    return padded;
  }, [items]);

  const folderBackColor = useMemo(() => darkenColor(color, 0.08), [color]);
  const transforms = isMobile ? mobileOpenTransform : desktopOpenTransform;

  // Stable transition refs: a useIsMobile flip (or any parent re-render) must
  // not hand framer-motion a fresh object and re-target an in-flight fan-out.
  // Desktop spring is near-critically-damped (settles in fewer frames, no
  // overshoot) instead of the previous bouncy 320/28/0.65.
  const desktopSpring = useMemo(
    () => ({ type: 'spring' as const, stiffness: 210, damping: 30, mass: 0.7 }),
    [],
  );
  const mobileTween = useMemo(
    () => ({
      type: 'tween' as const,
      duration: 0.32,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    }),
    [],
  );
  const instant = useMemo(() => ({ duration: 0 }), []);

  const transition = reduced ? instant : isMobile ? mobileTween : desktopSpring;

  const staggerStep = isMobile ? 0.025 : 0.035;

  const handleToggle = () => setOpen((prev) => !prev);

  return (
    <div style={{ transform: `scale(${size})` }} className={className}>
      <div
        className="relative cursor-pointer select-none group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyber-brand"
        role="button"
        aria-label={open ? 'Close folder' : 'Open folder to view projects'}
        aria-expanded={open}
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        }}
      >
        {/* Soft halo when open — static gradient, no per-frame work. */}
        <AnimatePresence>
          {open && !reduced && (
            <motion.div
              key="halo"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.45 }}
              aria-hidden="true"
              className={`pointer-events-none absolute left-1/2 top-1/2 h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full ${isMobile ? 'blur-lg' : 'blur-xl'}`}
              style={{
                background:
                  'radial-gradient(closest-side, rgba(52,211,153,0.28), rgba(16,185,129,0) 70%)',
              }}
            />
          )}
        </AnimatePresence>

        <motion.div
          animate={{ y: open ? -8 : 0 }}
          whileHover={!open && !isMobile && !reduced ? { y: -8, scale: 1.05 } : undefined}
          transition={transition}
          className="relative w-[100px] h-[80px] rounded-tl-0 rounded-tr-[10px] rounded-br-[10px] rounded-bl-[10px]"
          style={{
            backgroundColor: folderBackColor,
            filter: isMobile
              ? 'drop-shadow(0 4px 12px rgba(0,0,0,0.6)) drop-shadow(0 8px 24px rgba(0,0,0,0.4))'
              : 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))',
          }}
        >
          <span
            className="absolute z-0 bottom-[98%] left-0 w-[30px] h-[10px] rounded-tl-[5px] rounded-tr-[5px]"
            style={{ backgroundColor: folderBackColor }}
          />

          {papers.map((item, i) => {
            const sizeClass = open ? openSizes[i] : closedSizes[i];
            const closedTransform = 'translateX(-50%) translateY(10%)';
            const openTransform = transforms[i];

            return (
              <motion.div
                key={i}
                animate={{
                  transform: open ? openTransform : closedTransform,
                }}
                transition={{
                  ...transition,
                  delay: open && !reduced ? i * staggerStep : 0,
                }}
                whileHover={
                  open && !reduced && !isMobile
                    ? { scale: 1.18, zIndex: 30 }
                    : undefined
                }
                className={`absolute bottom-[10%] left-1/2 ${sizeClass} ${
                  open ? 'ring-1 ring-white/40' : ''
                }`}
                style={{
                  zIndex: 20 + i,
                  backgroundColor: PAPER_COLORS[i] ?? PAPER_COLORS[2],
                  borderRadius: '10px',
                  willChange: open ? 'transform' : 'auto',
                  boxShadow: open
                    ? '0 12px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.15)'
                    : 'none',
                }}
              >
                {item}
              </motion.div>
            );
          })}

          {/* Folder cover — left flap */}
          <motion.div
            animate={{
              transform: open
                ? 'skew(15deg) scaleY(0.6)'
                : 'skew(0deg) scaleY(1)',
            }}
            whileHover={
              !open && !reduced && !isMobile
                ? { transform: 'skew(15deg) scaleY(0.6)' }
                : undefined
            }
            transition={transition}
            className="absolute z-30 w-full h-full origin-bottom"
            style={{
              backgroundColor: color,
              borderRadius: '5px 10px 10px 10px',
            }}
          />
          {/* Folder cover — right flap */}
          <motion.div
            animate={{
              transform: open
                ? 'skew(-15deg) scaleY(0.6)'
                : 'skew(0deg) scaleY(1)',
            }}
            whileHover={
              !open && !reduced && !isMobile
                ? { transform: 'skew(-15deg) scaleY(0.6)' }
                : undefined
            }
            transition={transition}
            className="absolute z-30 w-full h-full origin-bottom"
            style={{
              backgroundColor: color,
              borderRadius: '5px 10px 10px 10px',
            }}
          />
        </motion.div>
      </div>
    </div>
  );
}
