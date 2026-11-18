'use client';

import { motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Briefcase, FileDown, FolderGit2, Rocket, Sun, X } from 'lucide-react';
import DecryptedText from '@/components/ui/DecryptedText';
import ClusterGlyph from '@/components/three/ClusterGlyph';
import type { SkillUsage } from '@/components/three/skillsMeta';
import type { ClusterGlyph as GlyphShape } from '@/components/three/skillsGraph';

/** One line of the readout. `live` names a value the scene keeps up to date. */
export interface CardFact {
  label: string;
  value: string;
  live?: string;
}

export interface CardLink {
  label: string;
  href: string;
  /** `download` saves the file, `anchor` scrolls the page, `external` opens a new tab. */
  kind: 'download' | 'anchor' | 'external';
}

export interface SkillCardData {
  kind: 'skill' | 'domain' | 'project' | 'profile';
  /** Skill name, domain title, project title or the owner's name. */
  title: string;
  /** Small label above the title. */
  domainLabel: string;
  /** Colour (hex) of the body, used for the glyph and the title rule. */
  color: string;
  /** Cluster emblem shape — mirrors the hub glyph in the scene and legend. */
  glyph: GlyphShape;
  blurb: string;
  /** A second, quieter paragraph. */
  detail?: string;
  /** skill variant: where the skill is used. */
  usedIn?: SkillUsage[];
  /** domain variant: the skills in this domain (each opens its moon). */
  domainSkills?: string[];
  /** project variant: what it is built with, and the two domains it flies between. */
  tech?: string[];
  route?: [string, string];
  /** Readout: figures about the body (some of them live). */
  facts?: CardFact[];
  /** One line under the readout saying what the figures are. */
  factsNote?: string;
  links?: CardLink[];
}

interface SkillDetailCardProps {
  data: SkillCardData;
  onClose: () => void;
  /** Opens the matching project's modal (label === projects[].title). */
  onOpenProject: (label: string) => void;
  /** Opens a skill's moon (label === the skill's name). */
  onSelectSkill?: (label: string) => void;
  /** Opens a domain's planet (title === the domain's title). */
  onSelectDomain?: (title: string) => void;
}

/**
 * Live readouts: the elements whose text the scene rewrites while a body is
 * open (speed, altitude, time to arrival…). Written straight to the DOM a few
 * times a second, so none of it goes through React.
 */
const LIVE: Record<string, HTMLElement | null> = {};
export function setLiveReadout(key: string, text: string): void {
  const el = LIVE[key];
  if (el && el.textContent !== text) el.textContent = text;
}

const TAG = 'rounded-md bg-white/[0.07] px-2 py-1 text-xs text-cyber-secondary';
const TAG_BUTTON = `${TAG} transition-colors hover:bg-cyber-brand/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-brand`;
const TEXT_LINK =
  'group inline-flex min-h-[44px] items-center gap-1 text-sm text-cyber-secondary underline decoration-cyber-brand/50 underline-offset-4 transition-colors hover:text-white hover:decoration-cyber-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-brand';
const PRIMARY =
  'group inline-flex min-h-[44px] items-center gap-2 rounded-md bg-cyber-brand px-4 text-sm font-semibold text-cyber-darker transition-colors hover:bg-cyber-brand2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-brand focus-visible:ring-offset-2 focus-visible:ring-offset-cyber-darker';
const HEADING = 'mb-2 text-xs text-cyber-accent';

function Kicker({ data }: { data: SkillCardData }) {
  return (
    <p className="mb-2 flex items-center gap-2 pr-12 text-xs uppercase tracking-[0.18em] text-cyber-accent">
      {data.kind === 'project' ? (
        <Rocket size={12} className="text-cyber-brand" aria-hidden="true" />
      ) : data.kind === 'profile' ? (
        <Sun size={12} className="text-cyber-brand" aria-hidden="true" />
      ) : (
        <ClusterGlyph shape={data.glyph} color={data.color} size={11} />
      )}
      {data.domainLabel}
    </p>
  );
}

