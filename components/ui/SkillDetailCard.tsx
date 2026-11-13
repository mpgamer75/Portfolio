'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { X, FolderGit2, Briefcase } from 'lucide-react';
import DecryptedText from '@/components/ui/DecryptedText';
import ClusterGlyph from '@/components/three/ClusterGlyph';
import type { SkillUsage } from '@/components/three/skillsMeta';
import type { ClusterGlyph as GlyphShape } from '@/components/three/skillsGraph';

export interface SkillCardData {
  kind: 'skill' | 'domain';
  /** Skill name (skill variant) or domain title (domain variant). */
  title: string;
  /** Small label above the title — the domain name. */
  domainLabel: string;
  /** Cluster colour (hex) used for the glyph, spotlight tint and border accent. */
  color: string;
  /** Cluster emblem shape — mirrors the hub glyph in the scene and legend. */
  glyph: GlyphShape;
  blurb: string;
  /** skill variant: where the skill is used. */
  usedIn?: SkillUsage[];
  /** domain variant: the skills in this domain. */
  domainSkills?: string[];
}

interface SkillDetailCardProps {
  data: SkillCardData;
  onClose: () => void;
  /** Opens the matching project's modal (label === projects[].title). */
  onOpenProject: (label: string) => void;
}

/**
 * Reactbits-style SpotlightCard used as the constellation's right-side detail
 * panel: a cursor-tracked radial emerald spotlight + glow border, the skill name
 * revealed via DecryptedText, and "where I use it" chips (project buttons open the
 * project modal; role chips are context-only). Slides in from the right.
 */
export default function SkillDetailCard({ data, onClose, onOpenProject }: SkillDetailCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  // Card origin in client px, measured once per pointer entry (not per move).
  const origin = useRef({ left: 0, top: 0 });

  const handleEnter = () => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    origin.current.left = r.left;
    origin.current.top = r.top;
  };
  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el || e.pointerType !== 'mouse') return;
    el.style.setProperty('--sx', `${e.clientX - origin.current.left}px`);
    el.style.setProperty('--sy', `${e.clientY - origin.current.top}px`);
  };

  // Vertical centring lives in the motion values (`y: '-50%'`): framer writes an
  // inline transform, which would override a Tailwind translate utility here.
  return (
    <motion.div
      data-skill-card=""
      initial={{ opacity: 0, x: 28, y: '-50%', scale: 0.96 }}
      animate={{ opacity: 1, x: 0, y: '-50%', scale: 1 }}
      exit={{ opacity: 0, x: 28, y: '-50%', scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="pointer-events-auto absolute right-3 top-1/2 z-20 flex max-h-[78%] w-[min(440px,38%)] flex-col sm:right-6 lg:right-10"
    >
      <div
        ref={cardRef}
        onPointerEnter={handleEnter}
        onPointerMove={handleMove}
        className="relative flex min-h-0 flex-col overflow-hidden rounded-xl border bg-cyber-darker/92 font-mono shadow-[0_0_40px_rgba(16,185,129,0.14)]"
        style={{ borderColor: `${data.color}66` }}
      >
        {/* Cursor-tracked spotlight (reactbits SpotlightCard) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(340px circle at var(--sx, 80%) var(--sy, 0px), ${data.color}24, transparent 60%)`,
          }}
        />

        {/* Single scroller: a long domain list scrolls inside the card, never the page. */}
        <div className="relative min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain p-6 lg:p-7">
          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close skill details"
            className="absolute right-5 top-5 z-10 flex h-11 w-11 lg:right-6 lg:top-6 items-center justify-center rounded-full text-cyber-accent transition-colors hover:text-cyber-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-brand"
          >
            <X size={18} aria-hidden="true" />
          </button>

          {/* Domain chip — the same emblem + tint as the hub in the scene */}
          <div className="mb-3 pr-10">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-cyber-primary/15 bg-white/5 px-2 py-1 text-xs text-cyber-secondary">
              <ClusterGlyph shape={data.glyph} color={data.color} size={11} />
              {data.kind === 'domain' ? 'Domain' : data.domainLabel}
            </span>
          </div>

          {/* Title (decrypt reveal) */}
          <h3 className="mb-3 text-2xl font-bold leading-tight text-white lg:text-3xl">
            <DecryptedText
              key={data.title}
              text={data.title}
              animateOn="mount"
              speed={38}
              parentClassName="break-words"
              className="text-white"
              encryptedClassName="text-cyber-brand/70"
            />
          </h3>

          {/* Blurb */}
          <p className="mb-5 text-sm leading-relaxed text-cyber-secondary">{data.blurb}</p>

          {data.kind === 'skill' ? (
            <>
              <h4 className="mb-2 text-xs text-cyber-accent">Where I use it</h4>
              <div className="flex flex-wrap gap-1.5">
                {(data.usedIn ?? []).map((u) =>
                  u.kind === 'project' ? (
                    <button
                      key={u.label}
                      type="button"
                      onClick={() => onOpenProject(u.label)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-cyber-brand/40 bg-cyber-brand/10 px-2.5 py-1.5 text-xs text-cyber-brand transition-colors hover:border-cyber-brand hover:bg-cyber-brand/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-brand"
                      title={`Open ${u.label}`}
                    >
                      <FolderGit2 size={12} aria-hidden="true" />
                      {u.label}
                    </button>
                  ) : (
                    <span
                      key={u.label}
                      className="inline-flex items-center gap-1.5 rounded-md border border-cyber-primary/15 bg-white/5 px-2.5 py-1.5 text-xs text-cyber-accent"
                    >
                      <Briefcase size={12} aria-hidden="true" />
                      {u.label}
                    </span>
                  ),
                )}
              </div>
            </>
          ) : (
            <>
              <h4 className="mb-2 text-xs text-cyber-accent">
                {(data.domainSkills?.length ?? 0)} skills in this domain
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {(data.domainSkills ?? []).map((s) => (
                  <span
                    key={s}
                    className="rounded-md border border-cyber-primary/15 bg-cyber-darker px-2 py-1 text-xs text-cyber-secondary"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
