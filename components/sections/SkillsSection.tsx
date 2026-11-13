'use client';

import { useCallback, useId, useState } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, FolderGit2, Github, GraduationCap, Terminal } from 'lucide-react';
import CertificationCard from '@/components/ui/CertificationCard';
import SectionHeading from '@/components/ui/SectionHeading';
import { Reveal, RevealItem } from '@/components/ui/Reveal';
import { useProjectModal } from '@/components/ui/ProjectModalProvider';
import SkillsConstellationGate, {
  type SkillsDisplayMode,
} from '@/components/three/SkillsConstellationGate';
import ClusterGlyph from '@/components/three/ClusterGlyph';
import { getSkillMeta } from '@/components/three/skillsMeta';
import { EASE_OUT } from '@/lib/motion';
import { certifications } from './certificationsData';
import { projects } from './projectsData';

type GlyphShape = 'circle' | 'diamond' | 'hexagon' | 'triangle';

interface SkillCategory {
  title: string;
  context: string;
  /** Domain emblem + tint. Mirrors the constellation's clusters (skillsGraph.ts). */
  glyph: GlyphShape;
  color: string;
  items: string[];
}

// The accessible, on-page source of truth for the skill lists. The constellation
// keeps its own copy in components/three/skillsGraph.ts — keep the two in sync.
const skillCategories: SkillCategory[] = [
  {
    title: 'Security & Systems',
    context: 'Applied across SOC and vulnerability-management work',
    glyph: 'circle',
    color: '#34D399',
    items: ['Kali Linux', 'Linux', 'Nmap', 'Wireshark', 'Metasploit', 'Fortinet', 'Trellix EDR', 'OSINT'],
  },
  {
    title: 'Programming',
    context: 'Languages behind my tooling & automation work',
    glyph: 'diamond',
    color: '#A7F3D0',
    items: ['C', 'C#', 'Java', 'JavaScript', 'TypeScript', 'PowerShell', 'Python', 'SQL', 'Bash'],
  },
  {
    title: 'Web Development',
    context: 'Shipped SABER and this portfolio',
    glyph: 'hexagon',
    color: '#2DD4BF',
    items: ['Next.js', 'React', 'Node.js', 'Vercel', 'REST API'],
  },
  {
    title: 'Tools & Platforms',
    context: 'Daily drivers for builds, labs and AD',
    glyph: 'triangle',
    color: '#059669',
    items: ['Git', 'GitHub', 'Docker', 'TryHackMe', 'Hack The Box', 'Active Directory'],
  },
];

/**
 * One domain card for the cards display (phones, reduced motion, no WebGL).
 * Skill chips are toggle buttons — one selection per card — and the selected
 * skill opens an inline panel with its blurb and where it is used, so the
 * content of the constellation's detail card is reachable without the 3D scene.
 */
