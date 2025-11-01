'use client';

import { motion } from 'framer-motion';
import { Github, ExternalLink, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';

interface ProjectCardProps {
  title: string;
  description: string;
  tech: string[];
  github?: string;
  demo?: string;
  featured?: boolean;
  imagePath?: string;
  index: number;
}

export default function ProjectCard({
  title,
  description,
  tech,
  github,
  demo,
  featured = false,
  imagePath,
  index,
}: ProjectCardProps) {
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
      {/* Image Container */}
      <div className="relative w-full h-64 bg-cyber-dark/30 overflow-hidden group">
        {imagePath ? (
          <Image
            src={imagePath}
            alt={title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          // Image placeholder
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
        
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-cyber-primary/0 group-hover:bg-cyber-primary/10 transition-all duration-300" />
        
        {/* Featured badge */}
        {featured && (
          <div className="absolute top-4 right-4 bg-cyber-primary text-cyber-darker px-3 py-1 rounded-full text-xs font-bold">
            FEATURED
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-cyber-primary transition-colors">
          {title}
        </h3>
        
        <p className="text-gray-300 mb-4 leading-relaxed">
          {description}
        </p>

        {/* Tech stack */}
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

        {/* Links */}
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
