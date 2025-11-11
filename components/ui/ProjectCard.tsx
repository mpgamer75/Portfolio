'use client';

import { useState } from 'react'; // <-- AJOUTÉ
import { motion, AnimatePresence } from 'framer-motion'; // <-- AJOUTÉ AnimatePresence
import { Github, ExternalLink, Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react'; // <-- AJOUTÉ Chevrons
import Image from 'next/image';

interface ProjectCardProps {
  title: string;
  description: string;
  tech: string[];
  github?: string;
  demo?: string;
  featured?: boolean;
  imagePaths?: string[]; // <-- MODIFIÉ (de imagePath à imagePaths)
  index: number;
}

export default function ProjectCard({
  title,
  description,
  tech,
  github,
  demo,
  featured = false,
  imagePaths, // <-- MODIFIÉ
  index,
}: ProjectCardProps) {
  const [currentImage, setCurrentImage] = useState(0); // <-- AJOUTÉ (logique du carrousel)

  const hasImages = imagePaths && imagePaths.length > 0;
  const hasMultipleImages = hasImages && imagePaths.length > 1;

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation(); // Empêche le clic de la carte
    e.preventDefault();
    setCurrentImage((prev) => (prev === imagePaths!.length - 1 ? 0 : prev + 1));
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCurrentImage((prev) => (prev === 0 ? imagePaths!.length - 1 : prev - 1));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      className={`cyber-card rounded-lg overflow-hidden ${
        featured ? 'md:col-span-2' : ''
      }`}
    >
      {/* Image Container - MODIFIÉ AVEC CARROUSEL */}
      <div className="relative w-full h-64 bg-cyber-dark/30 overflow-hidden group">
        {hasImages ? (
          <AnimatePresence initial={false}>
            <motion.div
              key={currentImage}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full"
            >
              <Image
                src={imagePaths[currentImage]}
                alt={`${title} - image ${currentImage + 1}`}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-110"
                priority={index < 2}
              />
            </motion.div>
          </AnimatePresence>
        ) : (
          // Image placeholder (inchangé)
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-cyber-dark/80 to-cyber-darker/80 border-2 border-dashed border-cyber-primary/30">
            <ImageIcon className="text-cyber-primary/50 mb-4" size={48} />
            <p className="text-cyber-primary/50 text-sm font-mono text-center px-4">
              Image du projet
            </p>
            <p className="text-cyber-primary/30 text-xs font-mono mt-2">
              {featured ? '800x400px' : '600x400px'}
            </p>
          </div>
        )}
        
        {/* Navigation du carrousel (AJOUTÉ) */}
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
            {/* Indicateurs (points) */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2 z-10">
              {imagePaths.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === currentImage ? 'bg-cyber-primary scale-125' : 'bg-cyber-primary/50'
                  }`}
                />
              ))}
            </div>
          </>
        )}
        
        {/* Overlay on hover (inchangé) */}
        <div className="absolute inset-0 bg-cyber-primary/0 group-hover:bg-cyber-primary/10 transition-all duration-300" />
        
        {/* Featured badge (inchangé) */}
        {featured && (
          <div className="absolute top-4 right-4 bg-cyber-primary text-cyber-darker px-3 py-1 rounded-full text-xs font-bold z-10">
            FEATURED
          </div>
        )}
      </div>

      {/* Content (inchangé) */}
      <div className="p-6">
        <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-cyber-primary transition-colors">
          {title}
        </h3>
        
        <p className="text-gray-300 mb-4 leading-relaxed">
          {description}
        </p>

        {/* Tech stack (inchangé) */}
        <div className="flex flex-wrap gap-2 mb-6">
          {tech.map((item, i) => (
            <span
              key={i}
              className="px-3 py-1 text-xs font-mono bg-cyber-primary/10 text-cyber-primary border border-cyber-primary/30 rounded-full"
            >
              {item}
            </span>
          ))}
        </div>

        {/* Links (inchangés) */}
        <div className="flex gap-4">
          {github && (
            <a
              href={github}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 text-gray-300 hover:text-cyber-primary transition-colors"
            >
              <Github size={20} />
              <span className="text-sm font-semibold">Code</span>
            </a>
          )}
          {demo && (
            <a
              href={demo}
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
    </motion.div>
  );
}