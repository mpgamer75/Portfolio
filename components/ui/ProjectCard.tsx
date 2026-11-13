'use client';

import { Github, ExternalLink, Star } from 'lucide-react';
import type { Project } from '@/components/sections/projectsData';
import ProjectPreview from './ProjectPreview';
import { Reveal } from './Reveal';

interface ProjectCardProps {
  project: Project;
  index: number;
  isMobile?: boolean;
  onOpen: (project: Project) => void;
  /** Grid placement classes from ProjectsGrid (column span / start). */
  className?: string;
}

/**
 * Grid-view project card. Accessibility pattern: a single full-card overlay button
 * is the primary "open details" action, with the quick GitHub/demo links floated
 * above it (z-20) — so we never nest <a> inside <button>.
 *
 * The scroll reveal lives on the outer wrapper and the card itself is a plain
 * element: framer-motion's inline transform would otherwise override the CSS
 * hover lift of `.cyber-card--interactive`.
 */
export default function ProjectCard({ project, index, isMobile, onOpen, className }: ProjectCardProps) {
  // Stagger by column on multi-column layouts only; a phone shows one card at a
  // time, so a per-index delay would just make each card arrive late.
  const delay = isMobile ? 0 : (index % 3) * 0.06;

  return (
    <Reveal delay={delay} className={className}>
      <div className="group relative flex h-full flex-col cyber-card cyber-card--interactive rounded-lg overflow-hidden">
        {/* Preview — fixed-aspect slot; `glare` sweeps once on card hover. */}
        <div className="glare w-full aspect-video bg-cyber-darker border-b border-cyber-primary/15">
          <ProjectPreview project={project} isMobile={isMobile} priority={false} />
          {project.featured && (
            <span className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 bg-cyber-brand text-cyber-darker text-xs font-bold px-1.5 py-0.5 rounded shadow-[0_0_12px_rgba(52,211,153,0.5)]">
              <Star size={11} aria-hidden="true" /> Featured
            </span>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col p-3 sm:p-4">
          <h3
            title={project.title}
            className="text-sm sm:text-base font-bold text-white mb-1.5 line-clamp-2 sm:truncate"
          >
            {project.title}
          </h3>
          <p className="text-xs sm:text-sm text-cyber-accent leading-relaxed line-clamp-2 mb-3">
            {project.tagline ?? project.description}
          </p>
          <div className="flex flex-wrap gap-1 mb-3">
            {project.tech.slice(0, 3).map((t) => (
              <span
                key={t}
                className="text-xs font-mono text-cyber-secondary bg-cyber-primary/10 border border-cyber-primary/20 px-1.5 py-0.5 rounded"
              >
                {t}
              </span>
            ))}
            {project.tech.length > 3 && (
              <span
                title={project.tech.slice(3).join(', ')}
                className="text-xs font-mono text-cyber-brand bg-cyber-brand/15 border border-cyber-brand/40 px-1.5 py-0.5 rounded"
              >
                +{project.tech.length - 3}
              </span>
            )}
          </div>

          {/* Quick links float above the overlay button */}
          <div className="relative z-20 mt-auto flex items-center gap-6 pointer-events-none">
            {project.github && (
              <a
                href={project.github}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="pointer-events-auto -m-3 flex h-11 w-11 items-center justify-center rounded-md text-cyber-secondary hover:text-cyber-brand transition-colors"
                aria-label={`${project.title} source on GitHub`}
              >
                <Github size={16} aria-hidden="true" />
              </a>
            )}
            {project.demo && (
              <a
                href={project.demo}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="pointer-events-auto -m-3 flex h-11 w-11 items-center justify-center rounded-md text-cyber-secondary hover:text-cyber-brand transition-colors"
                aria-label={`${project.title} live demo`}
              >
                <ExternalLink size={16} aria-hidden="true" />
              </a>
            )}
            <span
              aria-hidden="true"
              className="ml-auto inline-flex items-center gap-1 text-xs font-mono text-cyber-accent group-hover:text-cyber-brand transition-colors"
            >
              details
              <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">
                →
              </span>
            </span>
          </div>
        </div>

        {/* Full-card open action (sits below the quick links) */}
        <button
          type="button"
          onClick={() => onOpen(project)}
          className="absolute inset-0 z-10 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyber-brand"
          aria-label={`Open ${project.title} details`}
        />
      </div>
    </Reveal>
  );
}
