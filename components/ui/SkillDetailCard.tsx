'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Briefcase, FolderGit2, Rocket, X } from 'lucide-react';
import DecryptedText from '@/components/ui/DecryptedText';
import ClusterGlyph from '@/components/three/ClusterGlyph';
import type { SkillUsage } from '@/components/three/skillsMeta';
import type { ClusterGlyph as GlyphShape } from '@/components/three/skillsGraph';

export interface SkillCardData {
  kind: 'skill' | 'domain' | 'project';
  /** Skill name, domain title or project title. */
  title: string;
  /** Small label above the title — the domain name (skill variant). */
  domainLabel: string;
  /** Cluster colour (hex) used for the glyph and the title rule. */
  color: string;
  /** Cluster emblem shape — mirrors the hub glyph in the scene and legend. */
  glyph: GlyphShape;
  blurb: string;
  /** skill variant: where the skill is used. */
  usedIn?: SkillUsage[];
  /** domain variant: the skills in this domain. */
  domainSkills?: string[];
  /** project variant: what it is built with. */
  tech?: string[];
}

interface SkillDetailCardProps {
  data: SkillCardData;
  onClose: () => void;
  /** Opens the matching project's modal (label === projects[].title). */
  onOpenProject: (label: string) => void;
}

const TAG = 'rounded-md bg-white/[0.07] px-2 py-1 text-xs text-cyber-secondary';

/**
 * The star system's detail readout: what is pinned (a domain, a skill or a
 * project ship), set directly over the scene on its right-hand side. There is
 * no box around it: the scene itself fades into the page's dark behind the
 * text (a scrim with no edge), which keeps it legible over whatever the camera
 * is looking at. The text slides in from the right.
 */
export default function SkillDetailCard({ data, onClose, onOpenProject }: SkillDetailCardProps) {
  // Vertical centring lives in the motion values (`y: '-50%'`): framer writes an
  // inline transform, which would override a Tailwind translate utility here.
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="pointer-events-none absolute inset-0 z-20"
    >
      {/* Scrim: the right-hand side of the scene sinks into the page colour.
          It has no edge — it thins out to the left, and at the top and bottom
          with the stage itself. */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 w-[calc(min(430px,38%)+12rem)] bg-[linear-gradient(to_left,rgba(5,8,20,0.96),rgba(5,8,20,0.93)_66%,rgba(5,8,20,0.55)_85%,transparent)] [mask-image:linear-gradient(to_bottom,transparent,black_18%,black_80%,transparent)]"
      />
      <motion.div
        data-skill-card=""
        initial={{ x: 24, y: '-50%' }}
        animate={{ x: 0, y: '-50%' }}
        exit={{ x: 24, y: '-50%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        className="pointer-events-auto absolute right-3 top-1/2 flex max-h-[78%] w-[min(430px,38%)] flex-col font-mono sm:right-6 lg:right-12"
      >
      {/* Single scroller: a long domain list scrolls inside the panel, never the page. */}
      <div className="relative min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain py-2 pl-1 pr-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="absolute right-0 top-0 z-10 flex h-11 w-11 items-center justify-center rounded-full text-cyber-accent transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-brand"
        >
          <X size={18} aria-hidden="true" />
        </button>

        {/* Kind — the same emblem + tint as the body in the scene */}
        <p className="mb-2 flex items-center gap-2 pr-12 text-xs uppercase tracking-[0.18em] text-cyber-accent">
          {data.kind === 'project' ? (
            <Rocket size={12} className="text-cyber-brand" aria-hidden="true" />
          ) : (
            <ClusterGlyph shape={data.glyph} color={data.color} size={11} />
          )}
          {data.kind === 'domain' ? 'Domain' : data.kind === 'project' ? 'Shipped project' : data.domainLabel}
        </p>

        {/* Title (decrypt reveal) over a short rule in the body's colour */}
        <h3 className="mb-3 pr-12 text-2xl font-bold leading-tight text-white lg:text-3xl">
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
        <div aria-hidden="true" className="mb-4 h-px w-14" style={{ backgroundColor: data.color }} />

        <p className="mb-5 text-sm leading-relaxed text-cyber-secondary">{data.blurb}</p>

        {data.kind === 'skill' && (
          <>
            <h4 className="mb-2 text-xs text-cyber-accent">Where I use it</h4>
            <div className="flex flex-wrap gap-1.5">
              {(data.usedIn ?? []).map((u) =>
                u.kind === 'project' ? (
                  <button
                    key={u.label}
                    type="button"
                    onClick={() => onOpenProject(u.label)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-cyber-brand/15 px-2.5 py-1.5 text-xs text-cyber-brand transition-colors hover:bg-cyber-brand/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-brand"
                    title={`Open ${u.label}`}
                  >
                    <FolderGit2 size={12} aria-hidden="true" />
                    {u.label}
                  </button>
                ) : (
                  <span key={u.label} className={`inline-flex items-center gap-1.5 ${TAG} py-1.5 text-cyber-accent`}>
                    <Briefcase size={12} aria-hidden="true" />
                    {u.label}
                  </span>
                ),
              )}
            </div>
          </>
        )}

        {data.kind === 'domain' && (
          <>
            <h4 className="mb-2 text-xs text-cyber-accent">
              {(data.domainSkills?.length ?? 0)} skills in this domain
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {(data.domainSkills ?? []).map((s) => (
                <span key={s} className={TAG}>
                  {s}
                </span>
              ))}
            </div>
          </>
        )}

        {data.kind === 'project' && (
          <>
            <h4 className="mb-2 text-xs text-cyber-accent">Built with</h4>
            <div className="mb-5 flex flex-wrap gap-1.5">
              {(data.tech ?? []).map((t) => (
                <span key={t} className={TAG}>
                  {t}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onOpenProject(data.title)}
              className="group inline-flex min-h-[44px] items-center gap-2 rounded-md bg-cyber-brand px-4 text-sm font-semibold text-cyber-darker transition-colors hover:bg-cyber-brand2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-brand focus-visible:ring-offset-2 focus-visible:ring-offset-cyber-darker"
            >
              Open project
              <ArrowRight size={16} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
            </button>
          </>
        )}
      </div>
      </motion.div>
    </motion.div>
  );
}
