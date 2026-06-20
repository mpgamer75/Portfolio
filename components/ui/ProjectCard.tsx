'use client';

import { motion } from 'framer-motion';
import { Github, ExternalLink, Star } from 'lucide-react';
import type { Project } from '@/components/sections/projectsData';
import ProjectPreview from './ProjectPreview';

interface ProjectCardProps {
  project: Project;
  index: number;
  isMobile?: boolean;
  onOpen: (project: Project) => void;
}

/**
 * Grid-view project card. Accessibility pattern: a single full-card overlay button
 * is the primary "open details" action, with the quick GitHub/demo links floated
 * above it (z-20) — so we never nest <a> inside <button>.
 */
export default function ProjectCard({ project, index, isMobile, onOpen }: ProjectCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.05, 0.3) }}
      className="group relative cyber-card rounded-lg overflow-hidden hover-lift"
    >
      {/* Preview */}
      <div className="relative w-full h-32 sm:h-36 bg-cyber-darker/60 border-b border-cyber-primary/15 overflow-hidden">
        <ProjectPreview project={project} isMobile={isMobile} priority={index < 3} />
        {project.featured && (
          <span className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 bg-cyber-brand text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-[0_0_12px_rgba(52,211,153,0.5)]">
            <Star size={9} aria-hidden="true" /> FEATURED
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-3 sm:p-4">
        <h3 className="text-sm sm:text-base font-bold text-white mb-1.5 truncate">{project.title}</h3>
        <div className="flex flex-wrap gap-1 mb-3">
          {project.tech.slice(0, 3).map((t) => (
            <span
              key={t}
              className="text-[9px] sm:text-[10px] font-mono text-cyber-secondary bg-cyber-primary/10 border border-cyber-primary/20 px-1.5 py-0.5 rounded"
            >
              {t}
            </span>
          ))}
          {project.tech.length > 3 && (
            <span className="text-[9px] sm:text-[10px] font-mono text-cyber-accent px-1 py-0.5">
              +{project.tech.length - 3}
            </span>
          )}
        </div>

        {/* Quick links float above the overlay button */}
        <div className="relative z-20 flex items-center gap-3">
          {project.github && (
            <a
              href={project.github}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-cyber-secondary hover:text-cyber-brand transition-colors"
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
              className="text-cyber-secondary hover:text-cyber-brand transition-colors"
              aria-label={`${project.title} live demo`}
            >
              <ExternalLink size={16} aria-hidden="true" />
            </a>
          )}
          <span className="ml-auto text-[10px] font-mono text-cyber-accent group-hover:text-cyber-brand transition-colors">
            details →
          </span>
        </div>
      </div>

      {/* Full-card open action (sits below the quick links) */}
      <button
        type="button"
        onClick={() => onOpen(project)}
        className="absolute inset-0 z-10"
        aria-label={`Open ${project.title} details`}
      />
    </motion.div>
  );
}
