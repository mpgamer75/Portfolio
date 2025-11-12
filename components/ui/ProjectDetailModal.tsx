'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Github, ExternalLink, X, ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';

type Project = {
  title: string;
  description: string;
  tech: string[];
  github?: string;
  demo?: string;
  featured?: boolean;
  imagePaths?: string[];
};

interface ProjectDetailModalProps {
  project: Project | null;
  onClose: () => void;
}

export default function ProjectDetailModal({ project, onClose }: ProjectDetailModalProps) {
  const [currentImage, setCurrentImage] = useState(0);

  useEffect(() => {
    setCurrentImage(0);
  }, [project]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    
    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  if (!project) return null;

  const hasImages = project.imagePaths && project.imagePaths.length > 0;
  const hasMultipleImages = hasImages && project.imagePaths!.length > 1;

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasImages) return;
    setCurrentImage((prev) => (prev === project.imagePaths!.length - 1 ? 0 : prev + 1));
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasImages) return;
    setCurrentImage((prev) => (prev === 0 ? project.imagePaths!.length - 1 : prev - 1));
  };
  
  const validImageIndex = currentImage < (project.imagePaths?.length || 0) ? currentImage : 0;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="project-modal-backdrop" 
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="project-modal-content p-0.5 sm:p-1" 
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="project-modal-close-button" 
          aria-label="Close"
        >
          <X size={24} className="sm:w-8 sm:h-8" />
        </button>

        <div className="flex flex-col md:flex-row h-full w-full overflow-hidden rounded-lg">
          {/* Section Carrousel */}
          <div className="w-full md:w-1/2 h-[300px] sm:h-[400px] md:h-auto relative bg-cyber-darker/80 rounded-t-lg md:rounded-l-lg md:rounded-tr-none overflow-hidden group">
            {hasImages ? (
              <>
                <div className="w-full h-full flex items-center justify-center p-4 sm:p-6 md:p-8">
                  <motion.div
                    key={validImageIndex}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="relative w-full h-full max-h-[250px] sm:max-h-[350px] md:max-h-[500px]"
                  >
                    <Image
                      src={project.imagePaths![validImageIndex]}
                      alt={`${project.title} - ${validImageIndex + 1}`}
                      fill
                      className="object-contain"
                      sizes="(max-width: 768px) 100vw, 50vw"
                      unoptimized
                      priority
                    />
                  </motion.div>
                </div>
                
                {hasMultipleImages && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute top-1/2 left-2 sm:left-4 -translate-y-1/2 bg-cyber-primary/20 backdrop-blur-sm text-cyber-primary p-2 sm:p-3 rounded-full opacity-100 md:opacity-0 group-hover:opacity-100 transition-all duration-300 z-10 hover:bg-cyber-primary hover:text-cyber-darker hover:scale-110 border border-cyber-primary/50"
                      aria-label="Previous"
                    >
                      <ChevronLeft size={20} className="sm:w-7 sm:h-7" />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute top-1/2 right-2 sm:right-4 -translate-y-1/2 bg-cyber-primary/20 backdrop-blur-sm text-cyber-primary p-2 sm:p-3 rounded-full opacity-100 md:opacity-0 group-hover:opacity-100 transition-all duration-300 z-10 hover:bg-cyber-primary hover:text-cyber-darker hover:scale-110 border border-cyber-primary/50"
                      aria-label="Next"
                    >
                      <ChevronRight size={20} className="sm:w-7 sm:h-7" />
                    </button>
                    <div className="absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5 sm:gap-2 z-10 bg-cyber-darker/50 backdrop-blur-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-full">
                      {(project.imagePaths || []).map((_, i) => (
                        <button
                          key={i}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentImage(i);
                          }}
                          className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full transition-all duration-300 ${
                            i === validImageIndex 
                              ? 'bg-cyber-primary scale-125 shadow-[0_0_8px_rgba(255,255,255,0.8)]' 
                              : 'bg-cyber-primary/40 hover:bg-cyber-primary/70'
                          }`}
                          aria-label={`Image ${i + 1}`}
                        />
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
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-base sm:text-lg font-mono">No preview available</p>
              </div>
            )}
          </div>

          {/* Section Détails */}
          <div className="w-full md:w-1/2 p-4 sm:p-6 md:p-8 flex flex-col overflow-y-auto bg-cyber-dark/90 rounded-b-lg md:rounded-r-lg md:rounded-bl-none max-h-[400px] sm:max-h-[500px] md:max-h-[600px]">
            {project.featured && (
              <motion.span 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="self-start bg-cyber-primary text-cyber-darker px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs font-bold mb-3 sm:mb-4 shadow-[0_0_10px_rgba(255,255,255,0.5)]"
              >
                ⭐ FEATURED
              </motion.span>
            )}
            
            <motion.h3 
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
              className="text-gray-300 mb-4 sm:mb-6 leading-relaxed flex-grow text-sm sm:text-base"
            >
              {project.description}
            </motion.p>

            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mb-4 sm:mb-6"
            >
              <h4 className="text-xs sm:text-sm font-semibold text-cyber-primary mb-2 sm:mb-3 uppercase tracking-wider">Technologies</h4>
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
              className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-auto pt-4 sm:pt-6 border-t border-cyber-primary/20"
            >
              {project.github && (
                <a
                  href={project.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center space-x-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-cyber-darker text-cyber-primary border border-cyber-primary/50 rounded-lg hover:bg-cyber-primary hover:text-cyber-darker transition-all duration-300 hover:shadow-[0_0_15px_rgba(255,255,255,0.5)] font-semibold text-sm sm:text-base"
                >
                  <Github size={18} className="sm:w-5 sm:h-5" />
                  <span>View Code</span>
                </a>
              )}
              {project.demo && (
                <a
                  href={project.demo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center space-x-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-cyber-primary text-cyber-darker rounded-lg hover:bg-cyber-secondary transition-all duration-300 hover:shadow-[0_0_15px_rgba(255,255,255,0.5)] font-semibold text-sm sm:text-base"
                >
                  <ExternalLink size={18} className="sm:w-5 sm:h-5" />
                  <span>Live Demo</span>
                </a>
              )}
            </motion.div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}