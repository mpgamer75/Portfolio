'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { X, FolderGit2, Briefcase, Link2 } from 'lucide-react';
import DecryptedText from '@/components/ui/DecryptedText';
import ClusterGlyph from '@/components/three/ClusterGlyph';
import type { SkillUsage } from '@/components/three/skillsMeta';
import type { ClusterGlyph as GlyphShape } from '@/components/three/skillsGraph';

export interface SkillCardDomain {
  title: string;
  color: string;
  glyph: GlyphShape;
  count: number;
}

export interface SkillCardData {
  kind: 'skill' | 'domain' | 'core';
  /** Skill name (skill variant), domain title (domain variant) or the system's name (core). */
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
  /** skill variant: skills from other domains it is used with (the scene's dashed arcs). */
  related?: string[];
  /** domain variant: the skills in this domain. */
  domainSkills?: string[];
  /** core variant: the domains of the system. */
  domains?: SkillCardDomain[];
}

interface SkillDetailCardProps {
  data: SkillCardData;
  onClose: () => void;
  /** Opens the matching project's modal (label === projects[].title). */
  onOpenProject: (label: string) => void;
  /** Jumps to another skill or domain by its label (the scene turns to it). */
  onSelect: (label: string) => void;
}

const CHIP_BUTTON =
  'inline-flex items-center gap-1.5 rounded-md border border-cyber-primary/15 bg-cyber-darker px-2 py-1 text-xs text-cyber-secondary transition-colors hover:border-cyber-brand/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-brand';

/**
 * Reactbits-style SpotlightCard used as the constellation's right-side detail
 * panel: a cursor-tracked radial emerald spotlight + glow border, the skill name
 * revealed via DecryptedText, and "where I use it" chips (project buttons open the
 * project modal; role chips are context-only). Slides in from the right.
 */
export default function SkillDetailCard({ data, onClose, onOpenProject, onSelect }: SkillDetailCardProps) {
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
      // A beat late on the way in: the system turns towards the pin first.
      animate={{
        opacity: 1,
        x: 0,
        y: '-50%',
        scale: 1,
        transition: { type: 'spring', stiffness: 320, damping: 30, delay: 0.14 },
      }}
      exit={{ opacity: 0, x: 28, y: '-50%', scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="pointer-events-auto absolute right-3 top-1/2 z-20 flex max-h-[78%] w-[min(440px,38%)] flex-col sm:right-6 lg:right-10"
    >
      <div
        ref={cardRef}
        onPointerEnter={handleEnter}
        onPointerMove={handleMove}
        className="relative flex min-h-0 flex-col overflow-hidden rounded-xl border bg-cyber-darker/95 font-mono shadow-[0_0_40px_rgba(16,185,129,0.14)]"
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
              {(data.related?.length ?? 0) > 0 && (
                <>
                  <h4 className="mb-2 mt-5 flex items-center gap-1.5 text-xs text-cyber-accent">
                    <Link2 size={12} aria-hidden="true" />
                    Works with
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {(data.related ?? []).map((s) => (
                      <button key={s} type="button" onClick={() => onSelect(s)} className={CHIP_BUTTON}>
                        {s}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : data.kind === 'domain' ? (
            <>
              <h4 className="mb-2 text-xs text-cyber-accent">
                {(data.domainSkills?.length ?? 0)} skills in this domain
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {(data.domainSkills ?? []).map((s) => (
                  <button key={s} type="button" onClick={() => onSelect(s)} className={CHIP_BUTTON}>
                    {s}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <h4 className="mb-2 text-xs text-cyber-accent">Domains</h4>
              <div className="flex flex-col gap-1.5">
                {(data.domains ?? []).map((d) => (
                  <button
                    key={d.title}
                    type="button"
                    onClick={() => onSelect(d.title)}
                    className={`${CHIP_BUTTON} justify-between px-2.5 py-2`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <ClusterGlyph shape={d.glyph} color={d.color} size={12} />
                      {d.title}
                    </span>
                    <span className="tabular-nums text-cyber-accent">{d.count}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
