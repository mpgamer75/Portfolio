'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Github, ExternalLink, X, ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';

// Définition du type Project
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

  // Réinitialise le carrousel quand le projet change
  useEffect(() => {
    setCurrentImage(0);
  }, [project]);

  if (!project) return null;

  // CORRECTION: Ces vérifications sont maintenant fiables
  const hasImages = project.imagePaths && project.imagePaths.length > 0;
  const hasMultipleImages = hasImages && project.imagePaths!.length > 1;

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // CORRECTION: Ajout d'une garde
    if (!hasImages) return;
    setCurrentImage((prev) => (prev === project.imagePaths!.length - 1 ? 0 : prev + 1));
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // CORRECTION: Ajout d'une garde
    if (!hasImages) return;
    setCurrentImage((prev) => (prev === 0 ? project.imagePaths!.length - 1 : prev - 1));
  };
  
  // Cette vérification était déjà sûre
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
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="cyber-card project-modal-content" 
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="project-modal-close-button" 
          aria-label="Close project details"
        >
          <X size={32} />
        </button>

        <div className="flex flex-col md:flex-row h-full max-h-[90vh] md:max-h-[600px] w-full max-w-4xl">
          {/* Section Carrousel */}
          <div className="w-full md:w-1/2 h-64 md:h-full relative bg-cyber-darker/50 rounded-t-lg md:rounded-l-lg md:rounded-tr-none overflow-hidden group">
            {hasImages ? (
              <>
                <AnimatePresence initial={false}>
                  <motion.div
                    key={validImageIndex}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="w-full h-full"
                  >
                    <Image
                      // CORRECTION: Suppression du '!' (non-null assertion)
                      src={project.imagePaths![validImageIndex]}
                      alt={`${project.title} - image ${validImageIndex + 1}`}
                      fill
                      className="object-contain" 
                    />
                  </motion.div>
                </AnimatePresence>
                
                {hasMultipleImages && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute top-1/2 left-2 -translate-y-1/2 bg-cyber-darker/50 text-cyber-primary p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-cyber-primary hover:text-cyber-darker"
                      aria-label="Previous Image"
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute top-1/2 right-2 -translate-y-1/2 bg-cyber-darker/50 text-cyber-primary p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-cyber-primary hover:text-cyber-darker"
                      aria-label="Next Image"
                    >
                      <ChevronRight size={24} />
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                      {/* Safely handle optional imagePaths */}
                      {(project.imagePaths || []).map((_, i) => (
                        <div
                          key={i}
                          className={`w-2 h-2 rounded-full transition-all ${
                            i === validImageIndex ? 'bg-cyber-primary scale-125' : 'bg-cyber-primary/50'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-cyber-primary/50">
                <p>Aucune image</p>
              </div>
            )}
          </div>

          {/* Section Détails */}
          <div className="w-full md:w-1/2 p-6 flex flex-col overflow-y-auto">
            {project.featured && (
              <span className="self-start bg-cyber-primary text-cyber-darker px-3 py-1 rounded-full text-xs font-bold mb-3">
                FEATURED
              </span>
            )}
            <h3 className="text-3xl font-bold text-white mb-3">
              {project.title}
            </h3>
            
            <p className="text-gray-300 mb-4 leading-relaxed flex-grow">
              {project.description}
            </p>

            <div className="flex flex-wrap gap-2 mb-6">
              {project.tech.map((item, i) => (
                <span
                  key={i}
                  className="px-3 py-1 text-xs font-mono bg-cyber-primary/10 text-cyber-primary border border-cyber-primary/30 rounded-full"
                >
                  {item}
                </span>
              ))}
            </div>

            <div className="flex gap-4 mt-auto">
              {project.github && (
                <a
                  href={project.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-gray-300 hover:text-cyber-primary transition-colors"
                >
                  <Github size={20} />
                  <span className="text-sm font-semibold">Code</span>
                </a>
              )}
              {project.demo && (
                <a
                  href={project.demo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-gray-300 hover:text-cyber-secondary transition-colors"
                >
                  <ExternalLink size={20} />
                  <span className="text-sm font-semibold">Demo</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}