function SkillCategoryCard({ category }: { category: SkillCategory }) {
  const [selected, setSelected] = useState<string | null>(null);
  const { openProject } = useProjectModal();
  const panelId = useId();
  const meta = selected ? getSkillMeta(selected) : null;

  return (
    <div className="cyber-card h-full rounded-lg p-4 sm:p-5 md:p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-cyber-brand/10">
          <ClusterGlyph shape={category.glyph} color={category.color} size={20} />
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-white sm:text-xl">{category.title}</h3>
          <p className="mt-0.5 font-mono text-xs text-cyber-accent">{category.context}</p>
        </div>
      </div>

      <ul className="flex flex-wrap gap-2" aria-label={`${category.title} skills`}>
        {category.items.map((skill) => {
          const isSelected = selected === skill;
          return (
            <li key={skill}>
              <button
                type="button"
                aria-pressed={isSelected}
                aria-controls={panelId}
                onClick={() => setSelected(isSelected ? null : skill)}
                className={`inline-flex min-h-[36px] items-center rounded-lg border px-3 font-mono text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-brand sm:text-sm ${
                  isSelected
                    ? 'border-cyber-brand bg-cyber-brand/15 text-cyber-brand'
                    : 'border-cyber-primary/20 bg-cyber-darker text-cyber-secondary hover:border-cyber-brand/60 hover:text-cyber-primary'
                }`}
              >
                {skill}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Inline detail panel. The wrapper is always present so the selection is
          announced; the content enters with opacity/y only (no height animation). */}
      <div id={panelId} aria-live="polite">
        {selected && meta && (
          <motion.div
            key={selected}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="mt-4 rounded-lg border border-cyber-brand/25 bg-cyber-darker p-3 sm:p-4"
          >
            <p className="font-mono text-sm font-bold text-white">{selected}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-cyber-secondary">{meta.blurb}</p>
            {meta.usedIn.length > 0 && (
              <>
                <p className="mb-2 mt-3 font-mono text-xs text-cyber-accent">Where I use it</p>
                <ul className="flex flex-wrap gap-2">
                  {meta.usedIn.map((usage) => {
                    const project =
                      usage.kind === 'project'
                        ? projects.find((p) => p.title === usage.label)
                        : undefined;
                    return (
                      <li key={usage.label}>
                        {project ? (
                          <button
                            type="button"
                            onClick={() => openProject(project)}
                            aria-label={`Open project ${usage.label}`}
                            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-cyber-brand/40 bg-cyber-brand/10 px-2.5 font-mono text-xs text-cyber-brand transition-colors hover:border-cyber-brand hover:bg-cyber-brand/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-brand"
                          >
                            <FolderGit2 size={12} aria-hidden="true" />
                            {usage.label}
                          </button>
                        ) : (
                          <span className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-cyber-primary/15 bg-white/5 px-2.5 font-mono text-xs text-cyber-accent">
                            <Briefcase size={12} aria-hidden="true" />
                            {usage.label}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default function SkillsSection() {
  // 'pending' until the gate reports; cards are hidden on desktop only while the
  // 3D scene is (or may be) showing, so reduced-motion / no-WebGL desktops still
  // get a visible skills list instead of an empty section.
  const [mode, setMode] = useState<SkillsDisplayMode | 'pending'>('pending');
  const handleModeChange = useCallback((next: SkillsDisplayMode) => setMode(next), []);
  const show3D = mode === '3d';
  // Cards (and their hint) show below md always, and on desktop in cards mode.
  const cardsVisibility = mode === 'cards' ? '' : 'md:hidden';

  return (
    <section id="skills" className="relative py-12 sm:py-16 md:py-20">
      {/* Single full-width child: the section itself is display:flex (globals.css). */}
      <div className="w-full">
        {/* Heading (centered column) */}
        <Reveal className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading text="Skills" speed={60} />
        </Reveal>

        {/* 3D constellation — full-width and unboxed; desktop-only & render-gated.
            On mobile / reduced-motion the gate renders nothing and the cards below take over.
            The scene announces its own selection to assistive tech. */}
        <SkillsConstellationGate onModeChange={handleModeChange} />
        {show3D && (
          <p className="text-center text-cyber-accent font-mono text-xs sm:text-sm mt-3 mb-12 md:mb-16 px-4">
            drag to spin · hover a domain to unfold it · click to bring it forward
          </p>
        )}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Skill cards — the always-accessible display. Hidden on desktop only while
              the constellation is showing (reduced motion / no WebGL keep them). */}
          <p className={`mb-4 text-center font-mono text-xs text-cyber-accent sm:text-sm ${cardsVisibility}`}>
            &gt; <span className="md:hidden">tap</span>
            <span className="hidden md:inline">click</span> a skill to see where I use it
          </p>
          <Reveal
            stagger
            className={`grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 ${cardsVisibility}`}
          >
            {skillCategories.map((category) => (
              <RevealItem key={category.title}>
                <SkillCategoryCard category={category} />
              </RevealItem>
            ))}
          </Reveal>

          {/* Screen-reader fallback while the (decorative) constellation replaces the cards. */}
          {show3D && (
            <ul className="sr-only" aria-label="Skills by domain">
              {skillCategories.map((category) => (
                <li key={category.title}>
                  {category.title}: {category.items.join(', ')}
                </li>
              ))}
            </ul>
          )}

          {/* Certifications */}
          <Reveal className="mt-12 sm:mt-16">
            <h3 className="mb-5 text-center font-mono text-xs tracking-widest text-cyber-brand/80 sm:mb-6 sm:text-sm">
              {'// certifications'}
            </h3>
            <ul className="mx-auto grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-3">
              {certifications.map((certification) => (
                <CertificationCard key={certification.name} certification={certification} />
              ))}
            </ul>
          </Reveal>

          {/* Profiles & study — one readout row. */}
          <Reveal className="mt-10 sm:mt-14 md:mt-16">
            <ul className="mx-auto flex max-w-4xl flex-col items-start gap-1 border-y border-cyber-primary/10 py-3 font-mono text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-10 sm:gap-y-2 sm:text-base">
              <li>
                <a
                  href="https://github.com/mpgamer75"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex min-h-[44px] items-center gap-2 rounded-md px-1 text-cyber-secondary transition-colors hover:text-cyber-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-brand"
                >
                  <Github size={16} className="text-cyber-brand" aria-hidden="true" />
                  GitHub
                  <span className="text-cyber-accent">· 20 public repos</span>
                  <span aria-hidden="true" className="text-cyber-accent transition-transform group-hover:translate-x-0.5">→</span>
                </a>
              </li>
              <li>
                <a
                  href="https://tryhackme.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex min-h-[44px] items-center gap-2 rounded-md px-1 text-cyber-secondary transition-colors hover:text-cyber-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-brand"
                >
                  <Terminal size={16} className="text-cyber-brand" aria-hidden="true" />
                  TryHackMe
                  <span className="text-cyber-accent">· ongoing labs</span>
                  <span aria-hidden="true" className="text-cyber-accent transition-transform group-hover:translate-x-0.5">→</span>
                </a>
              </li>
              <li>
                <a
                  href="https://www.hackthebox.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex min-h-[44px] items-center gap-2 rounded-md px-1 text-cyber-secondary transition-colors hover:text-cyber-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyber-brand"
                >
                  <Terminal size={16} className="text-cyber-brand" aria-hidden="true" />
                  Hack The Box
                  <span className="text-cyber-accent">· preparing for the CPTS</span>
                  <span aria-hidden="true" className="text-cyber-accent transition-transform group-hover:translate-x-0.5">→</span>
                </a>
              </li>
              <li className="inline-flex min-h-[44px] items-center gap-2 px-1 text-cyber-secondary">
                <GraduationCap size={16} className="flex-shrink-0 text-cyber-brand" aria-hidden="true" />
                <span>
                  <span className="whitespace-nowrap">ECE Paris</span>{' '}
                  <span className="text-cyber-accent">· Cybersecurity Engineering graduate</span>
                </span>
              </li>
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
