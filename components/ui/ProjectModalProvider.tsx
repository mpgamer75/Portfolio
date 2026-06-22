'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import ProjectDetailModal from '@/components/ui/ProjectDetailModal';
import type { Project } from '@/components/sections/projectsData';

interface ProjectModalContextValue {
  openProject: (project: Project) => void;
  closeProject: () => void;
}

const ProjectModalContext = createContext<ProjectModalContextValue | null>(null);

/** Access the page-level project modal. Must be used within <ProjectModalProvider>. */
export function useProjectModal(): ProjectModalContextValue {
  const ctx = useContext(ProjectModalContext);
  if (!ctx) throw new Error('useProjectModal must be used within ProjectModalProvider');
  return ctx;
}

/**
 * Hoists the single ProjectDetailModal to page scope so any section (the Projects
 * grid/folder AND the Skills constellation's detail card) can open it. The modal
 * renders OUTSIDE the transformed <main> so its fixed overlay is viewport-anchored.
 * `closeProject` is a stable identity, so the modal's focus/keydown effect never
 * re-runs from an unrelated re-render.
 */
export default function ProjectModalProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<Project | null>(null);
  const openProject = useCallback((project: Project) => setSelected(project), []);
  const closeProject = useCallback(() => setSelected(null), []);
  const value = useMemo(() => ({ openProject, closeProject }), [openProject, closeProject]);

  return (
    <ProjectModalContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {selected && (
          <ProjectDetailModal key={selected.title} project={selected} onClose={closeProject} />
        )}
      </AnimatePresence>
    </ProjectModalContext.Provider>
  );
}