function Readout({ facts, note }: { facts: CardFact[]; note?: string }) {
  return (
    <div className="mb-4">
      <dl className="grid grid-cols-2 gap-x-5 gap-y-2">
        {facts.map((fact) => (
          <div key={fact.label} className="min-w-0">
            <dt className="text-[11px] uppercase tracking-[0.12em] text-cyber-accent">{fact.label}</dt>
            <dd
              ref={
                fact.live
                  ? (el) => {
                      LIVE[fact.live as string] = el;
                    }
                  : undefined
              }
              className="truncate text-sm tabular-nums text-white"
            >
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
      {note && <p className="mt-2 text-[11px] leading-snug text-cyber-accent/80">{note}</p>}
    </div>
  );
}

function Links({ links }: { links: CardLink[] }) {
  return (
    <>
      {links.map((link) =>
        link.kind === 'download' ? (
          <a key={link.href} href={link.href} download className={PRIMARY}>
            <FileDown size={16} aria-hidden="true" />
            {link.label}
          </a>
        ) : link.kind === 'anchor' ? (
          <a key={link.href} href={link.href} className={TEXT_LINK}>
            {link.label}
            <ArrowRight size={14} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
          </a>
        ) : (
          <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className={TEXT_LINK}>
            {link.label}
            <ArrowUpRight size={14} aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ),
      )}
    </>
  );
}

/**
 * The star system's detail readout: what is open (the star, a domain, a skill
 * or a project ship), set directly over the scene on its right-hand side. There
 * is no box around it: the scene itself fades into the page's dark behind the
 * text (a scrim with no edge), which keeps it legible over whatever the camera
 * is looking at. The text slides in from the right.
 */
export default function SkillDetailCard({
  data,
  onClose,
  onOpenProject,
  onSelectSkill,
  onSelectDomain,
}: SkillDetailCardProps) {
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
        className="pointer-events-auto absolute right-3 top-1/2 flex max-h-[84%] w-[min(430px,38%)] flex-col font-mono sm:right-6 lg:right-12"
      >
        {/* Single scroller: a long panel scrolls inside itself, never the page. */}
        <div className="relative min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain py-2 pl-1 pr-3 [scrollbar-color:rgba(255,255,255,0.2)_transparent] [scrollbar-width:thin]">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="absolute right-0 top-0 z-10 flex h-11 w-11 items-center justify-center rounded-full text-cyber-accent transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-brand"
          >
            <X size={18} aria-hidden="true" />
          </button>

          <Kicker data={data} />

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

          <p className="mb-3 text-sm leading-relaxed text-cyber-secondary">{data.blurb}</p>
          {data.detail && <p className="mb-4 text-sm leading-relaxed text-cyber-accent">{data.detail}</p>}

          {data.kind === 'skill' && (
            <div className="mb-5">
              <h4 className={HEADING}>Where I use it</h4>
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
            </div>
          )}

          {data.kind === 'domain' && (
            <div className="mb-5">
              <h4 className={HEADING}>
                {(data.domainSkills?.length ?? 0)} skills in this domain · pick one to fly to its moon
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {(data.domainSkills ?? []).map((skill) => (
                  <button key={skill} type="button" onClick={() => onSelectSkill?.(skill)} className={TAG_BUTTON}>
                    {skill}
                  </button>
                ))}
              </div>
            </div>
          )}

          {data.facts && data.facts.length > 0 && <Readout facts={data.facts} note={data.factsNote} />}

          {(data.kind === 'project' || (data.links && data.links.length > 0)) && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
              {data.kind === 'project' && (
                <button type="button" onClick={() => onOpenProject(data.title)} className={PRIMARY}>
                  Open project
                  <ArrowRight size={16} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
                </button>
              )}
              {data.links && <Links links={data.links} />}
            </div>
          )}

          {data.kind === 'project' && (
            <div className="mt-5 space-y-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <h4 className="mr-1 text-xs text-cyber-accent">Built with</h4>
                {(data.tech ?? []).map((t) => (
                  <span key={t} className={TAG}>
                    {t}
                  </span>
                ))}
              </div>
              {data.route && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <h4 className="mr-1 text-xs text-cyber-accent">Flies between</h4>
                  <button type="button" onClick={() => onSelectDomain?.(data.route![0])} className={TAG_BUTTON}>
                    {data.route[0]}
                  </button>
                  <span aria-hidden="true" className="text-cyber-accent">
                    ⇄
                  </span>
                  <button type="button" onClick={() => onSelectDomain?.(data.route![1])} className={TAG_BUTTON}>
                    {data.route[1]}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
