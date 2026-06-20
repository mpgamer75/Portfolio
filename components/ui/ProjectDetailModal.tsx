'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, type PanInfo } from 'framer-motion';
import { Github, ExternalLink, X, ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import type { Project } from '@/components/sections/projectsData';
import { BLUR_DATA_URL } from '@/lib/images';

interface ProjectDetailModalProps {
  project: Project | null;
  onClose: () => void;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function ProjectDetailModal({ project, onClose }: ProjectDetailModalProps) {
  const [currentImage, setCurrentImage] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!project) return;

    previouslyFocused.current = document.activeElement as HTMLElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      // Arrow-key carousel navigation (only when there's more than one image).
      const imgs = project.imagePaths;
      if (imgs && imgs.length > 1) {
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          setCurrentImage((prev) => (prev === imgs.length - 1 ? 0 : prev + 1));
          return;
        }
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          setCurrentImage((prev) => (prev === 0 ? imgs.length - 1 : prev - 1));
          return;
        }
      }

      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          FOCUSABLE_SELECTOR,
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKey);

    requestAnimationFrame(() => {
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        FOCUSABLE_SELECTOR,
      );
      focusable?.[0]?.focus();
    });

    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [project, onClose]);

  if (!project) return null;

  const hasImages = !!project.imagePaths && project.imagePaths.length > 0;
  const hasMultipleImages = hasImages && project.imagePaths!.length > 1;
  const validImageIndex =
    currentImage < (project.imagePaths?.length || 0) ? currentImage : 0;

  const goNext = () => {
    if (!hasImages) return;
    setCurrentImage((prev) => (prev === project.imagePaths!.length - 1 ? 0 : prev + 1));
  };

  const goPrev = () => {
    if (!hasImages) return;
    setCurrentImage((prev) => (prev === 0 ? project.imagePaths!.length - 1 : prev - 1));
  };

  const handleDragEnd = (_event: unknown, info: PanInfo) => {
    if (!hasMultipleImages) return;
    if (info.offset.x < -60) goNext();
    else if (info.offset.x > 60) goPrev();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="project-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-modal-title"
    >
      <motion.div
        ref={dialogRef}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 30 }}
        className="project-modal-content p-0.5 sm:p-1"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Screen-reader announcement for carousel image changes */}
        <div className="sr-only" role="status" aria-live="polite">
          {hasImages
            ? `Image ${validImageIndex + 1} of ${project.imagePaths!.length}`
            : ''}
        </div>

        <button
          onClick={onClose}
          className="project-modal-close-button"
          aria-label="Close project details"
        >
          <X size={24} className="sm:w-8 sm:h-8" aria-hidden="true" />
        </button>

        <div className="flex flex-col md:flex-row h-full w-full overflow-hidden rounded-lg">
          {/* Carousel */}
          <div className="w-full md:w-1/2 h-[300px] sm:h-[400px] md:h-auto relative bg-cyber-darker/80 rounded-t-lg md:rounded-l-lg md:rounded-tr-none overflow-hidden group">
            {hasImages ? (
              <>
                <div className="w-full h-full flex items-center justify-center p-4 sm:p-6 md:p-8">
                  <motion.div
                    className={`relative w-full h-full max-h-[250px] sm:max-h-[350px] md:max-h-[500px] ${
                      hasMultipleImages ? 'cursor-grab active:cursor-grabbing' : ''
                    }`}
                    drag={hasMultipleImages ? 'x' : false}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={reduced ? 0 : 0.15}
                    onDragEnd={handleDragEnd}
                  >
                    <Image
                      src={project.imagePaths![validImageIndex]}
                      alt={`${project.title} screenshot ${validImageIndex + 1}`}
                      fill
                      className="object-contain pointer-events-none select-none"
                      sizes="(max-width: 768px) 90vw, 45vw"
                      priority
                      placeholder="blur"
                      blurDataURL={BLUR_DATA_URL}
                    />
                  </motion.div>
                </div>

                {hasMultipleImages && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        goPrev();
                      }}
                      className="absolute top-1/2 left-2 sm:left-4 -translate-y-1/2 bg-cyber-primary/20 backdrop-blur-sm text-cyber-primary p-3 rounded-full opacity-100 md:opacity-0 group-hover:opacity-100 smooth-transition z-10 hover:bg-cyber-primary hover:text-cyber-darker hover:scale-110 border border-cyber-primary/50 scale-on-hover"
                      aria-label="Previous image"
                    >
                      <ChevronLeft size={20} className="sm:w-7 sm:h-7" aria-hidden="true" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        goNext();
                      }}
                      className="absolute top-1/2 right-2 sm:right-4 -translate-y-1/2 bg-cyber-primary/20 backdrop-blur-sm text-cyber-primary p-3 rounded-full opacity-100 md:opacity-0 group-hover:opacity-100 smooth-transition z-10 hover:bg-cyber-primary hover:text-cyber-darker hover:scale-110 border border-cyber-primary/50 scale-on-hover"
                      aria-label="Next image"
                    >
                      <ChevronRight size={20} className="sm:w-7 sm:h-7" aria-hidden="true" />
                    </button>
                    <div className="absolute bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 flex gap-0.5 sm:gap-1 z-10 bg-cyber-darker/50 backdrop-blur-sm px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full">
                      {(project.imagePaths || []).map((_, i) => (
                        <button
                          key={i}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentImage(i);
                          }}
                          className="w-6 h-6 flex items-center justify-center rounded-full"
                          aria-label={`Image ${i + 1}`}
                          aria-current={i === validImageIndex ? 'true' : undefined}
                        >
                          <span
                            className={`block rounded-full transition-all duration-300 ${
                              i === validImageIndex
                                ? 'w-2.5 h-2.5 sm:w-3 sm:h-3 bg-cyber-brand scale-110 shadow-[0_0_8px_rgba(52,211,153,0.9)]'
                                : 'w-2 h-2 sm:w-2.5 sm:h-2.5 bg-cyber-primary/40 hover:bg-cyber-primary/70'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-cyber-primary/50 p-4 sm:p-6 md:p-8">
                <svg
                  className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 mb-3 sm:mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-base sm:text-lg font-mono">No preview available</p>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="w-full md:w-1/2 p-4 sm:p-6 md:p-8 flex flex-col overflow-y-auto bg-cyber-dark/90 rounded-b-lg md:rounded-r-lg md:rounded-bl-none max-h-[400px] sm:max-h-[500px] md:max-h-[600px]">
            {project.featured && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="self-start bg-cyber-brand text-white px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs font-bold mb-3 sm:mb-4 shadow-[0_0_12px_rgba(52,211,153,0.5)]"
              >
                FEATURED
              </motion.span>
            )}

            <motion.h3
              id="project-modal-title"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 sm:mb-4"
            >
              {project.title}
            </motion.h3>

            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-cyber-secondary mb-4 sm:mb-6 leading-relaxed flex-grow text-sm sm:text-base"
            >
              {project.description}
            </motion.p>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mb-4 sm:mb-6"
            >
              <h4 className="text-xs sm:text-sm font-semibold text-cyber-primary mb-2 sm:mb-3 uppercase tracking-wider">
                Technologies
              </h4>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {project.tech.map((item, i) => (
                  <motion.span
                    key={i}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.4 + i * 0.05 }}
                    className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-mono bg-cyber-primary/10 text-cyber-primary border border-cyber-primary/30 rounded-full hover:bg-cyber-primary/20 hover:border-cyber-primary transition-all duration-300"
                  >
                    {item}
                  </motion.span>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-auto pt-4 sm:pt-6 border-t border-cyber-primary/20"
            >
              <p className="text-[10px] font-mono text-cyber-accent/60 mb-3" aria-hidden="true">
                {hasMultipleImages ? 'Swipe or use ←/→ to browse · Esc to close' : 'Esc to close'}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                {project.github && (
                  <a
                    href={project.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-fx="scan"
                    className="flex items-center justify-center space-x-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-cyber-darker text-cyber-primary border border-cyber-primary/50 rounded-lg hover:bg-cyber-brand hover:text-white hover:border-cyber-brand transition-all duration-300 hover:shadow-[0_0_15px_rgba(52,211,153,0.6)] font-semibold text-sm sm:text-base"
                  >
                    <Github size={18} className="sm:w-5 sm:h-5" aria-hidden="true" />
                    <span>View Code</span>
                  </a>
                )}
                {project.demo && (
                  <a
                    href={project.demo}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-fx="scan"
                    className="flex items-center justify-center space-x-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-cyber-brand text-white rounded-lg hover:bg-cyber-brand2 transition-all duration-300 hover:shadow-[0_0_15px_rgba(52,211,153,0.6)] font-semibold text-sm sm:text-base"
                  >
                    <ExternalLink size={18} className="sm:w-5 sm:h-5" aria-hidden="true" />
                    <span>Live Demo</span>
                  </a>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
