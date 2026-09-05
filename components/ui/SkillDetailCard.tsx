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

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--sx', `${e.clientX - r.left}px`);
    el.style.setProperty('--sy', `${e.clientY - r.top}px`);
  };

  return (
    <motion.div
      key={data.title}
      initial={{ opacity: 0, x: 28, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 28, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="pointer-events-auto absolute right-3 top-1/2 z-20 w-[min(440px,38%)] max-h-[78%] -translate-y-1/2 sm:right-6 lg:right-10"
    >
      <div
        ref={cardRef}
        onMouseMove={handleMove}
        className="relative overflow-hidden rounded-xl border bg-cyber-darker/92 p-6 font-mono shadow-[0_0_40px_rgba(16,185,129,0.14)] lg:p-7"
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

        <div className="relative">
          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close skill details"
            className="absolute -right-1 -top-1 flex h-11 w-11 items-center justify-center rounded-full text-cyber-accent transition-colors hover:text-cyber-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-brand"
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
