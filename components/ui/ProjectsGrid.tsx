'use client';

import type { Project } from '@/components/sections/projectsData';
import ProjectCard from './ProjectCard';

interface ProjectsGridProps {
  projects: Project[];
  isMobile?: boolean;
  onOpen: (project: Project) => void;
}

/**
 * Column placement for one card. Every card is the same size (two tracks wide);
 * an incomplete last row is centred instead of left-aligned:
 *  - `sm` (4 tracks, 2 cards per row): a lone last card starts at track 2.
 *  - `lg` (6 tracks, 3 cards per row): the first card of the last row is offset
 *    by the remainder (1 left over -> track 3, 2 left over -> track 2).
 * Class names are written out in full so Tailwind can see them.
 */
function placement(index: number, total: number): string {
  const smOrphan = total % 2 === 1 && index === total - 1;
  const lgRemainder = total % 3;
  const lgRowStart = lgRemainder > 0 && index === total - lgRemainder;

  let cls = 'sm:col-span-2';
  if (smOrphan) cls += ' sm:col-start-2';
  if (lgRowStart) cls += lgRemainder === 1 ? ' lg:col-start-3' : ' lg:col-start-2';
  else if (smOrphan) cls += ' lg:col-start-auto';
  return cls;
}

/** Flat, responsive gallery of every project — the "see them all at once" view. */
export default function ProjectsGrid({ projects, isMobile, onOpen }: ProjectsGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6 max-w-5xl mx-auto">
      {projects.map((project, i) => (
        <ProjectCard
          key={project.title}
          project={project}
          index={i}
          isMobile={isMobile}
          onOpen={onOpen}
          className={placement(i, projects.length)}
        />
      ))}
    </div>
  );
}
