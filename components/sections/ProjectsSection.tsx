'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { LayoutGrid, FolderOpen } from 'lucide-react';
import Folder from '@/components/ui/Folder';
import ProjectsGrid from '@/components/ui/ProjectsGrid';
import ProjectPreview from '@/components/ui/ProjectPreview';
import { useProjectModal } from '@/components/ui/ProjectModalProvider';
import { projects } from '@/components/sections/projectsData';
import { useIsMobile } from '@/hooks/useIsMobile';

type ProjectView = 'folder' | 'grid';

export default function ProjectsSection() {
  const [view, setView] = useState<ProjectView>('folder');
  const isMobile = useIsMobile();
  const reduced = useReducedMotion();
  // The project modal is hoisted to page scope (ProjectModalProvider) so the
  // Skills constellation's detail card can open it too.
  const { openProject } = useProjectModal();

  // Memoize the folder cards so the Folder doesn't reset its transitions on re-render.
  const folderItems = useMemo(
    () =>
      projects.map((project, index) => (
        <button
          key={project.title}
          type="button"
          className="w-full h-full rounded-lg overflow-hidden relative cursor-pointer group block text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyber-brand"
          onClick={(e) => {
            e.stopPropagation();
            openProject(project);
          }}
          aria-label={`Open ${project.title} details`}
        >
          <div className="w-full h-full bg-cyber-darker/90 rounded-lg flex flex-col items-center justify-between p-2 sm:p-3 transition-all duration-300 group-hover:scale-[1.02] active:scale-[0.98] group-hover:shadow-[0_0_20px_rgba(52,211,153,0.3)] border border-cyber-primary/30 group-hover:border-cyber-brand/70">
            {/* Image slot — screenshot (blur-up) or an on-brand generated preview */}
            <div className="w-full h-[80px] sm:h-[110px] relative rounded-md overflow-hidden bg-cyber-dark/60 border border-cyber-primary/15 flex items-center justify-center mb-1.5 sm:mb-2">
              <ProjectPreview project={project} isMobile={isMobile} priority={index < 3} />
              {project.featured && (
                <span
                  className="absolute top-1 left-1 z-10 bg-cyber-brand text-white text-[7px] font-bold leading-none px-1 py-0.5 rounded shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                  aria-hidden="true"
                >
                  ★
                </span>
              )}
            </div>
            {/* Title + tech badges */}
            <div className="w-full bg-cyber-darker/70 rounded-md px-1.5 sm:px-2 py-1 sm:py-1.5 border-t border-cyber-primary/15">
              <h4 className="text-cyber-primary text-[10px] sm:text-xs font-bold text-center truncate mb-0.5 sm:mb-1 tracking-wide">
                {project.title}
              </h4>
              <div className="flex justify-center gap-1 flex-wrap">
                {project.tech.slice(0, 2).map((tech, i) => (
                  <span
                    key={i}
                    className="text-[7px] sm:text-[8px] font-mono text-cyber-secondary bg-cyber-primary/10 border border-cyber-primary/20 px-1 py-0.5 rounded"
                  >
                    {tech}
                  </span>
                ))}
                {project.tech.length > 2 && (
                  <span
                    className="text-[7px] sm:text-[8px] font-mono text-cyber-brand bg-cyber-brand/15 border border-cyber-brand/40 px-1 py-0.5 rounded"
                    title={project.tech.slice(2).join(', ')}
                  >
                    +{project.tech.length - 2}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="absolute inset-0 bg-cyber-brand/0 group-hover:bg-cyber-brand/10 transition-colors duration-300 rounded-lg pointer-events-none" />
        </button>
      )),
    [isMobile, openProject],
  );

  return (
    <section
      id="projects"
        className="relative py-12 sm:py-16 md:py-20 min-h-screen flex flex-col items-center justify-center px-4"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="w-full"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-3 sm:mb-4 cyber-scan">
            <span className="text-cyber-primary">Projects</span>
          </h2>
          <div className="w-20 sm:w-24 h-1 bg-cyber-primary mx-auto mb-6 sm:mb-8 cyber-neon" />

          {/* View toggle */}
          <div className="flex justify-center mb-8 sm:mb-10">
            <div
              className="inline-flex items-center gap-1 p-1 rounded-lg border border-cyber-primary/20 bg-cyber-darker/60"
              role="tablist"
              aria-label="Projects view"
            >
              {([
                { id: 'folder' as const, label: 'Folder', Icon: FolderOpen },
                { id: 'grid' as const, label: 'Grid', Icon: LayoutGrid },
              ]).map(({ id, label, Icon }) => {
                const active = view === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setView(id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs sm:text-sm font-mono transition-colors ${
                      active
                        ? 'bg-cyber-brand/15 border border-cyber-brand/40 text-cyber-primary'
                        : 'border border-transparent text-cyber-accent hover:text-cyber-primary'
                    }`}
                  >
                    <Icon size={14} aria-hidden="true" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {view === 'folder' ? (
              <motion.div
                key="folder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <div className="flex justify-center items-center h-48 sm:h-56 md:h-64">
                  <motion.div
                    initial={reduced ? false : { y: 0 }}
                    whileInView={reduced ? undefined : { y: [0, -8, 0] }}
                    viewport={{ once: true, amount: 0.6 }}
                    transition={{ duration: 0.7, delay: 0.5, times: [0, 0.5, 1] }}
                  >
                    <Folder color="#34D399" size={isMobile ? 2 : 3} items={folderItems} />
                  </motion.div>
                </div>

                <p className="text-center text-cyber-accent text-readable font-mono mt-10 sm:mt-14 text-sm sm:text-base">
                  <span className="text-cyber-brand">&gt;</span> click the folder to open ·{' '}
                  {projects.length} projects
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <ProjectsGrid projects={projects} isMobile={isMobile} onOpen={openProject} />
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-center mt-10 sm:mt-12"
          >
            <a
              href="https://github.com/mpgamer75"
              target="_blank"
              rel="noopener noreferrer"
              className="cyber-button inline-block"
              aria-label="View more projects on GitHub"
            >
              View more on GitHub
            </a>
          </motion.div>
        </motion.div>
      </section>
  );
}
