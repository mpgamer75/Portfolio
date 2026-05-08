'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import Folder from '@/components/ui/Folder';
import ProjectDetailModal, { type Project } from '@/components/ui/ProjectDetailModal';
import SplitText from '@/components/ui/SplitText';
import { useIsMobile } from '@/hooks/useIsMobile';

export default function ProjectsSection() {
  const t = useTranslations('projects');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const isMobile = useIsMobile();

  const projects = t.raw('items') as Project[];

  const folderItems = projects.map((project, index) => (
    <button
      key={index}
      type="button"
      className="w-full h-full rounded-lg overflow-hidden relative cursor-pointer group block text-left"
      onClick={(e) => {
        e.stopPropagation();
        setSelectedProject(project);
      }}
      aria-label={`Open ${project.title} details`}
    >
      <div className="w-full h-full bg-gradient-to-br from-white via-gray-50 to-gray-100 rounded-lg flex flex-col items-center justify-between p-2 sm:p-3 transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-2xl border-2 border-gray-300 group-hover:border-cyber-primary">
        <div className="w-full h-[80px] sm:h-[110px] relative rounded-md overflow-hidden bg-cyber-darker/5 flex items-center justify-center mb-1.5 sm:mb-2">
          {project.imagePaths && project.imagePaths.length > 0 ? (
            <div className="relative w-full h-full">
              <Image
                src={project.imagePaths[0]}
                alt=""
                fill
                className="object-contain p-1"
                sizes="(max-width: 640px) 150px, 200px"
                loading="lazy"
                quality={isMobile ? 50 : 75}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-gray-400 p-2">
              <svg
                className="w-8 h-8 sm:w-10 sm:h-10 mb-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-[8px] sm:text-[9px] font-mono text-center">{t('noPreview')}</p>
            </div>
          )}
        </div>
        <div className="w-full bg-white/90 backdrop-blur-sm rounded-md px-1.5 sm:px-2 py-1 sm:py-1.5">
          <h4 className="text-cyber-darker text-[9px] sm:text-[10px] font-bold text-center truncate mb-0.5 sm:mb-1">
            {project.title}
          </h4>
          <div className="flex justify-center gap-1 flex-wrap">
            {project.tech.slice(0, 2).map((tech, i) => (
              <span
                key={i}
                className="text-[6px] sm:text-[7px] font-mono text-gray-600 bg-gray-200 px-1 py-0.5 rounded"
              >
                {tech}
              </span>
            ))}
            {project.tech.length > 2 && (
              <span className="text-[6px] sm:text-[7px] font-mono text-gray-600 bg-gray-200 px-1 py-0.5 rounded">
                +{project.tech.length - 2}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="absolute inset-0 bg-cyber-primary/0 group-hover:bg-cyber-primary/10 transition-colors duration-300 rounded-lg pointer-events-none" />
    </button>
  ));

  return (
    <>
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
            <SplitText className="text-cyber-primary">{t('title')}</SplitText>
          </h2>
          <div className="w-20 sm:w-24 h-1 bg-cyber-primary mx-auto mb-8 sm:mb-12 md:mb-16 cyber-neon" />

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2, type: 'spring' }}
            className="flex justify-center items-center h-48 sm:h-56 md:h-64"
          >
            <Folder color="var(--cyber-accent)" size={isMobile ? 2 : 3} items={folderItems} />
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-center text-cyber-primary text-readable font-mono mt-16 sm:mt-24 md:mt-32 text-base sm:text-lg md:text-xl font-bold animate-pulse"
          >
            {t('openHint')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-center mt-8 sm:mt-10 md:mt-12"
          >
            <a
              href="https://github.com/mpgamer75"
              target="_blank"
              rel="noopener noreferrer"
              className="cyber-button rounded-lg inline-block"
              aria-label={t('viewMore')}
            >
              {t('viewMore')}
            </a>
          </motion.div>
        </motion.div>
      </section>

      <AnimatePresence>
        {selectedProject && (
          <ProjectDetailModal
            key={selectedProject.title}
            project={selectedProject}
            onClose={() => setSelectedProject(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
