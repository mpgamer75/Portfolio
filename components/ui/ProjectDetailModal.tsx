'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, type PanInfo, type Variants } from 'framer-motion';
import { Github, ExternalLink, X, ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import type { Project } from '@/components/sections/projectsData';
import { BLUR_DATA_URL } from '@/lib/images';
import { EASE_OUT } from '@/lib/motion';

interface ProjectDetailModalProps {
  project: Project | null;
  onClose: () => void;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Details content: one short stagger (opacity + small rise), no scale pops. */
const detailsContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04, delayChildren: 0.04 } },
};

const detailsItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: EASE_OUT } },
};

const CAROUSEL_BUTTON =
  'flex h-11 w-11 items-center justify-center rounded-md border border-cyber-primary/20 bg-cyber-darker text-cyber-primary transition-colors hover:border-cyber-brand hover:text-cyber-brand';

export default function ProjectDetailModal({ project, onClose }: ProjectDetailModalProps) {
  const [currentImage, setCurrentImage] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!project) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    // <html> owns the viewport scroll (it carries overflow-x), so the lock goes
    // there; `scrollbar-gutter: stable` in globals.css prevents a layout shift.
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = 'hidden';

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
        const dialog = dialogRef.current;
        const focusable = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusable.length === 0) {
          event.preventDefault();
          dialog.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        // Focus escaped the dialog (or sits on the panel itself): pull it back in.
        if (!dialog.contains(active) || active === dialog) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
          return;
        }
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKey);

    const raf = requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const first = dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (first ?? dialog).focus();
    });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', handleKey);
      root.style.overflow = previousOverflow;
      const previous = previouslyFocused.current;
      if (previous?.isConnected) previous.focus?.();
    };
  }, [project, onClose]);

  if (!project) return null;

  const imagePaths = project.imagePaths ?? [];
  const hasImages = imagePaths.length > 0;
  const hasMultipleImages = imagePaths.length > 1;
  const validImageIndex = currentImage < imagePaths.length ? currentImage : 0;

  const goNext = () => {
    if (!hasImages) return;
    setCurrentImage((prev) => (prev >= imagePaths.length - 1 ? 0 : prev + 1));
  };

  const goPrev = () => {
    if (!hasImages) return;
    setCurrentImage((prev) => (prev <= 0 ? imagePaths.length - 1 : prev - 1));
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
      transition={{ duration: 0.2 }}
      className="project-modal-backdrop"
      onClick={onClose}
    >
      {/* The panel is the dialog. On phones it is the single scroller; from md
          the row below has a fixed height and only the details pane scrolls. */}
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-modal-title"
        tabIndex={-1}
        initial={{ scale: 0.97, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.97, opacity: 0 }}
        transition={reduced ? { duration: 0 } : { duration: 0.2, ease: EASE_OUT }}
        className="project-modal-content p-0.5 sm:p-1"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Screen-reader announcement for carousel image changes */}
        <div className="sr-only" role="status" aria-live="polite">
          {hasImages ? `Image ${validImageIndex + 1} of ${imagePaths.length}` : ''}
        </div>

        {/* Zero-height sticky rail: keeps the close button in view while the
            panel scrolls on phones. The button positions itself against it. */}
        <div className="sticky top-0 z-20 h-0">
          <button
            type="button"
            onClick={onClose}
            className="project-modal-close-button"
            aria-label="Close project details"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="flex w-full flex-col overflow-hidden rounded-lg md:h-[min(600px,85dvh)] md:flex-row">
          {/* Carousel */}
          <div
            role="group"
            aria-roledescription="carousel"
            aria-label={`${project.title} screenshots`}
            className={`relative flex w-full flex-col overflow-hidden rounded-t-lg bg-cyber-darker/80 md:h-auto md:min-h-0 md:w-1/2 md:rounded-l-lg md:rounded-tr-none ${
              hasImages ? 'h-[38dvh] min-h-[220px]' : 'h-40'
            }`}
          >
            {hasImages ? (
              <>
                <div className="min-h-0 flex-1 p-4 sm:p-6">
                  <motion.div
                    className={`relative h-full w-full ${
                      hasMultipleImages ? 'cursor-grab active:cursor-grabbing' : ''
                    }`}
                    drag={hasMultipleImages ? 'x' : false}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={reduced ? 0 : 0.15}
                    onDragEnd={handleDragEnd}
                  >
                    <Image
                      src={imagePaths[validImageIndex]}
                      alt={`${project.title} screenshot ${validImageIndex + 1}`}
                      fill
                      className="object-contain pointer-events-none select-none"
                      sizes="(max-width: 768px) 90vw, 45vw"
                      priority={validImageIndex === 0}
                      placeholder="blur"
                      blurDataURL={BLUR_DATA_URL}
                    />
                  </motion.div>
                </div>

                {hasMultipleImages && (
                  <div className="flex flex-shrink-0 items-center justify-center gap-4 border-t border-cyber-primary/15 px-3 py-2">
                    <button
                      type="button"
                      onClick={goPrev}
                      className={CAROUSEL_BUTTON}
                      aria-label="Previous image"
                    >
                      <ChevronLeft size={20} aria-hidden="true" />
                    </button>
                    <span
                      aria-hidden="true"
                      className="min-w-[3.5rem] text-center font-mono text-xs tabular-nums text-cyber-secondary select-none"
                    >
                      {validImageIndex + 1} / {imagePaths.length}
                    </span>
                    <button
                      type="button"
                      onClick={goNext}
                      className={CAROUSEL_BUTTON}
                      aria-label="Next image"
                    >
                      <ChevronRight size={20} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center p-4 text-cyber-primary/50 sm:p-6 md:p-8">
                <svg
                  className="mb-3 h-12 w-12 sm:mb-4 md:h-24 md:w-24"
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
                <p className="font-mono text-base sm:text-lg">No preview available</p>
              </div>
            )}
          </div>

          {/* Details */}
          <motion.div
            variants={detailsContainer}
            initial="hidden"
            animate="visible"
            className="flex w-full flex-col rounded-b-lg bg-cyber-dark/90 p-4 sm:p-6 md:min-h-0 md:w-1/2 md:overflow-y-auto md:overscroll-contain md:rounded-r-lg md:rounded-bl-none md:p-8"
          >
            {project.featured && (
              <motion.span
                variants={detailsItem}
                className="mb-3 self-start rounded-full bg-cyber-brand px-3 py-1 text-xs font-bold text-cyber-darker shadow-[0_0_12px_rgba(52,211,153,0.5)] sm:mb-4 sm:px-4 sm:py-1.5"
              >
                FEATURED
              </motion.span>
            )}

            <motion.h3
              id="project-modal-title"
              variants={detailsItem}
              className="mb-3 text-2xl font-bold text-white sm:mb-4 sm:text-3xl md:pr-12 md:text-4xl"
            >
              {project.title}
            </motion.h3>

            <motion.p
              variants={detailsItem}
              className="mb-4 flex-grow text-sm leading-relaxed text-cyber-secondary sm:mb-6 sm:text-base"
            >
              {project.description}
            </motion.p>

            <motion.div variants={detailsItem} className="mb-4 sm:mb-6">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-cyber-primary sm:mb-3 sm:text-sm">
                Technologies
              </h4>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {project.tech.map((item) => (
                  <span
                    key={item}
                    className="rounded-md border border-cyber-primary/30 bg-cyber-primary/10 px-2 py-1 font-mono text-xs text-cyber-primary sm:px-3 sm:py-1.5 sm:text-sm"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </motion.div>

            <motion.div
              variants={detailsItem}
              className="mt-auto border-t border-cyber-primary/20 pt-4 sm:pt-6"
            >
              <p className="mb-3 hidden font-mono text-xs text-cyber-accent/80 md:block" aria-hidden="true">
                {hasMultipleImages ? 'Drag or use ←/→ to browse · Esc to close' : 'Esc to close'}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                {project.github && (
                  <a
                    href={project.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-fx="scan"
                    className="flex min-h-[44px] items-center justify-center space-x-2 rounded-lg border border-cyber-primary/50 bg-cyber-darker px-4 py-2 text-sm font-semibold text-cyber-primary transition-colors duration-300 hover:border-cyber-brand hover:bg-cyber-brand hover:text-cyber-darker sm:px-5 sm:py-2.5 sm:text-base"
                  >
                    <Github size={18} className="sm:h-5 sm:w-5" aria-hidden="true" />
                    <span>View Code</span>
                  </a>
                )}
                {project.demo && (
                  <a
                    href={project.demo}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-fx="scan"
                    className="flex min-h-[44px] items-center justify-center space-x-2 rounded-lg bg-cyber-brand px-4 py-2 text-sm font-semibold text-cyber-darker transition-colors duration-300 hover:bg-cyber-brand2 sm:px-5 sm:py-2.5 sm:text-base"
                  >
                    <ExternalLink size={18} className="sm:h-5 sm:w-5" aria-hidden="true" />
                    <span>Live Demo</span>
                  </a>
                )}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}
