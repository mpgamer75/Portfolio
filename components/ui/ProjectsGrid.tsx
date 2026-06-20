'use client';

import type { Project } from '@/components/sections/projectsData';
import ProjectCard from './ProjectCard';

interface ProjectsGridProps {
  projects: Project[];
  isMobile?: boolean;
  onOpen: (project: Project) => void;
}

/** Flat, responsive gallery of every project — the "see them all at once" view. */
export default function ProjectsGrid({ projects, isMobile, onOpen }: ProjectsGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
      {projects.map((project, i) => (
        <ProjectCard
          key={project.title}
          project={project}
          index={i}
          isMobile={isMobile}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
