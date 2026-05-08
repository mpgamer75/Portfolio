'use client';

import { useRef } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Terminal, User, Briefcase, FolderGit2, Cpu, Mail } from 'lucide-react';
import { useIsMobile, useReducedMotion } from '@/hooks/useIsMobile';

const ICON_SIZE = 44;
const MAX_SCALE = 1.55;
const INFLUENCE = 130;

const items = [
  { href: '#home', icon: Terminal, key: 'home' as const },
  { href: '#about', icon: User, key: 'about' as const },
  { href: '#experience', icon: Briefcase, key: 'experience' as const },
  { href: '#projects', icon: FolderGit2, key: 'projects' as const },
  { href: '#skills', icon: Cpu, key: 'skills' as const },
  { href: '#contact', icon: Mail, key: 'contact' as const },
];

function DockIcon({
  href,
  Icon,
  label,
  mouseX,
  reduced,
}: {
  href: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  mouseX: MotionValue<number | null>;
  reduced: boolean;
}) {
  const ref = useRef<HTMLAnchorElement>(null);

  const distance = useTransform(mouseX, (val) => {
    if (val === null || !ref.current) return INFLUENCE * 2;
    const rect = ref.current.getBoundingClientRect();
    return val - (rect.left + rect.width / 2);
  });

  const scaleRaw = useTransform(distance, [-INFLUENCE, 0, INFLUENCE], [1, MAX_SCALE, 1]);
  const scale = useSpring(scaleRaw, { stiffness: 220, damping: 18, mass: 0.5 });

  return (
    <motion.a
      ref={ref}
      href={href}
      aria-label={label}
      className="relative flex items-center justify-center rounded-xl bg-cyber-darker/70 border border-cyber-primary/30 hover:border-cyber-primary text-cyber-primary"
      style={{
        width: ICON_SIZE,
        height: ICON_SIZE,
        scale: reduced ? 1 : scale,
      }}
      whileTap={{ scale: 0.92 }}
    >
      <Icon size={20} className="drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]" />
      <span className="pointer-events-none absolute -top-9 whitespace-nowrap rounded-md bg-cyber-darker/95 border border-cyber-primary/30 px-2 py-1 text-[10px] font-mono text-cyber-secondary opacity-0 group-hover:opacity-100 transition-opacity">
        {label}
      </span>
    </motion.a>
  );
}

export default function Dock() {
  const t = useTranslations('nav');
  const isMobile = useIsMobile();
  const reduced = useReducedMotion();
  const mouseX = useMotionValue<number | null>(null);

  if (isMobile) return null;

  return (
    <motion.nav
      aria-label="Section dock"
      onMouseMove={(event) => mouseX.set(event.clientX)}
      onMouseLeave={() => mouseX.set(null)}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.4 }}
      className="hidden md:flex fixed left-1/2 -translate-x-1/2 bottom-6 z-50 items-end gap-2 rounded-2xl border border-cyber-primary/20 bg-cyber-darker/60 backdrop-blur-md px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
    >
      {items.map(({ href, icon: Icon, key }) => (
        <div key={href} className="group">
          <DockIcon
            href={href}
            Icon={Icon}
            label={t(key)}
            mouseX={mouseX}
            reduced={reduced}
          />
        </div>
      ))}
    </motion.nav>
  );
}
